import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import { PiChartBar } from 'react-icons/pi';

import Card from '../components/Card';
import Select from '../components/Select';
import ChatMessage from '../components/ChatMessage';
import { ChartWithToggle } from '../components/Chart/ChartWithToggle';
import useAnalysisAgent from '../hooks/useAnalysisAgent';
import { MODELS } from '../hooks/useModel';
import useFollow from '../hooks/useFollow';
import Textarea from '../components/Textarea';
import Button from '../components/Button';

type StateType = {
  content: string;
  setContent: (s: string) => void;
  clear: () => void;
};

const useAnalysisPageState = create<StateType>((set) => ({
  content: '',
  setContent: (s: string) => set({ content: s }),
  clear: () => set({ content: '' }),
}));

/**
 * Strip ```json ... ``` code blocks from a message so they don't render as
 * inline charts on the left panel (they will be shown exclusively on the right).
 * A small placeholder badge is inserted in their place.
 */
const stripJsonChartBlocks = (content: string): string =>
  content.replace(/```json[\s\S]*?```/g, '`[📊 chart]`');

const AnalysisAgentPage: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { content, setContent, clear: clearInput } = useAnalysisPageState();

  const {
    loading,
    getModelId,
    setModelId,
    clear: clearChat,
    messages,
    isEmpty,
    post,
    extractedCharts,
  } = useAnalysisAgent(pathname);

  const { scrollableContainer, setFollowing } = useFollow();
  const chartsEndRef = useRef<HTMLDivElement>(null);

  const { modelIds: availableModels, modelDisplayName } = MODELS;
  const modelId = getModelId();

  const disabledSend = useMemo(
    () => content.trim() === '' || loading,
    [content, loading]
  );

  // Auto-scroll the left chat pane on new messages
  useEffect(() => {
    setFollowing(true);
  }, [setFollowing]);

  // Scroll charts panel to top when new charts arrive
  useEffect(() => {
    chartsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [extractedCharts.length]);

  const onSend = useCallback(async () => {
    if (disabledSend) return;
    setFollowing(true);
    const text = content.trim();
    setContent('');
    await post(text);
  }, [content, disabledSend, post, setContent, setFollowing]);

  const onReset = useCallback(() => {
    clearInput();
    clearChat();
  }, [clearInput, clearChat]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSend();
      }
    },
    [onSend]
  );

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      {/* Page title (visible only on large screens) */}
      <div className="invisible col-span-12 my-0 ml-5 h-0 items-center text-xl font-semibold lg:visible lg:mb-0 lg:mt-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('analysisAgent.title')}
      </div>

      {/* Main split-screen content */}
      <div className="flex flex-1 flex-col gap-4 p-4 lg:h-[calc(100vh-4rem)] lg:flex-row">
        {/* ── Left column: Chat conversation ── */}
        <div className="flex w-full flex-col lg:w-[45%]">
          <Card
            label={t('analysisAgent.chat_label')}
            className="flex h-full flex-col">
            {/* Model selector */}
            <div className="mb-3 shrink-0">
              <Select
                value={modelId}
                onChange={setModelId}
                options={availableModels.map((m) => ({
                  value: m,
                  label: modelDisplayName(m),
                }))}
                label={t('analysisAgent.model')}
              />
            </div>

            {/* Message list */}
            <div
              ref={scrollableContainer}
              className="min-h-0 flex-1 overflow-y-auto">
              {isEmpty ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-500">
                  <PiChartBar size={40} className="text-gray-300" />
                  <p className="text-sm">{t('analysisAgent.description')}</p>
                </div>
              ) : (
                messages.map((message, idx) => (
                  <div key={idx}>
                    {idx === 0 && (
                      <div className="w-full border-b border-gray-300" />
                    )}
                    <ChatMessage
                      chatContent={
                        message.role === 'assistant'
                          ? {
                              ...message,
                              content: stripJsonChartBlocks(message.content),
                            }
                          : message
                      }
                      loading={loading && idx === messages.length - 1}
                      hideFeedback
                      hideSaveSystemContext
                    />
                    <div className="w-full border-b border-gray-300" />
                  </div>
                ))
              )}
            </div>

            {/* Input area */}
            <div className="mt-3 shrink-0 space-y-2">
              <Textarea
                placeholder={t('analysisAgent.input_placeholder')}
                value={content}
                onChange={setContent}
                onKeyDown={onKeyDown}
                className="w-full resize-none"
                rows={4}
              />
              <div className="flex justify-end gap-2">
                <Button outlined onClick={onReset} disabled={loading && isEmpty}>
                  {t('analysisAgent.clear')}
                </Button>
                <Button onClick={onSend} disabled={disabledSend}>
                  {loading ? t('analysisAgent.analyzing') : t('analysisAgent.send')}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right column: Chart panel ── */}
        <div className="w-full lg:w-[55%]">
          <Card
            label={t('analysisAgent.charts_label')}
            className="flex h-full flex-col px-3">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {extractedCharts.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-500">
                  <PiChartBar size={48} className="text-gray-300" />
                  <p className="text-sm">{t('analysisAgent.no_charts')}</p>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div ref={chartsEndRef} />
                  {extractedCharts.map((chart, idx) => (
                    <ChartWithToggle key={idx} code={chart.chartJson} />
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AnalysisAgentPage;
