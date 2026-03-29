import * as cdk from 'aws-cdk-lib';
import { ProcessedStackInput } from '../lib/stack-input';
import {
  mergeInferenceProfileArns,
  collectUniqueRegions,
} from '../lib/create-stacks';
import { ApplicationInferenceProfileStack } from '../lib/application-inference-profile-stack';

describe('create-stacks helpers', () => {
  describe('collectUniqueRegions', () => {
    it('collects unique regions from all model arrays', () => {
      const params = {
        modelIds: [
          { modelId: 'model-a', region: 'us-east-1' },
          { modelId: 'model-b', region: 'us-west-2' },
        ],
        imageGenerationModelIds: [{ modelId: 'img-a', region: 'us-east-1' }],
        videoGenerationModelIds: [
          { modelId: 'vid-a', region: 'ap-northeast-1' },
        ],
        speechToSpeechModelIds: [] as { modelId: string; region: string }[],
      } as Partial<ProcessedStackInput> as ProcessedStackInput;

      const regions = collectUniqueRegions(params);
      expect(regions).toEqual(
        expect.arrayContaining(['us-east-1', 'us-west-2', 'ap-northeast-1'])
      );
      expect(regions).toHaveLength(3);
    });

    it('returns empty array when all model arrays are empty', () => {
      const params = {
        modelIds: [],
        imageGenerationModelIds: [],
        videoGenerationModelIds: [],
        speechToSpeechModelIds: [],
      } as Partial<ProcessedStackInput> as ProcessedStackInput;

      const regions = collectUniqueRegions(params);
      expect(regions).toEqual([]);
    });
  });

  describe('mergeInferenceProfileArns', () => {
    it('returns original modelIds when no inference profile stacks match', () => {
      const app = new cdk.App();
      const modelIds = [
        {
          modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
          region: 'us-east-1',
        },
      ];

      // Empty inferenceProfileStacks — no matches
      const result = mergeInferenceProfileArns(modelIds, {}, app);

      expect(result).toEqual(modelIds);
      expect(result[0].inferenceProfileArn).toBeUndefined();
    });

    it('returns original modelIds when RemoteOutputs lookup fails (fallback)', () => {
      const app = new cdk.App();
      const modelIds = [
        {
          modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
          region: 'us-east-1',
        },
      ];

      // Non-matching region in inferenceProfileStacks — stack exists but region won't match
      const result = mergeInferenceProfileArns(
        modelIds,
        { 'us-west-2': {} as unknown as ApplicationInferenceProfileStack },
        app
      );

      // us-east-1 model has no stack for its region
      expect(result).toEqual(modelIds);
      expect(result[0].inferenceProfileArn).toBeUndefined();
    });

    it('returns deep-copied modelIds without mutation of input', () => {
      const app = new cdk.App();
      const modelIds = [
        { modelId: 'model-a', region: 'us-east-1' },
        { modelId: 'model-b', region: 'us-west-2' },
      ];

      const result = mergeInferenceProfileArns(modelIds, {}, app);

      // Result is a new array (not same reference)
      expect(result).not.toBe(modelIds);
      // Each element is a new object
      expect(result[0]).not.toBe(modelIds[0]);
      // Values are preserved
      expect(result[0].modelId).toBe('model-a');
      expect(result[1].modelId).toBe('model-b');
    });
  });
});
