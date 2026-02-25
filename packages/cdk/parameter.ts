import * as cdk from 'aws-cdk-lib';
import {
  StackInput,
  stackInputSchema,
  ProcessedStackInput,
} from './lib/stack-input';
import { ModelConfiguration } from 'generative-ai-use-cases';
import { loadBrandingConfig } from './branding';

// Get parameters from CDK Context
const getContext = (app: cdk.App): StackInput => {
  const params = stackInputSchema.parse(app.node.getAllContext());
  return params;
};

// If you want to define parameters directly
const envs: Record<string, Partial<StackInput>> = {
  // If you want to define an anonymous environment, uncomment the following and the content of cdk.json will be ignored.
  // If you want to define an anonymous environment in parameter.ts, uncomment the following and the content of cdk.json will be ignored.
  // '': {
  //   // Parameters for anonymous environment
  //   // If you want to override the default settings, add the following
  // },
  dev: {
    selfSignUpEnabled: true,
    modelIds: [
      'global.anthropic.claude-opus-4-5-20251101-v1:0',
      'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      'global.anthropic.claude-haiku-4-5-20251001-v1:0',
      'global.amazon.nova-2-lite-v1:0',
      // === Custom models (not in upstream GenU) ===
      'deepseek.v3.2',
      'minimax.minimax-m2.1',
      'zai.glm-4.7',
      'zai.glm-4.7-flash',
      'moonshotai.kimi-k2.5',
      'qwen.qwen3-coder-next',
    ],
    imageGenerationModelIds: ['amazon.nova-canvas-v1:0'],
    videoGenerationModelIds: ['amazon.nova-reel-v1:0'],
    speechToSpeechModelIds: ['amazon.nova-sonic-v1:0'],
    agentEnabled: true,
    createGenericAgentCoreRuntime: true,
    ragKnowledgeBaseEnabled: true,
    agentCoreExternalRuntimes: [
      {
        name: '法令Agent',
        arn: 'arn:aws:bedrock-agentcore:us-east-1:767397786624:runtime/lc_agent_dev-G926ztHUBZ',
        description: '法令についてなんでも調べられます',
      },
      {
        name: '自治体仕様書Agent',
        arn: 'arn:aws:bedrock-agentcore:us-east-1:767397786624:runtime/ok_agent_dev-xnSJ2aBTN0',
        description: '自治体標準化の仕様書について調べられます',
      },
      {
        name: '統計Agent',
        arn: 'arn:aws:bedrock-agentcore:us-east-1:767397786624:runtime/estat_agent_dev-hatoXl3TjV',
        description: 'e-Stat政府統計データを検索・取得できます',
      },
    ],
  },
  staging: {
    // Parameters for staging environment
  },
  prod: {
    // Parameters for production environment
  },
  // If you need other environments, customize them as needed
};

// For backward compatibility, get parameters from CDK Context > parameter.ts
export const getParams = (app: cdk.App): ProcessedStackInput => {
  // By default, get parameters from CDK Context
  let params = getContext(app);

  // If the env matches the ones defined in envs, use the parameters in envs instead of the ones in context
  if (envs[params.env]) {
    params = stackInputSchema.parse({
      ...envs[params.env],
      env: params.env,
    });
  }
  // Make the format of modelIds, imageGenerationModelIds consistent
  const convertToModelConfiguration = (
    models: (string | ModelConfiguration)[],
    defaultRegion: string
  ): ModelConfiguration[] => {
    return models.map((model) =>
      typeof model === 'string'
        ? { modelId: model, region: defaultRegion }
        : model
    );
  };

  return {
    ...params,
    modelIds: convertToModelConfiguration(params.modelIds, params.modelRegion),
    imageGenerationModelIds: convertToModelConfiguration(
      params.imageGenerationModelIds,
      params.modelRegion
    ),
    videoGenerationModelIds: convertToModelConfiguration(
      params.videoGenerationModelIds,
      params.modelRegion
    ),
    speechToSpeechModelIds: convertToModelConfiguration(
      params.speechToSpeechModelIds,
      params.modelRegion
    ),
    endpointNames: convertToModelConfiguration(
      params.endpointNames,
      params.modelRegion
    ),
    // Process agentCoreRegion: null -> modelRegion
    agentCoreRegion: params.agentCoreRegion || params.modelRegion,
    // Load branding configuration
    brandingConfig: loadBrandingConfig(),
  };
};
