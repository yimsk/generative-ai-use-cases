import { Model, ModelConfiguration } from 'generative-ai-use-cases';
import { modelMetadata } from '@generative-ai-use-cases/common';

// Default Models

const parseRequiredModelConfigurations = (
  envVarName: string,
  expectedFlag?: 'text' | 'image_gen' | 'video_gen'
): ModelConfiguration[] => {
  const rawValue = process.env[envVarName];
  if (!rawValue || rawValue.trim() === '') {
    throw new Error(`${envVarName} is required and cannot be empty`);
  }

  const parsed = JSON.parse(rawValue) as ModelConfiguration[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${envVarName} must contain at least one model config`);
  }

  return parsed.map((model, index) => {
    const modelId = model.modelId.trim();
    const region = model.region.trim();
    const inferenceProfileArn = model.inferenceProfileArn?.trim();

    if (!modelId) {
      throw new Error(`${envVarName}[${index}].modelId cannot be empty`);
    }
    if (!region) {
      throw new Error(`${envVarName}[${index}].region cannot be empty`);
    }

    const metadata = modelMetadata[modelId];
    if (!metadata) {
      throw new Error(
        `${envVarName}[${index}].modelId is unsupported: ${modelId}`
      );
    }
    if (expectedFlag && !metadata.flags[expectedFlag]) {
      throw new Error(
        `${envVarName}[${index}].modelId is not a ${expectedFlag} model: ${modelId}`
      );
    }

    if (model.inferenceProfileArn && !inferenceProfileArn) {
      throw new Error(
        `${envVarName}[${index}].inferenceProfileArn cannot be empty`
      );
    }

    return {
      modelId,
      region,
      ...(inferenceProfileArn && { inferenceProfileArn }),
    };
  });
};

const modelIds: ModelConfiguration[] = parseRequiredModelConfigurations(
  'MODEL_IDS',
  'text'
);
// If there is a lightweight model among the available models, prioritize the lightweight model.
const lightWeightModelIds = modelIds.filter(
  (model: ModelConfiguration) => modelMetadata[model.modelId].flags.light
);
const defaultModelConfiguration = lightWeightModelIds[0] || modelIds[0];
export const defaultModel: Model = {
  type: 'bedrock',
  modelId: defaultModelConfiguration.modelId,
  region: defaultModelConfiguration.region,
  ...(defaultModelConfiguration.inferenceProfileArn && {
    inferenceProfileArn: defaultModelConfiguration.inferenceProfileArn,
  }),
};

const imageGenerationModels: ModelConfiguration[] =
  parseRequiredModelConfigurations('IMAGE_GENERATION_MODEL_IDS', 'image_gen');
export const defaultImageGenerationModel: Model = {
  type: 'bedrock',
  modelId: imageGenerationModels[0].modelId,
  region: imageGenerationModels[0].region,
  ...(imageGenerationModels[0].inferenceProfileArn && {
    inferenceProfileArn: imageGenerationModels[0].inferenceProfileArn,
  }),
};

const videoGenerationModels: ModelConfiguration[] =
  parseRequiredModelConfigurations('VIDEO_GENERATION_MODEL_IDS', 'video_gen');
export const defaultVideoGenerationModel: Model = {
  type: 'bedrock',
  modelId: videoGenerationModels[0].modelId,
  region: videoGenerationModels[0].region,
  ...(videoGenerationModels[0].inferenceProfileArn && {
    inferenceProfileArn: videoGenerationModels[0].inferenceProfileArn,
  }),
};

// Get inference profile ARN from modelId
export const getInferenceProfileArn = (modelId: string): string | undefined => {
  const textModelConfig = modelIds.find((config) => config.modelId === modelId);
  if (textModelConfig?.inferenceProfileArn) {
    return textModelConfig.inferenceProfileArn;
  }
  const imageModelConfig = imageGenerationModels.find(
    (config) => config.modelId === modelId
  );
  if (imageModelConfig?.inferenceProfileArn) {
    return imageModelConfig.inferenceProfileArn;
  }
  const videoModelConfig = videoGenerationModels.find(
    (config) => config.modelId === modelId
  );
  if (videoModelConfig?.inferenceProfileArn) {
    return videoModelConfig.inferenceProfileArn;
  }
  return undefined;
};
