import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import type { TooltipComponentFormatterCallbackParams } from 'echarts';
import { ChartProps } from './types';
import { format } from 'date-fns';
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

interface UsecaseData {
  date: string;
  [key: string]: number | string; // Execution count for each usecase
}

const UsecaseDistributionChart: React.FC<ChartProps> = ({
  data,
  title,
  description,
  options = {},
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const { chartData, usecases } = useMemo(() => {
    // Aggregate execution count for each usecase by date
    const dailyData = data.map((stat) => {
      const dailyStats: UsecaseData = {
        date: format(new Date(stat.date), 'MM/dd'),
      };

      Object.entries(stat.executions || {}).forEach(([key, value]) => {
        if (key.startsWith('usecase#')) {
          const usecase = key.replace('usecase#', '');
          dailyStats[usecase] = value;
        }
      });

      return dailyStats;
    });

    // Get all usecases that appeared during the entire period
    const allUsecases = Array.from(
      new Set(
        data.flatMap((stat) =>
          Object.keys(stat.executions || {})
            .filter((key) => key.startsWith('usecase#'))
            .map((key) => key.replace('usecase#', ''))
        )
      )
    ).sort();

    // Initialize execution count for usecases that do not exist
    dailyData.forEach((daily) => {
      allUsecases.forEach((usecase) => {
        if (!(usecase in daily)) {
          daily[usecase] = 0;
        }
      });
    });

    return {
      chartData: dailyData,
      usecases: allUsecases,
    };
  }, [data]);

  const { legend = true, tooltip = true, colors = COLORS } = options;

  const formatTooltip = useCallback(
    (params: TooltipComponentFormatterCallbackParams): string => {
      const items = Array.isArray(params) ? params : [params];

      return [
        items[0]?.name ?? '',
        ...items.map((item) => {
          const value = Number(item.value ?? 0);
          const marker = typeof item.marker === 'string' ? item.marker : '';
          return `${marker}${item.seriesName ?? ''}: ${value.toLocaleString()}`;
        }),
      ].join('<br/>');
    },
    []
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
    if (!chartRef.current || chartData.length === 0 || usecases.length === 0) {
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
          }
        : undefined,
      xAxis: {
        type: 'category',
        data: chartData.map((item) => item.date),
      },
      yAxis: {
        type: 'value',
      },
      series: usecases.map((usecase) => ({
        name: usecase,
        type: 'bar' as const,
        stack: 'total',
        data: chartData.map((item) => Number(item[usecase] ?? 0)),
      })),
    };

    chartRef.current.setOption(option, true);
    chartRef.current.resize();
  }, [chartData, colors, formatTooltip, legend, tooltip, usecases]);

  if (data.length === 0 || chartData.length === 0 || usecases.length === 0) {
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

export default UsecaseDistributionChart;
