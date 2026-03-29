import {
  BedrockImageGenerationResponse,
  Metadata,
  StreamingChunk,
  StabilityAI2024ModelResponse,
} from 'generative-ai-use-cases';
import {
  ConverseCommandOutput,
  ConverseStreamOutput,
} from '@aws-sdk/client-bedrock-runtime';

export const extractConverseOutput = (
  output: ConverseCommandOutput
): StreamingChunk => {
  if (output.output && output.output.message && output.output.message.content) {
    // output.message.content is an array, but usually only one element is returned, so join is not necessary.
    // However, to implement on the safe side, join is implemented so that it works even if an array with multiple elements comes.
    const responseText = output.output.message.content
      .map((block) => block.text)
      .join('\n');
    const reasoningText = output.output.message.content
      .map((block) => {
        if (block.reasoningContent) {
          return block.reasoningContent.reasoningText?.text;
        }
        return '';
      })
      .join('\n');
    const metadata = {
      usage: output.usage,
    } as Metadata;
    return { text: responseText, trace: reasoningText, metadata };
  }

  return { text: '', trace: '' };
};

export const extractConverseStreamOutput = (
  output: ConverseStreamOutput
): StreamingChunk => {
  if (output.contentBlockDelta && output.contentBlockDelta.delta?.text) {
    return { text: output.contentBlockDelta.delta?.text };
  } else if (
    output.contentBlockDelta &&
    output.contentBlockDelta.delta?.reasoningContent
  ) {
    const reasoningText =
      output.contentBlockDelta.delta?.reasoningContent?.text;
    return { text: '', trace: reasoningText };
  } else if (output.metadata && output.metadata.usage) {
    return {
      text: '',
      metadata: { usage: output.metadata.usage } as Metadata,
    };
  }

  return { text: '', trace: '' };
};

export const extractOutputImageStableDiffusion = (
  response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse
) => {
  if ('result' in response) {
    // BedrockImageGenerationResponse
    if (response.result !== 'success') {
      throw new Error('Failed to invoke model');
    }
    return response.artifacts[0].base64;
  } else {
    // StabilityAI2024ModelResponse
    throw new Error('Unexpected response type for Stable Diffusion');
  }
};

export const extractOutputImageStabilityAI2024Model = (
  response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse
) => {
  if ('finish_reasons' in response) {
    // StabilityAI2024ModelResponse
    if (response.finish_reasons[0] !== null) {
      if (response.finish_reasons[0] == 'Filter reason: prompt') {
        throw new Error(
          response.finish_reasons[0] + ': Japanese prompts are not supported'
        );
      }
      throw new Error(response.finish_reasons[0]);
    }
    return response.images[0];
  } else {
    // BedrockImageGenerationResponse
    throw new Error('Unexpected response type for Stability AI 2024 Model');
  }
};

export const extractOutputImageAmazonImage = (
  response: BedrockImageGenerationResponse | StabilityAI2024ModelResponse
) => {
  if ('images' in response) {
    return response.images[0];
  } else {
    throw new Error('Unexpected response type for Amazon Image');
  }
};
