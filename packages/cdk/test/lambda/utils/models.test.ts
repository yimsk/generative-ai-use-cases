import type {
  ConverseCommandOutput,
  ConverseStreamOutput,
} from '@aws-sdk/client-bedrock-runtime';
import type {
  BedrockImageGenerationResponse,
  GenerateImageParams,
} from 'generative-ai-use-cases';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

type ModelsModule = typeof import('../../../lambda/utils/models');

const originalEnv = process.env;
const modelsModulePath = resolve(
  __dirname,
  '../../../lambda/utils/models/index.ts'
);

const baseEnv = {
  MODEL_IDS: JSON.stringify([
    {
      modelId: 'us.anthropic.claude-sonnet-4-6',
      region: 'us-east-1',
      inferenceProfileArn:
        'arn:aws:bedrock:us-east-1:123456789012:inference-profile/text',
    },
    {
      modelId: 'amazon.nova-lite-v1:0',
      region: 'us-west-2',
    },
  ]),
  IMAGE_GENERATION_MODEL_IDS: JSON.stringify([
    {
      modelId: 'amazon.titan-image-generator-v2:0',
      region: 'us-east-1',
      inferenceProfileArn:
        'arn:aws:bedrock:us-east-1:123456789012:inference-profile/image',
    },
  ]),
  VIDEO_GENERATION_MODEL_IDS: JSON.stringify([
    {
      modelId: 'amazon.nova-reel-v1:1',
      region: 'us-west-2',
      inferenceProfileArn:
        'arn:aws:bedrock:us-west-2:123456789012:inference-profile/video',
    },
  ]),
};

const loadModelsModule = (
  envOverrides: Partial<NodeJS.ProcessEnv> = {}
): Promise<ModelsModule> => {
  process.env = {
    ...originalEnv,
    ...baseEnv,
    ...envOverrides,
  };

  const moduleUrl = new URL(
    `?${Date.now()}-${Math.random()}`,
    pathToFileURL(modelsModulePath)
  );

  return import(moduleUrl.href) as Promise<ModelsModule>;
};

const importModelsModuleInChild = (
  envOverrides: Partial<NodeJS.ProcessEnv> = {}
) => {
  const env = {
    ...originalEnv,
    ...baseEnv,
    ...envOverrides,
  };
  const moduleUrl = pathToFileURL(modelsModulePath).href;

  return spawnSync(
    'bun',
    ['--eval', `await import(${JSON.stringify(moduleUrl)})`],
    {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
    }
  );
};

describe('lambda/utils/models', () => {
  afterAll(() => {
    process.env = originalEnv;
  });

  it('keeps the legacy export contract stable', async () => {
    const models = await loadModelsModule();

    expect(Object.keys(models).sort()).toMatchInlineSnapshot(`
      [
        "BEDROCK_IMAGE_GEN_MODELS",
        "BEDROCK_TEXT_GEN_MODELS",
        "BEDROCK_VIDEO_GEN_MODELS",
        "defaultImageGenerationModel",
        "defaultModel",
        "defaultVideoGenerationModel",
        "getInferenceProfileArn",
      ]
    `);
  });

  it('preserves default model selection and inference profile lookup', async () => {
    const models = await loadModelsModule();

    expect(models.defaultModel).toEqual({
      type: 'bedrock',
      modelId: 'amazon.nova-lite-v1:0',
      region: 'us-west-2',
    });
    expect(models.defaultImageGenerationModel).toEqual({
      type: 'bedrock',
      modelId: 'amazon.titan-image-generator-v2:0',
      region: 'us-east-1',
      inferenceProfileArn:
        'arn:aws:bedrock:us-east-1:123456789012:inference-profile/image',
    });
    expect(models.defaultVideoGenerationModel).toEqual({
      type: 'bedrock',
      modelId: 'amazon.nova-reel-v1:1',
      region: 'us-west-2',
      inferenceProfileArn:
        'arn:aws:bedrock:us-west-2:123456789012:inference-profile/video',
    });
    expect(
      models.getInferenceProfileArn('us.anthropic.claude-sonnet-4-6')
    ).toBe('arn:aws:bedrock:us-east-1:123456789012:inference-profile/text');
    expect(
      models.getInferenceProfileArn('amazon.titan-image-generator-v2:0')
    ).toBe('arn:aws:bedrock:us-east-1:123456789012:inference-profile/image');
    expect(models.getInferenceProfileArn('amazon.nova-reel-v1:1')).toBe(
      'arn:aws:bedrock:us-west-2:123456789012:inference-profile/video'
    );
  });

  it('preserves representative request builders and extractors', async () => {
    const models = await loadModelsModule({
      GUARDRAIL_IDENTIFIER: 'guardrail-id',
      GUARDRAIL_VERSION: '1',
    });

    const titanInput = models.BEDROCK_TEXT_GEN_MODELS[
      'amazon.titan-text-premier-v1:0'
    ].createConverseCommandInput(
      [
        { role: 'system', content: 'system: ' },
        { role: 'user', content: 'hello' },
      ],
      '/chat/session-1',
      { type: 'bedrock', modelId: 'amazon.titan-text-premier-v1:0' },
      models.BEDROCK_TEXT_GEN_MODELS['amazon.titan-text-premier-v1:0']
        .defaultParams,
      models.BEDROCK_TEXT_GEN_MODELS['amazon.titan-text-premier-v1:0']
        .usecaseParams
    );

    expect(titanInput).toMatchInlineSnapshot(`
      {
        "guardrailConfig": {
          "guardrailIdentifier": "guardrail-id",
          "guardrailVersion": "1",
          "trace": "disabled",
        },
        "inferenceConfig": {
          "maxTokens": 3000,
          "temperature": 0.7,
          "topP": 1,
        },
        "messages": [
          {
            "content": [
              {
                "text": "system: hello",
              },
            ],
            "role": "user",
          },
        ],
        "modelId": "amazon.titan-text-premier-v1:0",
        "system": [],
      }
    `);

    const converseOutput = {
      output: {
        message: {
          role: 'assistant',
          content: [
            { text: 'answer' },
            { reasoningContent: { reasoningText: { text: 'trace' } } },
          ],
        },
      },
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      stopReason: 'end_turn',
      metrics: { latencyMs: 1 },
      $metadata: {},
    } as ConverseCommandOutput;
    expect(
      models.BEDROCK_TEXT_GEN_MODELS[
        'us.anthropic.claude-sonnet-4-6'
      ].extractConverseOutput(converseOutput)
    ).toEqual({
      text: 'answer\n',
      trace: '\ntrace',
      metadata: {
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      },
    });

    const streamOutput = {
      contentBlockDelta: {
        contentBlockIndex: 0,
        delta: {
          reasoningContent: { text: 'thinking' },
        },
      },
      $metadata: {},
    } as ConverseStreamOutput;
    expect(
      models.BEDROCK_TEXT_GEN_MODELS[
        'us.anthropic.claude-sonnet-4-6'
      ].extractConverseStreamOutput(streamOutput)
    ).toEqual({ text: '', trace: 'thinking' });

    const imageParams: GenerateImageParams = {
      textPrompt: [{ text: 'draw a cat', weight: 1 }],
      cfgScale: 8,
      seed: 9,
      height: 512,
      width: 512,
      step: 30,
      stylePreset: 'photographic',
      initImage: 'base64-image',
      controlMode: 'SEGMENTATION',
      controlStrength: 0.4,
    };

    expect(
      JSON.parse(
        models.BEDROCK_IMAGE_GEN_MODELS[
          'amazon.titan-image-generator-v2:0'
        ].createBodyImage(imageParams)
      )
    ).toMatchInlineSnapshot(`
      {
        "imageGenerationConfig": {
          "cfgScale": 8,
          "height": 512,
          "numberOfImages": 1,
          "quality": "standard",
          "seed": 9,
          "width": 512,
        },
        "imageVariationParams": {
          "images": [
            "base64-image",
          ],
          "similarityStrength": 0.2,
          "text": "draw a cat, photographic",
        },
        "taskType": "IMAGE_VARIATION",
      }
    `);

    const imageResponse = {
      images: ['image-1'],
    } as BedrockImageGenerationResponse;

    expect(
      models.BEDROCK_IMAGE_GEN_MODELS[
        'amazon.titan-image-generator-v2:0'
      ].extractOutputImage(imageResponse)
    ).toBe('image-1');

    expect(
      models.BEDROCK_VIDEO_GEN_MODELS['amazon.nova-reel-v1:1'].createBodyVideo({
        taskType: 'MULTI_SHOT_AUTOMATED',
        prompt: 'a cinematic pan',
        durationSeconds: 6,
        fps: 24,
        dimension: '1280x720',
        seed: 99,
      })
    ).toEqual({
      taskType: 'MULTI_SHOT_AUTOMATED',
      multiShotAutomatedParams: {
        text: 'a cinematic pan',
      },
      videoGenerationConfig: {
        durationSeconds: 6,
        fps: 24,
        dimension: '1280x720',
        seed: 99,
      },
    });
  });

  it('keeps malformed env parsing failures at module load', async () => {
    const result = importModelsModuleInChild({ MODEL_IDS: 'not-json' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /JSON Parse error|Unexpected token|Unexpected end of JSON input/i
    );
  });

  it.each([
    [
      'missing MODEL_IDS',
      { MODEL_IDS: undefined },
      /MODEL_IDS.*required|MODEL_IDS.*empty/i,
    ],
    [
      'empty MODEL_IDS',
      { MODEL_IDS: '[]' },
      /MODEL_IDS.*at least one|MODEL_IDS.*empty/i,
    ],
    [
      'whitespace IMAGE_GENERATION_MODEL_IDS',
      { IMAGE_GENERATION_MODEL_IDS: '   ' },
      /IMAGE_GENERATION_MODEL_IDS.*required|IMAGE_GENERATION_MODEL_IDS.*empty/i,
    ],
    [
      'invalid enum model id',
      {
        MODEL_IDS: JSON.stringify([
          { modelId: 'not-a-real-model', region: 'us-east-1' },
        ]),
      },
      /unsupported|not a text model/i,
    ],
  ])('%s', async (_name, envOverrides, pattern) => {
    const result = importModelsModuleInChild(envOverrides);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(pattern);
  });
});
