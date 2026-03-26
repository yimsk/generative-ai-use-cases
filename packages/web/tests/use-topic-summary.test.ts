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
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('updates topic when LLM returns new topic', async () => {
    mockPredict.mockResolvedValue('<output>Budget Planning Discussion</output>');

    const { result } = renderHook(() => useTopicSummary(defaultOptions));

    await act(async () => {
      result.current.updateTopic('some text about budget');
    });

    await waitFor(() => {
      expect(result.current.topic).toBe('Budget Planning Discussion');
    });

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
  });

  test('debounces rapid calls', async () => {
    vi.useFakeTimers();

    mockPredict.mockResolvedValue('<output>New Topic</output>');

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
    expect(result.current.isUpdating).toBe(false);
  });
});
