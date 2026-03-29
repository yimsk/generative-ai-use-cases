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

import useScreenAudio from '../../src/hooks/useScreenAudio';

const createTranscriptStream = (events: unknown[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const event of events) {
      yield event;
    }
  },
});

const createTrack = (kind: string) => ({
  kind,
  stop: vi.fn(),
});

describe('useScreenAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clientInstances.length = 0;
    mocks.fetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => 'token-123' } },
    });
    mocks.sendImpl.mockResolvedValue({
      TranscriptResultStream: createTranscriptStream([]),
    });

    class MockMediaStream {
      tracks: Array<{ kind: string; stop: ReturnType<typeof vi.fn> }>;

      constructor(
        tracks: Array<{ kind: string; stop: ReturnType<typeof vi.fn> }> = []
      ) {
        this.tracks = tracks;
      }

      getTracks() {
        return this.tracks;
      }

      getAudioTracks() {
        return this.tracks.filter((track) => track.kind === 'audio');
      }

      getVideoTracks() {
        return this.tracks.filter((track) => track.kind === 'video');
      }
    }

    Object.defineProperty(globalThis, 'MediaStream', {
      value: MockMediaStream,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getDisplayMedia: vi
          .fn()
          .mockResolvedValue(
            new MockMediaStream([createTrack('audio'), createTrack('video')])
          ),
      },
      configurable: true,
    });
  });

  it('preserves screen transcript updates and fixed sample rate behavior', async () => {
    mocks.sendImpl.mockResolvedValue({
      TranscriptResultStream: createTranscriptStream([
        {
          TranscriptEvent: {
            Transcript: {
              Results: [
                {
                  ResultId: 'screen-1',
                  IsPartial: true,
                  LanguageCode: 'en-US',
                  Alternatives: [
                    {
                      Items: [{ Speaker: '1', Content: 'hello' }],
                    },
                  ],
                },
                {
                  ResultId: 'ignored-result',
                  IsPartial: false,
                  LanguageCode: 'en-US',
                  Alternatives: [
                    {
                      Items: [{ Speaker: '2', Content: 'ignored' }],
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
                  ResultId: 'screen-1',
                  IsPartial: false,
                  LanguageCode: 'en-US',
                  Alternatives: [
                    {
                      Items: [
                        { Speaker: '1', Content: 'hello' },
                        { Speaker: '1', Content: 'there' },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      ]),
    });

    const { result } = renderHook(() => useScreenAudio());

    await waitFor(() => {
      expect(result.current.isSupported).toBe(true);
      expect(mocks.clientInstances).toHaveLength(1);
    });

    await act(async () => {
      await result.current.startTranscription('en-US', true, ['en-US'], false);
    });

    const sentCommand = mocks.clientInstances[0].send.mock.calls[0][0];
    expect(sentCommand.input.MediaSampleRateHertz).toBe(48000);
    expect(sentCommand.input.LanguageCode).toBe('en-US');
    expect(sentCommand.input.ShowSpeakerLabel).toBe(true);
    expect(result.current.rawTranscripts).toEqual([
      {
        resultId: 'screen-1',
        startTime: 0,
        endTime: 0,
        isPartial: false,
        transcripts: [{ speakerLabel: 'spk_1', transcript: 'hello there' }],
        languageCode: 'en-US',
      },
    ]);
    expect(result.current.transcriptScreen).toEqual([
      {
        speakerLabel: 'spk_1',
        transcript: 'hello there',
      },
    ]);
    expect(result.current.recording).toBe(false);
    expect(mocks.clientInstances[0].destroy).toHaveBeenCalledTimes(1);
  });

  it('cleans up a prepared display stream when stopped', async () => {
    const { result } = renderHook(() => useScreenAudio());

    await waitFor(() => {
      expect(result.current.isSupported).toBe(true);
    });

    const preparedStream = await act(async () => {
      return await result.current.prepareScreenCapture();
    });

    act(() => {
      result.current.stopTranscription();
    });

    expect(
      preparedStream
        .getTracks()
        .every((track) => track.stop.mock.calls.length === 1)
    ).toBe(true);
  });

  it('maps browser capture errors and clearTranscripts resets the error', async () => {
    const deniedError = new Error('denied');
    deniedError.name = 'NotAllowedError';
    window.navigator.mediaDevices.getDisplayMedia.mockRejectedValueOnce(
      deniedError
    );

    const { result } = renderHook(() => useScreenAudio());

    await waitFor(() => {
      expect(result.current.isSupported).toBe(true);
      expect(mocks.clientInstances).toHaveLength(1);
    });

    await act(async () => {
      await result.current.startTranscription();
    });

    expect(result.current.error).toBe('Screen audio access was denied');

    act(() => {
      result.current.clearTranscripts();
    });

    expect(result.current.error).toBe('');
    expect(result.current.rawTranscripts).toEqual([]);
  });
});
