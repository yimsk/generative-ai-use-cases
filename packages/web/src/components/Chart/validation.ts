import type {
  BasicChartInput,
  BoxplotInput,
  CandlestickInput,
  ChartType,
  CreateChartInput,
  HeatmapInput,
  MapColorStop,
  MapInput,
  RadarInput,
  ScatterChartInput,
  ScatterDataPoint,
} from './types';

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isValidMapColorStop(value: unknown): value is MapColorStop {
  if (!isRecord(value)) return false;
  const offset: unknown = value.offset;
  if (!isValidNumber(offset)) return false;
  if (offset < 0 || offset > 1) return false;
  return typeof value.color === 'string' && value.color.length > 0;
}

function isValidColorStops(value: unknown): value is MapColorStop[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every(isValidMapColorStop)
  );
}

function isValidDataPoint(input: unknown): boolean {
  if (!isRecord(input)) return false;
  return typeof input.name === 'string' && isValidNumber(input.value);
}

function isValidScatterDataPoint(input: unknown): input is ScatterDataPoint {
  if (!isRecord(input)) return false;
  if (typeof input.name !== 'string') return false;

  const value = input.value;
  if (isValidNumber(value)) {
    return true;
  }
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(isValidNumber)
  ) {
    return true;
  }
  return false;
}

export function validateBasicChart(
  input: unknown
): input is BasicChartInput | ScatterChartInput {
  if (!isRecord(input)) return false;

  const validTypes: (BasicChartInput['type'] | ScatterChartInput['type'])[] = [
    'bar',
    'line',
    'pie',
    'area',
    'scatter',
  ];

  if (!validTypes.includes(input.type as BasicChartInput['type'])) return false;

  const hasData = Array.isArray(input.data) && input.data.length > 0;
  const hasSeries = Array.isArray(input.series) && input.series.length > 0;

  if (!hasData && !hasSeries) return false;

  if (hasData) {
    for (const item of input.data as unknown[]) {
      if (
        input.type === 'scatter'
          ? !isValidScatterDataPoint(item)
          : !isValidDataPoint(item)
      ) {
        return false;
      }
    }
  }

  if (hasSeries) {
    const seriesArray = input.series as unknown[];
    const firstSeriesLength = (seriesArray[0] as { data: unknown[] }).data
      .length;
    const needsEqualLength =
      input.type === 'bar' || input.type === 'line' || input.type === 'area';

    for (const item of seriesArray) {
      if (!isRecord(item)) return false;
      if (typeof item.name !== 'string' || !Array.isArray(item.data))
        return false;
      if (needsEqualLength && item.data.length !== firstSeriesLength)
        return false;

      if (needsEqualLength) {
        const categoryNames = new Set<string>();
        for (const point of item.data as unknown[]) {
          if (isRecord(point) && typeof point.name === 'string') {
            if (categoryNames.has(point.name)) return false;
            categoryNames.add(point.name);
          }
        }
      }

      for (const point of item.data) {
        if (
          input.type === 'scatter'
            ? !isValidScatterDataPoint(point)
            : !isValidDataPoint(point)
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

export function validateBoxplot(input: unknown): input is BoxplotInput {
  if (!isRecord(input) || input.type !== 'boxplot') return false;
  if (!Array.isArray(input.data) || input.data.length === 0) return false;

  if (input.labels !== undefined) {
    if (!isStringArray(input.labels)) return false;
    if (input.labels.length !== input.data.length) return false;
  }

  for (const item of input.data as unknown[]) {
    if (!Array.isArray(item) || item.length !== 5) return false;
    for (const value of item) {
      if (!isValidNumber(value)) return false;
    }
  }

  return true;
}

export function validateHeatmap(input: unknown): input is HeatmapInput {
  if (!isRecord(input) || input.type !== 'heatmap') return false;
  if (!Array.isArray(input.xLabels) || input.xLabels.length === 0) return false;
  if (!Array.isArray(input.yLabels) || input.yLabels.length === 0) return false;
  if (!Array.isArray(input.data) || input.data.length === 0) return false;

  for (const item of input.data as unknown[]) {
    if (!Array.isArray(item) || item.length !== 3) return false;
    for (const value of item) {
      if (!isValidNumber(value)) return false;
    }
    const [xIndex, yIndex] = item as [number, number, number];
    if (!Number.isInteger(xIndex) || !Number.isInteger(yIndex)) return false;
    if (xIndex < 0 || xIndex >= input.xLabels.length) return false;
    if (yIndex < 0 || yIndex >= input.yLabels.length) return false;
  }

  return true;
}

export function validateRadar(input: unknown): input is RadarInput {
  if (!isRecord(input) || input.type !== 'radar') return false;
  if (!Array.isArray(input.indicators) || input.indicators.length === 0)
    return false;
  if (!Array.isArray(input.data) || input.data.length === 0) return false;

  for (const indicator of input.indicators as unknown[]) {
    if (!isRecord(indicator)) return false;
    if (typeof indicator.name !== 'string' || !isValidNumber(indicator.max)) {
      return false;
    }
  }

  const indicatorCount = input.indicators.length;
  for (const item of input.data as unknown[]) {
    if (!isRecord(item)) return false;
    if (typeof item.name !== 'string' || !Array.isArray(item.value))
      return false;
    if (item.value.length !== indicatorCount) return false;

    for (const value of item.value) {
      if (!isValidNumber(value)) return false;
    }
  }

  return true;
}

export function validateCandlestick(input: unknown): input is CandlestickInput {
  if (!isRecord(input) || input.type !== 'candlestick') return false;
  if (!Array.isArray(input.data) || input.data.length === 0) return false;

  if (input.dates !== undefined) {
    if (!isStringArray(input.dates)) return false;
    if (input.dates.length !== input.data.length) return false;
  }

  for (const item of input.data as unknown[]) {
    if (!Array.isArray(item) || item.length !== 4) return false;
    for (const value of item) {
      if (!isValidNumber(value)) return false;
    }
  }

  return true;
}

export function validateMap(input: unknown): input is MapInput {
  if (!isRecord(input) || input.type !== 'map') return false;
  if (input.region !== 'japan' && input.region !== 'world') return false;
  if (input.region === 'world' && input.detail === 'municipality') {
    return false;
  }
  if (input.min != null && !isValidNumber(input.min)) return false;
  if (input.max != null && !isValidNumber(input.max)) return false;
  if (input.min != null && input.max != null && input.min >= input.max) {
    return false;
  }
  if (input.colorStops != null && !isValidColorStops(input.colorStops)) {
    return false;
  }
  if (!Array.isArray(input.data) || input.data.length === 0) return false;

  for (const item of input.data as unknown[]) {
    if (!isValidDataPoint(item)) return false;
  }

  if (
    input.detail === 'municipality' &&
    (typeof input.prefecture !== 'string' || input.prefecture.length === 0)
  ) {
    return false;
  }

  return true;
}

const validators: Record<ChartType, (input: unknown) => boolean> = {
  bar: validateBasicChart,
  line: validateBasicChart,
  pie: validateBasicChart,
  area: validateBasicChart,
  scatter: validateBasicChart,
  boxplot: validateBoxplot,
  heatmap: validateHeatmap,
  radar: validateRadar,
  candlestick: validateCandlestick,
  map: validateMap,
};

export function isValidChartData(input: unknown): input is CreateChartInput {
  if (!isRecord(input)) return false;

  const type = input.type;

  if (typeof type !== 'string') return false;

  const validator = validators[type as ChartType];

  return validator ? validator(input) : false;
}
