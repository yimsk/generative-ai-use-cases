import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutableRefObject } from 'react';
import type { RealtimeSegment } from '../../../src/components/MeetingMinutes/MeetingMinutesRealtimeTranslationOrchestrator';
import useMeetingMinutesTranslationQueue from '../../../src/components/MeetingMinutes/useMeetingMinutesTranslationQueue';

const makeSegment = (): RealtimeSegment => ({
  resultId: 'mic-1',
  source: 'microphone',
  startTime: 1,
  endTime: 2,
  isPartial: false,
  transcripts: [{ transcript: 'Hello everyone.' }],
  sessionId: 1,
  languageCode: 'en-US',
  translationSegments: [
    {
      text: 'Hello everyone.',
      needsTranslation: true,
    },
  ],
});

describe('useMeetingMinutesTranslationQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it('syncs the latest translation config after language, context, and type changes', async () => {
    const realtimeSegmentsRef = {
      current: [makeSegment()],
    } as MutableRefObject<RealtimeSegment[]>;

    const setRealtimeSegments = vi.fn(
      (
        updater:
          | RealtimeSegment[]
          | ((prev: RealtimeSegment[]) => RealtimeSegment[])
      ) => {
        realtimeSegmentsRef.current =
          typeof updater === 'function'
            ? updater(realtimeSegmentsRef.current)
            : updater;
      }
    );

    const translate = vi.fn().mockResolvedValue('translated-text');

    const { rerender } = renderHook(
      (props: {
        primaryLanguage: string;
        secondaryLanguage: string;
        translationType: string;
        userDefinedContext: string;
        systemGeneratedContext: string;
      }) =>
        useMeetingMinutesTranslationQueue({
          realtimeTranslationEnabled: true,
          selectedTranslationModel: 'model-a',
          translationInterval: 100,
          realtimeSegmentsRef,
          setRealtimeSegments,
          translate,
          primaryLanguage: props.primaryLanguage,
          secondaryLanguage: props.secondaryLanguage,
          translationType: props.translationType,
          userDefinedContext: props.userDefinedContext,
          systemGeneratedContext: props.systemGeneratedContext,
        }),
      {
        initialProps: {
          primaryLanguage: 'ja-JP',
          secondaryLanguage: 'en-US',
          translationType: 'unidirectional',
          userDefinedContext: 'old user context',
          systemGeneratedContext: 'old system context',
        },
      }
    );

    rerender({
      primaryLanguage: 'en-US',
      secondaryLanguage: 'ja-JP',
      translationType: 'bidirectional',
      userDefinedContext: 'updated user context',
      systemGeneratedContext: 'updated system context',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
    });

    expect(translate).toHaveBeenCalledTimes(1);

    expect(translate).toHaveBeenCalledWith(
      'Hello everyone.',
      'model-a',
      'Japanese',
      'User-defined context: updated user context\n\nSystem-generated context: updated system context\n\nRecent conversation context: Hello everyone.'
    );
  });
});
