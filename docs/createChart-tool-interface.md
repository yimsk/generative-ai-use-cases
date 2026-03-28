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
| labels     | array  | No          | Category labels (boxplot)                                                            |
| xLabels    | array  | Yes\*       | X categories (heatmap)                                                               |
| yLabels    | array  | Yes\*       | Y categories (heatmap)                                                               |
| indicators | array  | Yes\*       | Radar indicators [{name, max}]                                                       |
| dates      | array  | No          | Date labels (candlestick)                                                            |
| region     | string | Yes\*       | Map region: "japan" or "world"                                                       |
| detail     | string | No          | Map detail: "prefecture" or "municipality"                                           |
| prefecture | string | Conditional | Required when detail="municipality"                                                  |

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
- Geographic data is loaded dynamically from GeoJSON files for optimal performance.
