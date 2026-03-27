import { describe, expect, test } from 'vitest';
import { sortSegmentsByLanguage } from '../src/utils/realtimeTranslationSplit';

type SourceLanguage = 'en' | 'ja';

interface Segment {
  text: string;
  speakerLabel: string;
  timestamp: number;
  isPartial: boolean;
  sourceLanguage: SourceLanguage;
}

interface TranslationResponse {
  text: string;
}

describe('sortSegmentsByLanguage', () => {
  test('routes a Japanese source segment to leftSegments with English text', () => {
    const segments: Segment[] = [
      {
        text: 'jp-source-1',
        speakerLabel: 'spk_0',
        timestamp: 1710000000,
        isPartial: false,
        sourceLanguage: 'ja',
      },
    ];
    const translations: TranslationResponse[] = [{ text: 'EN|hello' }];

    expect(sortSegmentsByLanguage(segments, translations)).toEqual({
      leftSegments: [
        {
          text: 'hello',
          speakerLabel: 'spk_0',
          timestamp: 1710000000,
          isPartial: false,
          sourceLanguage: 'ja',
        },
      ],
      rightSegments: [],
    });
  });

  test('routes an English source segment to rightSegments with Japanese text', () => {
    const segments: Segment[] = [
      {
        text: 'Hello',
        speakerLabel: 'spk_1',
        timestamp: 1710000001,
        isPartial: false,
        sourceLanguage: 'en',
      },
    ];
    const translations: TranslationResponse[] = [{ text: 'JP|jp-target-1' }];

    expect(sortSegmentsByLanguage(segments, translations)).toEqual({
      leftSegments: [],
      rightSegments: [
        {
          text: 'jp-target-1',
          speakerLabel: 'spk_1',
          timestamp: 1710000001,
          isPartial: false,
          sourceLanguage: 'en',
        },
      ],
    });
  });

  test('preserves sourceLanguage on routed segments', () => {
    const segments: Segment[] = [
      {
        text: 'jp-source-2',
        speakerLabel: 'spk_2',
        timestamp: 1710000002,
        isPartial: false,
        sourceLanguage: 'ja',
      },
      {
        text: 'Thank you',
        speakerLabel: 'spk_3',
        timestamp: 1710000003,
        isPartial: true,
        sourceLanguage: 'en',
      },
    ];
    const translations: TranslationResponse[] = [
      { text: 'EN|Thank you' },
      { text: 'JP|jp-target-2' },
    ];

    const result = sortSegmentsByLanguage(segments, translations);

    expect(result.leftSegments[0]?.sourceLanguage).toBe('ja');
    expect(result.rightSegments[0]?.sourceLanguage).toBe('en');
  });

  test('preserves speaker labels in output segments', () => {
    const segments: Segment[] = [
      {
        text: 'jp-source-3',
        speakerLabel: 'spk_4',
        timestamp: 1710000004,
        isPartial: false,
        sourceLanguage: 'ja',
      },
      {
        text: 'Good morning',
        speakerLabel: 'spk_5',
        timestamp: 1710000005,
        isPartial: false,
        sourceLanguage: 'en',
      },
    ];
    const translations: TranslationResponse[] = [
      { text: 'EN|Good morning' },
      { text: 'JP|jp-target-3' },
    ];

    const result = sortSegmentsByLanguage(segments, translations);

    expect(result.leftSegments[0]?.speakerLabel).toBe('spk_4');
    expect(result.rightSegments[0]?.speakerLabel).toBe('spk_5');
  });

  test('returns empty arrays for empty input', () => {
    expect(sortSegmentsByLanguage([], [])).toEqual({
      leftSegments: [],
      rightSegments: [],
    });
  });

  test('skips translations with a mismatched language prefix', () => {
    const segments: Segment[] = [
      {
        text: 'Hello',
        speakerLabel: 'spk_0',
        timestamp: 1710000010,
        isPartial: false,
        sourceLanguage: 'en',
      },
    ];

    const translations: TranslationResponse[] = [{ text: 'EN|Hello' }];

    expect(sortSegmentsByLanguage(segments, translations)).toEqual({
      leftSegments: [],
      rightSegments: [],
    });
  });
});
