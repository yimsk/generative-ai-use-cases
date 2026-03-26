import React from 'react';
import { useTranslation } from 'react-i18next';
import TranscriptSidebar, { type DisplaySegment } from './TranscriptSidebar';
import TranslationPanel from './TranslationPanel';

type Props = {
  segments: DisplaySegment[];
  topic: string;
  isUpdating: boolean;
  isEnglishMode: boolean;
  onToggleEnglish: (value: boolean) => void;
  onStop: () => void;
  onClear: () => void;
  children?: React.ReactNode;
};

const MonitorDisplay: React.FC<Props> = ({
  segments,
  topic,
  isUpdating,
  isEnglishMode,
  onToggleEnglish,
  onStop,
  onClear,
  children,
}) => {
  const { t } = useTranslation();
  const modeLabel = isEnglishMode ? 'EN' : 'JP';

  return (
    <div className="h-full min-h-0 rounded-[32px] border border-slate-800 bg-slate-950 text-white shadow-[0_28px_80px_rgba(2,6,23,0.55)]">
      <div className="grid h-full min-h-0 grid-cols-1 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,1))] lg:grid-cols-[minmax(18rem,30%)_1fr]">
        <aside className="flex min-h-72 flex-col border-b border-slate-800/80 bg-slate-900/80 lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/70">
                {t('meetingMinutes.transcript')}
              </p>
              <p className="mt-1 text-sm text-slate-400">{segments.length}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onStop}
                className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:border-red-300/40 hover:bg-red-500/20">
                {t('monitor.stop_recording')}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-700">
                {t('monitor.clear')}
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <TranscriptSidebar segments={segments} />
          </div>
        </aside>

        <section className="relative flex min-h-96 min-w-0 flex-col gap-4 p-4 md:p-5 lg:min-h-0 lg:p-6">
          {children && (
            <div className="absolute right-4 top-4 z-20">{children}</div>
          )}

          <div className="rounded-[24px] border border-cyan-400/15 bg-slate-900/70 px-5 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span
                className={[
                  'inline-flex h-2.5 w-2.5 rounded-full',
                  isUpdating ? 'animate-pulse bg-cyan-300' : 'bg-cyan-400/70',
                ].join(' ')}
              />
              <span className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">
                {t('monitor.current_topic')}
              </span>
            </div>
            <div className="mt-2 text-lg font-medium text-white md:text-xl">
              {topic || t('monitor.no_topic')}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <TranslationPanel
              segments={segments}
              isEnglishMode={isEnglishMode}
            />
          </div>

          <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex justify-end md:bottom-5 md:right-5 lg:bottom-6 lg:right-6">
            <button
              type="button"
              onClick={() => onToggleEnglish(!isEnglishMode)}
              className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-cyan-400/20 bg-slate-900/90 px-4 py-2 text-xs font-medium text-slate-100 shadow-lg shadow-slate-950/40 backdrop-blur-sm transition hover:border-cyan-300/35 hover:bg-slate-800">
              <span>{t('monitor.english_mode')}</span>
              <span
                className={[
                  'inline-flex min-w-11 justify-center rounded-full px-2 py-0.5 text-[11px]',
                  isEnglishMode
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-700 text-slate-200',
                ].join(' ')}>
                {modeLabel}
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export type { DisplaySegment };

export default MonitorDisplay;
