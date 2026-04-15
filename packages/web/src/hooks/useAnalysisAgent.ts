import { useCallback, useEffect, useMemo } from 'react';
import useChat from './useChat';
import { isValidChartData } from '../components/Chart/validation';

// System prompt instructing the AI to produce analysis text + chart JSON blocks
const ANALYSIS_SYSTEM_PROMPT = `You are a data analysis expert. When the user provides data or asks analytical questions:

1. Provide clear, insightful analysis in plain text.
2. When a chart would help visualize the data, output chart data inside a JSON code block using this exact format:

\`\`\`json
{
  "type": "bar",
  "title": "Chart Title",
  "xAxisLabel": "X Axis Label",
  "yAxisLabel": "Y Axis Label",
  "data": [
    { "name": "Category A", "value": 100 },
    { "name": "Category B", "value": 200 }
  ]
}
\`\`\`

Supported chart types and their required fields:
- bar / line / area: type, data (or series for multi-series), optional xAxisLabel, yAxisLabel
- pie: type, data
- scatter: type, data with value as [x, y], optional xAxisLabel, yAxisLabel
- boxplot: type, data as [[min, q1, median, q3, max], ...], optional labels
- heatmap: type, xLabels, yLabels, data as [[xIndex, yIndex, value], ...]
- radar: type, indicators ([{name, max}]), data ([{name, value: [...]}])
- candlestick: type, data as [[open, close, low, high], ...], optional dates

For multi-series charts (bar/line/area), use this format:
\`\`\`json
{
  "type": "bar",
  "title": "Multi-series Example",
  "series": [
    { "name": "Series 1", "data": [{ "name": "A", "value": 10 }] },
    { "name": "Series 2", "data": [{ "name": "A", "value": 20 }] }
  ]
}
\`\`\`

You may include multiple chart blocks in a single response. Always explain what each chart shows.`;

export type ExtractedChart = {
  chartJson: string;
  messageIndex: number;
};

const useAnalysisAgent = (id: string) => {
  const {
    loading,
    getModelId,
    setModelId,
    clear,
    messages,
    isEmpty,
    postChat,
    updateSystemContext,
    setLoading,
  } = useChat(id);

  // Set the analysis system prompt once on mount
  useEffect(() => {
    updateSystemContext(ANALYSIS_SYSTEM_PROMPT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = useCallback(
    async (content: string) => {
      await postChat(content, false);
    },
    [postChat]
  );

  // Extract valid chart JSONs from all assistant messages, latest first
  const extractedCharts = useMemo((): ExtractedChart[] => {
    const charts: ExtractedChart[] = [];
    messages.forEach((msg, idx) => {
      if (msg.role !== 'assistant') return;
      const matches = [...msg.content.matchAll(/```json\s*([\s\S]*?)```/g)];
      for (const match of matches) {
        const jsonStr = match[1].trim();
        try {
          const parsed: unknown = JSON.parse(jsonStr);
          if (isValidChartData(parsed)) {
            charts.push({ chartJson: jsonStr, messageIndex: idx });
          }
        } catch {
          // skip invalid JSON
        }
      }
    });
    return charts.reverse();
  }, [messages]);

  return {
    loading,
    getModelId,
    setModelId,
    clear,
    messages,
    isEmpty,
    post,
    extractedCharts,
    setLoading,
  };
};

export default useAnalysisAgent;
