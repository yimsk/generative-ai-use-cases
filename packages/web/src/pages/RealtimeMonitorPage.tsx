import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageCode } from '@aws-sdk/client-transcribe-streaming';
import type { Transcript } from 'generative-ai-use-cases';
import MonitorDisplay from '../components/RealtimeMonitor/MonitorDisplay';
import MonitorSetup, {
  type MonitorConfig,
} from '../components/RealtimeMonitor/MonitorSetup';
import TopicBar from '../components/RealtimeMonitor/TopicBar';
import EnglishModeToggle from '../components/RealtimeMonitor/EnglishModeToggle';
import RecordingContextMenu from '../components/RealtimeMonitor/RecordingContextMenu';
import type { StructuredContextValues } from '../components/RealtimeMonitor/StructuredContextForm';
import type { DisplaySegment } from '../components/RealtimeMonitor/TranscriptSidebar';
import useMicrophone from '../hooks/useMicrophone';
import useRealtimeTranslation from '../hooks/useRealtimeTranslation';
import useTopicSummary from '../hooks/useTopicSummary';
import { getLanguageNameFromCode } from '../components/MeetingMinutes/MeetingMinutesContextGenerator';

type MonitorPhase = 'idle' | 'recording' | 'stopped';

type RawTranscriptSegment = {
  resultId: string;
  startTime: number;
  endTime: number;
  isPartial: boolean;
  transcripts: Transcript[];
  languageCode?: string;
};

type SessionProps = {
  config: MonitorConfig;
  phase: Exclude<MonitorPhase, 'idle'>;
  onStop: () => void;
  onClear: () => void;
  onRestart: () => void;
};

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

const getSourceText = (transcripts: Transcript[]) => {
  return transcripts
    .map((transcript) => transcript.transcript)
    .join(' ')
    .trim();
};

const buildDisplayTexts = (
  sourceText: string,
  translatedText: string,
  config: MonitorConfig,
  detectedLanguageCode?: string
) => {
  const sourceLanguage = detectedLanguageCode ?? config.primaryLanguage;

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

const upsertSegment = (
  currentSegments: DisplaySegment[],
  rawSegment: RawTranscriptSegment,
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

const MonitorSession: React.FC<SessionProps> = ({
  config,
  phase,
  onStop,
  onClear,
  onRestart,
}) => {
  const { t } = useTranslation();
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
  const [segments, setSegments] = useState<DisplaySegment[]>([]);
  const [isEnglishMode, setIsEnglishMode] = useState(
    isEnglishLanguage(config.secondaryLanguage)
  );
  const [contextValues, setContextValues] = useState<StructuredContextValues>({
    meetingName: config.meetingName,
    participants: config.participants,
    background: config.background,
  });
  const { topicJa, topicEn, isUpdating, updateTopic } = useTopicSummary({
    modelId: config.topicModel,
    targetLanguage: getLanguageNameFromCode(config.secondaryLanguage),
  });
  const startRequestedRef = useRef(false);
  const latestRequestIdRef = useRef<Record<string, number>>({});
  const latestRequestedSourceRef = useRef<Record<string, string>>({});

  const contextString = useMemo(() => {
    return [
      contextValues.meetingName,
      contextValues.participants,
      contextValues.background,
    ]
      .filter(Boolean)
      .join('\n');
  }, [
    contextValues.background,
    contextValues.meetingName,
    contextValues.participants,
  ]);

  const targetLanguageName = useMemo(() => {
    return getLanguageNameFromCode(config.secondaryLanguage);
  }, [config.secondaryLanguage]);

  const requestTranslation = useCallback(
    async (rawSegment: RawTranscriptSegment, sourceText: string) => {
      const nextRequestId =
        (latestRequestIdRef.current[rawSegment.resultId] ?? 0) + 1;
      latestRequestIdRef.current[rawSegment.resultId] = nextRequestId;
      latestRequestedSourceRef.current[rawSegment.resultId] = sourceText;

      const translatedText = await translate(
        sourceText,
        config.translationModel,
        targetLanguageName,
        contextString || undefined
      );

      if (
        !translatedText ||
        latestRequestIdRef.current[rawSegment.resultId] !== nextRequestId
      ) {
        return;
      }

      setSegments((currentSegments) =>
        upsertSegment(currentSegments, rawSegment, config, translatedText)
      );
      updateTopic(translatedText);
    },
    [config, contextString, targetLanguageName, translate, updateTopic]
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
    rawTranscripts.forEach((rawSegment) => {
      setSegments((currentSegments) =>
        upsertSegment(currentSegments, rawSegment, config)
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 px-4 py-4 text-white lg:px-6 lg:py-6">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-white lg:text-2xl">
              {config.meetingName || t('monitor.title')}
            </h1>
            {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
            <p className="mt-1 text-sm text-slate-400">
              {t('monitor.primary_language')}: {config.primaryLanguage} /{' '}
              {t('monitor.secondary_language')}: {config.secondaryLanguage}
            </p>
          </div>
          <EnglishModeToggle
            isEnglishMode={isEnglishMode}
            onChange={setIsEnglishMode}
          />
        </div>

        <TopicBar
          topicJa={topicJa}
          topicEn={topicEn}
          isUpdating={isUpdating}
          isEnglishMode={isEnglishMode}
        />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error.message}
          </div>
        )}

        {!clientReady && phase === 'recording' && (
          // eslint-disable-next-line @shopify/jsx-no-hardcoded-content
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
            Preparing microphone...
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <MonitorDisplay
            segments={segments}
            topicJa={topicJa}
            topicEn={topicEn}
            isUpdating={isUpdating}
            isEnglishMode={isEnglishMode}
            onToggleEnglish={setIsEnglishMode}
            onStop={phase === 'recording' ? handleStop : () => undefined}
            onClear={onClear}>
            <div className="flex items-center gap-2">
              <EnglishModeToggle
                isEnglishMode={isEnglishMode}
                onChange={setIsEnglishMode}
              />
              <RecordingContextMenu
                values={contextValues}
                onChange={setContextValues}
              />
            </div>
          </MonitorDisplay>

          {phase === 'stopped' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[32px] bg-slate-950/70 backdrop-blur-sm">
              {/* eslint-disable-next-line @shopify/jsx-no-hardcoded-content */}
              <button
                type="button"
                onClick={onRestart}
                className="rounded-full border border-cyan-300/30 bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                Restart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RealtimeMonitorPage: React.FC = () => {
  const [phase, setPhase] = useState<MonitorPhase>('idle');
  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  const handleStart = useCallback((nextConfig: MonitorConfig) => {
    setConfig(nextConfig);
    setSessionKey((current) => current + 1);
    setPhase('recording');
  }, []);

  const handleClear = useCallback(() => {
    setConfig(null);
    setSessionKey((current) => current + 1);
    setPhase('idle');
  }, []);

  const handleStop = useCallback(() => {
    setPhase('stopped');
  }, []);

  const handleRestart = useCallback(() => {
    setSessionKey((current) => current + 1);
    setPhase('recording');
  }, []);

  if (phase === 'idle' || !config) {
    return <MonitorSetup onStart={handleStart} />;
  }

  return (
    <MonitorSession
      key={sessionKey}
      config={config}
      phase={phase}
      onStop={handleStop}
      onClear={handleClear}
      onRestart={handleRestart}
    />
  );
};

export default RealtimeMonitorPage;
