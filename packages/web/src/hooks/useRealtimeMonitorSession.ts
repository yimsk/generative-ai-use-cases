import { LanguageCode } from '@aws-sdk/client-transcribe-streaming';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  generateSystemContext,
  getLanguageNameFromCode,
  getRecentSegmentsContext,
  shouldGenerateContext,
} from '../components/MeetingMinutes/MeetingMinutesContextGenerator';
import type { MonitorConfig } from '../components/RealtimeMonitor/MonitorSetup';
import type { StructuredContextValues } from '../components/RealtimeMonitor/StructuredContextForm';
import type { DisplaySegment } from '../components/RealtimeMonitor/TranscriptSidebar';
import useChatApi from './useChatApi';
import useMicrophone from './useMicrophone';
import useRealtimeTranslation from './useRealtimeTranslation';
import useTopicSummary from './useTopicSummary';
import type { RawTranscript } from './useAudioTranscription';
import {
  buildMonitorStaticContext,
  buildMonitorTranslationContext,
} from '../utils/monitorTranslationContext';
import {
  getTranslationTarget,
  resolveSourceLanguage,
} from '../utils/realtimeTranslationDirection';
import {
  getSourceText,
  upsertDisplaySegment,
} from '../utils/realtimeMonitorSegments';

type MonitorSessionPhase = 'recording' | 'stopped';

const isEnglishLanguage = (languageCode?: string) => {
  return languageCode?.toLowerCase().startsWith('en') ?? false;
};

type UseRealtimeMonitorSessionProps = {
  config: MonitorConfig;
  phase: MonitorSessionPhase;
  onStop: () => void;
};

export const useRealtimeMonitorSession = ({
  config,
  phase,
  onStop,
}: UseRealtimeMonitorSessionProps) => {
  const {
    startTranscription,
    stopTranscription,
    recording,
    clearTranscripts,
    rawTranscripts,
    error,
    clientReady,
  } = useMicrophone();
  const { translate } = useRealtimeTranslation();
  const { predict } = useChatApi();
  const [segments, setSegments] = useState<DisplaySegment[]>([]);
  const [isEnglishMode, setIsEnglishMode] = useState(
    isEnglishLanguage(config.secondaryLanguage)
  );
  const [systemGeneratedContext, setSystemGeneratedContext] = useState('');
  const [contextValues, setContextValues] = useState<StructuredContextValues>({
    meetingName: config.meetingName,
    background: config.background,
  });
  const { topicJa, topicEn, isUpdating, updateTopic } = useTopicSummary({
    modelId: config.topicModel,
    targetLanguage: getLanguageNameFromCode(config.secondaryLanguage),
  });
  const startRequestedRef = useRef(false);
  const latestRequestIdRef = useRef<Record<string, number>>({});
  const latestRequestedSourceRef = useRef<Record<string, string>>({});
  const generateSystemContextRef = useRef<(() => Promise<void>) | null>(null);

  const staticContext = useMemo(() => {
    return buildMonitorStaticContext(contextValues);
  }, [contextValues]);

  const recentContext = useMemo(() => {
    return getRecentSegmentsContext(rawTranscripts);
  }, [rawTranscripts]);

  const translationContext = useMemo(() => {
    return buildMonitorTranslationContext({
      staticContext,
      systemGeneratedContext,
      recentContext,
    });
  }, [recentContext, staticContext, systemGeneratedContext]);

  const generateSystemContextCallback = useCallback(async () => {
    if (!shouldGenerateContext(true, phase === 'recording', rawTranscripts)) {
      return;
    }

    const result = await generateSystemContext(
      rawTranscripts,
      config.secondaryLanguage,
      predict
    );

    if (result) {
      setSystemGeneratedContext(result);
    }
  }, [config.secondaryLanguage, phase, predict, rawTranscripts]);

  generateSystemContextRef.current = generateSystemContextCallback;

  const requestTranslation = useCallback(
    async (rawSegment: RawTranscript, sourceText: string) => {
      const nextRequestId =
        (latestRequestIdRef.current[rawSegment.resultId] ?? 0) + 1;
      latestRequestIdRef.current[rawSegment.resultId] = nextRequestId;
      latestRequestedSourceRef.current[rawSegment.resultId] = sourceText;

      const sourceLanguage = resolveSourceLanguage(
        rawSegment.transcripts,
        rawSegment.languageCode,
        config.primaryLanguage,
        config.secondaryLanguage
      );
      const targetLanguage = getTranslationTarget(
        'bidirectional',
        sourceLanguage,
        config.primaryLanguage,
        config.secondaryLanguage
      );
      const targetLanguageName = getLanguageNameFromCode(targetLanguage);

      const translatedText = await translate(
        sourceText,
        config.translationModel,
        targetLanguageName,
        translationContext
      );

      if (
        !translatedText ||
        latestRequestIdRef.current[rawSegment.resultId] !== nextRequestId
      ) {
        return;
      }

      setSegments((currentSegments) =>
        upsertDisplaySegment(
          currentSegments,
          rawSegment,
          config,
          translatedText
        )
      );
      updateTopic(translatedText);
    },
    [config, translate, translationContext, updateTopic]
  );

  useEffect(() => {
    if (phase !== 'recording' || !clientReady || startRequestedRef.current) {
      return;
    }

    startRequestedRef.current = true;
    clearTranscripts();
    void startTranscription(config.primaryLanguage as LanguageCode);
  }, [
    clearTranscripts,
    clientReady,
    config.primaryLanguage,
    phase,
    startTranscription,
  ]);

  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }

    const intervalId = window.setInterval(() => {
      void generateSystemContextRef.current?.();
    }, 60000);

    const initialTimeoutId = window.setTimeout(() => {
      void generateSystemContextRef.current?.();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(initialTimeoutId);
    };
  }, [phase]);

  useEffect(() => {
    rawTranscripts.forEach((rawSegment) => {
      setSegments((currentSegments) =>
        upsertDisplaySegment(currentSegments, rawSegment, config)
      );

      const sourceText = getSourceText(rawSegment.transcripts);
      if (
        !sourceText ||
        latestRequestedSourceRef.current[rawSegment.resultId] === sourceText
      ) {
        return;
      }

      void requestTranslation(rawSegment, sourceText);
    });
  }, [config, rawTranscripts, requestTranslation]);

  useEffect(() => {
    if (phase === 'recording' || !recording) {
      return;
    }

    stopTranscription();
  }, [phase, recording, stopTranscription]);

  const handleStop = useCallback(() => {
    stopTranscription();
    onStop();
  }, [onStop, stopTranscription]);

  return {
    clientReady,
    contextValues,
    error,
    handleStop,
    isEnglishMode,
    isUpdating,
    segments,
    setContextValues,
    setIsEnglishMode,
    systemGeneratedContext,
    translationContext,
    topicEn,
    topicJa,
  };
};
