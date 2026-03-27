import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useMicrophone from './useMicrophone';
import useTranslationCore from './useTranslationCore';
import useChatApi from './useChatApi';
import { MODELS, findModelByModelId } from './useModel';
import { getPrompter } from '../prompts';
import type { RealtimeTranslationSplitParams } from '../prompts';
import {
  sortSegmentsByLanguage,
  type Segment,
  type SourceLanguage,
} from '../utils/realtimeTranslationSplit';

export { sortSegmentsByLanguage } from '../utils/realtimeTranslationSplit';
export type {
  Segment,
  SourceLanguage,
} from '../utils/realtimeTranslationSplit';

interface TranslationResponse {
  text: string;
}

interface SourceSegment extends Segment {
  id: string;
}

interface TranslationEntry {
  sourceText: string;
  translationText: string;
}

const TRANSLATION_ID = 'realtime-translation-split';

const normalizeSourceLanguage = (
  languageCode?: string
): SourceLanguage | null => {
  if (languageCode?.startsWith('ja')) {
    return 'ja';
  }

  if (languageCode?.startsWith('en')) {
    return 'en';
  }

  return null;
};

const sanitizeTranslationText = (text: string): string => {
  return text.replace(/(<output>|<\/output>|<o>|<\/o>)/g, '').trim();
};

const collectPredictStreamText = async (
  stream: AsyncIterable<string | Uint8Array | undefined>
): Promise<string> => {
  let fullResponse = '';
  let lineBuffer = '';

  const flushLine = (line: string) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      return;
    }

    const payload = (() => {
      try {
        return JSON.parse(trimmedLine) as { text?: string };
      } catch {
        return null;
      }
    })();

    if (payload?.text) {
      fullResponse += payload.text;
    }
  };

  for await (const chunk of stream) {
    if (!chunk) {
      continue;
    }

    lineBuffer +=
      typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);

    let newlineIndex = lineBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = lineBuffer.slice(0, newlineIndex);
      lineBuffer = lineBuffer.slice(newlineIndex + 1);
      flushLine(line);
      newlineIndex = lineBuffer.indexOf('\n');
    }
  }

  flushLine(lineBuffer);
  return fullResponse;
};

const useRealtimeTranslationSplit = () => {
  const {
    startTranscription,
    stopTranscription,
    recording,
    clearTranscripts,
    rawTranscripts,
    error: microphoneError,
    clientReady,
  } = useMicrophone();
  const { translate } = useTranslationCore();
  const { predictStream } = useChatApi();

  const modelId = useMemo(() => {
    const preferredModelId = MODELS.lightModelIds[0] ?? MODELS.modelIds[0];
    return preferredModelId ?? MODELS.textModels[0]?.modelId ?? '';
  }, []);

  const sourceSegments = useMemo<SourceSegment[]>(() => {
    return rawTranscripts.flatMap((rawTranscript) => {
      const sourceLanguage = normalizeSourceLanguage(
        rawTranscript.languageCode
      );

      if (!sourceLanguage) {
        return [];
      }

      return rawTranscript.transcripts
        .filter((transcript) => transcript.transcript.trim().length > 0)
        .map((transcript, index) => ({
          id: `${rawTranscript.resultId}-${index}`,
          text: transcript.transcript,
          speakerLabel: transcript.speakerLabel ?? '',
          timestamp: rawTranscript.startTime,
          isPartial: rawTranscript.isPartial,
          sourceLanguage,
        }));
    });
  }, [rawTranscripts]);

  const [translationsById, setTranslationsById] = useState<
    Record<string, TranslationEntry>
  >({});
  const [error, setError] = useState<Error | null>(null);
  const requestSequenceRef = useRef<Record<string, number>>({});
  const translationsByIdRef = useRef<Record<string, TranslationEntry>>({});

  useEffect(() => {
    if (microphoneError) {
      setError(microphoneError);
    }
  }, [microphoneError]);

  const streamTranslation = useCallback(
    async (segment: SourceSegment): Promise<string> => {
      if (!modelId) {
        throw new Error('Model not found');
      }

      const model = findModelByModelId(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      const prompter = getPrompter(modelId);
      const promptParams: RealtimeTranslationSplitParams = {
        text: segment.text,
        sourceLanguage: segment.sourceLanguage,
        speaker: segment.speakerLabel || undefined,
      };

      const stream = predictStream({
        model,
        messages: [
          {
            role: 'system',
            content: prompter.systemContext('/translate'),
          },
          {
            role: 'user',
            content: prompter.realtimeTranslationSplitPrompt(promptParams),
          },
        ],
        id: TRANSLATION_ID,
      });

      const fullResponse = await collectPredictStreamText(stream);

      const sanitized = sanitizeTranslationText(fullResponse);
      if (sanitized) {
        return sanitized;
      }

      const fallbackTranslation = await translate(segment.text, {
        modelId,
        targetLanguage:
          segment.sourceLanguage === 'ja' ? 'English' : 'Japanese',
      });

      const prefix = segment.sourceLanguage === 'ja' ? 'EN' : 'JP';
      return `${prefix}|${fallbackTranslation.trim()}`;
    },
    [modelId, predictStream, translate]
  );

  useEffect(() => {
    let cancelled = false;

    sourceSegments
      .filter((segment) => !segment.isPartial)
      .forEach((segment) => {
        const existingTranslation = translationsByIdRef.current[segment.id];
        if (existingTranslation?.sourceText === segment.text) {
          return;
        }

        const requestId = (requestSequenceRef.current[segment.id] ?? 0) + 1;
        requestSequenceRef.current[segment.id] = requestId;

        void streamTranslation(segment)
          .then((translationText) => {
            if (cancelled) {
              return;
            }

            if (requestSequenceRef.current[segment.id] !== requestId) {
              return;
            }

            const nextEntry = {
              sourceText: segment.text,
              translationText,
            };
            translationsByIdRef.current = {
              ...translationsByIdRef.current,
              [segment.id]: nextEntry,
            };
            setTranslationsById((prev) => ({
              ...prev,
              [segment.id]: nextEntry,
            }));
            setError(null);
          })
          .catch((translationError) => {
            if (cancelled) {
              return;
            }

            setError(
              translationError instanceof Error
                ? translationError
                : new Error('Translation failed')
            );
          });
      });

    return () => {
      cancelled = true;
    };
  }, [sourceSegments, streamTranslation]);

  const translations = useMemo<TranslationResponse[]>(() => {
    return sourceSegments.map((segment) => ({
      text: translationsById[segment.id]?.translationText ?? '',
    }));
  }, [sourceSegments, translationsById]);

  const { leftSegments, rightSegments } = useMemo(
    () => sortSegmentsByLanguage(sourceSegments, translations),
    [sourceSegments, translations]
  );

  const startRecording = useCallback(() => {
    setError(null);

    if (!clientReady) {
      setError(new Error('Microphone is still preparing. Please try again.'));
      return;
    }

    void startTranscription(undefined, true, ['en-US', 'ja-JP'], true);
  }, [clientReady, startTranscription]);

  const clearSegments = useCallback(() => {
    clearTranscripts();
    requestSequenceRef.current = {};
    translationsByIdRef.current = {};
    setTranslationsById({});
    setError(null);
  }, [clearTranscripts]);

  return {
    leftSegments,
    rightSegments,
    startRecording,
    stopRecording: stopTranscription,
    clearSegments,
    isRecording: recording,
    error,
    isMicrophoneReady: clientReady,
  };
};

export default useRealtimeTranslationSplit;
