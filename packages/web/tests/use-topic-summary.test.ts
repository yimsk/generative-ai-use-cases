import { describe, expect, test, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockPredict = vi.fn();

vi.mock('../src/hooks/useChatApi', () => ({
  __esModule: true,
  default: () => ({
    predict: mockPredict,
  }),
}));

vi.mock('../src/prompts', () => ({
  getPrompter: () => ({
    systemContext: () => 'system prompt',
    topicSummaryPrompt: () => 'user prompt',
  }),
}));

vi.mock('../src/hooks/useModel', () => ({
  findModelByModelId: (modelId: string) => ({
    modelId,
    type: 'bedrock',
  }),
}));

import useTopicSummary from '../src/hooks/useTopicSummary';

const budgetTopicJa = String.fromCodePoint(
  0x4e88,
  0x7b97,
  0x8a08,
  0x753b,
  0x4f1a,
  0x8b70
);
const newTopicJa = String.fromCodePoint(0x65b0, 0x3057, 0x3044, 0x8a71, 0x984c);
const hiringTopicJa = String.fromCodePoint(0x63a1, 0x7528, 0x9762, 0x63a5);

describe('useTopicSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultOptions = {
    modelId: 'anthropic.claude-3-haiku',
    targetLanguage: 'ja',
    debounceMs: 10000,
  };

  test('returns initial empty topic', () => {
    const { result } = renderHook(() => useTopicSummary(defaultOptions));

    expect(result.current.topic).toBe('');
    expect(result.current.topicJa).toBe('');
    expect(result.current.topicEn).toBe('');
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('updates bilingual topics when LLM returns new topic', async () => {
    mockPredict.mockResolvedValue(
      `<output><ja>${budgetTopicJa}</ja><en>Budget Planning Discussion</en></output>`
    );

    const { result } = renderHook(() => useTopicSummary(defaultOptions));

    await act(async () => {
      result.current.updateTopic('some text about budget');
    });

    await waitFor(() => {
      expect(result.current.topicJa).toBe(budgetTopicJa);
    });

    expect(result.current.topic).toBe(budgetTopicJa);
    expect(result.current.topicEn).toBe('Budget Planning Discussion');
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('keeps current topic when "SAME" returned', async () => {
    mockPredict.mockResolvedValue('<output>SAME</output>');

    const { result } = renderHook(() => useTopicSummary(defaultOptions));

    await act(async () => {
      result.current.updateTopic('budget details continue');
    });

    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false);
    });

    expect(result.current.topic).toBe('');
    expect(result.current.topicJa).toBe('');
    expect(result.current.topicEn).toBe('');
  });

  test('debounces rapid calls', async () => {
    vi.useFakeTimers();

    mockPredict.mockResolvedValue(
      `<output><ja>${newTopicJa}</ja><en>New Topic</en></output>`
    );

    const { result } = renderHook(() => useTopicSummary(defaultOptions));

    await act(async () => {
      result.current.updateTopic('first segment');
    });

    await act(async () => {
      result.current.updateTopic('second segment');
    });

    expect(mockPredict).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(10001);
    });

    await act(async () => {
      result.current.updateTopic('third segment after debounce');
    });

    expect(mockPredict).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  test('handles API errors gracefully', async () => {
    mockPredict.mockRejectedValue(new Error('API failure'));

    const { result } = renderHook(() => useTopicSummary(defaultOptions));

    await act(async () => {
      result.current.updateTopic('text');
    });

    await waitFor(() => {
      expect(result.current.error).toBe('API failure');
    });

    expect(result.current.topic).toBe('');
    expect(result.current.topicJa).toBe('');
    expect(result.current.topicEn).toBe('');
    expect(result.current.isUpdating).toBe(false);
  });

  test('returns english topic when target language is english', async () => {
    mockPredict.mockResolvedValue(
      `<output><ja>${hiringTopicJa}</ja><en>Hiring Interview</en></output>`
    );

    const { result } = renderHook(() =>
      useTopicSummary({
        ...defaultOptions,
        targetLanguage: 'English',
      })
    );

    await act(async () => {
      result.current.updateTopic('candidate feedback');
    });

    await waitFor(() => {
      expect(result.current.topicEn).toBe('Hiring Interview');
    });

    expect(result.current.topic).toBe('Hiring Interview');
    expect(result.current.topicJa).toBe(hiringTopicJa);
  });
});
