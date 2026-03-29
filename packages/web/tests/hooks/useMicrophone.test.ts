import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class MockMicrophoneStream {
    static toRaw = vi.fn(() => new Float32Array([0.25, -0.25]));

    stopped = false;
    stream: MediaStream | undefined;

    setStream(stream: MediaStream) {
      this.stream = stream;
    }

    stop() {
      this.stopped = true;
    }

    async *[Symbol.asyncIterator]() {
      yield Buffer.from([1, 2, 3, 4]);
    }
  }

  class MockStartStreamTranscriptionCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class MockTranscribeStreamingClient {
    destroy = vi.fn();
    send = vi.fn((command: MockStartStreamTranscriptionCommand) =>
      state.sendImpl(command)
    );
  }

  const state = {
    MockMicrophoneStream,
    MockStartStreamTranscriptionCommand,
    MockTranscribeStreamingClient,
    sendImpl: vi.fn(),
    fetchAuthSession: vi.fn(),
    fromCognitoIdentityPool: vi.fn(() => ({ mocked: true })),
    clientInstances: [] as MockTranscribeStreamingClient[],
    audioContextInstances: [] as { close: ReturnType<typeof vi.fn> }[],
  };

  return state;
});

vi.mock('microphone-stream', () => ({
  default: mocks.MockMicrophoneStream,
}));

vi.mock('@aws-sdk/client-transcribe-streaming', () => ({
  StartStreamTranscriptionCommand: mocks.MockStartStreamTranscriptionCommand,
  TranscribeStreamingClient: vi.fn(() => {
    const client = new mocks.MockTranscribeStreamingClient();
    mocks.clientInstances.push(client);
    return client;
  }),
}));

vi.mock('@aws-sdk/credential-provider-cognito-identity', () => ({
  fromCognitoIdentityPool: mocks.fromCognitoIdentityPool,
}));

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: mocks.fetchAuthSession,
}));

import useMicrophone from '../../src/hooks/useMicrophone';

const createTranscriptStream = (events: unknown[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const event of events) {
      yield event;
    }
  },
});

describe('useMicrophone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clientInstances.length = 0;
    mocks.audioContextInstances.length = 0;
    mocks.fetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => 'token-123' } },
    });
    mocks.sendImpl.mockResolvedValue({
      TranscriptResultStream: createTranscriptStream([]),
    });

    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'isSecureContext', {
      value: true,
      configurable: true,
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ id: 'user-media-stream' }),
      },
      configurable: true,
    });

    class MockAudioContext {
      sampleRate = 44100;
      close = vi.fn().mockResolvedValue(undefined);

      constructor() {
        mocks.audioContextInstances.push(this);
      }
    }

    Object.defineProperty(window, 'AudioContext', {
      value: MockAudioContext,
      configurable: true,
      writable: true,
    });
  });

  it('preserves transcript normalization and detected sample rate behavior', async () => {
    mocks.sendImpl.mockResolvedValue({
      TranscriptResultStream: createTranscriptStream([
        {
          TranscriptEvent: {
            Transcript: {
              Results: [
                {
                  ResultId: 'result-1',
                  IsPartial: true,
                  LanguageCode: 'ja-JP',
                  Alternatives: [
                    {
                      Items: [
                        { Speaker: '0', Content: 'こんにちは' },
                        { Speaker: '0', Content: '世界' },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        {
          TranscriptEvent: {
            Transcript: {
              Results: [
                {
                  ResultId: 'result-1',
                  IsPartial: false,
                  LanguageCode: 'ja-JP',
                  Alternatives: [
                    {
                      Items: [
                        { Speaker: '0', Content: 'こんにちは' },
                        { Speaker: '0', Content: '世界' },
                      ],
                    },
                  ],
                },
                {
                  ResultId: 'result-2',
                  IsPartial: false,
                  LanguageCode: 'ja-JP',
                  Alternatives: [
                    {
                      Items: [{ Speaker: '0', Content: 'です' }],
                    },
                  ],
                },
              ],
            },
          },
        },
      ]),
    });

    const { result } = renderHook(() => useMicrophone());

    await waitFor(() => {
      expect(result.current.clientReady).toBe(true);
    });

    await act(async () => {
      await result.current.startTranscription('ja-JP', true, ['ja-JP'], false);
    });

    expect(mocks.clientInstances).toHaveLength(1);
    expect(mocks.clientInstances[0].send).toHaveBeenCalledTimes(1);
    const sentCommand = mocks.clientInstances[0].send.mock.calls[0][0];
    expect(sentCommand.input.MediaSampleRateHertz).toBe(44100);
    expect(sentCommand.input.LanguageCode).toBe('ja-JP');
    expect(sentCommand.input.ShowSpeakerLabel).toBe(true);

    expect(result.current.rawTranscripts).toEqual([
      {
        resultId: 'result-1',
        startTime: 0,
        endTime: 0,
        isPartial: false,
        transcripts: [{ speakerLabel: 'spk_0', transcript: 'こんにちは 世界' }],
        languageCode: 'ja-JP',
      },
      {
        resultId: 'result-2',
        startTime: 0,
        endTime: 0,
        isPartial: false,
        transcripts: [{ speakerLabel: 'spk_0', transcript: 'です' }],
        languageCode: 'ja-JP',
      },
    ]);
    expect(result.current.transcriptMic).toEqual([
      {
        speakerLabel: 'spk_0',
        transcript: 'こんにちは世界です',
      },
    ]);
    expect(result.current.recording).toBe(false);
  });

  it('surfaces microphone availability errors without opening media devices', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'isSecureContext', {
      value: false,
      configurable: true,
    });

    const { result } = renderHook(() => useMicrophone());

    await waitFor(() => {
      expect(result.current.clientReady).toBe(true);
    });

    await act(async () => {
      await result.current.startTranscription();
    });

    await waitFor(() => {
      expect(result.current.error?.message).toBe(
        'Microphone access requires HTTPS or localhost. Open the app from a secure origin and try again.'
      );
    });
    expect(window.navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('destroys the transcribe client on unmount', async () => {
    const { result, unmount } = renderHook(() => useMicrophone());

    await waitFor(() => {
      expect(result.current.clientReady).toBe(true);
    });

    const client = mocks.clientInstances[0];
    unmount();

    expect(client.destroy).toHaveBeenCalledTimes(1);
  });
});
