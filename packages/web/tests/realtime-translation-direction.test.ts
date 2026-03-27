import { describe, expect, it } from 'vitest';
import type { Transcript } from 'generative-ai-use-cases';
import {
  getTranslationTarget,
  inferLanguageFromText,
  resolveSourceLanguage,
} from '../src/utils/realtimeTranslationDirection';

const transcripts = (text: string): Transcript[] => [{ transcript: text }];
const japaneseSample = String.fromCodePoint(
  0x305c,
  0x3072,
  0x3054,
  0x89a7,
  0x304f,
  0x3060,
  0x3055,
  0x3044
);

describe('realtimeTranslationDirection', () => {
  it('infers japanese from japanese text', () => {
    expect(inferLanguageFromText(japaneseSample)).toBe('ja-jp');
  });

  it('infers english from ascii text', () => {
    expect(inferLanguageFromText('Please take a look')).toBe('en-us');
  });

  it('resolves english source from transcript text even when primary is japanese', () => {
    expect(
      resolveSourceLanguage(
        transcripts('Please take a look'),
        undefined,
        'ja-JP',
        'en-US'
      )
    ).toBe('en-us');
  });

  it('routes english source to primary language in bidirectional mode', () => {
    expect(
      getTranslationTarget('bidirectional', 'en-us', 'ja-JP', 'en-US')
    ).toBe('ja-JP');
  });

  it('routes japanese source to secondary language in bidirectional mode', () => {
    expect(
      getTranslationTarget('bidirectional', 'ja-jp', 'ja-JP', 'en-US')
    ).toBe('en-US');
  });

  it('keeps secondary language fallback when source cannot be resolved', () => {
    expect(
      getTranslationTarget('bidirectional', undefined, 'ja-JP', 'en-US')
    ).toBe('en-US');
  });
});
