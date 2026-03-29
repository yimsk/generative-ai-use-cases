import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { GenerativeAiUseCasesStack } from './generative-ai-use-cases-stack';
import { CloudFrontWafStack } from './cloud-front-waf-stack';
import { DashboardStack } from './dashboard-stack';
import { AgentStack } from './agent-stack';
import { RagKnowledgeBaseStack } from './rag-knowledge-base-stack';
import { GuardrailStack } from './guardrail-stack';
import { AgentCoreStack } from './agent-core-stack';
import { ResearchAgentCoreStack } from './research-agent-core-stack';
import { ProcessedStackInput } from './stack-input';
import { VideoTmpBucketStack } from './video-tmp-bucket-stack';
import { ApplicationInferenceProfileStack } from './application-inference-profile-stack';
import { ClosedNetworkStack } from './closed-network-stack';
import { RemoteOutputs } from 'cdk-remote-stack';
import { REMOTE_OUTPUT_KEYS } from './remote-output-keys';

class DeletionPolicySetter implements cdk.IAspect {
  constructor(private readonly policy: cdk.RemovalPolicy) {}

  visit(node: IConstruct): void {
    if (node instanceof cdk.CfnResource) {
      node.applyRemovalPolicy(this.policy);
    }
  }
}

export const collectUniqueRegions = (
  params: Pick<
    ProcessedStackInput,
    | 'modelIds'
    | 'imageGenerationModelIds'
    | 'videoGenerationModelIds'
    | 'speechToSpeechModelIds'
  >
): string[] => {
  return [
    ...new Set([
      ...params.modelIds.map((model) => model.region),
      ...params.imageGenerationModelIds.map((model) => model.region),
      ...params.videoGenerationModelIds.map((model) => model.region),
      ...params.speechToSpeechModelIds.map((model) => model.region),
    ]),
  ];
};

export const mergeInferenceProfileArns = (
  modelIds: ProcessedStackInput['modelIds'],
  inferenceProfileStacks: Record<string, ApplicationInferenceProfileStack>,
  scope: cdk.App
): ProcessedStackInput['modelIds'] => {
  return modelIds.map((modelId) => {
    const result = { ...modelId };
    const stack = inferenceProfileStacks[modelId.region];
    if (!stack) {
      return result;
    }

    try {
      const remoteOutputs = new RemoteOutputs(
        scope,
        `InferenceProfile-${modelId.region}-RemoteOutputs`,
        {
          stack: stack,
          alwaysUpdate: true,
        }
      );
      const inferenceProfileArnsJson = remoteOutputs.get(
        REMOTE_OUTPUT_KEYS.INFERENCE_PROFILE_ARNS
      );
      if (inferenceProfileArnsJson) {
        const inferenceProfileArns = JSON.parse(inferenceProfileArnsJson);
        const inferenceProfileArn = inferenceProfileArns[modelId.modelId];
        if (inferenceProfileArn) {
          result.inferenceProfileArn = inferenceProfileArn;
        }
      }
    } catch (e) {
      console.debug(
        `Inference profile lookup failed for region ${modelId.region}: ${e instanceof Error ? e.message : String(e)}. Continuing without inference profile.`
      );
    }
    return result;
  });
};

const createInferenceProfileStacks = (
  app: cdk.App,
  params: ProcessedStackInput,
  modelRegions: string[]
): Record<string, ApplicationInferenceProfileStack> => {
  const inferenceProfileStacks: Record<
    string,
    ApplicationInferenceProfileStack
  > = {};
  for (const region of modelRegions) {
    inferenceProfileStacks[region] = new ApplicationInferenceProfileStack(
      app,
      `ApplicationInferenceProfileStack${params.env}${region}`,
      {
        env: {
          account: params.account,
          region,
        },
        params,
      }
    );
  }
  return inferenceProfileStacks;
};

const preprocessParams = (
  app: cdk.App,
  params: ProcessedStackInput,
  inferenceProfileStacks: Record<string, ApplicationInferenceProfileStack>
): ProcessedStackInput => {
  const updatedParams: ProcessedStackInput = JSON.parse(JSON.stringify(params));
  updatedParams.modelIds = mergeInferenceProfileArns(
    params.modelIds,
    inferenceProfileStacks,
    app
  );
  updatedParams.imageGenerationModelIds = mergeInferenceProfileArns(
    params.imageGenerationModelIds,
    inferenceProfileStacks,
    app
  );
  updatedParams.videoGenerationModelIds = mergeInferenceProfileArns(
    params.videoGenerationModelIds,
    inferenceProfileStacks,
    app
  );
  updatedParams.speechToSpeechModelIds = mergeInferenceProfileArns(
    params.speechToSpeechModelIds,
    inferenceProfileStacks,
    app
  );
  return updatedParams;
};

const createRegionScopedResources = (
  app: cdk.App,
  params: ProcessedStackInput
): Record<string, string> => {
  const videoModelRegions = [
    ...new Set(params.videoGenerationModelIds.map((model) => model.region)),
  ];
  const videoBucketRegionMap: Record<string, string> = {};

  for (const region of videoModelRegions) {
    const videoTmpBucketStack = new VideoTmpBucketStack(
      app,
      `VideoTmpBucketStack${params.env}${region}`,
      {
        env: {
          account: params.account,
          region,
        },
        params,
      }
    );
    videoBucketRegionMap[region] = videoTmpBucketStack.bucketName;
  }

  return videoBucketRegionMap;
};

const createFeatureStacks = (
  app: cdk.App,
  params: ProcessedStackInput,
  updatedParams: ProcessedStackInput,
  videoBucketRegionMap: Record<string, string>
) => {
  const isSageMakerStudio = 'SAGEMAKER_APP_TYPE_LOWERCASE' in process.env;

  let closedNetworkStack: ClosedNetworkStack | undefined = undefined;

  if (params.closedNetworkMode) {
    closedNetworkStack = new ClosedNetworkStack(
      app,
      `ClosedNetworkStack${params.env}`,
      {
        env: {
          account: params.account,
          region: params.region,
        },
        params,
        isSageMakerStudio,
      }
    );
  }

  const cloudFrontWafStack =
    (params.allowedIpV4AddressRanges ||
      params.allowedIpV6AddressRanges ||
      params.allowedCountryCodes ||
      params.hostName) &&
    !params.closedNetworkMode
      ? new CloudFrontWafStack(app, `CloudFrontWafStack${params.env}`, {
          env: {
            account: updatedParams.account,
            region: 'us-east-1',
          },
          params: updatedParams,
          crossRegionReferences: true,
        })
      : null;

  const ragKnowledgeBaseStack =
    updatedParams.ragKnowledgeBaseEnabled && !updatedParams.ragKnowledgeBaseId
      ? new RagKnowledgeBaseStack(
          app,
          `RagKnowledgeBaseStack${updatedParams.env}`,
          {
            env: {
              account: updatedParams.account,
              region: updatedParams.modelRegion,
            },
            params: updatedParams,
            crossRegionReferences: true,
          }
        )
      : null;

  if (updatedParams.crossAccountBedrockRoleArn) {
    if (updatedParams.agentEnabled || updatedParams.searchApiKey) {
      throw new Error(
        'When `crossAccountBedrockRoleArn` is specified, the `agentEnabled` and `searchApiKey` parameters are not supported. Please create agents in the other account and specify them in the `agents` parameter.'
      );
    }
  }
  const agentStack = updatedParams.agentEnabled
    ? new AgentStack(app, `WebSearchAgentStack${updatedParams.env}`, {
        env: {
          account: updatedParams.account,
          region: updatedParams.modelRegion,
        },
        params: updatedParams,
        vpc: closedNetworkStack?.vpc,
      })
    : null;

  const guardrailStack = updatedParams.guardrailEnabled
    ? new GuardrailStack(app, `GuardrailStack${updatedParams.env}`, {
        env: {
          account: updatedParams.account,
          region: updatedParams.modelRegion,
        },
        crossRegionReferences: true,
      })
    : null;

  const agentCoreStack =
    params.createGenericAgentCoreRuntime || params.agentBuilderEnabled
      ? new AgentCoreStack(app, `AgentCoreStack${params.env}`, {
          env: {
            account: params.account,
            region: params.agentCoreRegion,
          },
          params: params,
        })
      : null;

  const researchAgentCoreStack = params.researchAgentEnabled
    ? new ResearchAgentCoreStack(app, `ResearchAgentCoreStack${params.env}`, {
        env: {
          account: params.account,
          region: params.agentCoreRegion,
        },
        params: params,
      })
    : null;

  const generativeAiUseCasesStack = new GenerativeAiUseCasesStack(
    app,
    `GenerativeAiUseCasesStack${updatedParams.env}`,
    {
      env: {
        account: updatedParams.account,
        region: updatedParams.region,
      },
      description: updatedParams.anonymousUsageTracking
        ? 'Generative AI Use Cases (uksb-1tupboc48)'
        : undefined,
      params: updatedParams,
      crossRegionReferences: true,
      knowledgeBaseId: ragKnowledgeBaseStack?.knowledgeBaseId,
      knowledgeBaseDataSourceBucketName:
        ragKnowledgeBaseStack?.dataSourceBucketName,
      agentStack: agentStack || undefined,
      createGenericAgentCoreRuntime: params.createGenericAgentCoreRuntime,
      agentBuilderEnabled: params.agentBuilderEnabled,
      agentCoreStack: agentCoreStack || undefined,
      researchAgentEnabled: params.researchAgentEnabled,
      researchAgentCoreStack: researchAgentCoreStack || undefined,
      videoBucketRegionMap,
      guardrailIdentifier: guardrailStack?.guardrailIdentifier,
      guardrailVersion: 'DRAFT',
      webAclId: cloudFrontWafStack?.webAclArn,
      cert: cloudFrontWafStack?.cert,
      isSageMakerStudio,
      vpc: closedNetworkStack?.vpc,
      apiGatewayVpcEndpoint: closedNetworkStack?.apiGatewayVpcEndpoint,
      webBucket: closedNetworkStack?.webBucket,
    }
  );

  if (agentStack) {
    generativeAiUseCasesStack.addDependency(agentStack);
  }
  if (agentCoreStack) {
    generativeAiUseCasesStack.addDependency(agentCoreStack);
  }

  cdk.Aspects.of(generativeAiUseCasesStack).add(
    new DeletionPolicySetter(cdk.RemovalPolicy.DESTROY)
  );

  const dashboardStack = updatedParams.dashboard
    ? new DashboardStack(
        app,
        `GenerativeAiUseCasesDashboardStack${updatedParams.env}`,
        {
          env: {
            account: updatedParams.account,
            region: updatedParams.modelRegion,
          },
          params: updatedParams,
          userPool: generativeAiUseCasesStack.userPool,
          userPoolClient: generativeAiUseCasesStack.userPoolClient,
          appRegion: updatedParams.region,
          crossRegionReferences: true,
        }
      )
    : null;

  return {
    closedNetworkStack,
    cloudFrontWafStack,
    ragKnowledgeBaseStack,
    agentStack,
    guardrailStack,
    agentCoreStack,
    researchAgentCoreStack,
    generativeAiUseCasesStack,
    dashboardStack,
  };
};

export const createStacks = (app: cdk.App, params: ProcessedStackInput) => {
  const modelRegions = collectUniqueRegions(params);

  const inferenceProfileStacks = createInferenceProfileStacks(
    app,
    params,
    modelRegions
  );

  const updatedParams = preprocessParams(app, params, inferenceProfileStacks);

  const videoBucketRegionMap = createRegionScopedResources(app, updatedParams);

  return createFeatureStacks(app, params, updatedParams, videoBucketRegionMap);
};
