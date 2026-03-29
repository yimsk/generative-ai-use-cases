import {
  AmazonAdvancedImageParams,
  AmazonGeneralImageParams,
  ConverseInferenceParams,
  GenerateImageParams,
  GenerateVideoParams,
  GuardrailConverseConfigParams,
  GuardrailConverseStreamConfigParams,
  Model,
  StableDiffusionParams,
  StabilityAI2024ModelParams,
  UnrecordedMessage,
  UsecaseConverseInferenceParams,
} from 'generative-ai-use-cases';
import {
  ContentBlock,
  ConverseCommandInput,
  ConverseStreamCommandInput,
  ConversationRole,
} from '@aws-sdk/client-bedrock-runtime';
import { modelMetadata } from '@generative-ai-use-cases/common';
import { getInferenceProfileArn } from './env-config';
import {
  applyAutoCacheToMessages,
  applyAutoCacheToSystem,
} from '../promptCache';
import { convertToSafeFilename } from '../fileNameUtils';
import { getFormatFromMimeType, getMimeTypeFromFileName } from '../media';

// Model Params

export const DEFAULT_64K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 65536,
    temperature: 1,
    topP: 1,
  },
};

export const DEFAULT_128K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 131072,
    temperature: 1,
    topP: 1,
  },
};

export const CLAUDE_SONNET_4_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 64000,
    temperature: 1,
  },
};

export const CLAUDE_OPUS_4_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 32000,
    temperature: 1,
    topP: 0.999,
  },
};

export const CLAUDE_OPUS_4_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 64000,
    temperature: 1,
  },
};

export const CLAUDE_OPUS_4_6_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 128000,
    temperature: 1,
  },
};

export const CLAUDE_SONNET_4_6_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 64000,
    temperature: 1,
  },
};

export const CLAUDE_3_5_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 8192,
    temperature: 0.6,
    topP: 0.8,
  },
};

export const CLAUDE_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 4096,
    temperature: 0.6,
    topP: 0.8,
  },
};

export const TITAN_TEXT_DEFAULT_PARAMS: ConverseInferenceParams = {
  // Converse API only accepts 3000, instead of 3072, which is described in the doc.
  // If 3072 is accepted, revert to 3072.
  // https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-text.html
  inferenceConfig: {
    maxTokens: 3000,
    temperature: 0.7,
    topP: 1.0,
  },
};

export const LLAMA_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 2048,
    temperature: 0.5,
    topP: 0.9,
    stopSequences: ['<|eot_id|>'],
  },
};

export const MISTRAL_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 8192,
    temperature: 0.6,
    topP: 0.99,
  },
};

export const MIXTRAL_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 4096,
    temperature: 0.6,
    topP: 0.99,
  },
};

export const COMMANDR_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 4000,
    temperature: 0.3,
    topP: 0.75,
  },
};

export const NOVA_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 5120,
    temperature: 0.7,
    topP: 0.9,
  },
  // There are no additional costs for cache writes with Amazon Nova models
  promptCachingConfig: {
    autoCacheFields: {
      system: true,
      messages: true,
    },
  },
};

export const NOVA_2_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 65535,
    temperature: 1,
  },
  // There are no additional costs for cache writes with Amazon Nova models
  promptCachingConfig: {
    autoCacheFields: {
      system: true,
      messages: true,
    },
  },
};

export const DEEPSEEK_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 32768,
    temperature: 0.6,
    topP: 0.95,
  },
};

// Qwen3 model parameters based on actual AWS Bedrock limits
export const QWEN_16K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 16384,
    temperature: 0.7,
    topP: 0.9,
  },
};

export const QWEN_64K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 65536,
    temperature: 0.7,
    topP: 0.9,
  },
};

export const QWEN_192K_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 196608,
    temperature: 0.7,
    topP: 0.9,
  },
};

export const PALMYRA_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 8192,
    temperature: 1,
    topP: 0.9,
  },
};

export const OPENAI_DEFAULT_PARAMS: ConverseInferenceParams = {
  inferenceConfig: {
    maxTokens: 8192,
    temperature: 1,
    topP: 1.0,
  },
};

export const USECASE_DEFAULT_PARAMS: UsecaseConverseInferenceParams = {
  '/chat': {
    promptCachingConfig: {
      autoCacheFields: {
        system: true,
        messages: true,
      },
    },
  },
  '/rag': {
    inferenceConfig: {
      temperature: 0.0,
    },
    promptCachingConfig: {
      autoCacheFields: {
        system: false,
      },
    },
  },
  '/diagram': {
    promptCachingConfig: {
      autoCacheFields: {
        system: true,
      },
    },
  },
  '/meeting-minutes': {
    promptCachingConfig: {
      autoCacheFields: {
        system: true,
        messages: true,
      },
    },
  },
  '/use-case-builder': {
    promptCachingConfig: {
      autoCacheFields: {
        messages: false,
      },
    },
  },
  '/title': {
    promptCachingConfig: {
      autoCacheFields: {
        system: false,
        messages: false,
      },
    },
  },
};

// Guardrail Settings
export const createGuardrailConfig = ():
  | GuardrailConverseConfigParams
  | undefined => {
  if (
    process.env.GUARDRAIL_IDENTIFIER !== undefined &&
    process.env.GUARDRAIL_VERSION !== undefined
  ) {
    return {
      guardrailIdentifier: process.env.GUARDRAIL_IDENTIFIER,
      guardrailVersion: process.env.GUARDRAIL_VERSION,
      // Outputs become heavy and there is no way to check the trace on the app side, so disabled is hard-coded
      trace: 'disabled',
    };
  }
  return undefined;
};

export const createGuardrailStreamConfig = ():
  | GuardrailConverseStreamConfigParams
  | undefined => {
  const baseConfig = createGuardrailConfig();
  if (baseConfig) {
    return {
      ...baseConfig,
      // Although there is a possibility that a bad output will occur when using asynchronous processing,
      // since it has never occurred even with bad inputs (i.e., stopping at the input point),
      // use asynchronous processing to improve the experience.
      // https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-streaming.html
      streamProcessingMode: 'async',
    };
  }
  return undefined;
};

// ID conversion rules
const idTransformationRules = [
  // Chat history -> Chat
  { pattern: /^\/chat\/.+/, replacement: '/chat' },
  // Use case builder (/new and /execute/*)
  {
    pattern: /^\/use-case-builder\/.+/,
    replacement: '/use-case-builder',
  },
];

// ID conversion
export function normalizeId(id: string): string {
  if (!id) return id;
  const rule = idTransformationRules.find((rule) => id.match(rule.pattern));
  const ret = rule ? rule.replacement : id;
  return ret;
}

export const mergeConverseInferenceParams = (
  a: ConverseInferenceParams,
  b: ConverseInferenceParams
) =>
  ({
    inferenceConfig: {
      ...a.inferenceConfig,
      ...b.inferenceConfig,
    },
    promptCachingConfig: {
      autoCacheFields: {
        ...a.promptCachingConfig?.autoCacheFields,
        ...b.promptCachingConfig?.autoCacheFields,
      },
    },
  }) as ConverseInferenceParams;

export const createConverseCommandInput = (
  messages: UnrecordedMessage[],
  id: string,
  model: Model,
  defaultConverseInferenceParams: ConverseInferenceParams,
  usecaseConverseInferenceParams: UsecaseConverseInferenceParams
) => {
  // Set the string passed in the system role to the system prompt
  const system = messages.find((message) => message.role === 'system');
  const systemContext = system ? [{ text: system.content }] : [];

  // Add the string of user role and assistant role other than the system role to the conversation
  messages = messages.filter((message) => message.role !== 'system');
  const conversation = messages.map((message) => {
    const contentBlocks: ContentBlock[] = [];

    // Put images, videos, and documents before the task, instruction, and user query
    if (message.extraData) {
      message.extraData.forEach((extra) => {
        // Prior to v4.2.4, 'extra.source.mediaType' could be empty.
        // For resumed conversations from older versions, we fallback to detecting mimeType based on the extension.
        const mimeType =
          extra.source.mediaType || getMimeTypeFromFileName(extra.name);
        const format = getFormatFromMimeType(mimeType);

        if (extra.type === 'image' && extra.source.type === 'base64') {
          contentBlocks.push({
            image: {
              format,
              source: {
                bytes: Buffer.from(extra.source.data, 'base64'),
              },
            },
          } as ContentBlock.ImageMember);
        } else if (extra.type === 'file' && extra.source.type === 'base64') {
          contentBlocks.push({
            document: {
              format,
              name: convertToSafeFilename(extra.name),
              source: {
                bytes: Buffer.from(extra.source.data, 'base64'),
              },
            },
          } as ContentBlock.DocumentMember);
        } else if (extra.type === 'video' && extra.source.type === 'base64') {
          contentBlocks.push({
            video: {
              format,
              source: {
                bytes: Buffer.from(extra.source.data, 'base64'),
              },
            },
          } as ContentBlock.VideoMember);
        } else if (extra.type === 'video' && extra.source.type === 's3') {
          contentBlocks.push({
            video: {
              format,
              source: {
                s3Location: {
                  uri: extra.source.data,
                },
              },
            },
          } as ContentBlock.VideoMember);
        }
      });
    }

    contentBlocks.push({ text: message.content });
    return {
      role:
        message.role === 'user'
          ? ConversationRole.USER
          : ConversationRole.ASSISTANT,
      content: contentBlocks,
    };
  });

  // Merge model's default params with use-case specific ones
  const usecaseParams = usecaseConverseInferenceParams[normalizeId(id)] || {};
  const params = mergeConverseInferenceParams(
    defaultConverseInferenceParams,
    usecaseParams
  );

  // Apply prompt caching
  const autoCacheFields = params.promptCachingConfig?.autoCacheFields || {};
  const conversationWithCache = autoCacheFields['messages']
    ? applyAutoCacheToMessages(conversation, model.modelId)
    : conversation;
  const systemContextWithCache = autoCacheFields['system']
    ? applyAutoCacheToSystem(systemContext, model.modelId)
    : systemContext;

  const guardrailConfig = createGuardrailConfig();

  const modelIdOrArn = getInferenceProfileArn(model.modelId) || model.modelId;
  const converseCommandInput: ConverseCommandInput = {
    modelId: modelIdOrArn,
    messages: conversationWithCache,
    system: systemContextWithCache,
    inferenceConfig: params.inferenceConfig,
    guardrailConfig,
  };

  if (
    modelMetadata[model.modelId].flags.reasoning &&
    (model.modelParameters?.reasoningConfig?.type === 'enabled' ||
      model.modelParameters?.reasoningConfig?.type === 'adaptive')
  ) {
    converseCommandInput.inferenceConfig = {
      ...params.inferenceConfig,
      temperature: 1, // reasoning requires temperature to be 1
      topP: undefined, // reasoning does not require topP
      maxTokens: params.inferenceConfig?.maxTokens,
    };

    if (model.modelParameters?.reasoningConfig?.type === 'adaptive') {
      // Adaptive thinking (Claude Opus 4.6+)
      // https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html
      converseCommandInput.additionalModelRequestFields = {
        thinking: { type: 'adaptive' },
        output_config: {
          effort: model.modelParameters?.reasoningConfig?.effort || 'high',
        },
      };
    } else {
      // Extended thinking (legacy: Claude 3.7 Sonnet, Claude 4/4.1/4.5)
      converseCommandInput.additionalModelRequestFields = {
        reasoning_config: {
          type: model.modelParameters?.reasoningConfig?.type,
          budget_tokens:
            model.modelParameters?.reasoningConfig?.budgetTokens || 0,
        },
      };
    }
  }

  return converseCommandInput;
};

// Function for models that do not support system prompts
// - Amazon Titan model (amazon.titan-text-premier-v1:0)
// - Mistral AI Instruct (mistral.mixtral-8x7b-instruct-v0:1, mistral.mistral-7b-instruct-v0:2)
// https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html#conversation-inference-supported-models-features
export const createConverseCommandInputWithoutSystemContext = (
  messages: UnrecordedMessage[],
  id: string,
  model: Model,
  defaultConverseInferenceParams: ConverseInferenceParams,
  usecaseConverseInferenceParams: UsecaseConverseInferenceParams
) => {
  // Since system is not available, system is also included as user.
  const system = messages.find((message) => message.role === 'system');
  messages = messages.filter((message) => message.role !== 'system');
  if (messages.length > 0 && messages[0].role === 'user') {
    messages[0].content = system?.content + messages[0].content;
  }

  return createConverseCommandInput(
    messages,
    id,
    model,
    defaultConverseInferenceParams,
    usecaseConverseInferenceParams
  );
};

// ConverseStreamCommandInput has the same structure as ConverseCommandInput, so the input created by "createConverseCommandInput" can be used as is.
export const createConverseStreamCommandInput = (
  messages: UnrecordedMessage[],
  id: string,
  model: Model,
  defaultParams: ConverseInferenceParams,
  usecaseParams: UsecaseConverseInferenceParams
): ConverseStreamCommandInput => {
  const converseCommandInput = createConverseCommandInput(
    messages,
    id,
    model,
    defaultParams,
    usecaseParams
  );
  const guardrailStreamConfig = createGuardrailStreamConfig();
  return {
    ...converseCommandInput,
    guardrailStreamConfig,
  } as ConverseStreamCommandInput;
};

// Function for models that do not support system prompts
// - Amazon Titan model (amazon.titan-text-premier-v1:0)
// - Mistral AI Instruct (mistral.mixtral-8x7b-instruct-v0:1, mistral.mistral-7b-instruct-v0:2)
// https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html#conversation-inference-supported-models-features
export const createConverseStreamCommandInputWithoutSystemContext = (
  messages: UnrecordedMessage[],
  id: string,
  model: Model,
  defaultParams: ConverseInferenceParams,
  usecaseParams: UsecaseConverseInferenceParams
): ConverseStreamCommandInput => {
  const converseCommandInput = createConverseCommandInputWithoutSystemContext(
    messages,
    id,
    model,
    defaultParams,
    usecaseParams
  );
  const guardrailStreamConfig = createGuardrailStreamConfig();
  return {
    ...converseCommandInput,
    guardrailStreamConfig,
  } as ConverseStreamCommandInput;
};

export const createBodyImageStableDiffusion = (params: GenerateImageParams) => {
  let body: StableDiffusionParams = {
    text_prompts: params.textPrompt,
    cfg_scale: params.cfgScale,
    style_preset: params.stylePreset,
    seed: params.seed,
    steps: params.step,
    image_strength: params.maskImage ? 0 : params.imageStrength, // When inpainting/outpainting, 0 or above is bad
    height: params.height,
    width: params.width,
  };
  if (params.initImage && params.maskImage === undefined) {
    // Image to Image
    body = {
      ...body,
      init_image: params.initImage,
    };
  } else if (params.initImage && params.maskImage) {
    // Image to Image (Masking)
    body = {
      ...body,
      init_image: params.initImage,
      mask_image: params.maskImage,
      mask_source:
        params.taskType === 'INPAINTING'
          ? 'MASK_IMAGE_BLACK'
          : 'MASK_IMAGE_WHITE',
    };
  }
  return JSON.stringify(body);
};

export const createBodyImageStabilityAI2024Model = (
  params: GenerateImageParams
) => {
  let positivePrompt: string = '';
  let negativePrompt: string | undefined;
  params.textPrompt.forEach((prompt) => {
    if (prompt.weight >= 0) {
      positivePrompt = prompt.text;
    } else {
      negativePrompt = prompt.text;
    }
  });
  if (!positivePrompt) {
    throw new Error('Positive prompt is required');
  }
  let body: StabilityAI2024ModelParams = {
    prompt: positivePrompt,
    seed: params.seed,
    output_format: 'png',
  };
  if (params.stylePreset) {
    body.prompt = body.prompt + ', ' + params.stylePreset;
  }

  // When in image-to-image mode, aspect ratio cannot be used
  if (params.aspectRatio && !params.initImage) {
    body = {
      ...body,
      aspect_ratio: params.aspectRatio,
    };
  }
  if (negativePrompt) {
    body = {
      ...body,
      negative_prompt: negativePrompt,
    };
  }

  // Image to Image
  if (params.initImage) {
    body = {
      ...body,
      image: params.initImage,
      mode: 'image-to-image',
      strength: params.imageStrength,
    };
  }
  return JSON.stringify(body);
};

export const createBodyImageAmazonGeneralImage = (
  params: GenerateImageParams
) => {
  // TODO: Support inpainting and outpainting too
  const imageGenerationConfig = {
    numberOfImages: 1,
    quality: 'standard',
    height: params.height,
    width: params.width,
    cfgScale: params.cfgScale,
    seed: params.seed % 214783648, // max for titan image
  };
  let body: Partial<AmazonGeneralImageParams> = {};
  if (params.initImage && params.taskType === undefined) {
    body = {
      taskType: 'IMAGE_VARIATION',
      imageVariationParams: {
        text:
          (params.textPrompt.find((x) => x.weight > 0)?.text || '') +
          ', ' +
          params.stylePreset,
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
        images: [params.initImage],
        similarityStrength: Math.max(params.imageStrength || 0.2, 0.2), // Min 0.2
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  } else if (params.initImage && params.taskType === 'INPAINTING') {
    body = {
      taskType: 'INPAINTING',
      inPaintingParams: {
        text:
          (params.textPrompt.find((x) => x.weight > 0)?.text || '') +
          ', ' +
          params.stylePreset,
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
        image: params.initImage,
        maskImage: params.maskImage,
        maskPrompt: params.maskPrompt,
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  } else if (params.initImage && params.taskType === 'OUTPAINTING') {
    body = {
      taskType: 'OUTPAINTING',
      outPaintingParams: {
        text:
          (params.textPrompt.find((x) => x.weight > 0)?.text || '') +
          ', ' +
          params.stylePreset,
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
        image: params.initImage,
        maskImage: params.maskImage,
        maskPrompt: params.maskPrompt,
        outPaintingMode: 'DEFAULT',
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  } else {
    body = {
      taskType: 'TEXT_IMAGE',
      textToImageParams: {
        text:
          (params.textPrompt.find((x) => x.weight > 0)?.text || '') +
          ', ' +
          params.stylePreset,
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
      },
      imageGenerationConfig: imageGenerationConfig,
    };
  }
  return JSON.stringify(body);
};

export const createBodyImageAmazonAdvancedImage = (
  params: GenerateImageParams
) => {
  const baseBody = JSON.parse(createBodyImageAmazonGeneralImage(params));
  let body: Partial<AmazonAdvancedImageParams> = {
    ...baseBody,
  };

  if (params.taskType === 'COLOR_GUIDED_GENERATION') {
    body = {
      taskType: 'COLOR_GUIDED_GENERATION',
      colorGuidedGenerationParams: {
        text: params.textPrompt.find((x) => x.weight > 0)?.text || '',
        negativeText:
          params.textPrompt.find((x) => x.weight < 0)?.text || undefined,
        referenceImage: params.initImage,
        colors: params.colors!,
      },
      imageGenerationConfig: body.imageGenerationConfig,
    };
  } else if (params.taskType === 'BACKGROUND_REMOVAL') {
    body = {
      taskType: 'BACKGROUND_REMOVAL',
      backgroundRemovalParams: {
        image: params.initImage!,
      },
    };
  } else if (body.textToImageParams) {
    // Extension of TEXT_IMAGE task type (Image Conditioning)
    body.textToImageParams = {
      ...body.textToImageParams,
      conditionImage: params.initImage,
      controlMode: params.controlMode,
      controlStrength: params.controlStrength,
    };
  }
  return JSON.stringify(body);
};

export const createBodyVideoNovaReel = (params: GenerateVideoParams) => {
  return {
    taskType: 'TEXT_VIDEO',
    textToVideoParams: {
      text: params.prompt,
      images: params.images,
    },
    videoGenerationConfig: {
      durationSeconds: params.durationSeconds,
      fps: params.fps,
      dimension: params.dimension,
      seed: params.seed,
    },
  };
};

export const createBodyVideoNovaReelV11 = (params: GenerateVideoParams) => {
  if (params.taskType === 'TEXT_VIDEO') {
    return {
      taskType: 'TEXT_VIDEO',
      textToVideoParams: {
        text: params.prompt,
        images: params.images,
      },
      videoGenerationConfig: {
        durationSeconds: params.durationSeconds,
        fps: params.fps,
        dimension: params.dimension,
        seed: params.seed,
      },
    };
  } else if (params.taskType === 'MULTI_SHOT_AUTOMATED') {
    return {
      taskType: 'MULTI_SHOT_AUTOMATED',
      multiShotAutomatedParams: {
        text: params.prompt,
      },
      videoGenerationConfig: {
        durationSeconds: params.durationSeconds,
        fps: params.fps,
        dimension: params.dimension,
        seed: params.seed,
      },
    };
  } else if (params.taskType === 'MULTI_SHOT_MANUAL') {
    throw new Error('Not implemented yet');
  } else {
    throw new Error(`Unknown task type ${params.taskType}`);
  }
};

export const createBodyVideoLumaRayV2 = (params: GenerateVideoParams) => {
  return {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio,
    loop: params.loop,
    duration: `${params.durationSeconds}s`,
    resolution: params.resolution,
  };
};
