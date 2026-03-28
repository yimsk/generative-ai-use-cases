import { describe, expect, it } from 'vitest';
import {
  isValidChartData,
  validateBasicChart,
  validateBoxplot,
  validateCandlestick,
  validateHeatmap,
  validateMap,
  validateRadar,
} from '../../../src/components/Chart/validation';
import {
  isValidChartData as isValidChartDataFromTypes,
  type BasicChartInput,
  type BoxplotInput,
  type CandlestickInput,
  type ChartType,
  type CreateChartInput,
  type HeatmapInput,
  type MapInput,
  type RadarInput,
} from '../../../src/components/Chart/types';

describe('chart types', () => {
  it('supports all chart type literals', () => {
    const chartTypes: ChartType[] = [
      'bar',
      'line',
      'pie',
      'area',
      'scatter',
      'boxplot',
      'heatmap',
      'radar',
      'candlestick',
      'map',
    ];

    expect(chartTypes).toHaveLength(10);
  });

  it('re-exports isValidChartData from types', () => {
    expect(isValidChartDataFromTypes).toBe(isValidChartData);
  });
});

describe('validateBasicChart', () => {
  const validDataChart: BasicChartInput = {
    type: 'bar',
    data: [{ name: 'A', value: 1 }],
  };

  const validSeriesChart: BasicChartInput = {
    type: 'line',
    series: [{ name: 'Series 1', data: [{ name: 'A', value: 1 }] }],
  };

  it('accepts valid chart data', () => {
    expect(validateBasicChart(validDataChart)).toBe(true);
  });

  it('accepts valid chart series', () => {
    expect(validateBasicChart(validSeriesChart)).toBe(true);
  });

  it('rejects charts without data and series', () => {
    expect(validateBasicChart({ type: 'pie' })).toBe(false);
  });

  it('rejects invalid data items', () => {
    expect(
      validateBasicChart({
        type: 'area',
        data: [{ name: 'A', value: '1' }],
      })
    ).toBe(false);
  });

  it('rejects invalid series items', () => {
    expect(
      validateBasicChart({
        type: 'scatter',
        series: [{ name: 'Series 1', data: [{ name: 'A', value: '1' }] }],
      })
    ).toBe(false);
  });

  it('rejects invalid chart type', () => {
    expect(
      validateBasicChart({
        type: 'heatmap',
        data: [{ name: 'A', value: 1 }],
      })
    ).toBe(false);
  });
});

describe('validateBoxplot', () => {
  const validInput: BoxplotInput = {
    type: 'boxplot',
    data: [[1, 2, 3, 4, 5]],
  };

  it('accepts valid data', () => {
    expect(validateBoxplot(validInput)).toBe(true);
  });

  it('rejects missing data', () => {
    expect(validateBoxplot({ type: 'boxplot' })).toBe(false);
  });

  it('rejects wrong tuple length', () => {
    expect(validateBoxplot({ type: 'boxplot', data: [[1, 2, 3, 4]] })).toBe(
      false
    );
  });

  it('rejects non-number values', () => {
    expect(
      validateBoxplot({
        type: 'boxplot',
        data: [[1, 2, 3, 4, '5']],
      })
    ).toBe(false);
  });
});

describe('validateHeatmap', () => {
  const validInput: HeatmapInput = {
    type: 'heatmap',
    xLabels: ['Mon'],
    yLabels: ['AM'],
    data: [[0, 0, 42]],
  };

  it('accepts valid data', () => {
    expect(validateHeatmap(validInput)).toBe(true);
  });

  it('rejects missing xLabels', () => {
    expect(
      validateHeatmap({ type: 'heatmap', yLabels: ['AM'], data: [[0, 0, 1]] })
    ).toBe(false);
  });

  it('rejects missing yLabels', () => {
    expect(
      validateHeatmap({ type: 'heatmap', xLabels: ['Mon'], data: [[0, 0, 1]] })
    ).toBe(false);
  });

  it('rejects missing data', () => {
    expect(
      validateHeatmap({ type: 'heatmap', xLabels: ['Mon'], yLabels: ['AM'] })
    ).toBe(false);
  });

  it('rejects out-of-bounds indices', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        xLabels: ['Mon'],
        yLabels: ['AM'],
        data: [[1, 0, 42]],
      })
    ).toBe(false);
  });

  it('rejects wrong tuple length', () => {
    expect(
      validateHeatmap({
        type: 'heatmap',
        xLabels: ['Mon'],
        yLabels: ['AM'],
        data: [[0, 0]],
      })
    ).toBe(false);
  });
});

describe('validateRadar', () => {
  const validInput: RadarInput = {
    type: 'radar',
    indicators: [{ name: 'Speed', max: 100 }],
    data: [{ name: 'Model A', value: [80] }],
  };

  it('accepts valid data', () => {
    expect(validateRadar(validInput)).toBe(true);
  });

  it('rejects missing indicators', () => {
    expect(
      validateRadar({ type: 'radar', data: [{ name: 'A', value: [1] }] })
    ).toBe(false);
  });

  it('rejects missing data', () => {
    expect(
      validateRadar({
        type: 'radar',
        indicators: [{ name: 'Speed', max: 100 }],
      })
    ).toBe(false);
  });

  it('rejects invalid indicators', () => {
    expect(
      validateRadar({
        type: 'radar',
        indicators: [{ name: 'Speed' }],
        data: [{ name: 'Model A', value: [80] }],
      })
    ).toBe(false);
  });

  it('rejects invalid data values', () => {
    expect(
      validateRadar({
        type: 'radar',
        indicators: [{ name: 'Speed', max: 100 }],
        data: [{ name: 'Model A', value: [80, '90'] }],
      })
    ).toBe(false);
  });
});

describe('validateCandlestick', () => {
  const validInput: CandlestickInput = {
    type: 'candlestick',
    data: [[10, 12, 9, 13]],
  };

  it('accepts valid data', () => {
    expect(validateCandlestick(validInput)).toBe(true);
  });

  it('rejects missing data', () => {
    expect(validateCandlestick({ type: 'candlestick' })).toBe(false);
  });

  it('rejects wrong tuple length', () => {
    expect(
      validateCandlestick({ type: 'candlestick', data: [[10, 12, 9]] })
    ).toBe(false);
  });

  it('rejects non-number values', () => {
    expect(
      validateCandlestick({
        type: 'candlestick',
        data: [[10, 12, 9, '13']],
      })
    ).toBe(false);
  });
});

describe('validateMap', () => {
  const validJapanMap: MapInput = {
    type: 'map',
    region: 'japan',
    detail: 'prefecture',
    data: [{ name: 'Tokyo', value: 100 }],
  };

  const validWorldMap: MapInput = {
    type: 'map',
    region: 'world',
    data: [{ name: 'Japan', value: 1 }],
  };

  it('accepts valid japan map', () => {
    expect(validateMap(validJapanMap)).toBe(true);
  });

  it('accepts valid world map', () => {
    expect(validateMap(validWorldMap)).toBe(true);
  });

  it('rejects missing region', () => {
    expect(
      validateMap({ type: 'map', data: [{ name: 'Tokyo', value: 100 }] })
    ).toBe(false);
  });

  it('rejects invalid region', () => {
    expect(
      validateMap({
        type: 'map',
        region: 'asia',
        data: [{ name: 'Tokyo', value: 100 }],
      })
    ).toBe(false);
  });

  it('rejects municipality detail without prefecture', () => {
    expect(
      validateMap({
        type: 'map',
        region: 'japan',
        detail: 'municipality',
        data: [{ name: 'Shinjuku', value: 100 }],
      })
    ).toBe(false);
  });

  it('accepts municipality detail with prefecture', () => {
    expect(
      validateMap({
        type: 'map',
        region: 'japan',
        detail: 'municipality',
        prefecture: '13-tokyo',
        data: [{ name: 'Shinjuku', value: 100 }],
      })
    ).toBe(true);
  });
});

describe('isValidChartData', () => {
  it('accepts all supported chart types', () => {
    const inputs: CreateChartInput[] = [
      { type: 'bar', data: [{ name: 'A', value: 1 }] },
      {
        type: 'line',
        series: [{ name: 'S1', data: [{ name: 'A', value: 1 }] }],
      },
      { type: 'pie', data: [{ name: 'A', value: 1 }] },
      { type: 'area', data: [{ name: 'A', value: 1 }] },
      { type: 'scatter', data: [{ name: 'A', value: 1 }] },
      { type: 'boxplot', data: [[1, 2, 3, 4, 5]] },
      { type: 'heatmap', xLabels: ['X'], yLabels: ['Y'], data: [[0, 0, 1]] },
      {
        type: 'radar',
        indicators: [{ name: 'Metric', max: 10 }],
        data: [{ name: 'Series', value: [5] }],
      },
      { type: 'candlestick', data: [[1, 2, 0, 3]] },
      { type: 'map', region: 'world', data: [{ name: 'Japan', value: 1 }] },
    ];

    for (const input of inputs) {
      expect(isValidChartData(input)).toBe(true);
    }
  });

  it('rejects unknown chart types', () => {
    expect(
      isValidChartData({ type: 'unknown', data: [{ name: 'A', value: 1 }] })
    ).toBe(false);
  });

  it('rejects nullish and primitive inputs', () => {
    expect(isValidChartData(null)).toBe(false);
    expect(isValidChartData(undefined)).toBe(false);
    expect(isValidChartData('chart')).toBe(false);
  });
});
