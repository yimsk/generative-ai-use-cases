# `createChart` Tool Interface

## Overview

`createChart` is a tool interface for AgentCore Agents that need to trigger chart rendering in the frontend.

The tool returns structured JSON input that the frontend renders client-side with Apache ECharts.

When the tool call succeeds, the tool response is always:

```json
{ "status": "ok" }
```

## Supported Chart Types

- Basic: `bar`, `line`, `pie`, `area`, `scatter`
- Statistical: `boxplot`, `heatmap`, `radar`, `candlestick`
- Geographic: `map`

## Tool Definition

Tool name: `createChart`

### Basic Charts (bar, line, pie, area, scatter)

```json
{
  "type": "bar",
  "title": "Monthly Sales",
  "data": [{ "name": "Jan", "value": 120 }],
  "xAxisLabel": "Month",
  "yAxisLabel": "Sales"
}
```

Or with multiple series:

```json
{
  "type": "line",
  "title": "Revenue vs Cost",
  "series": [
    { "name": "Revenue", "data": [{ "name": "Q1", "value": 420 }] },
    { "name": "Cost", "data": [{ "name": "Q1", "value": 300 }] }
  ]
}
```

For scatter charts, `value` may be either a single numeric value or an `[x, y]` tuple.

```json
{
  "type": "scatter",
  "title": "Experiment Results",
  "data": [
    { "name": "Sample A", "value": [10, 20] },
    { "name": "Sample B", "value": 15 }
  ],
  "xAxisLabel": "Input",
  "yAxisLabel": "Output"
}
```

Scatter charts keep the plotted view clean and do not show point labels by default. Tooltips handle point detail instead:

- Point names are shown by default when available.
- Tuple data shows the point name plus labeled `xAxisLabel` and `yAxisLabel` values.
- Scalar data keeps a simpler tooltip with the point name and y-axis value.

There is no scatter tooltip or label customization API. Use the current input shape only.

### Boxplot (箱ひげ図)

```json
{
  "type": "boxplot",
  "title": "Income Distribution",
  "data": [[100, 300, 500, 700, 900]],
  "labels": ["Tokyo", "Osaka"]
}
```

Data format: `[min, Q1, median, Q3, max]` for each box.

### Heatmap (ヒートマップ)

```json
{
  "type": "heatmap",
  "title": "Correlation Matrix",
  "xLabels": ["A", "B", "C"],
  "yLabels": ["X", "Y", "Z"],
  "data": [
    [0, 0, 0.5],
    [0, 1, 0.8],
    [1, 0, 0.3]
  ]
}
```

Data format: `[xIndex, yIndex, value]` tuples.
`xIndex` and `yIndex` must be finite integers within the bounds of `xLabels` and `yLabels`.

### Radar (レーダーチャート)

```json
{
  "type": "radar",
  "title": "City Metrics",
  "indicators": [
    { "name": "Population", "max": 15000000 },
    { "name": "GDP", "max": 1000000 }
  ],
  "data": [{ "name": "Tokyo", "value": [14000000, 950000] }]
}
```

### Candlestick (ローソク足)

```json
{
  "type": "candlestick",
  "title": "Stock Price",
  "dates": ["2024-01-01", "2024-01-02"],
  "data": [
    [100, 120, 90, 130],
    [120, 110, 105, 125]
  ]
}
```

Data format: `[open, close, lowest, highest]` for each candle.

### Map (地図)

```json
{
  "type": "map",
  "title": "Population by Prefecture",
  "region": "japan",
  "detail": "prefecture",
  "data": [
    { "name": "東京都", "value": 13960000 },
    { "name": "大阪府", "value": 8837000 }
  ]
}
```

Optional color scale customization:

```json
{
  "type": "map",
  "title": "Population Change Rate by Prefecture",
  "region": "japan",
  "detail": "prefecture",
  "min": -16,
  "max": 0,
  "colorStops": [
    { "offset": 0, "color": "#8B0000" },
    { "offset": 0.3, "color": "#DC143C" },
    { "offset": 0.5, "color": "#FF6347" },
    { "offset": 0.7, "color": "#FFA07A" },
    { "offset": 1, "color": "#FFE4B5" }
  ],
  "data": [
    { "name": "秋田県", "value": -15.3 },
    { "name": "東京都", "value": -3.8 }
  ]
}
```

For municipality detail:

```json
{
  "type": "map",
  "region": "japan",
  "detail": "municipality",
  "prefecture": "13-tokyo",
  "data": [{ "name": "新宿区", "value": 350000 }]
}
```

Prefecture codes: 01-hokkaido, 13-tokyo, 27-osaka, etc.

## Field Reference

| Field      | Type   | Required    | Description                                                                          |
| ---------- | ------ | ----------- | ------------------------------------------------------------------------------------ |
| type       | string | Yes         | Chart type: bar, line, pie, area, scatter, boxplot, heatmap, radar, candlestick, map |
| title      | string | No          | Chart title                                                                          |
| data       | array  | Conditional | Single series data (basic charts, map)                                               |
| series     | array  | Conditional | Multi-series data (basic charts)                                                     |
| xAxisLabel | string | No          | X-axis label (basic charts)                                                          |
| yAxisLabel | string | No          | Y-axis label (basic charts)                                                          |
| labels     | array  | No          | Category labels (boxplot, string array)                                              |
| xLabels    | array  | Yes\*       | X categories (heatmap, string array)                                                 |
| yLabels    | array  | Yes\*       | Y categories (heatmap, string array)                                                 |
| indicators | array  | Yes\*       | Radar indicators [{name, max}]                                                       |
| dates      | array  | No          | Date labels (candlestick, string array)                                              |
| region     | string | Yes\*       | Map region: "japan" or "world"                                                       |
| detail     | string | No          | Map detail: "prefecture" or "municipality"                                           |
| prefecture | string | Conditional | Required when detail="municipality"                                                  |
| min        | number | No          | Map visual scale minimum. Defaults to the minimum value in `data`.                   |
| max        | number | No          | Map visual scale maximum. Defaults to the maximum value in `data`.                   |
| colorStops | array  | No          | Map gradient stops as `[{ offset, color }]`, where `offset` is between 0 and 1.      |

\*Required for specific chart types

## Output

The tool response is always:

```json
{ "status": "ok" }
```

The chart itself is rendered by the frontend from the tool input payload.

## Implementation Notes

- The tool does not produce images. It sends structured JSON only.
- The frontend detects tool use events where `name="createChart"` and renders the payload with ECharts.
- Supported chart types include basic charts, statistical visualizations, and geographic maps.
- Invalid or malformed chart data shows an error message in the UI instead of crashing.
- For `bar`, `line`, and `area`, multi-series data is aligned by category name; missing categories render as gaps.
- For `pie` and `scatter`, multi-series inputs may have unequal lengths.
- Scatter point `name` metadata is preserved in the rendered payload and surfaced in default tooltips.
- Geographic data is loaded dynamically from GeoJSON files for optimal performance.
- Map charts support optional custom color scales via `min`, `max`, and `colorStops`.
