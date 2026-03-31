export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'area'
  | 'scatter'
  | 'boxplot'
  | 'heatmap'
  | 'radar'
  | 'candlestick'
  | 'map';

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface ScatterDataPoint {
  name: string;
  value: number | [number, number];
}

export interface ScatterChartSeries {
  name: string;
  data: ScatterDataPoint[];
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
}

export interface ChartInputBase {
  type: ChartType;
  title?: string;
}

export interface BasicChartInput extends ChartInputBase {
  type: 'bar' | 'line' | 'pie' | 'area';
  data?: ChartDataPoint[];
  series?: ChartSeries[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface ScatterChartInput extends ChartInputBase {
  type: 'scatter';
  data: ScatterDataPoint[];
  series?: ScatterChartSeries[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface BoxplotInput extends ChartInputBase {
  type: 'boxplot';
  data: [number, number, number, number, number][];
  labels?: string[];
}

export interface HeatmapInput extends ChartInputBase {
  type: 'heatmap';
  xLabels: string[];
  yLabels: string[];
  data: [number, number, number][];
}

export interface RadarInput extends ChartInputBase {
  type: 'radar';
  indicators: { name: string; max: number }[];
  data: { name: string; value: number[] }[];
}

export interface CandlestickInput extends ChartInputBase {
  type: 'candlestick';
  data: [number, number, number, number][];
  dates?: string[];
}

export interface MapColorStop {
  offset: number;
  color: string;
}

export interface MapInput extends ChartInputBase {
  type: 'map';
  region: 'japan' | 'world';
  detail?: 'prefecture' | 'municipality';
  prefecture?: string;
  min?: number;
  max?: number;
  colorStops?: MapColorStop[];
  data: { name: string; value: number }[];
}

type ChartInputUnion =
  | BasicChartInput
  | ScatterChartInput
  | BoxplotInput
  | HeatmapInput
  | RadarInput
  | CandlestickInput
  | MapInput;

export type CreateChartInput = ChartInputUnion;

export type { BasicChartInput as CreateChartInputBasic };

export { isValidChartData } from './validation';
