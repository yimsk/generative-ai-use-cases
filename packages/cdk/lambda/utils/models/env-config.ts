import { Model, ModelConfiguration } from 'generative-ai-use-cases';
import { modelMetadata } from '@generative-ai-use-cases/common';

// Default Models

const modelIds: ModelConfiguration[] = (
  JSON.parse(process.env.MODEL_IDS || '[]') as ModelConfiguration[]
)
  .map((model) => ({
    modelId: model.modelId.trim(),
    region: model.region.trim(),
    ...(model.inferenceProfileArn && {
      inferenceProfileArn: model.inferenceProfileArn,
    }),
  }))
  .filter((model) => model.modelId);
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

const imageGenerationModels: ModelConfiguration[] = (
  JSON.parse(
    process.env.IMAGE_GENERATION_MODEL_IDS || '[]'
  ) as ModelConfiguration[]
)
  .map(
    (model: ModelConfiguration): ModelConfiguration => ({
      modelId: model.modelId.trim(),
      region: model.region.trim(),
      ...(model.inferenceProfileArn && {
        inferenceProfileArn: model.inferenceProfileArn,
      }),
    })
  )
  .filter((model) => model.modelId);
export const defaultImageGenerationModel: Model = {
  type: 'bedrock',
  modelId: imageGenerationModels?.[0]?.modelId ?? '',
  region: imageGenerationModels?.[0]?.region ?? '',
  ...(imageGenerationModels?.[0]?.inferenceProfileArn && {
    inferenceProfileArn: imageGenerationModels[0].inferenceProfileArn,
  }),
};

const videoGenerationModels: ModelConfiguration[] = (
  JSON.parse(
    process.env.VIDEO_GENERATION_MODEL_IDS || '[]'
  ) as ModelConfiguration[]
)
  .map(
    (model: ModelConfiguration): ModelConfiguration => ({
      modelId: model.modelId.trim(),
      region: model.region.trim(),
      ...(model.inferenceProfileArn && {
        inferenceProfileArn: model.inferenceProfileArn,
      }),
    })
  )
  .filter((model) => model.modelId);
export const defaultVideoGenerationModel: Model = {
  type: 'bedrock',
  modelId: videoGenerationModels?.[0]?.modelId ?? '',
  region: videoGenerationModels?.[0]?.region ?? '',
  ...(videoGenerationModels?.[0]?.inferenceProfileArn && {
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
