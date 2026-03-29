import { useCallback, useEffect, useRef } from 'react';
import {
  generateSystemContext,
  shouldGenerateContext,
} from './MeetingMinutesContextGenerator';
import type { RealtimeSegment } from './MeetingMinutesRealtimeTranslationOrchestrator';
import type { Model } from 'generative-ai-use-cases';

interface UseMeetingMinutesContextTimerProps {
  realtimeTranslationEnabled: boolean;
  isRecording: boolean;
  realtimeSegments: RealtimeSegment[];
  targetLanguage: string;
  predict: (params: {
    model: Model;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
    id: string;
  }) => Promise<string>;
  onGeneratedContext: (context: string) => void;
}

export const useMeetingMinutesContextTimer = ({
  realtimeTranslationEnabled,
  isRecording,
  realtimeSegments,
  targetLanguage,
  predict,
  onGeneratedContext,
}: UseMeetingMinutesContextTimerProps) => {
  const generateContext = useCallback(async () => {
    if (
      !shouldGenerateContext(
        realtimeTranslationEnabled,
        isRecording,
        realtimeSegments
      )
    ) {
      return;
    }

    const result = await generateSystemContext(
      realtimeSegments,
      targetLanguage,
      predict
    );

    if (result) {
      onGeneratedContext(result);
    }
  }, [
    isRecording,
    onGeneratedContext,
    predict,
    realtimeSegments,
    realtimeTranslationEnabled,
    targetLanguage,
  ]);

  const generateContextRef = useRef(generateContext);

  useEffect(() => {
    generateContextRef.current = generateContext;
  }, [generateContext]);

  useEffect(() => {
    if (!realtimeTranslationEnabled || !isRecording) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void generateContextRef.current();
    }, 60000);
    const timeoutId = window.setTimeout(() => {
      void generateContextRef.current();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [isRecording, realtimeTranslationEnabled]);
};

export default useMeetingMinutesContextTimer;
