import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../Switch';
import type { DisplaySegment } from './TranscriptSidebar';

type Props = {
  segments: DisplaySegment[];
  isEnglishMode: boolean;
};

const TranslationPanel: React.FC<Props> = ({ segments, isEnglishMode }) => {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const [followLatest, setFollowLatest] = useState(true);
  const isAutoScrollingRef = useRef(false);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !followLatest || segments.length === 0) {
      return;
    }

    isAutoScrollingRef.current = true;
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (panelRef.current) {
          panelRef.current.scrollTop = panelRef.current.scrollHeight;
        }
        isAutoScrollingRef.current = false;
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [followLatest, segments]);

  const handleScroll = useCallback(() => {
    if (isAutoScrollingRef.current) {
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const atBottom =
      panel.scrollHeight - panel.scrollTop - panel.clientHeight < 30;
    if (!atBottom) {
      setFollowLatest(false);
    }
  }, []);

  return (
    <div className="relative flex h-full flex-col gap-2">
      <div
        data-testid="translation-panel"
        ref={panelRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 md:p-5">
        {segments.length === 0 ? (
          <div className="flex h-full min-h-72 items-center justify-center px-6 text-center text-base text-slate-400 md:text-lg">
            {t('monitor.no_topic')}
          </div>
        ) : (
          <div className="space-y-4">
            {segments.map((segment, index) => {
              const displayText = isEnglishMode
                ? segment.enText
                : segment.jaText;

              return (
                <article
                  key={segment.id}
                  className="rounded-lg border border-slate-800/80 bg-slate-950/70 px-4 py-3">
                  <div className="mb-2 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <span>{segment.timestamp}</span>
                    {segment.speaker && (
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                        {segment.speaker}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100 md:text-base md:leading-7">
                    {displayText ||
                      segment.translatedText ||
                      segment.sourceText}
                  </p>
                  {index < segments.length - 1 && (
                    <div className="mt-3 border-t border-slate-800/90" />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex justify-start">
        <div className="rounded-full border border-cyan-400/20 bg-slate-900/90 px-3 py-2 shadow-lg shadow-slate-950/40 backdrop-blur-sm">
          <Switch
            checked={followLatest}
            onSwitch={setFollowLatest}
            label={t('monitor.follow_latest')}
          />
        </div>
      </div>
    </div>
  );
};

export default TranslationPanel;
