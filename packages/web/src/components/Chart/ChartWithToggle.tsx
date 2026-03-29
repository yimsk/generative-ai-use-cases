import { useState, memo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { VscCode } from 'react-icons/vsc';
import { LuChartBar, LuExpand } from 'react-icons/lu';
import { IoIosClose, IoMdDownload } from 'react-icons/io';
import { TbSvg } from 'react-icons/tb';
import type * as echarts from 'echarts';

import ButtonCopy from '../ButtonCopy';
import Button from '../Button';
import EChartsRenderer from './EChartsRenderer';

import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChartWithToggleProps {
  code: string;
}

export const ChartWithToggle = memo(({ code }: ChartWithToggleProps) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'chart' | 'code'>('chart');
  const [zoom, setZoom] = useState(false);
  const prevCodeRef = useRef(code);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mainChartRef = useRef<echarts.ECharts | null>(null);
  const zoomChartRef = useRef<echarts.ECharts | null>(null);

  const chartInstance = useCallback((): echarts.ECharts | null => {
    return zoomChartRef.current ?? mainChartRef.current;
  }, []);

  const handleMainChartInit = useCallback(
    (instance: echarts.ECharts | null) => {
      mainChartRef.current = instance;
    },
    []
  );

  const handleZoomChartInit = useCallback(
    (instance: echarts.ECharts | null) => {
      zoomChartRef.current = instance;
    },
    []
  );

  const scheduleChartResize = useCallback(() => {
    if (resizeTimerRef.current) {
      clearTimeout(resizeTimerRef.current);
    }

    resizeTimerRef.current = setTimeout(() => {
      chartInstance()?.resize();
    }, 0);
  }, [chartInstance]);

  useEffect(() => {
    if (code !== prevCodeRef.current) {
      prevCodeRef.current = code;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        setViewMode('chart');
      }, 500);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [code]);

  useEffect(() => {
    if (viewMode === 'chart' || zoom) {
      scheduleChartResize();
    }

    return () => {
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
    };
  }, [scheduleChartResize, viewMode, zoom]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setZoom(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const downloadAsSVG = useCallback(() => {
    const instance = chartInstance();

    if (!instance) {
      return;
    }

    const url = instance.getDataURL({
      type: 'svg',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });

    const link = document.createElement('a');
    link.href = url;
    link.download = `chart_${new Date().getTime()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [chartInstance]);

  return (
    <>
      <div className="my-4 rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="flex rounded border bg-gray-50 text-xs font-bold">
              <button
                type="button"
                className={`m-0.5 flex items-center rounded px-2 py-1 transition-colors
                ${viewMode === 'chart' ? 'bg-gray-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setViewMode('chart')}>
                <LuChartBar className="mr-1 text-sm" />
                {t('chart.view_chart')}
              </button>
              <button
                type="button"
                className={`m-0.5 flex items-center rounded px-2 py-1 transition-colors
                ${viewMode === 'code' ? 'bg-gray-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => setViewMode('code')}>
                <VscCode className="mr-1 text-sm" />
                {t('chart.view_code')}
              </button>
            </div>

            <Button
              outlined
              onClick={downloadAsSVG}
              title={t('chart.download_svg')}
              className="cursor-pointer px-2 py-1 text-xs">
              <IoMdDownload className="text-sm" />
              <TbSvg className="text-lg" />
            </Button>

            <Button
              outlined
              onClick={() => setZoom(true)}
              title="Zoom chart"
              aria-label="Zoom chart"
              className="cursor-pointer px-2 py-1 text-xs">
              <LuExpand className="text-sm" />
            </Button>
          </div>

          <ButtonCopy className="text-gray-400" text={code} />
        </div>

        <div className="relative overflow-hidden">
          <div
            data-testid="chart-panel"
            className={`transition-all duration-200 ${
              viewMode === 'chart'
                ? 'visible opacity-100'
                : 'invisible absolute left-0 top-0 h-0 opacity-0'
            }`}>
            <EChartsRenderer
              rawJson={code}
              onChartInit={handleMainChartInit}
            />
          </div>
          <div
            data-testid="code-panel"
            className={`transition-all duration-200 ${
              viewMode === 'code'
                ? 'visible opacity-100'
                : 'invisible absolute left-0 top-0 h-0 opacity-0'
            }`}>
            <SyntaxHighlighter
              style={vscDarkPlus}
              language="json"
              customStyle={{
                margin: 0,
                borderRadius: '0 0 0.5rem 0.5rem',
              }}>
              {code}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>

      {zoom && (
        <>
          <button
            type="button"
            aria-label={t('common.close')}
            className="fixed inset-0 z-[100] bg-black/50"
            onClick={() => setZoom(false)}
          />
          <div
            data-testid="chart-zoom-modal"
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[110] flex h-[90%] w-[90%] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white">
            <div className="flex h-[40px] justify-end px-2">
              <button type="button" onClick={() => setZoom(false)}>
                <IoIosClose className="flex h-8 w-8 cursor-pointer content-center justify-center rounded text-lg hover:bg-gray-200" />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-8 pb-8">
              <EChartsRenderer
                rawJson={code}
                onChartInit={handleZoomChartInit}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
});
