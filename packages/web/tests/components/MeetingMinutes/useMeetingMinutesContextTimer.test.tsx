import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMeetingMinutesContextTimer } from '../../../src/components/MeetingMinutes/useMeetingMinutesContextTimer';
import type { RealtimeSegment } from '../../../src/components/MeetingMinutes/MeetingMinutesRealtimeTranslationOrchestrator';

vi.mock(
  '../../../src/components/MeetingMinutes/MeetingMinutesContextGenerator',
  () => ({
    generateSystemContext: vi.fn(),
    shouldGenerateContext: vi.fn(),
  })
);

import {
  generateSystemContext,
  shouldGenerateContext,
} from '../../../src/components/MeetingMinutes/MeetingMinutesContextGenerator';

const mockShouldGenerateContext = vi.mocked(shouldGenerateContext);
const mockGenerateSystemContext = vi.mocked(generateSystemContext);
type UseMeetingMinutesContextTimerProps = Parameters<
  typeof useMeetingMinutesContextTimer
>[0];

describe('useMeetingMinutesContextTimer', () => {
  const mockPredict = vi.fn() as UseMeetingMinutesContextTimerProps['predict'];
  const mockOnGeneratedContext = vi.fn();
  const defaultRealtimeSegments = [
    {
      resultId: '1',
      source: 'microphone',
      startTime: 0,
      endTime: 1,
      isPartial: false,
      transcripts: [{ transcript: 'Test segment' }],
      sessionId: 1,
      translationSegments: [],
    },
  ] as unknown as RealtimeSegment[];

  const defaultProps = {
    realtimeTranslationEnabled: true,
    isRecording: true,
    realtimeSegments: defaultRealtimeSegments,
    targetLanguage: 'en',
    predict: mockPredict,
    onGeneratedContext: mockOnGeneratedContext,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockShouldGenerateContext.mockReturnValue(true);
    mockGenerateSystemContext.mockResolvedValue('Generated context');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not start timer when realtimeTranslationEnabled is false', () => {
    renderHook(() =>
      useMeetingMinutesContextTimer({
        ...defaultProps,
        realtimeTranslationEnabled: false,
      })
    );

    vi.advanceTimersByTime(60000);
    expect(mockShouldGenerateContext).not.toHaveBeenCalled();
  });

  it('should not start timer when isRecording is false', () => {
    renderHook(() =>
      useMeetingMinutesContextTimer({
        ...defaultProps,
        isRecording: false,
      })
    );

    vi.advanceTimersByTime(60000);
    expect(mockShouldGenerateContext).not.toHaveBeenCalled();
  });

  it('should call generateContext after 30 second timeout', async () => {
    renderHook(() => useMeetingMinutesContextTimer(defaultProps));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockShouldGenerateContext).toHaveBeenCalled();
  });

  it('should call generateContext every 60 seconds on interval', async () => {
    renderHook(() => useMeetingMinutesContextTimer(defaultProps));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockShouldGenerateContext).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockShouldGenerateContext).toHaveBeenCalledTimes(2);
  });

  it('should generate context when conditions are met', async () => {
    mockShouldGenerateContext.mockReturnValue(true);
    mockGenerateSystemContext.mockResolvedValue('Test context');

    renderHook(() => useMeetingMinutesContextTimer(defaultProps));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockGenerateSystemContext).toHaveBeenCalledWith(
      defaultProps.realtimeSegments,
      defaultProps.targetLanguage,
      defaultProps.predict
    );

    expect(mockOnGeneratedContext).toHaveBeenCalledWith('Test context');
  });

  it('should not generate context when shouldGenerateContext returns false', async () => {
    mockShouldGenerateContext.mockReturnValue(false);

    renderHook(() => useMeetingMinutesContextTimer(defaultProps));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockShouldGenerateContext).toHaveBeenCalled();

    expect(mockGenerateSystemContext).not.toHaveBeenCalled();
    expect(mockOnGeneratedContext).not.toHaveBeenCalled();
  });

  it('should not call onGeneratedContext when result is null', async () => {
    mockShouldGenerateContext.mockReturnValue(true);
    mockGenerateSystemContext.mockResolvedValue(null);

    renderHook(() => useMeetingMinutesContextTimer(defaultProps));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockGenerateSystemContext).toHaveBeenCalled();

    expect(mockOnGeneratedContext).not.toHaveBeenCalled();
  });

  it('should clean up timers on unmount', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    const { unmount } = renderHook(() =>
      useMeetingMinutesContextTimer(defaultProps)
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('should restart timer when isRecording changes from false to true', () => {
    const { rerender } = renderHook(
      (props) => useMeetingMinutesContextTimer(props),
      {
        initialProps: {
          ...defaultProps,
          isRecording: false,
        },
      }
    );

    vi.advanceTimersByTime(60000);
    expect(mockShouldGenerateContext).not.toHaveBeenCalled();

    rerender({
      ...defaultProps,
      isRecording: true,
    });

    vi.advanceTimersByTime(30000);
    expect(mockShouldGenerateContext).toHaveBeenCalled();
  });

  it('should handle empty segments array', async () => {
    mockShouldGenerateContext.mockReturnValue(true);

    renderHook(() =>
      useMeetingMinutesContextTimer({
        ...defaultProps,
        realtimeSegments: [],
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockShouldGenerateContext).toHaveBeenCalledWith(true, true, []);
  });

  it('should handle edge case with undefined segments gracefully', async () => {
    mockShouldGenerateContext.mockReturnValue(false);

    renderHook(() =>
      useMeetingMinutesContextTimer({
        ...defaultProps,
        realtimeSegments: undefined as unknown as RealtimeSegment[],
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockShouldGenerateContext).toHaveBeenCalled();

    expect(mockGenerateSystemContext).not.toHaveBeenCalled();
  });
});
