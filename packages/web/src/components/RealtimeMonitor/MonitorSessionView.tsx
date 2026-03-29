import React from 'react';
import { useTranslation } from 'react-i18next';
import MonitorDisplay from './MonitorDisplay';
import type { MonitorConfig } from './MonitorSetup';
import RecordingContextMenu from './RecordingContextMenu';
import type { StructuredContextValues } from './StructuredContextForm';
import type { DisplaySegment } from './TranscriptSidebar';

type Props = {
  clientReady: boolean;
  config: MonitorConfig;
  contextValues: StructuredContextValues;
  error: Error | null;
  isEnglishMode: boolean;
  isUpdating: boolean;
  phase: 'recording' | 'stopped';
  segments: DisplaySegment[];
  systemGeneratedContext: string;
  topicEn: string;
  topicJa: string;
  onClear: () => void;
  onContextValuesChange: (values: StructuredContextValues) => void;
  onRestart: () => void;
  onStop: () => void;
  onToggleLanguage: (value: boolean) => void;
};

const MonitorSessionView: React.FC<Props> = ({
  clientReady,
  config,
  contextValues,
  error,
  isEnglishMode,
  isUpdating,
  phase,
  segments,
  systemGeneratedContext,
  topicEn,
  topicJa,
  onClear,
  onContextValuesChange,
  onRestart,
  onStop,
  onToggleLanguage,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-slate-950 px-4 py-4 text-white lg:px-6 lg:py-6">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-white lg:text-2xl">
              {config.meetingName || t('monitor.title')}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {t('monitor.primary_language')}: {config.primaryLanguage} /{' '}
              {t('monitor.secondary_language')}: {config.secondaryLanguage}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error.message}
          </div>
        )}

        {!clientReady && phase === 'recording' && (
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
            onToggleLanguage={onToggleLanguage}
            onStop={phase === 'recording' ? onStop : () => undefined}
            onClear={onClear}>
            <RecordingContextMenu
              values={contextValues}
              onChange={onContextValuesChange}
              systemGeneratedContext={systemGeneratedContext}
            />
          </MonitorDisplay>

          {phase === 'stopped' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[32px] bg-slate-950/70 backdrop-blur-sm">
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

export default MonitorSessionView;
