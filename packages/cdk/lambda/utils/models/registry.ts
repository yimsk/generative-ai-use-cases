import {
  BedrockImageGenerationResponse,
  ConverseInferenceParams,
  GenerateImageParams,
  GenerateVideoParams,
  Model,
  StreamingChunk,
  StabilityAI2024ModelResponse,
  UnrecordedMessage,
  UsecaseConverseInferenceParams,
} from 'generative-ai-use-cases';
import {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamOutput,
  StartAsyncInvokeCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import {
  CLAUDE_3_5_DEFAULT_PARAMS,
  CLAUDE_DEFAULT_PARAMS,
  CLAUDE_OPUS_4_5_DEFAULT_PARAMS,
  CLAUDE_OPUS_4_6_DEFAULT_PARAMS,
  CLAUDE_OPUS_4_DEFAULT_PARAMS,
  CLAUDE_SONNET_4_6_DEFAULT_PARAMS,
  CLAUDE_SONNET_4_DEFAULT_PARAMS,
  COMMANDR_DEFAULT_PARAMS,
  createBodyImageAmazonAdvancedImage,
  createBodyImageAmazonGeneralImage,
  createBodyImageStabilityAI2024Model,
  createBodyImageStableDiffusion,
  createBodyVideoLumaRayV2,
  createBodyVideoNovaReel,
  createBodyVideoNovaReelV11,
  createConverseCommandInput,
  createConverseCommandInputWithoutSystemContext,
  createConverseStreamCommandInput,
  createConverseStreamCommandInputWithoutSystemContext,
  DEEPSEEK_DEFAULT_PARAMS,
  DEFAULT_128K_DEFAULT_PARAMS,
  DEFAULT_64K_DEFAULT_PARAMS,
  LLAMA_DEFAULT_PARAMS,
  MISTRAL_DEFAULT_PARAMS,
  MIXTRAL_DEFAULT_PARAMS,
  NOVA_2_DEFAULT_PARAMS,
  NOVA_DEFAULT_PARAMS,
  OPENAI_DEFAULT_PARAMS,
  PALMYRA_DEFAULT_PARAMS,
  QWEN_16K_DEFAULT_PARAMS,
  QWEN_192K_DEFAULT_PARAMS,
  QWEN_64K_DEFAULT_PARAMS,
  TITAN_TEXT_DEFAULT_PARAMS,
  USECASE_DEFAULT_PARAMS,
} from './request-builders';
import {
  extractConverseOutput,
  extractConverseStreamOutput,
  extractOutputImageAmazonImage,
  extractOutputImageStabilityAI2024Model,
  extractOutputImageStableDiffusion,
} from './output-extractors';

type TextGenerationModel = {
  defaultParams: ConverseInferenceParams;
  usecaseParams: UsecaseConverseInferenceParams;
  createConverseCommandInput: (
    messages: UnrecordedMessage[],
    id: string,
    model: Model,
    defaultParams: ConverseInferenceParams,
    usecaseParams: UsecaseConverseInferenceParams
  ) => ConverseCommandInput;
  createConverseStreamCommandInput: (
    messages: UnrecordedMessage[],
    id: string,
    model: Model,
    defaultParams: ConverseInferenceParams,
    usecaseParams: UsecaseConverseInferenceParams
  ) => ConverseStreamCommandInput;
  extractConverseOutput: (body: ConverseCommandOutput) => StreamingChunk;
  extractConverseStreamOutput: (body: ConverseStreamOutput) => StreamingChunk;
};

type TextModelFactoryOptions = Pick<
  TextGenerationModel,
  | 'defaultParams'
  | 'createConverseCommandInput'
  | 'createConverseStreamCommandInput'
> & {
  usecaseParams?: UsecaseConverseInferenceParams;
  extractConverseOutput?: TextGenerationModel['extractConverseOutput'];
  extractConverseStreamOutput?: TextGenerationModel['extractConverseStreamOutput'];
};

type Region = 'global' | 'us' | 'eu' | 'apac' | 'jp' | 'au';

type ImageGenerationModel = {
  createBodyImage: (params: GenerateImageParams) => string;
  extractOutputImage: (
    response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse
  ) => string;
};

type VideoGenerationBody = NonNullable<
  StartAsyncInvokeCommandInput['modelInput']
>;

type VideoGenerationModel = {
  createBodyVideo: (params: GenerateVideoParams) => VideoGenerationBody;
};

const createTextModel = ({
  defaultParams,
  usecaseParams = USECASE_DEFAULT_PARAMS,
  createConverseCommandInput: buildConverseCommandInput,
  createConverseStreamCommandInput: buildConverseStreamCommandInput,
  extractConverseOutput: extractOutput = extractConverseOutput,
  extractConverseStreamOutput:
    extractStreamOutput = extractConverseStreamOutput,
}: TextModelFactoryOptions): TextGenerationModel => ({
  defaultParams,
  usecaseParams,
  createConverseCommandInput: buildConverseCommandInput,
  createConverseStreamCommandInput: buildConverseStreamCommandInput,
  extractConverseOutput: extractOutput,
  extractConverseStreamOutput: extractStreamOutput,
});

const createModelIds = (modelId: string, regions: Region[] = []) => [
  modelId,
  ...regions.map((region) => `${region}.${modelId}`),
];

const createPrefixedModelIds = (modelId: string, regions: Region[]) =>
  regions.map((region) => `${region}.${modelId}`);

const createTextModelEntries = (
  modelIds: string[],
  options: TextModelFactoryOptions
): [string, TextGenerationModel][] =>
  modelIds.map((modelId) => [modelId, createTextModel(options)]);

const createRegionalTextModelEntries = (
  modelId: string,
  regions: Region[],
  options: TextModelFactoryOptions,
  includeBaseModel = true
): [string, TextGenerationModel][] =>
  createTextModelEntries(
    includeBaseModel
      ? createModelIds(modelId, regions)
      : createPrefixedModelIds(modelId, regions),
    options
  );

const withSystemContext = (
  defaultParams: ConverseInferenceParams
): TextModelFactoryOptions => ({
  defaultParams,
  createConverseCommandInput,
  createConverseStreamCommandInput,
});

const withoutSystemContext = (
  defaultParams: ConverseInferenceParams
): TextModelFactoryOptions => ({
  defaultParams,
  createConverseCommandInput: createConverseCommandInputWithoutSystemContext,
  createConverseStreamCommandInput:
    createConverseStreamCommandInputWithoutSystemContext,
});

const TEXT_MODEL_GROUPS: [string, TextGenerationModel][] = [
  ...createTextModelEntries(
    createPrefixedModelIds('anthropic.claude-opus-4-6-v1', [
      'global',
      'us',
      'au',
      'eu',
    ]),
    withSystemContext(CLAUDE_OPUS_4_6_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    createPrefixedModelIds('anthropic.claude-sonnet-4-6', [
      'global',
      'us',
      'eu',
      'au',
      'jp',
    ]),
    withSystemContext(CLAUDE_SONNET_4_6_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['us.anthropic.claude-opus-4-5-20251101-v1:0'],
    withSystemContext(CLAUDE_OPUS_4_5_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    [
      'us.anthropic.claude-opus-4-1-20250805-v1:0',
      'us.anthropic.claude-opus-4-20250514-v1:0',
    ],
    withSystemContext(CLAUDE_OPUS_4_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['global.anthropic.claude-opus-4-5-20251101-v1:0'],
    withSystemContext(CLAUDE_OPUS_4_5_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    createPrefixedModelIds('anthropic.claude-sonnet-4-5-20250929-v1:0', [
      'global',
      'us',
      'eu',
      'jp',
    ]),
    withSystemContext(CLAUDE_SONNET_4_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    createPrefixedModelIds('anthropic.claude-haiku-4-5-20251001-v1:0', [
      'global',
      'us',
      'eu',
      'jp',
    ]),
    withSystemContext(CLAUDE_SONNET_4_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    createPrefixedModelIds('anthropic.claude-sonnet-4-20250514-v1:0', [
      'global',
      'us',
      'eu',
      'apac',
    ]),
    withSystemContext(CLAUDE_SONNET_4_DEFAULT_PARAMS)
  ),
  ...createRegionalTextModelEntries(
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    ['us', 'apac'],
    withSystemContext(CLAUDE_3_5_DEFAULT_PARAMS)
  ),
  ...createRegionalTextModelEntries(
    'anthropic.claude-3-5-haiku-20241022-v1:0',
    ['us'],
    withSystemContext(CLAUDE_3_5_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    createPrefixedModelIds('anthropic.claude-3-7-sonnet-20250219-v1:0', [
      'us',
      'eu',
      'apac',
    ]),
    withSystemContext(CLAUDE_SONNET_4_DEFAULT_PARAMS)
  ),
  ...createRegionalTextModelEntries(
    'anthropic.claude-3-5-sonnet-20240620-v1:0',
    ['us', 'eu', 'apac'],
    withSystemContext(CLAUDE_3_5_DEFAULT_PARAMS)
  ),
  ...createRegionalTextModelEntries(
    'anthropic.claude-3-opus-20240229-v1:0',
    ['us'],
    withSystemContext(CLAUDE_DEFAULT_PARAMS)
  ),
  ...createRegionalTextModelEntries(
    'anthropic.claude-3-sonnet-20240229-v1:0',
    ['us', 'eu', 'apac'],
    withSystemContext(CLAUDE_DEFAULT_PARAMS)
  ),
  ...createRegionalTextModelEntries(
    'anthropic.claude-3-haiku-20240307-v1:0',
    ['us', 'eu', 'apac'],
    withSystemContext(CLAUDE_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['amazon.titan-text-express-v1', 'amazon.titan-text-premier-v1:0'],
    withoutSystemContext(TITAN_TEXT_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    [
      'meta.llama3-8b-instruct-v1:0',
      'meta.llama3-70b-instruct-v1:0',
      'meta.llama3-1-8b-instruct-v1:0',
      'meta.llama3-1-70b-instruct-v1:0',
      'meta.llama3-1-405b-instruct-v1:0',
      'us.meta.llama3-2-1b-instruct-v1:0',
      'us.meta.llama3-2-3b-instruct-v1:0',
      'us.meta.llama3-2-11b-instruct-v1:0',
      'us.meta.llama3-2-90b-instruct-v1:0',
      'us.meta.llama3-3-70b-instruct-v1:0',
      'us.meta.llama4-scout-17b-instruct-v1:0',
      'us.meta.llama4-maverick-17b-instruct-v1:0',
    ],
    withSystemContext(LLAMA_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['mistral.mistral-7b-instruct-v0:2'],
    withoutSystemContext(MISTRAL_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['mistral.mixtral-8x7b-instruct-v0:1'],
    withoutSystemContext(MIXTRAL_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    [
      'mistral.mistral-small-2402-v1:0',
      'mistral.mistral-large-2402-v1:0',
      'mistral.mistral-large-2407-v1:0',
      'us.mistral.pixtral-large-2502-v1:0',
      'eu.mistral.pixtral-large-2502-v1:0',
    ],
    withSystemContext(MISTRAL_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    [
      'mistral.mistral-large-3-675b-instruct',
      'mistral.ministral-3-3b-instruct',
      'mistral.ministral-3-8b-instruct',
      'mistral.ministral-3-14b-instruct',
    ],
    withSystemContext(DEFAULT_128K_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['mistral.magistral-small-2509'],
    withSystemContext(DEFAULT_64K_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['cohere.command-r-v1:0', 'cohere.command-r-plus-v1:0'],
    withSystemContext(COMMANDR_DEFAULT_PARAMS)
  ),
  ...createRegionalTextModelEntries(
    'amazon.nova-pro-v1:0',
    ['us', 'eu', 'apac'],
    withSystemContext(NOVA_DEFAULT_PARAMS)
  ),
  ...createRegionalTextModelEntries(
    'amazon.nova-lite-v1:0',
    ['us', 'eu', 'apac'],
    withSystemContext(NOVA_DEFAULT_PARAMS)
  ),
  ...createRegionalTextModelEntries(
    'amazon.nova-micro-v1:0',
    ['us', 'eu', 'apac'],
    withSystemContext(NOVA_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['us.amazon.nova-premier-v1:0'],
    withSystemContext(NOVA_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    [
      'us.amazon.nova-2-lite-v1:0',
      'jp.amazon.nova-2-lite-v1:0',
      'global.amazon.nova-2-lite-v1:0',
    ],
    withSystemContext(NOVA_2_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['deepseek.v3-v1:0', 'us.deepseek.r1-v1:0'],
    withSystemContext(DEEPSEEK_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['qwen.qwen3-235b-a22b-2507-v1:0'],
    withSystemContext(QWEN_192K_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['qwen.qwen3-32b-v1:0'],
    withSystemContext(QWEN_16K_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['qwen.qwen3-coder-480b-a35b-v1:0'],
    withSystemContext(QWEN_64K_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['qwen.qwen3-coder-30b-a3b-v1:0'],
    withSystemContext(QWEN_192K_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['qwen.qwen3-next-80b-a3b', 'qwen.qwen3-vl-235b-a22b'],
    withSystemContext(DEFAULT_128K_DEFAULT_PARAMS)
  ),
  // Although Palmyra supports system context, the model seems work best without it.
  ...createTextModelEntries(
    ['us.writer.palmyra-x4-v1:0', 'us.writer.palmyra-x5-v1:0'],
    withoutSystemContext(PALMYRA_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['openai.gpt-oss-120b-1:0', 'openai.gpt-oss-20b-1:0'],
    withoutSystemContext(OPENAI_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['google.gemma-3-4b-it', 'google.gemma-3-12b-it', 'google.gemma-3-27b-it'],
    withoutSystemContext(DEFAULT_64K_DEFAULT_PARAMS)
  ),
  // MiniMax AI
  ...createTextModelEntries(
    ['minimax.minimax-m2'],
    withoutSystemContext(DEFAULT_128K_DEFAULT_PARAMS)
  ),
  // Moonshot AI
  ...createTextModelEntries(
    ['moonshot.kimi-k2-thinking'],
    withoutSystemContext(DEFAULT_128K_DEFAULT_PARAMS)
  ),
  // NVIDIA
  ...createTextModelEntries(
    ['nvidia.nemotron-nano-9b-v2', 'nvidia.nemotron-nano-12b-v2'],
    withoutSystemContext(DEFAULT_64K_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['nvidia.nemotron-nano-3-30b'],
    withoutSystemContext(DEFAULT_128K_DEFAULT_PARAMS)
  ),
  // === Custom models (not in upstream GenU) ===
  // DeepSeek V3.2 - similar to deepseek.v3-v1:0
  ...createTextModelEntries(
    ['deepseek.v3.2'],
    withSystemContext(DEEPSEEK_DEFAULT_PARAMS)
  ),
  // MiniMax M2.1 - system context enabled (Claude-like prompting)
  ...createTextModelEntries(
    ['minimax.minimax-m2.1'],
    withSystemContext(DEFAULT_128K_DEFAULT_PARAMS)
  ),
  // Z.AI GLM 4.7 - system context enabled (Claude-like prompting)
  ...createTextModelEntries(
    ['zai.glm-4.7'],
    withSystemContext(DEFAULT_128K_DEFAULT_PARAMS)
  ),
  ...createTextModelEntries(
    ['zai.glm-4.7-flash'],
    withSystemContext(DEFAULT_64K_DEFAULT_PARAMS)
  ),
  // Moonshot Kimi K2.5 - system context enabled (Claude-like prompting)
  ...createTextModelEntries(
    ['moonshotai.kimi-k2.5'],
    withSystemContext(DEFAULT_128K_DEFAULT_PARAMS)
  ),
  // Qwen3 Coder Next - similar to qwen.qwen3-next-80b-a3b
  ...createTextModelEntries(
    ['qwen.qwen3-coder-next'],
    withSystemContext(DEFAULT_128K_DEFAULT_PARAMS)
  ),
];

// Definition of parameters and functions for each model related to text generation
export const BEDROCK_TEXT_GEN_MODELS: Record<string, TextGenerationModel> =
  Object.fromEntries(TEXT_MODEL_GROUPS);

// Definition of parameters and functions for each image generation model
export const BEDROCK_IMAGE_GEN_MODELS: Record<string, ImageGenerationModel> = {
  'stability.stable-diffusion-xl-v1': {
    createBodyImage: createBodyImageStableDiffusion,
    extractOutputImage: extractOutputImageStableDiffusion,
  },
  'stability.stable-image-core-v1:1': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'stability.stable-image-ultra-v1:1': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'stability.sd3-5-large-v1:0': {
    createBodyImage: createBodyImageStabilityAI2024Model,
    extractOutputImage: extractOutputImageStabilityAI2024Model,
  },
  'amazon.titan-image-generator-v1': {
    createBodyImage: createBodyImageAmazonGeneralImage,
    extractOutputImage: extractOutputImageAmazonImage,
  },
  'amazon.titan-image-generator-v2:0': {
    createBodyImage: createBodyImageAmazonAdvancedImage,
    extractOutputImage: extractOutputImageAmazonImage,
  },
  'amazon.nova-canvas-v1:0': {
    createBodyImage: createBodyImageAmazonAdvancedImage,
    extractOutputImage: extractOutputImageAmazonImage,
  },
};

export const BEDROCK_VIDEO_GEN_MODELS: Record<string, VideoGenerationModel> = {
  'amazon.nova-reel-v1:0': {
    createBodyVideo: (params) =>
      createBodyVideoNovaReel(params) as unknown as VideoGenerationBody,
  },
  'amazon.nova-reel-v1:1': {
    createBodyVideo: (params) =>
      createBodyVideoNovaReelV11(params) as unknown as VideoGenerationBody,
  },
  'luma.ray-v2:0': {
    createBodyVideo: (params) =>
      createBodyVideoLumaRayV2(params) as unknown as VideoGenerationBody,
  },
};
