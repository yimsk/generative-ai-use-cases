import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as echarts from 'echarts';
import { useGeoJSON } from '../../hooks/useGeoJSON';
import {
  validateBasicChart,
  validateBoxplot,
  validateCandlestick,
  validateHeatmap,
  validateMap,
  validateRadar,
} from './validation';
import type {
  BasicChartInput,
  BoxplotInput,
  CandlestickInput,
  CreateChartInput,
  HeatmapInput,
  MapInput,
  RadarInput,
} from './types';

const COLORS = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
];

const AXIS_GRID = {
  left: 64,
  right: 24,
  top: 24,
  bottom: 40,
  containLabel: true,
} as const;

interface EChartsRendererProps {
  rawJson: string;
  onChartInit?: (instance: echarts.ECharts | null) => void;
}

function ErrorDisplay({ rawJson }: { rawJson: string }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4">
      <p className="font-semibold text-red-700">{t('chart.invalid_data')}</p>
      <pre className="mt-2 overflow-auto text-xs text-gray-600">{rawJson}</pre>
    </div>
  );
}

function getCategoryData(input: BasicChartInput): string[] {
  if (input.series && input.series.length > 0) {
    return input.series[0].data.map((item) => item.name);
  }

  return input.data ? input.data.map((item) => item.name) : [];
}

function buildAxisGrid(
  isMultiSeries: boolean,
  xAxisLabel?: string
): echarts.EChartsOption['grid'] {
  return {
    ...AXIS_GRID,
    top: isMultiSeries ? 56 : AXIS_GRID.top,
    bottom: xAxisLabel ? 52 : AXIS_GRID.bottom,
  };
}

function buildCategorySeries(
  input: BasicChartInput,
  chartType: 'bar' | 'line',
  extra?: (series: { areaStyle?: object }) => void
) {
  const isMultiSeries = Array.isArray(input.series) && input.series.length > 0;
  const multiSeries = input.series ?? [];

  return isMultiSeries
    ? multiSeries.map((series) => {
        const entry: Record<string, unknown> = {
          name: series.name,
          type: chartType,
          data: series.data.map((item) => item.value),
        };
        if (extra) extra(entry);
        return entry;
      })
    : (() => {
        const entry: Record<string, unknown> = {
          type: chartType,
          data: input.data ? input.data.map((item) => item.value) : [],
        };
        if (extra) extra(entry);
        return [entry];
      })();
}

function buildBasicOption(input: BasicChartInput): echarts.EChartsOption {
  const isMultiSeries = Array.isArray(input.series) && input.series.length > 0;
  const categoryData = getCategoryData(input);

  const baseOption: echarts.EChartsOption = {
    color: COLORS,
    tooltip: {
      trigger: isMultiSeries || input.type !== 'pie' ? 'axis' : 'item',
    },
    legend: isMultiSeries ? { top: 24 } : undefined,
  };

  switch (input.type) {
    case 'bar':
      return {
        ...baseOption,
        grid: buildAxisGrid(isMultiSeries, input.xAxisLabel),
        xAxis: {
          type: 'category',
          data: categoryData,
          name: input.xAxisLabel,
        },
        yAxis: { type: 'value', name: input.yAxisLabel },
        series: buildCategorySeries(input, 'bar'),
      };

    case 'line':
      return {
        ...baseOption,
        grid: buildAxisGrid(isMultiSeries, input.xAxisLabel),
        xAxis: {
          type: 'category',
          data: categoryData,
          name: input.xAxisLabel,
        },
        yAxis: { type: 'value', name: input.yAxisLabel },
        series: buildCategorySeries(input, 'line'),
      };

    case 'area':
      return {
        ...baseOption,
        grid: buildAxisGrid(isMultiSeries, input.xAxisLabel),
        xAxis: {
          type: 'category',
          data: categoryData,
          name: input.xAxisLabel,
        },
        yAxis: { type: 'value', name: input.yAxisLabel },
        series: buildCategorySeries(input, 'line', (e) => {
          e.areaStyle = {};
        }),
      };

    case 'pie':
      return {
        ...baseOption,
        tooltip: { trigger: 'item' },
        legend: isMultiSeries
          ? { top: 24 }
          : { orient: 'vertical', left: 'left' },
        series: isMultiSeries
          ? (input.series ?? []).map((series) => ({
              name: series.name,
              type: 'pie' as const,
              radius: '50%',
              data: series.data.map((item) => ({
                name: item.name,
                value: item.value,
              })),
            }))
          : [
              {
                type: 'pie' as const,
                radius: '50%',
                data: input.data
                  ? input.data.map((item) => ({
                      name: item.name,
                      value: item.value,
                    }))
                  : [],
              },
            ],
      };

    case 'scatter':
      return {
        ...baseOption,
        grid: buildAxisGrid(isMultiSeries, input.xAxisLabel),
        xAxis: { type: 'value', name: input.xAxisLabel },
        yAxis: { type: 'value', name: input.yAxisLabel },
        series: isMultiSeries
          ? (input.series ?? []).map((series) => ({
              name: series.name,
              type: 'scatter' as const,
              data: series.data.map((item) => [item.value, item.value]),
            }))
          : [
              {
                type: 'scatter' as const,
                data: input.data
                  ? input.data.map((item) => [item.value, item.value])
                  : [],
              },
            ],
      };
  }
}

function buildBoxplotOption(input: BoxplotInput): echarts.EChartsOption {
  return {
    color: COLORS,
    grid: AXIS_GRID,
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'category',
      data: input.labels || input.data.map((_, i) => String(i)),
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'boxplot',
        data: input.data,
      },
    ],
  };
}

function buildHeatmapOption(input: HeatmapInput): echarts.EChartsOption {
  return {
    color: COLORS,
    grid: AXIS_GRID,
    tooltip: { trigger: 'item' },
    xAxis: { type: 'category', data: input.xLabels },
    yAxis: { type: 'category', data: input.yLabels },
    visualMap: {
      min: Math.min(...input.data.map((datum) => datum[2])),
      max: Math.max(...input.data.map((datum) => datum[2])),
      calculable: true,
      inRange: { color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4'] },
    },
    series: [
      {
        type: 'heatmap',
        data: input.data,
        label: { show: true },
      },
    ],
  };
}

function buildRadarOption(input: RadarInput): echarts.EChartsOption {
  return {
    color: COLORS,
    tooltip: { trigger: 'item' },
    radar: {
      indicator: input.indicators.map((indicator) => ({
        name: indicator.name,
        max: indicator.max,
      })),
    },
    series: [
      {
        type: 'radar',
        data: input.data.map((datum) => ({
          name: datum.name,
          value: datum.value,
        })),
      },
    ],
  };
}

function buildCandlestickOption(
  input: CandlestickInput
): echarts.EChartsOption {
  return {
    color: COLORS,
    grid: AXIS_GRID,
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: input.dates || input.data.map((_, i) => String(i)),
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'candlestick',
        data: input.data,
      },
    ],
  };
}

function buildMapOption(mapData: MapInput): echarts.EChartsOption {
  const values = mapData.data.map((datum) => datum.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const rawValue = Array.isArray(params)
          ? params[0]?.value
          : params.value;
        const value =
          typeof rawValue === 'number' || typeof rawValue === 'string'
            ? rawValue.toLocaleString()
            : 'N/A';

        return `${params.name}: ${value}`;
      },
    },
    visualMap: {
      min: minValue,
      max: maxValue,
      text: ['High', 'Low'],
      realtime: false,
      calculable: true,
      inRange: {
        color: ['#e0f3f8', '#abd9e9', '#74add1', '#4575b4'],
      },
    },
    series: [
      {
        type: 'map',
        map: mapData.region,
        data: mapData.data,
        label: {
          show: mapData.detail === 'municipality',
          fontSize: 10,
        },
        emphasis: {
          label: { show: true },
          itemStyle: {
            areaColor: '#ffd700',
          },
        },
      },
    ],
  };
}

type ValidatedData =
  | { kind: 'basic'; data: BasicChartInput }
  | { kind: 'boxplot'; data: BoxplotInput }
  | { kind: 'heatmap'; data: HeatmapInput }
  | { kind: 'radar'; data: RadarInput }
  | { kind: 'candlestick'; data: CandlestickInput }
  | { kind: 'map'; data: MapInput }
  | null;

const VALIDATORS: Array<{
  validate: (input: unknown) => boolean;
  kind: NonNullable<ValidatedData>['kind'];
}> = [
  { validate: validateBasicChart, kind: 'basic' },
  { validate: validateBoxplot, kind: 'boxplot' },
  { validate: validateHeatmap, kind: 'heatmap' },
  { validate: validateRadar, kind: 'radar' },
  { validate: validateCandlestick, kind: 'candlestick' },
  { validate: validateMap, kind: 'map' },
];

function resolveValidatedData(raw: unknown): ValidatedData {
  for (const { validate, kind } of VALIDATORS) {
    if (validate(raw)) {
      return { kind, data: raw } as ValidatedData;
    }
  }
  return null;
}

function resolveOption(
  validated: NonNullable<ValidatedData>
): echarts.EChartsOption | null {
  switch (validated.kind) {
    case 'basic':
      return buildBasicOption(validated.data as BasicChartInput);
    case 'boxplot':
      return buildBoxplotOption(validated.data as BoxplotInput);
    case 'heatmap':
      return buildHeatmapOption(validated.data as HeatmapInput);
    case 'radar':
      return buildRadarOption(validated.data as RadarInput);
    case 'candlestick':
      return buildCandlestickOption(validated.data as CandlestickInput);
    default:
      return null;
  }
}

const EChartsRenderer: React.FC<EChartsRendererProps> = ({
  rawJson,
  onChartInit,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleResize = useCallback(() => {
    if (resizeTimerRef.current) {
      clearTimeout(resizeTimerRef.current);
    }

    resizeTimerRef.current = setTimeout(() => {
      chartRef.current?.resize();
    }, 0);
  }, []);

  const parsed = useMemo(() => {
    try {
      return { data: JSON.parse(rawJson) as unknown, error: null };
    } catch {
      return { data: null, error: 'Invalid JSON' };
    }
  }, [rawJson]);

  const validated = useMemo(
    () => (parsed.error || !parsed.data ? null : resolveValidatedData(parsed.data)),
    [parsed.data, parsed.error]
  );

  const mapData = useMemo(
    () =>
      validated?.kind === 'map'
        ? (validated.data as MapInput)
        : null,
    [validated]
  );

  const {
    geoJson,
    loading: geoLoading,
    error: geoError,
  } = useGeoJSON(mapData?.region, mapData?.detail, mapData?.prefecture);

  const chartData = useMemo<CreateChartInput | null>(
    () => (validated ? (validated.data as CreateChartInput) : null),
    [validated]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const instance = echarts.init(containerRef.current);
    chartRef.current = instance;
    onChartInit?.(instance);
    scheduleResize();

    const handleResize = () => {
      chartRef.current?.resize();
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        scheduleResize();
      });
      resizeObserverRef.current.observe(containerRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      chartRef.current?.dispose();
      chartRef.current = null;
      onChartInit?.(null);
    };
  }, [onChartInit, scheduleResize]);

  useEffect(() => {
    if (!chartRef.current || parsed.error || !parsed.data || !validated) {
      return;
    }

    let option: echarts.EChartsOption;

    if (mapData && !geoLoading && geoJson) {
      option = buildMapOption(mapData);
      chartRef.current.setOption(option, true);
      scheduleResize();
      return;
    }

    const resolved = resolveOption(validated);
    if (!resolved) {
      return;
    }

    option = resolved;
    chartRef.current.setOption(option, true);
    scheduleResize();
  }, [geoJson, geoLoading, mapData, parsed.data, parsed.error, scheduleResize, validated]);

  if (parsed.error !== null) {
    return <ErrorDisplay rawJson={rawJson} />;
  }

  if (!chartData) {
    return <ErrorDisplay rawJson={rawJson} />;
  }

  if (mapData && geoLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  if (mapData && geoError) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4">
        <p className="font-semibold text-red-700">{t('chart.invalid_data')}</p>
        <p className="text-sm text-gray-600">{geoError}</p>
      </div>
    );
  }

  return (
    <div>
      {chartData.title && (
        <h3 className="mb-2 text-lg font-semibold">{chartData.title}</h3>
      )}
      <div ref={containerRef} style={{ width: '100%', height: 300 }} />
    </div>
  );
};

export default EChartsRenderer;
