import type { Transcript } from 'generative-ai-use-cases';
import type { MonitorConfig } from '../components/RealtimeMonitor/MonitorSetup';
import type { DisplaySegment } from '../components/RealtimeMonitor/TranscriptSidebar';
import type { RawTranscript } from '../hooks/useAudioTranscription';
import { resolveSourceLanguage } from './realtimeTranslationDirection';

const isJapaneseLanguage = (languageCode?: string) => {
  return languageCode?.toLowerCase().startsWith('ja') ?? false;
};

const isEnglishLanguage = (languageCode?: string) => {
  return languageCode?.toLowerCase().startsWith('en') ?? false;
};

const formatTimestamp = (seconds: number) => {
  const date = new Date(Math.max(seconds, 0) * 1000);
  return date.toISOString().slice(14, 19);
};

const getSpeakerLabel = (transcripts: Transcript[]) => {
  const speaker = transcripts.find((transcript) => transcript.speakerLabel);
  return speaker?.speakerLabel;
};

export const getSourceText = (transcripts: Transcript[]) => {
  return transcripts
    .map((transcript) => transcript.transcript)
    .join(' ')
    .trim();
};

const buildDisplayTexts = (
  sourceText: string,
  translatedText: string,
  config: MonitorConfig,
  transcripts: Transcript[],
  detectedLanguageCode?: string
) => {
  const sourceLanguage = resolveSourceLanguage(
    transcripts,
    detectedLanguageCode,
    config.primaryLanguage,
    config.secondaryLanguage
  );

  if (isJapaneseLanguage(sourceLanguage)) {
    return {
      jaText: sourceText,
      enText: translatedText,
    };
  }

  if (isEnglishLanguage(sourceLanguage)) {
    return {
      jaText: translatedText,
      enText: sourceText,
    };
  }

  if (isJapaneseLanguage(config.secondaryLanguage)) {
    return {
      jaText: translatedText,
      enText: sourceText,
    };
  }

  return {
    jaText: sourceText,
    enText: translatedText,
  };
};

export const upsertDisplaySegment = (
  currentSegments: DisplaySegment[],
  rawSegment: RawTranscript,
  config: MonitorConfig,
  translatedText?: string
) => {
  const sourceText = getSourceText(rawSegment.transcripts);
  const existingSegment = currentSegments.find(
    (segment) => segment.id === rawSegment.resultId
  );
  const nextTranslatedText =
    translatedText ?? existingSegment?.translatedText ?? '';
  const displayTexts = buildDisplayTexts(
    sourceText,
    nextTranslatedText,
    config,
    rawSegment.transcripts,
    rawSegment.languageCode
  );
  const nextSegment: DisplaySegment = {
    id: rawSegment.resultId,
    timestamp: formatTimestamp(rawSegment.startTime),
    sourceText,
    translatedText: nextTranslatedText,
    speaker: getSpeakerLabel(rawSegment.transcripts),
    ...displayTexts,
  };

  const existingIndex = currentSegments.findIndex(
    (segment) => segment.id === rawSegment.resultId
  );

  if (existingIndex === -1) {
    return [...currentSegments, nextSegment];
  }

  return currentSegments.map((segment, index) => {
    return index === existingIndex ? nextSegment : segment;
  });
};
