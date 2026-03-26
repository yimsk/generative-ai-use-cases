import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { DisplaySegment } from './TranscriptSidebar';

type Props = {
  segments: DisplaySegment[];
  isEnglishMode: boolean;
};

const TranslationPanel: React.FC<Props> = ({ segments, isEnglishMode }) => {
  const { t } = useTranslation();
  const setLastSegmentRef = useCallback((node: HTMLDivElement | null) => {
    node?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  return (
    <div className="h-full overflow-y-auto rounded-[28px] border border-slate-800 bg-slate-950/70">
      {segments.length === 0 ? (
        <div className="flex h-full min-h-72 items-center justify-center px-8 text-center text-2xl text-slate-500">
          {t('monitor.no_topic')}
        </div>
      ) : (
        <div className="space-y-8 p-6 md:p-8 lg:p-10">
          {segments.map((segment, index) => {
            const displayText = isEnglishMode ? segment.enText : segment.jaText;

            return (
              <div
                key={segment.id}
                ref={index === segments.length - 1 ? setLastSegmentRef : null}>
                <div className="mb-3 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-cyan-300/80">
                  <span>{segment.timestamp}</span>
                  {segment.speaker && (
                    <span className="rounded-full border border-cyan-400/20 px-2 py-1 text-[10px] text-slate-300">
                      {segment.speaker}
                    </span>
                  )}
                </div>
                <p className="text-pretty text-2xl font-medium leading-[1.6] text-white md:text-3xl xl:text-4xl">
                  {displayText || segment.translatedText || segment.sourceText}
                </p>
                {index < segments.length - 1 && (
                  <div className="mt-8 border-t border-slate-800/90" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TranslationPanel;
