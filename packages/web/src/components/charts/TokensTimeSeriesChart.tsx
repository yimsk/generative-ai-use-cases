import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { TooltipComponentFormatterCallbackParams } from 'echarts';
import { ChartProps } from './types';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

// Blue color for input, green for output
const COLORS = ['#2196f3', '#90caf9', '#1976d2', '#4caf50'];

const TokensTimeSeriesChart: React.FC<ChartProps> = ({
  data,
  title,
  description,
  options = {},
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const chartData = useMemo(() => {
    return data.map((stat) => {
      return {
        date: format(new Date(stat.date), 'MM/dd'),
        inputTokens: stat.inputTokens?.overall || 0,
        outputTokens: stat.outputTokens?.overall || 0,
        cacheReadTokens: stat.cacheReadInputTokens?.overall || 0,
        cacheWriteTokens: stat.cacheWriteInputTokens?.overall || 0,
      };
    });
  }, [data]);

  const { legend = true, tooltip = true, colors = COLORS } = options;
  const seriesNames = useMemo(
    () => [
      'inputTokens',
      'cacheReadTokens',
      'cacheWriteTokens',
      'outputTokens',
    ],
    []
  );

  const getTokenLabel = useCallback(
    (name: string): string => {
      switch (name) {
        case 'inputTokens':
          return t('stat.input_tokens');
        case 'outputTokens':
          return t('stat.output_tokens');
        case 'cacheReadTokens':
          return t('stat.cache_read_tokens');
        case 'cacheWriteTokens':
          return t('stat.cache_write_tokens');
        default:
          return name;
      }
    },
    [t]
  );

  const formatTooltip = useCallback(
    (params: TooltipComponentFormatterCallbackParams): string => {
      const items = Array.isArray(params) ? params : [params];
      const titleItem = items[0];

      return [
        titleItem?.name ?? '',
        ...items.map((item) => {
          const value = Number(item.value ?? 0);
          const marker = typeof item.marker === 'string' ? item.marker : '';
          return `${marker}${getTokenLabel(item.seriesName ?? '')}: ${value.toLocaleString()}`;
        }),
      ].join('<br/>');
    },
    [getTokenLabel]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    chartRef.current = echarts.init(containerRef.current);

    const handleResize = () => {
      chartRef.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || chartData.length === 0) {
      return;
    }

    const option: echarts.EChartsOption = {
      color: colors,
      grid: {
        left: 16,
        right: 16,
        top: legend ? 56 : 16,
        bottom: 16,
        containLabel: true,
      },
      tooltip: tooltip
        ? {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: formatTooltip,
          }
        : undefined,
      legend: legend
        ? {
            top: 16,
            formatter: (name) => getTokenLabel(name),
          }
        : undefined,
      xAxis: {
        type: 'category',
        data: chartData.map((item) => item.date),
      },
      yAxis: {
        type: 'value',
      },
      series: seriesNames.map((name) => ({
        name,
        type: 'bar' as const,
        stack: 'total',
        data: chartData.map((item) => Number(item[name] ?? 0)),
      })),
    };

    chartRef.current.setOption(option, true);
    chartRef.current.resize();
  }, [
    chartData,
    colors,
    formatTooltip,
    getTokenLabel,
    legend,
    seriesNames,
    tooltip,
  ]);

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <div className="text-gray-500">{t('stat.no_data_available')}</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="mb-2 font-semibold">{title}</div>
      {description && (
        <div className="mb-4 text-sm text-gray-600">{description}</div>
      )}
      <div ref={containerRef} className="h-[300px]" />
    </div>
  );
};

export default TokensTimeSeriesChart;
