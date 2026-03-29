import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';

const mockModelMetadata = {
  'anthropic.claude-3-sonnet-20240229-v1:0': {
    displayName: 'Claude 3 Sonnet',
    flags: { text: true, image: true, light: true },
  },
  'anthropic.claude-3-haiku-20240307-v1:0': {
    displayName: 'Claude 3 Haiku',
    flags: { text: true, light: true },
  },
  'amazon.titan-image-generator-v1:0': {
    displayName: 'Titan Image',
    flags: { image_gen: true },
  },
  'amazon.nova-reel-v1:0': {
    displayName: 'Nova Reel',
    flags: { video_gen: true },
  },
};

vi.mock('@generative-ai-use-cases/common', () => ({
  CRI_PREFIX_PATTERN: /-cri-([a-z0-9]+)$/,
  modelMetadata: mockModelMetadata,
}));

describe('useModel exports', () => {
  const baseEnv = {
    VITE_APP_MODEL_REGION: 'us-east-1',
    VITE_APP_MODEL_IDS: JSON.stringify([
      {
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        region: 'us-east-1',
      },
      {
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        region: 'us-west-2',
      },
      { modelId: 'custom-model-cri-abc123', region: 'us-east-1' },
      { modelId: 'custom-model-cri-def456', region: 'us-west-2' },
    ]),
    VITE_APP_ENDPOINT_NAMES: JSON.stringify([
      { modelId: 'sagemaker-model-1', region: 'us-east-1' },
    ]),
    VITE_APP_IMAGE_MODEL_IDS: JSON.stringify([
      { modelId: 'amazon.titan-image-generator-v1:0', region: 'us-east-1' },
    ]),
    VITE_APP_VIDEO_MODEL_IDS: JSON.stringify([
      { modelId: 'amazon.nova-reel-v1:0', region: 'us-east-1' },
    ]),
    VITE_APP_SPEECH_TO_SPEECH_MODEL_IDS: JSON.stringify([
      { modelId: 'amazon.nova-sonic-v1:0', region: 'us-east-1' },
    ]),
    VITE_APP_BUILTIN_AGENTS_JSON: JSON.stringify([
      { displayName: 'Search Agent', description: 'Search the web' },
    ]),
    VITE_APP_CUSTOM_AGENTS_JSON: JSON.stringify([
      { displayName: 'Custom Agent', description: 'Custom tool' },
    ]),
    VITE_APP_FLOWS: JSON.stringify([
      {
        flowId: 'flow-1',
        aliasId: 'alias-1',
        flowName: 'Test Flow',
        description: 'Test',
      },
    ]),
  };

  const setEnv = (overrides: Record<string, string> = {}) => {
    vi.unstubAllEnvs();
    Object.entries(baseEnv).forEach(([key, value]) => {
      vi.stubEnv(key, value);
    });
    Object.entries(overrides).forEach(([key, value]) => {
      vi.stubEnv(key, value);
    });
  };

  const importUseModelWithEnv = async (overrides: Record<string, string>) => {
    vi.resetModules();
    setEnv(overrides);

    try {
      return await import('../../src/hooks/useModel');
    } finally {
      setEnv();
    }
  };

  beforeAll(() => {
    setEnv();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  describe('MODELS export', () => {
    it('should export MODELS with correct structure', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS).toBeDefined();
      expect(MODELS.modelRegion).toBe('us-east-1');
      expect(Array.isArray(MODELS.modelIds)).toBe(true);
      expect(Array.isArray(MODELS.allModelIds)).toBe(true);
      expect(Array.isArray(MODELS.modelIdsInModelRegion)).toBe(true);
      expect(typeof MODELS.modelMetadata).toBe('object');
      expect(typeof MODELS.getModelMetadata).toBe('function');
      expect(typeof MODELS.modelDisplayName).toBe('function');
      expect(Array.isArray(MODELS.lightModelIds)).toBe(true);
      expect(Array.isArray(MODELS.visionModelIds)).toBe(true);
      expect(typeof MODELS.visionEnabled).toBe('boolean');
      expect(Array.isArray(MODELS.imageGenModelIds)).toBe(true);
      expect(Array.isArray(MODELS.videoGenModelIds)).toBe(true);
      expect(Array.isArray(MODELS.agentNames)).toBe(true);
      expect(Array.isArray(MODELS.agents)).toBe(true);
      expect(Array.isArray(MODELS.textModels)).toBe(true);
      expect(Array.isArray(MODELS.imageGenModels)).toBe(true);
      expect(Array.isArray(MODELS.videoGenModels)).toBe(true);
      expect(Array.isArray(MODELS.agentModels)).toBe(true);
      expect(typeof MODELS.agentEnabled).toBe('boolean');
      expect(MODELS.searchAgent).toBeDefined();
      expect(Array.isArray(MODELS.flows)).toBe(true);
      expect(typeof MODELS.flowChatEnabled).toBe('boolean');
      expect(Array.isArray(MODELS.speechToSpeechModelIds)).toBe(true);
      expect(Array.isArray(MODELS.speechToSpeechModels)).toBe(true);
    });

    it('should parse bedrock model IDs correctly', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.modelIds).toContain(
        'anthropic.claude-3-sonnet-20240229-v1:0'
      );
      expect(MODELS.modelIds).toContain(
        'anthropic.claude-3-haiku-20240307-v1:0'
      );
      expect(MODELS.modelIds).toContain('custom-model-cri-abc123');
      expect(MODELS.modelIds).toContain('custom-model-cri-def456');
      expect(MODELS.modelIds).toHaveLength(4);
    });

    it('should combine bedrock and sagemaker model IDs in allModelIds', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.allModelIds).toContain(
        'anthropic.claude-3-sonnet-20240229-v1:0'
      );
      expect(MODELS.allModelIds).toContain('sagemaker-model-1');
      expect(MODELS.allModelIds).toHaveLength(5);
    });

    it('should filter models by model region', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.modelIdsInModelRegion).toContain(
        'anthropic.claude-3-sonnet-20240229-v1:0'
      );
      expect(MODELS.modelIdsInModelRegion).toContain('custom-model-cri-abc123');
      expect(MODELS.modelIdsInModelRegion).not.toContain(
        'anthropic.claude-3-haiku-20240307-v1:0'
      );
      expect(MODELS.modelIdsInModelRegion).toHaveLength(2);
    });

    it('should identify light models correctly', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.lightModelIds).toContain(
        'anthropic.claude-3-sonnet-20240229-v1:0'
      );
      expect(MODELS.lightModelIds).toContain(
        'anthropic.claude-3-haiku-20240307-v1:0'
      );
      expect(MODELS.lightModelIds).toHaveLength(2);
    });

    it('should identify vision models correctly', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.visionModelIds).toContain(
        'anthropic.claude-3-sonnet-20240229-v1:0'
      );
      expect(MODELS.visionModelIds).not.toContain(
        'anthropic.claude-3-haiku-20240307-v1:0'
      );
      expect(MODELS.visionModelIds).toHaveLength(1);
      expect(MODELS.visionEnabled).toBe(true);
    });

    it('should parse image generation model IDs', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.imageGenModelIds).toContain(
        'amazon.titan-image-generator-v1:0'
      );
      expect(MODELS.imageGenModelIds).toHaveLength(1);
    });

    it('should parse video generation model IDs', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.videoGenModelIds).toContain('amazon.nova-reel-v1:0');
      expect(MODELS.videoGenModelIds).toHaveLength(1);
    });

    it('should parse speech to speech model IDs', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.speechToSpeechModelIds).toContain('amazon.nova-sonic-v1:0');
      expect(MODELS.speechToSpeechModelIds).toHaveLength(1);
    });

    it('should parse agents correctly', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.agentNames).toContain('Search Agent');
      expect(MODELS.agentNames).toContain('Custom Agent');
      expect(MODELS.agentNames).toHaveLength(2);
      expect(MODELS.agentEnabled).toBe(true);
      expect(MODELS.agents).toHaveLength(2);
      expect(MODELS.agents[0]).toHaveProperty('displayName');
      expect(MODELS.agents[0]).toHaveProperty('description');
    });

    it('should identify search agent', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.searchAgent).toBe('Search Agent');
    });

    it('should parse flows correctly', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.flows).toHaveLength(1);
      expect(MODELS.flows[0]).toHaveProperty('flowId', 'flow-1');
      expect(MODELS.flowChatEnabled).toBe(true);
    });
  });

  describe('textModels export', () => {
    it('should export textModels array with bedrock and sagemaker models', async () => {
      const { textModels } = await import('../../src/hooks/useModel');

      expect(Array.isArray(textModels)).toBe(true);
      expect(textModels).toHaveLength(5);

      const bedrockModel = textModels.find(
        (m) => m.modelId === 'anthropic.claude-3-sonnet-20240229-v1:0'
      );
      expect(bedrockModel).toBeDefined();
      expect(bedrockModel?.type).toBe('bedrock');
      expect(bedrockModel?.region).toBe('us-east-1');

      const sagemakerModel = textModels.find(
        (m) => m.modelId === 'sagemaker-model-1'
      );
      expect(sagemakerModel).toBeDefined();
      expect(sagemakerModel?.type).toBe('sagemaker');
      expect(sagemakerModel?.region).toBe('us-east-1');
    });
  });

  describe('modelDisplayName helper', () => {
    it('should return display name from metadata', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(
        MODELS.modelDisplayName('anthropic.claude-3-sonnet-20240229-v1:0')
      ).toBe('Claude 3 Sonnet');
    });

    it('should return modelId if no metadata found', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.modelDisplayName('unknown-model-id')).toBe(
        'unknown-model-id'
      );
    });

    it('should add CRI suffix for duplicate base models', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      expect(MODELS.modelDisplayName('custom-model-cri-abc123')).toBe(
        'custom-model-cri-abc123 (ABC123)'
      );
      expect(MODELS.modelDisplayName('custom-model-cri-def456')).toBe(
        'custom-model-cri-def456 (DEF456)'
      );
    });
  });

  describe('getModelMetadata helper', () => {
    it('should return metadata for known models', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      const metadata = MODELS.getModelMetadata(
        'anthropic.claude-3-sonnet-20240229-v1:0'
      );
      expect(metadata.displayName).toBe('Claude 3 Sonnet');
      expect(metadata.flags).toHaveProperty('text', true);
      expect(metadata.flags).toHaveProperty('image', true);
    });

    it('should return fallback for unknown models', async () => {
      const { MODELS } = await import('../../src/hooks/useModel');

      const metadata = MODELS.getModelMetadata('unknown-model');
      expect(metadata.displayName).toBe('unknown-model');
      expect(metadata.flags).toEqual({});
    });
  });

  describe('findModelByModelId helper', () => {
    it('should return a deep copy of the found model', async () => {
      const { findModelByModelId, textModels } = await import(
        '../../src/hooks/useModel'
      );

      const model = findModelByModelId(
        'anthropic.claude-3-sonnet-20240229-v1:0'
      );

      expect(model).toBeDefined();
      expect(model?.modelId).toBe('anthropic.claude-3-sonnet-20240229-v1:0');
      expect(model?.type).toBe('bedrock');

      const originalModel = textModels.find(
        (m) => m.modelId === 'anthropic.claude-3-sonnet-20240229-v1:0'
      );
      model!.region = 'modified-region';
      expect(originalModel?.region).toBe('us-east-1');
    });

    it('should find models from imageGenModels', async () => {
      const { findModelByModelId } = await import('../../src/hooks/useModel');

      const model = findModelByModelId('amazon.titan-image-generator-v1:0');

      expect(model).toBeDefined();
      expect(model?.type).toBe('bedrock');
    });

    it('should find models from videoGenModels', async () => {
      const { findModelByModelId } = await import('../../src/hooks/useModel');

      const model = findModelByModelId('amazon.nova-reel-v1:0');

      expect(model).toBeDefined();
      expect(model?.type).toBe('bedrock');
    });

    it('should find models from agentModels', async () => {
      const { findModelByModelId } = await import('../../src/hooks/useModel');

      const model = findModelByModelId('Search Agent');

      expect(model).toBeDefined();
      expect(model?.type).toBe('bedrockAgent');
    });

    it('should return undefined for unknown model', async () => {
      const { findModelByModelId } = await import('../../src/hooks/useModel');

      const model = findModelByModelId('nonexistent-model');

      expect(model).toBeUndefined();
    });
  });

  describe('config parsing failures', () => {
    it('should fail fast for invalid agent JSON', async () => {
      await expect(
        importUseModelWithEnv({
          VITE_APP_BUILTIN_AGENTS_JSON: '{invalid-json',
        })
      ).rejects.toThrow(/Invalid builtin agents/);
    });

    it('should fail fast for invalid flows JSON', async () => {
      await expect(
        importUseModelWithEnv({
          VITE_APP_FLOWS: '{invalid-json',
        })
      ).rejects.toThrow(/Invalid VITE_APP_FLOWS/);
    });
  });
});
