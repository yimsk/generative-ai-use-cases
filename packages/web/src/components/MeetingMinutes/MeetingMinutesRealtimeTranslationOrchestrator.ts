import { Transcript } from 'generative-ai-use-cases';
import {
  updateTranslationSegments,
  type TranslationSegment,
} from './MeetingMinutesSegmentSplitter';

export interface RealtimeSegment {
  resultId: string;
  source: 'microphone' | 'screen';
  startTime: number;
  endTime: number;
  isPartial: boolean;
  transcripts: Transcript[];
  sessionId: number;
  languageCode?: string;
  translationSegments: TranslationSegment[];
}

export interface SourceTranscriptSegment {
  resultId: string;
  startTime: number;
  endTime: number;
  isPartial: boolean;
  transcripts: Transcript[];
  languageCode?: string;
}

export const resolveSegmentLanguage = (
  languageCode: string | undefined,
  primaryLanguage: string
): string | undefined => {
  if (languageCode) {
    return languageCode;
  }

  return primaryLanguage === 'auto' ? undefined : primaryLanguage;
};

export const createRealtimeSegment = ({
  rawSegment,
  source,
  sessionId,
  primaryLanguage,
}: {
  rawSegment: SourceTranscriptSegment;
  source: RealtimeSegment['source'];
  sessionId: number;
  primaryLanguage: string;
}): RealtimeSegment => {
  const text = rawSegment.transcripts
    .map((transcript) => transcript.transcript)
    .join(' ')
    .trim();
  const languageCode = resolveSegmentLanguage(
    rawSegment.languageCode,
    primaryLanguage
  );

  return {
    resultId: rawSegment.resultId,
    source,
    startTime: rawSegment.startTime,
    endTime: rawSegment.endTime,
    isPartial: rawSegment.isPartial,
    transcripts: rawSegment.transcripts,
    sessionId,
    languageCode,
    translationSegments: updateTranslationSegments(text, languageCode, []),
  };
};

export const mergeRealtimeSegment = (
  currentSegments: RealtimeSegment[],
  newSegment: RealtimeSegment
): RealtimeSegment[] => {
  const existingIndex = currentSegments.findIndex(
    (segment) =>
      segment.resultId === newSegment.resultId &&
      segment.source === newSegment.source
  );
  const currentText = newSegment.transcripts
    .map((transcript) => transcript.transcript)
    .join(' ')
    .trim();

  if (existingIndex === -1) {
    return [...currentSegments, newSegment];
  }

  const nextSegments = [...currentSegments];
  const currentSegment = nextSegments[existingIndex];

  nextSegments[existingIndex] = {
    ...newSegment,
    translationSegments: updateTranslationSegments(
      currentText,
      newSegment.languageCode,
      currentSegment.translationSegments
    ),
  };

  return nextSegments;
};

export const sortRealtimeSegments = (
  realtimeSegments: RealtimeSegment[]
): RealtimeSegment[] => {
  return [...realtimeSegments].sort((left, right) => {
    if (left.sessionId !== right.sessionId) {
      return left.sessionId - right.sessionId;
    }

    return left.startTime - right.startTime;
  });
};

export const buildRealtimeText = ({
  realtimeSegments,
  speakerMapping,
  formatTime,
}: {
  realtimeSegments: RealtimeSegment[];
  speakerMapping: Record<string, string>;
  formatTime: (seconds: number) => string;
}): string => {
  return sortRealtimeSegments(realtimeSegments)
    .map((segment) => {
      const timeLabel = `[${formatTime(segment.startTime)}]`;
      const partialIndicator = segment.isPartial ? ' (...)' : '';

      return segment.transcripts
        .map((transcript) => {
          const speakerLabel = transcript.speakerLabel
            ? `${speakerMapping[transcript.speakerLabel] || transcript.speakerLabel}: `
            : '';

          return `${timeLabel} ${speakerLabel}${transcript.transcript}${partialIndicator}`;
        })
        .join('\n');
    })
    .join('\n');
};
