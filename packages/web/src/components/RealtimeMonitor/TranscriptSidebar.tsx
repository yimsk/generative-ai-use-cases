import React from 'react';
import { useTranslation } from 'react-i18next';

export type TranscriptSegment = {
  id: string;
  timestamp: string;
  sourceText: string;
  translatedText: string;
  speaker?: string;
};

export type DisplaySegment = TranscriptSegment & {
  jaText: string;
  enText: string;
};

type Props = {
  segments: DisplaySegment[];
};

const TranscriptSidebar: React.FC<Props> = ({ segments }) => {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-2 p-3">
        {segments.length === 0 ? (
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-4 text-xs text-slate-400">
            {t('meetingMinutes.no_transcript')}
          </div>
        ) : (
          segments.map((segment, index) => {
            const isLatest = index === segments.length - 1;

            return (
              <article
                key={segment.id}
                className={[
                  'rounded-xl border px-3 py-2.5 transition-colors',
                  isLatest
                    ? 'border-cyan-400/40 bg-slate-800 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]'
                    : 'border-slate-800/80 bg-slate-900/80',
                ].join(' ')}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    {segment.timestamp}
                  </span>
                  {segment.speaker && (
                    <span className="truncate rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                      {segment.speaker}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-5 text-white">
                  {segment.sourceText}
                </p>
                <p className="mt-1 truncate text-xs leading-5 text-slate-300">
                  {segment.translatedText}
                </p>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TranscriptSidebar;
