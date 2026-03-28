import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { TooltipComponentFormatterCallbackParams } from 'echarts';
import { ChartProps } from './types';
import { format } from 'date-fns';
import { MODELS } from '../../hooks/useModel';
import { useTranslation } from 'react-i18next';

const COLORS = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
];

interface ModelExecutionData {
  date: string;
  total: number;
  [modelId: string]: number | string;
}

const ModelExecutionsChart: React.FC<ChartProps> = ({
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
      const baseData: ModelExecutionData = {
        date: format(new Date(stat.date), 'MM/dd'),
        total: stat.executions?.overall || 0,
      };
      // Add execution counts for each model
      Object.entries(stat.executions || {}).forEach(([key, value]) => {
        if (key.startsWith('model#')) {
          const modelId = key.replace('model#', '');
          baseData[modelId] = value;
        }
      });
      return baseData;
    });
  }, [data]);

  const modelIds = useMemo(() => {
    const ids = new Set<string>();
    data.forEach((stat) => {
      Object.keys(stat.executions || {}).forEach((key) => {
        if (key.startsWith('model#')) {
          const modelId = key.replace('model#', '');
          ids.add(modelId);
        }
      });
    });
    return Array.from(ids);
  }, [data]);

  const { legend = true, tooltip = true, colors = COLORS } = options;

  const formatTooltip = useCallback(
    (params: TooltipComponentFormatterCallbackParams): string => {
      const items = Array.isArray(params) ? params : [params];
      const firstItem = items[0];
      const rowIndex = firstItem?.dataIndex;
      const row =
        typeof rowIndex === 'number' ? chartData[rowIndex] : undefined;
      const total = Number(row?.total ?? 0);

      return [
        firstItem?.name ?? '',
        ...items.map((item) => {
          const value = Number(item.value ?? 0);
          const percentage =
            total > 0 ? ` (${((value / total) * 100).toFixed(1)}%)` : '';
          const marker = typeof item.marker === 'string' ? item.marker : '';
          return `${marker}${MODELS.modelDisplayName(item.seriesName ?? '')}: ${value.toLocaleString()}${percentage}`;
        }),
      ].join('<br/>');
    },
    [chartData]
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
    if (!chartRef.current || chartData.length === 0 || modelIds.length === 0) {
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
            formatter: (name) => MODELS.modelDisplayName(name),
          }
        : undefined,
      xAxis: {
        type: 'category',
        data: chartData.map((item) => item.date),
      },
      yAxis: {
        type: 'value',
      },
      series: modelIds.map((modelId) => ({
        name: modelId,
        type: 'bar' as const,
        stack: 'total',
        data: chartData.map((item) => Number(item[modelId] ?? 0)),
      })),
    };

    chartRef.current.setOption(option, true);
    chartRef.current.resize();
  }, [chartData, colors, formatTooltip, legend, modelIds, tooltip]);

  if (data.length === 0 || modelIds.length === 0) {
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

export default ModelExecutionsChart;
