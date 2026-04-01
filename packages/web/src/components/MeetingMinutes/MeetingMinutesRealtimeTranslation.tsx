import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageCode } from '@aws-sdk/client-transcribe-streaming';
import Select from '../Select';
import Textarea from '../Textarea';
import Button from '../Button';
import ModalDialog from '../ModalDialog';
import MeetingMinutesTranscriptSegment from './MeetingMinutesTranscriptSegment';
import MeetingMinutesSettingsPanel from './MeetingMinutesSettingsPanel';
import MeetingMinutesControlButtons from './MeetingMinutesControlButtons';
import useMicrophone from '../../hooks/useMicrophone';
import useScreenAudio from '../../hooks/useScreenAudio';
import useRealtimeTranslation from '../../hooks/useRealtimeTranslation';
import useChatApi from '../../hooks/useChatApi';
import { MODELS } from '../../hooks/useModel';
import useMeetingMinutesTranslationQueue from './useMeetingMinutesTranslationQueue';
import useMeetingMinutesContextTimer from './useMeetingMinutesContextTimer';
import {
  getTranslationTarget,
  resolveSourceLanguage,
} from '../../utils/realtimeTranslationDirection';
import {
  buildRealtimeText,
  createRealtimeSegment,
  mergeRealtimeSegment,
  sortRealtimeSegments,
  type RealtimeSegment,
} from './MeetingMinutesRealtimeTranslationOrchestrator';

interface MeetingMinutesRealtimeTranslationProps {
  /** Callback when transcript text changes */
  onTranscriptChange?: (text: string) => void;
  /** Callback when recording state changes */
  onRecordingStateChange?: (state: {
    micRecording: boolean;
    screenRecording: boolean;
  }) => void;
  initialPrimaryLanguage?: string;
  initialSecondaryLanguage?: string;
  initialTranslationType?: string;
}

const MeetingMinutesRealtimeTranslation: React.FC<
  MeetingMinutesRealtimeTranslationProps
> = ({
  onTranscriptChange,
  onRecordingStateChange,
  initialPrimaryLanguage = 'en-US',
  initialSecondaryLanguage = 'ja-JP',
  initialTranslationType = 'unidirectional',
}) => {
  const { t } = useTranslation();
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef<boolean>(true);
  const realtimeSegmentsRef = useRef<RealtimeSegment[]>([]);

  // Microphone and screen audio hooks
  const {
    startTranscription: startMicTranscription,
    stopTranscription: stopMicTranscription,
    recording: micRecording,
    clearTranscripts: clearMicTranscripts,
    rawTranscripts: micRawTranscripts,
  } = useMicrophone();

  const {
    prepareScreenCapture,
    startTranscriptionWithStream,
    stopTranscription: stopScreenTranscription,
    recording: screenRecording,
    clearTranscripts: clearScreenTranscripts,
    isSupported: isScreenAudioSupported,
    error: screenAudioError,
    rawTranscripts: screenRawTranscripts,
  } = useScreenAudio();

  // Internal state management
  const [primaryLanguage, setPrimaryLanguage] = useState(
    initialPrimaryLanguage
  );
  const [speakerLabel, setSpeakerLabel] = useState(false);
  const [maxSpeakers, setMaxSpeakers] = useState(4);
  const [speakers, setSpeakers] = useState('');
  const [enableScreenAudio, setEnableScreenAudio] = useState(false);
  const [enableMicAudio, setEnableMicAudio] = useState(true);
  const [realtimeSegments, setRealtimeSegmentsState] = useState<
    RealtimeSegment[]
  >([]);

  // Helper function to update both state and ref
  const setRealtimeSegments = useCallback(
    (
      updater:
        | RealtimeSegment[]
        | ((prev: RealtimeSegment[]) => RealtimeSegment[])
    ) => {
      setRealtimeSegmentsState((prev) => {
        const newSegments =
          typeof updater === 'function' ? updater(prev) : updater;
        realtimeSegmentsRef.current = newSegments;
        return newSegments;
      });
    },
    []
  );

  // Translation states - Default to enabled for realtime translation tab
  const realtimeTranslationEnabled = true; // Always enabled in this tab
  const [translationType, setTranslationType] = useState<string>(
    initialTranslationType
  );
  const [selectedTranslationModel, setSelectedTranslationModel] = useState('');
  const [secondaryLanguage, setSecondaryLanguage] = useState(
    initialSecondaryLanguage
  );

  // Context states for translation accuracy improvement
  const [userDefinedContext, setUserDefinedContext] = useState('');
  const [systemGeneratedContext, setSystemGeneratedContext] = useState('');
  const [screenShareStartError, setScreenShareStartError] = useState('');
  const [isScreenShareChoiceOpen, setIsScreenShareChoiceOpen] = useState(false);

  // Simple session management
  const [currentSessionId, setCurrentSessionId] = useState(0);

  // Notify parent component of recording state changes
  useEffect(() => {
    console.log('[MeetingMinutesRealtimeTranslation] recording state changed', {
      micRecording,
      screenRecording,
      enableMicAudio,
      enableScreenAudio,
      translationType,
      primaryLanguage,
      secondaryLanguage,
    });
    onRecordingStateChange?.({
      micRecording,
      screenRecording,
    });
  }, [
    micRecording,
    screenRecording,
    enableMicAudio,
    enableScreenAudio,
    translationType,
    primaryLanguage,
    secondaryLanguage,
    onRecordingStateChange,
  ]);

  // Translation hook
  const { availableModels, translate, translationInterval } =
    useRealtimeTranslation();

  // Hook for generating system context
  const { predict } = useChatApi();

  // Set default translation model on mount
  useEffect(() => {
    if (!selectedTranslationModel && availableModels.length > 0) {
      setSelectedTranslationModel(availableModels[0]);
    }
  }, [availableModels, selectedTranslationModel]);

  // Language options
  const languageOptions = useMemo(
    () => [
      { value: 'auto', label: t('meetingMinutes.language_auto') },
      { value: 'ja-JP', label: t('meetingMinutes.language_japanese') },
      { value: 'en-US', label: t('meetingMinutes.language_english') },
      { value: 'zh-CN', label: t('meetingMinutes.language_chinese') },
      { value: 'ko-KR', label: t('meetingMinutes.language_korean') },
      { value: 'th-TH', label: t('meetingMinutes.language_thai') },
      { value: 'vi-VN', label: t('meetingMinutes.language_vietnamese') },
    ],
    [t]
  );

  // Target language options for translation (excluding 'auto')
  const targetLanguageOptions = useMemo(
    () => languageOptions.filter((option) => option.value !== 'auto'),
    [languageOptions]
  );

  // Translation type options
  const translationTypeOptions = useMemo(
    () => [
      { value: 'unidirectional', label: t('meetingMinutes.unidirectional') },
      { value: 'bidirectional', label: t('meetingMinutes.bidirectional') },
    ],
    [t]
  );

  // Speaker mapping
  const speakerMapping = useMemo(() => {
    return Object.fromEntries(
      speakers.split(',').map((speaker, idx) => [`spk_${idx}`, speaker.trim()])
    );
  }, [speakers]);

  // Helper function to format time in MM:SS format
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Real-time text output
  const realtimeText: string = useMemo(() => {
    return buildRealtimeText({
      realtimeSegments,
      speakerMapping,
      formatTime,
    });
  }, [realtimeSegments, speakerMapping, formatTime]);

  // Auto scroll to bottom when transcript updates if user was at bottom
  useEffect(() => {
    if (
      transcriptContainerRef.current &&
      isAtBottomRef.current &&
      realtimeSegments.length > 0
    ) {
      setTimeout(() => {
        if (transcriptContainerRef.current) {
          transcriptContainerRef.current.scrollTop =
            transcriptContainerRef.current.scrollHeight;
        }
      }, 10);
    }
  }, [realtimeSegments]);

  // Text existence check
  const hasTranscriptText = useMemo(() => {
    return realtimeText.trim() !== '';
  }, [realtimeText]);

  // Update callback when transcript changes
  useEffect(() => {
    onTranscriptChange?.(realtimeText);
  }, [realtimeText, onTranscriptChange]);

  const updateRealtimeSegments = useCallback(
    (newSegment: RealtimeSegment) => {
      setRealtimeSegments((prev) => mergeRealtimeSegment(prev, newSegment));
    },
    [setRealtimeSegments]
  );

  // Process microphone raw transcripts
  useEffect(() => {
    if (micRawTranscripts && micRawTranscripts.length > 0) {
      micRawTranscripts.forEach((rawSegment) => {
        updateRealtimeSegments(
          createRealtimeSegment({
            rawSegment,
            source: 'microphone',
            sessionId: currentSessionId,
            primaryLanguage,
          })
        );
      });
    }
  }, [
    micRawTranscripts,
    updateRealtimeSegments,
    currentSessionId,
    primaryLanguage,
  ]);

  // Process screen audio raw transcripts
  useEffect(() => {
    if (
      enableScreenAudio &&
      screenRawTranscripts &&
      screenRawTranscripts.length > 0
    ) {
      screenRawTranscripts.forEach((rawSegment) => {
        updateRealtimeSegments(
          createRealtimeSegment({
            rawSegment,
            source: 'screen',
            sessionId: currentSessionId,
            primaryLanguage,
          })
        );
      });
    }
  }, [
    screenRawTranscripts,
    enableScreenAudio,
    updateRealtimeSegments,
    currentSessionId,
    primaryLanguage,
  ]);

  // Recording states
  const isRecording = micRecording || screenRecording;

  useMeetingMinutesTranslationQueue({
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
  });

  useMeetingMinutesContextTimer({
    realtimeTranslationEnabled,
    isRecording,
    realtimeSegments,
    targetLanguage: secondaryLanguage,
    predict,
    onGeneratedContext: setSystemGeneratedContext,
  });

  // Clear function
  const handleClear = useCallback(() => {
    setRealtimeSegments([]);
    stopMicTranscription();
    stopScreenTranscription();
    clearMicTranscripts();
    clearScreenTranscripts();
    setScreenShareStartError('');
    setIsScreenShareChoiceOpen(false);

    // Reset session state for fresh start
    setCurrentSessionId(0);

    onTranscriptChange?.('');
  }, [
    setRealtimeSegments,
    stopMicTranscription,
    stopScreenTranscription,
    clearMicTranscripts,
    clearScreenTranscripts,
    onTranscriptChange,
  ]);

  const startTranscription = useCallback(
    async ({ forceMicOnly = false }: { forceMicOnly?: boolean } = {}) => {
      setScreenShareStartError('');
      setIsScreenShareChoiceOpen(false);

      // Simple session management - just increment session ID when recording starts
      setCurrentSessionId((prev) => prev + 1);

      // Clear only the hooks' internal state, but preserve our segments
      clearMicTranscripts();
      clearScreenTranscripts();

      // For bidirectional translation, use multi-language identification with both languages
      let langCode: LanguageCode | undefined;
      let languageOptions: string[] | undefined;
      let enableMultiLanguage: boolean = false;

      if (translationType === 'bidirectional') {
        langCode = undefined; // No fixed language code for multi-language
        languageOptions = [primaryLanguage, secondaryLanguage];
        enableMultiLanguage = true; // Enable multi-language identification
      } else {
        langCode =
          primaryLanguage === 'auto'
            ? undefined
            : (primaryLanguage as LanguageCode);
        languageOptions =
          primaryLanguage === 'auto' ? ['en-US', 'ja-JP'] : undefined;
        enableMultiLanguage = false;
      }

      try {
        console.log('[MeetingMinutesRealtimeTranslation] start requested', {
          enableMicAudio,
          enableScreenAudio,
          primaryLanguage,
          secondaryLanguage,
          translationType,
          speakerLabel,
          languageOptions,
          enableMultiLanguage,
          forceMicOnly,
        });
        let screenStream: MediaStream | null = null;
        if (!forceMicOnly && enableScreenAudio && isScreenAudioSupported) {
          screenStream = await prepareScreenCapture();
        }

        if (screenStream) {
          startTranscriptionWithStream(
            screenStream,
            langCode,
            speakerLabel,
            languageOptions,
            enableMultiLanguage
          );
        }
        if (enableMicAudio || forceMicOnly) {
          startMicTranscription(
            langCode,
            speakerLabel,
            languageOptions,
            enableMultiLanguage
          );
        }
      } catch (error) {
        console.error('Failed to start synchronized recording:', error);
        setScreenShareStartError(
          error instanceof Error
            ? error.message
            : 'Failed to start screen audio capture'
        );
        setIsScreenShareChoiceOpen(true);
      }
    },
    [
      clearMicTranscripts,
      clearScreenTranscripts,
      enableMicAudio,
      enableScreenAudio,
      isScreenAudioSupported,
      prepareScreenCapture,
      primaryLanguage,
      secondaryLanguage,
      speakerLabel,
      startMicTranscription,
      startTranscriptionWithStream,
      translationType,
    ]
  );

  // Start transcription
  const onClickExecStartTranscription = useCallback(async () => {
    await startTranscription();
  }, [startTranscription]);

  // Stop transcription
  const handleStopRecording = useCallback(() => {
    console.log('[MeetingMinutesRealtimeTranslation] stop requested');
    stopMicTranscription();
    stopScreenTranscription();
  }, [stopMicTranscription, stopScreenTranscription]);

  return (
    <div className="flex h-full flex-col">
      {/* Settings Panel */}
      <MeetingMinutesSettingsPanel
        isRecording={isRecording}
        enableMicAudio={enableMicAudio}
        setEnableMicAudio={setEnableMicAudio}
        enableScreenAudio={enableScreenAudio}
        setEnableScreenAudio={setEnableScreenAudio}
        speakerLabel={speakerLabel}
        setSpeakerLabel={setSpeakerLabel}
        maxSpeakers={maxSpeakers}
        setMaxSpeakers={setMaxSpeakers}
        speakers={speakers}
        setSpeakers={setSpeakers}>
        {/* Translation-specific settings */}

        {/* Languages */}
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-28 shrink-0 items-center text-sm text-gray-600">
              {translationType === 'bidirectional'
                ? t('meetingMinutes.language_1')
                : t('meetingMinutes.transcription_language')}
            </div>
            <div>
              <Select
                value={primaryLanguage}
                onChange={setPrimaryLanguage}
                options={languageOptions}
                fullWidth
                notItem
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-28 shrink-0 items-center text-sm text-gray-600 sm:w-auto">
              {translationType === 'bidirectional'
                ? t('meetingMinutes.language_2')
                : t('meetingMinutes.translation_language')}
            </div>
            <div>
              <Select
                value={secondaryLanguage}
                onChange={setSecondaryLanguage}
                options={targetLanguageOptions}
                fullWidth
                notItem
              />
            </div>
          </div>
        </div>

        {/* Translation Type */}
        <div className="mb-3 flex items-center gap-4">
          <div className="flex h-9 w-28 shrink-0 items-center text-sm text-gray-600">
            {t('meetingMinutes.translation_type')}
          </div>
          <div>
            <Select
              value={translationType}
              onChange={setTranslationType}
              options={translationTypeOptions}
              fullWidth
              notItem
            />
          </div>
        </div>

        {/* Translation Model */}
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-28 shrink-0 items-center text-sm text-gray-600">
            {t('meetingMinutes.translation_model')}
          </div>
          <div>
            <Select
              value={selectedTranslationModel}
              onChange={setSelectedTranslationModel}
              options={availableModels.map((modelId) => ({
                value: modelId,
                label: MODELS.modelDisplayName(modelId),
              }))}
              fullWidth
              notItem
            />
          </div>
        </div>
      </MeetingMinutesSettingsPanel>

      {/* Translation Context - Only show when real-time translation is ON and recording */}
      {realtimeTranslationEnabled && isRecording && (
        <div className="mb-4 shrink-0 rounded-lg border border-gray-200 p-4">
          <div className="mb-3 text-sm font-bold text-gray-700">
            {t('translate.contextHelp')}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-1 block text-sm text-gray-600">
                {t('translate.userDefinedContext')}
              </div>
              <Textarea
                className="h-20 w-full text-sm"
                placeholder={t('translate.userDefinedContextPlaceholder')}
                value={userDefinedContext}
                onChange={setUserDefinedContext}
              />
            </div>
            <div>
              <div className="mb-1 block text-sm text-gray-600">
                {t('translate.systemGeneratedContext')}
              </div>
              <Textarea
                className="h-20 w-full text-sm"
                placeholder={t('translate.systemGeneratedContextPlaceholder')}
                value={systemGeneratedContext}
                onChange={setSystemGeneratedContext}
              />
            </div>
          </div>
        </div>
      )}

      {/* Screen Audio Error Display */}
      {screenAudioError && (
        <div className="mb-3 shrink-0 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <strong>{t('meetingMinutes.screen_audio_error')}</strong>
          {t('common.colon')} {screenAudioError}
        </div>
      )}

      <ModalDialog
        isOpen={isScreenShareChoiceOpen}
        title="Screen share failed"
        onClose={() => setIsScreenShareChoiceOpen(false)}>
        <div className="text-sm text-gray-700">
          <div>Failed to start screen audio capture</div>
          {screenShareStartError && (
            <div className="mt-1 text-gray-500">{screenShareStartError}</div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              outlined
              onClick={() => startTranscription()}
              className="p-2">
              Retry
            </Button>
            <Button
              onClick={() => {
                void startTranscription({ forceMicOnly: true });
              }}
              className="p-2">
              Use microphone only
            </Button>
          </div>
        </div>
      </ModalDialog>

      {/* Transcript Panel */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex shrink-0 items-center justify-between">
          <div className="font-bold">{t('meetingMinutes.transcript')}</div>
          <MeetingMinutesControlButtons
            isRecording={isRecording}
            hasTranscriptText={hasTranscriptText}
            transcriptText={realtimeText}
            onStartRecording={onClickExecStartTranscription}
            onStopRecording={handleStopRecording}
            onClear={handleClear}
          />
        </div>
        <div
          ref={transcriptContainerRef}
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const distanceFromBottom =
              target.scrollHeight - target.clientHeight - target.scrollTop;
            const isAtBottom = distanceFromBottom < 80; // About 3-4 lines tolerance
            isAtBottomRef.current = isAtBottom;
          }}
          className="relative min-h-0 flex-1 overflow-y-auto rounded border border-black/30 p-1.5">
          {realtimeSegments.length === 0 && !isRecording ? (
            <div className="flex h-full flex-col items-center justify-center py-8">
              <div className="text-center text-gray-400">
                {t('transcribe.result_placeholder')}
              </div>
            </div>
          ) : (
            sortRealtimeSegments(realtimeSegments).map(
              (segment, index, sortedSegments) => {
                const prevSegment =
                  index > 0 ? sortedSegments[index - 1] : null;
                const isNewSession =
                  prevSegment && segment.sessionId !== prevSegment.sessionId;

                // Find the translation target for this segment
                const translationTarget = getTranslationTarget(
                  translationType,
                  resolveSourceLanguage(
                    segment.transcripts,
                    segment.languageCode,
                    primaryLanguage,
                    secondaryLanguage
                  ),
                  primaryLanguage,
                  secondaryLanguage
                );

                return (
                  <React.Fragment
                    key={`${segment.resultId}-${segment.source}-${index}`}>
                    {isNewSession && (
                      <div className="my-4 flex items-center px-2">
                        <div className="grow border-t border-gray-300"></div>
                        <div className="mx-4 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-sm text-blue-700">
                          {t('meetingMinutes.new_recording_session')}
                        </div>
                        <div className="grow border-t border-gray-300"></div>
                      </div>
                    )}
                    <MeetingMinutesTranscriptSegment
                      startTime={segment.startTime}
                      transcripts={segment.transcripts}
                      speakerMapping={speakerMapping}
                      isPartial={segment.isPartial}
                      formatTime={formatTime}
                      translation={
                        segment.translationSegments
                          .map((ts) => ts.translation)
                          .filter(Boolean)
                          .join(' ') || ''
                      }
                      translationSegments={segment.translationSegments}
                      isTranslating={segment.translationSegments.some(
                        (ts) => ts.needsTranslation && !ts.translation
                      )}
                      translationEnabled={realtimeTranslationEnabled}
                      detectedLanguage={segment.languageCode}
                      translationTarget={translationTarget}
                      isBidirectional={translationType === 'bidirectional'}
                    />
                  </React.Fragment>
                );
              }
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingMinutesRealtimeTranslation;
