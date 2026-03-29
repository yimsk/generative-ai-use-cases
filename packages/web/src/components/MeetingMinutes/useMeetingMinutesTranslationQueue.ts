import { MutableRefObject, useCallback, useEffect, useRef } from 'react';
import {
  getLanguageNameFromCode,
  getRecentSegmentsContext,
} from './MeetingMinutesContextGenerator';
import type { RealtimeSegment } from './MeetingMinutesRealtimeTranslationOrchestrator';
import {
  getTranslationTarget,
  resolveSourceLanguage,
} from '../../utils/realtimeTranslationDirection';
import type { TranslationSegment } from './MeetingMinutesSegmentSplitter';

interface TranslationQueueConfig {
  primaryLanguage: string;
  secondaryLanguage: string;
  translationType: string;
  selectedTranslationModel: string;
  userDefinedContext: string;
  systemGeneratedContext: string;
}

interface UseMeetingMinutesTranslationQueueProps {
  realtimeTranslationEnabled: boolean;
  selectedTranslationModel: string;
  translationInterval: number;
  realtimeSegmentsRef: MutableRefObject<RealtimeSegment[]>;
  setRealtimeSegments: (
    updater:
      | RealtimeSegment[]
      | ((prev: RealtimeSegment[]) => RealtimeSegment[])
  ) => void;
  translate: (
    sentence: string,
    modelId: string,
    targetLanguage: string,
    context?: string
  ) => Promise<string | null>;
  primaryLanguage: string;
  secondaryLanguage: string;
  translationType: string;
  userDefinedContext: string;
  systemGeneratedContext: string;
}

export const useMeetingMinutesTranslationQueue = ({
  realtimeTranslationEnabled,
  selectedTranslationModel,
  translationInterval,
  realtimeSegmentsRef,
  setRealtimeSegments,
  translate,
  primaryLanguage,
  secondaryLanguage,
  translationType,
  userDefinedContext,
  systemGeneratedContext,
}: UseMeetingMinutesTranslationQueueProps) => {
  const latestRequestTimestampsRef = useRef(new Map<string, number>());
  const intervalConfigRef = useRef<TranslationQueueConfig>({
    primaryLanguage,
    secondaryLanguage,
    translationType,
    selectedTranslationModel,
    userDefinedContext,
    systemGeneratedContext,
  });
  const intervalConfigModelRef = useRef(selectedTranslationModel);

  if (intervalConfigModelRef.current !== selectedTranslationModel) {
    intervalConfigModelRef.current = selectedTranslationModel;
    intervalConfigRef.current = {
      primaryLanguage,
      secondaryLanguage,
      translationType,
      selectedTranslationModel,
      userDefinedContext,
      systemGeneratedContext,
    };
  }

  const translateSentence = useCallback(
    async (
      segment: RealtimeSegment,
      sentenceIndex: number,
      translationSegment: TranslationSegment
    ) => {
      const requestId = `${segment.resultId}-${sentenceIndex}`;
      const requestTimestamp = Date.now();
      const intervalConfig = intervalConfigRef.current;

      latestRequestTimestampsRef.current.set(requestId, requestTimestamp);

      setRealtimeSegments((prev) =>
        prev.map((currentSegment) => {
          if (
            currentSegment.resultId !== segment.resultId ||
            currentSegment.source !== segment.source
          ) {
            return currentSegment;
          }

          return {
            ...currentSegment,
            translationSegments: currentSegment.translationSegments.map(
              (currentTranslationSegment, currentIndex) => {
                if (currentIndex !== sentenceIndex) {
                  return currentTranslationSegment;
                }

                return {
                  ...currentTranslationSegment,
                  requestTimestamp,
                };
              }
            ),
          };
        })
      );

      try {
        const sourceLanguage = resolveSourceLanguage(
          segment.transcripts,
          segment.languageCode,
          intervalConfig.primaryLanguage,
          intervalConfig.secondaryLanguage
        );
        const targetLanguage = getTranslationTarget(
          intervalConfig.translationType,
          sourceLanguage,
          intervalConfig.primaryLanguage,
          intervalConfig.secondaryLanguage
        );
        const targetLanguageName = getLanguageNameFromCode(targetLanguage);
        const contexts: string[] = [];

        if (intervalConfig.userDefinedContext.trim()) {
          contexts.push(
            `User-defined context: ${intervalConfig.userDefinedContext.trim()}`
          );
        }
        if (intervalConfig.systemGeneratedContext.trim()) {
          contexts.push(
            `System-generated context: ${intervalConfig.systemGeneratedContext.trim()}`
          );
        }

        const recentSegmentsText = getRecentSegmentsContext(
          realtimeSegmentsRef.current
        );
        if (recentSegmentsText) {
          contexts.push(`Recent conversation context: ${recentSegmentsText}`);
        }

        const translation = await translate(
          translationSegment.text,
          intervalConfig.selectedTranslationModel,
          targetLanguageName,
          contexts.length > 0 ? contexts.join('\n\n') : undefined
        );

        if (
          translation === null ||
          latestRequestTimestampsRef.current.get(requestId) !== requestTimestamp
        ) {
          return;
        }

        setRealtimeSegments((prev) =>
          prev.map((currentSegment) => {
            if (
              currentSegment.resultId !== segment.resultId ||
              currentSegment.source !== segment.source
            ) {
              return currentSegment;
            }

            return {
              ...currentSegment,
              translationSegments: currentSegment.translationSegments.map(
                (currentTranslationSegment, currentIndex) => {
                  if (currentIndex !== sentenceIndex) {
                    return currentTranslationSegment;
                  }

                  return {
                    ...currentTranslationSegment,
                    translation: translation || undefined,
                    needsTranslation:
                      currentTranslationSegment.text !==
                      translationSegment.text,
                    lastTranslatedText: translationSegment.text,
                  };
                }
              ),
            };
          })
        );
      } catch (error) {
        console.error('Failed to translate sentence:', error);
      }
    },
    [realtimeSegmentsRef, setRealtimeSegments, translate]
  );

  const processPendingTranslations = useCallback(async () => {
    for (const segment of realtimeSegmentsRef.current) {
      const sentencesToTranslate = segment.translationSegments.filter(
        (translationSegment) =>
          translationSegment.needsTranslation && translationSegment.text.trim()
      );

      for (const translationSentence of sentencesToTranslate) {
        const sentenceIndex =
          segment.translationSegments.indexOf(translationSentence);

        await translateSentence(segment, sentenceIndex, translationSentence);
      }
    }
  }, [realtimeSegmentsRef, translateSentence]);

  useEffect(() => {
    if (!realtimeTranslationEnabled || !selectedTranslationModel) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void processPendingTranslations();
    }, translationInterval);

    return () => window.clearInterval(intervalId);
  }, [
    processPendingTranslations,
    realtimeTranslationEnabled,
    selectedTranslationModel,
    translationInterval,
  ]);
};

export default useMeetingMinutesTranslationQueue;
