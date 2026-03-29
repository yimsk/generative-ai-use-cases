import { Model, ModelConfiguration, AgentInfo, Flow } from 'generative-ai-use-cases';
import {
  CRI_PREFIX_PATTERN,
  modelMetadata,
} from '@generative-ai-use-cases/common';

// ============== Config Parser Functions ==============

function parseModelConfigurations(
  envValue: string | undefined,
  envVarName: string
): ModelConfiguration[] {
  if (!envValue) {
    return [];
  }
  try {
    const parsed = JSON.parse(envValue) as ModelConfiguration[];
    if (!Array.isArray(parsed)) {
      throw new Error(`${envVarName} must be a JSON array`);
    }
    return parsed
      .map((model) => ({
        modelId: model.modelId?.trim() ?? '',
        region: model.region?.trim() ?? '',
      }))
      .filter((model) => model.modelId);
  } catch (error) {
    console.error(
      `Failed to parse ${envVarName}:`,
      error instanceof Error ? error.message : String(error)
    );
    throw new Error(
      `Invalid environment variable ${envVarName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function parseAgents(
  builtinJson: string | undefined,
  customJson: string | undefined
): AgentInfo[] {
  const parseAgentJson = (json: string | undefined, source: string): AgentInfo[] => {
    if (!json || json.trim() === '') {
      return [];
    }
    try {
      const parsed = JSON.parse(json) as AgentInfo[];
      if (!Array.isArray(parsed)) {
        console.warn(`${source} is not an array, using empty array`);
        return [];
      }
      return parsed;
    } catch (error) {
      console.warn(`Failed to parse ${source}:`, error);
      return [];
    }
  };

  const builtinAgents = parseAgentJson(builtinJson, 'builtin agents');
  const customAgents = parseAgentJson(customJson, 'custom agents');
  return [...builtinAgents, ...customAgents];
}

function parseFlows(envValue: string | undefined): Flow[] {
  if (!envValue) {
    return [];
  }
  try {
    const parsed = JSON.parse(envValue) as Flow[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

// ============== Environment Config Loading ==============

const modelRegion = import.meta.env.VITE_APP_MODEL_REGION ?? '';

// Parse all model configurations with explicit error handling
const bedrockModelConfigs = parseModelConfigurations(
  import.meta.env.VITE_APP_MODEL_IDS,
  'VITE_APP_MODEL_IDS'
);
const endpointConfigs = parseModelConfigurations(
  import.meta.env.VITE_APP_ENDPOINT_NAMES,
  'VITE_APP_ENDPOINT_NAMES'
);
const imageModelConfigs = parseModelConfigurations(
  import.meta.env.VITE_APP_IMAGE_MODEL_IDS,
  'VITE_APP_IMAGE_MODEL_IDS'
);
const videoModelConfigs = parseModelConfigurations(
  import.meta.env.VITE_APP_VIDEO_MODEL_IDS,
  'VITE_APP_VIDEO_MODEL_IDS'
);
const speechToSpeechModelConfigs = parseModelConfigurations(
  import.meta.env.VITE_APP_SPEECH_TO_SPEECH_MODEL_IDS,
  'VITE_APP_SPEECH_TO_SPEECH_MODEL_IDS'
);

// Derive model ID arrays
const bedrockModelIds: string[] = bedrockModelConfigs.map(
  (model) => model.modelId
);
const endpointNames = endpointConfigs.map((model) => model.modelId);
const imageGenModelIds: string[] = imageModelConfigs.map(
  (model) => model.modelId
);
const videoGenModelIds: string[] = videoModelConfigs.map(
  (model) => model.modelId
);
const speechToSpeechModelIds: string[] = speechToSpeechModelConfigs.map(
  (model) => model.modelId
);

// Filter models by region and flags
const modelIdsInModelRegion: string[] = bedrockModelConfigs
  .filter((model) => model.region === modelRegion)
  .map((model) => model.modelId);

const lightModelIds: string[] = bedrockModelConfigs
  .filter((model) => modelMetadata[model.modelId]?.flags?.light)
  .map((model) => model.modelId);

const visionModelIds: string[] = bedrockModelIds.filter(
  (modelId) => modelMetadata[modelId]?.flags?.image
);
const visionEnabled: boolean = visionModelIds.length > 0;

// Detect duplicate base model IDs (for CRI suffix handling)
const duplicateBaseModelIds = new Set(
  bedrockModelIds
    .map((modelId) => modelId.replace(CRI_PREFIX_PATTERN, ''))
    .filter((item, index, arr) => arr.indexOf(item) !== index)
);

// Parse agents
const agents = parseAgents(
  import.meta.env.VITE_APP_BUILTIN_AGENTS_JSON,
  import.meta.env.VITE_APP_CUSTOM_AGENTS_JSON
);
const agentNames: string[] = agents.map((agent) => agent.displayName);

// Parse flows
const flows = parseFlows(import.meta.env.VITE_APP_FLOWS);

// Search agent detection
const searchAgent = agentNames.find((name) => name.includes('Search'));

// ============== Model Object Builders ==============

function buildModelFromConfig(
  config: ModelConfiguration,
  type: Model['type']
): Model {
  return {
    modelId: config.modelId,
    type,
    region: config.region,
  };
}

export const textModels: Model[] = [
  ...bedrockModelConfigs.map((config) => buildModelFromConfig(config, 'bedrock')),
  ...endpointConfigs.map((config) => buildModelFromConfig(config, 'sagemaker')),
];

const imageGenModels: Model[] = imageModelConfigs.map((config) =>
  buildModelFromConfig(config, 'bedrock')
);

const videoGenModels: Model[] = videoModelConfigs.map((config) =>
  buildModelFromConfig(config, 'bedrock')
);

const speechToSpeechModels: Model[] = speechToSpeechModelConfigs.map((config) =>
  buildModelFromConfig(config, 'bedrock')
);

const agentModels: Model[] = agentNames.map(
  (name) => ({ modelId: name, type: 'bedrockAgent' }) as Model
);

// ============== Helper Functions ==============

export function findModelByModelId(modelId: string): Model {
  const model = [
    ...textModels,
    ...imageGenModels,
    ...videoGenModels,
    ...agentModels,
  ].find((m) => m.modelId === modelId);

  if (model) {
    // structuredClone replaces JSON.parse(JSON.stringify()) for deep copy
    return structuredClone(model);
  }

  // Return a default model to satisfy the return type (original behavior compatibility)
  return undefined as unknown as Model;
}

function modelDisplayName(modelId: string): string {
  let displayName = modelMetadata[modelId]?.displayName ?? modelId;
  if (duplicateBaseModelIds.has(modelId.replace(CRI_PREFIX_PATTERN, ''))) {
    const criMatch = modelId.match(CRI_PREFIX_PATTERN);
    if (criMatch) {
      displayName += ` (${criMatch[1].toUpperCase()})`;
    }
  }
  return displayName;
}

function getModelMetadata(modelId: string) {
  const model = modelMetadata[modelId];
  if (!model) {
    return {
      displayName: modelId,
      flags: {},
    };
  }
  return model;
}

// ============== Exported Constants ==============

export const MODELS = {
  modelRegion,
  modelIds: bedrockModelIds,
  allModelIds: [...bedrockModelIds, ...endpointNames],
  modelIdsInModelRegion,
  modelMetadata,
  getModelMetadata,
  modelDisplayName,
  lightModelIds,
  visionModelIds,
  visionEnabled,
  imageGenModelIds,
  videoGenModelIds,
  agentNames,
  agents,
  textModels,
  imageGenModels,
  videoGenModels,
  agentModels,
  agentEnabled: agentNames.length > 0,
  searchAgent,
  flows,
  flowChatEnabled: flows.length > 0,
  speechToSpeechModelIds,
  speechToSpeechModels,
};
