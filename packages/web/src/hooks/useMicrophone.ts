import {
  LanguageCode,
  TranscribeStreamingClient,
} from '@aws-sdk/client-transcribe-streaming';
import { Buffer } from 'buffer';
import MicrophoneStream from 'microphone-stream';
import { useState, useEffect, useMemo } from 'react';
import {
  buildStartStreamCommand,
  buildTranscriptView,
  createTranscribeClient,
  normalizeTranscriptResult,
  RawTranscript,
  upsertTranscriptById,
} from './useAudioTranscription';

const MICROPHONE_DEBUG_PREFIX = '[useMicrophone]';
const MICROPHONE_CHUNK_LOG_INTERVAL = 250;
const MICROPHONE_EMPTY_EVENT_LOG_INTERVAL = 25;

type MicrophoneStreamWithEvents = MicrophoneStream & {
  on: (
    event: 'error' | 'format' | 'data',
    handler: (payload: unknown) => void
  ) => void;
};

const logMicrophoneDebug = (
  message: string,
  data?: Record<string, unknown>
) => {
  if (data) {
    console.log(`${MICROPHONE_DEBUG_PREFIX} ${message}`, data);
    return;
  }

  console.log(`${MICROPHONE_DEBUG_PREFIX} ${message}`);
};

const getDebugTracks = (stream: MediaStream): MediaStreamTrack[] => {
  return typeof stream.getTracks === 'function' ? stream.getTracks() : [];
};

const bindMediaStreamDebugEvents = (
  stream: MediaStream,
  source: string
): (() => void) => {
  const canListenToStream =
    typeof stream.addEventListener === 'function' &&
    typeof stream.removeEventListener === 'function';

  const onActive = () => {
    const tracks = getDebugTracks(stream);
    logMicrophoneDebug(`${source} stream addtrack`, {
      active: stream.active,
      trackCount: tracks.length,
    });
  };
  const onInactive = () => {
    const tracks = getDebugTracks(stream);
    logMicrophoneDebug(`${source} stream became inactive`, {
      active: stream.active,
      trackStates: tracks.map((track) => ({
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      })),
    });
  };

  if (canListenToStream) {
    stream.addEventListener('addtrack', onActive);
    stream.addEventListener('removetrack', onActive);
    stream.addEventListener('inactive', onInactive);
  }

  const cleanups = getDebugTracks(stream).map((track, index) => {
    const onEnded = () => {
      logMicrophoneDebug(`${source} track ended`, {
        index,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
    };
    const onMute = () => {
      logMicrophoneDebug(`${source} track mute`, {
        index,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
    };
    const onUnmute = () => {
      logMicrophoneDebug(`${source} track unmute`, {
        index,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
    };

    const canListenToTrack =
      typeof track.addEventListener === 'function' &&
      typeof track.removeEventListener === 'function';

    if (!canListenToTrack) {
      return () => undefined;
    }

    track.addEventListener('ended', onEnded);
    track.addEventListener('mute', onMute);
    track.addEventListener('unmute', onUnmute);

    return () => {
      track.removeEventListener('ended', onEnded);
      track.removeEventListener('mute', onMute);
      track.removeEventListener('unmute', onUnmute);
    };
  });

  return () => {
    if (canListenToStream) {
      stream.removeEventListener('addtrack', onActive);
      stream.removeEventListener('removetrack', onActive);
      stream.removeEventListener('inactive', onInactive);
    }
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
};

const getMicrophoneAvailabilityError = (): Error | null => {
  if (typeof window === 'undefined') {
    return new Error('Microphone is only available in the browser.');
  }

  if (!window.isSecureContext) {
    return new Error(
      'Microphone access requires HTTPS or localhost. Open the app from a secure origin and try again.'
    );
  }

  if (!window.navigator.mediaDevices?.getUserMedia) {
    return new Error(
      'This browser does not provide microphone access through mediaDevices.getUserMedia.'
    );
  }

  return null;
};

const useMicrophone = () => {
  const [micStream, setMicStream] = useState<MicrophoneStream | undefined>();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [rawTranscripts, setRawTranscripts] = useState<RawTranscript[]>([]);
  const [language, setLanguage] = useState<string>('ja-JP');
  const [transcribeClient, setTranscribeClient] =
    useState<TranscribeStreamingClient>();

  const transcriptMic = useMemo(() => {
    return buildTranscriptView(rawTranscripts, language);
  }, [rawTranscripts, language]);

  useEffect(() => {
    if (transcribeClient) return;

    let cancelled = false;
    let client: TranscribeStreamingClient | undefined;
    let handedOff = false;

    const setupClient = async () => {
      try {
        logMicrophoneDebug('Initializing transcribe client');
        client = await createTranscribeClient();
        if (!client) {
          logMicrophoneDebug(
            'Transcribe client initialization returned empty client'
          );
          return;
        }

        if (cancelled) {
          client.destroy();
          return;
        }

        handedOff = true;
        setTranscribeClient(client);
        setError(null);
        logMicrophoneDebug('Transcribe client ready');
      } catch (clientError) {
        if (!cancelled) {
          logMicrophoneDebug('Transcribe client initialization failed', {
            error:
              clientError instanceof Error
                ? {
                    name: clientError.name,
                    message: clientError.message,
                  }
                : clientError,
          });
          setError(
            clientError instanceof Error
              ? clientError
              : new Error('Failed to initialize microphone client')
          );
        }
      }
    };

    void setupClient();

    return () => {
      cancelled = true;
      if (!handedOff) {
        client?.destroy();
      }
    };
  }, [transcribeClient]);

  useEffect(() => {
    return () => {
      transcribeClient?.destroy();
    };
  }, [transcribeClient]);

  const startStream = async (
    mic: MicrophoneStream,
    languageCode?: LanguageCode,
    speakerLabel: boolean = false,
    languageOptions?: string[],
    enableMultiLanguage: boolean = false,
    mediaSampleRateHertz: number = 48000
  ) => {
    let emptyTranscriptEventCount = 0;

    if (!transcribeClient) {
      logMicrophoneDebug(
        'startStream skipped because transcribe client is unavailable'
      );
      return;
    }

    // Update Language
    if (languageCode) {
      setLanguage(languageCode);
    }

    const command = buildStartStreamCommand({
      stream: mic as unknown as AsyncIterable<Buffer>,
      languageCode,
      speakerLabel,
      languageOptions,
      enableMultiLanguage,
      mediaSampleRateHertz,
    });

    try {
      logMicrophoneDebug('Sending transcribe streaming command', {
        languageCode,
        speakerLabel,
        languageOptions,
        enableMultiLanguage,
        mediaSampleRateHertz,
      });
      const response = await transcribeClient.send(command);
      logMicrophoneDebug('Transcribe streaming command accepted', {
        hasTranscriptStream: !!response.TranscriptResultStream,
      });

      if (response.TranscriptResultStream) {
        for await (const event of response.TranscriptResultStream) {
          const results = event.TranscriptEvent?.Transcript?.Results ?? [];

          if (results.length === 0) {
            emptyTranscriptEventCount += 1;

            if (
              emptyTranscriptEventCount <= 3 ||
              emptyTranscriptEventCount %
                MICROPHONE_EMPTY_EVENT_LOG_INTERVAL ===
                0
            ) {
              logMicrophoneDebug('Received empty transcript event summary', {
                emptyTranscriptEventCount,
              });
            }

            continue;
          }

          logMicrophoneDebug('Received transcript event', {
            resultCount: results.length,
          });
          for (const result of results) {
            if (!result) {
              continue;
            }

            // Update Language
            if (result.LanguageCode) {
              setLanguage(result.LanguageCode);
            }

            const normalizedResult = normalizeTranscriptResult(
              result,
              `mic-${Date.now()}-${Math.random()}`
            );

            setRawTranscripts((prev) => {
              return upsertTranscriptById(prev, normalizedResult);
            });
          }
        }
      }
    } catch (error) {
      logMicrophoneDebug('Transcribe streaming failed', {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
      });
      setError(
        error instanceof Error ? error : new Error('Speech recognition failed')
      );
      console.error(error);
      stopTranscription();
    } finally {
      logMicrophoneDebug(
        'Transcribe streaming finished, stopping transcription'
      );
      stopTranscription();
    }
  };

  const startTranscription = async (
    languageCode?: LanguageCode,
    speakerLabel?: boolean,
    languageOptions?: string[],
    enableMultiLanguage?: boolean
  ) => {
    const availabilityError = getMicrophoneAvailabilityError();
    if (availabilityError) {
      setError(availabilityError);
      return;
    }

    if (!transcribeClient) {
      setError(new Error('Microphone is still preparing. Please try again.'));
      return;
    }

    const mic = new MicrophoneStream();
    const debugMic = mic as MicrophoneStreamWithEvents;
    let audioContext: AudioContext | undefined;
    let cleanupStreamDebug: (() => void) | undefined;
    let chunkCount = 0;
    let totalBytes = 0;
    try {
      setError(null);
      setMicStream(mic);
      if (typeof debugMic.on === 'function') {
        debugMic.on('error', (error) => {
          logMicrophoneDebug('MicrophoneStream emitted error', {
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : error,
          });
        });
        debugMic.on('format', (format) => {
          logMicrophoneDebug('MicrophoneStream format received', {
            format,
          });
        });
        debugMic.on('data', (chunk) => {
          const byteLength =
            chunk instanceof Buffer
              ? chunk.length
              : chunk instanceof ArrayBuffer
                ? chunk.byteLength
                : typeof chunk === 'object' &&
                    chunk !== null &&
                    'length' in chunk &&
                    typeof chunk.length === 'number'
                  ? chunk.length
                  : undefined;

          if (typeof byteLength === 'number') {
            chunkCount += 1;
            totalBytes += byteLength;

            if (chunkCount % MICROPHONE_CHUNK_LOG_INTERVAL === 0) {
              logMicrophoneDebug('MicrophoneStream data summary', {
                chunkCount,
                totalBytes,
                averageBytesPerChunk: Math.round(totalBytes / chunkCount),
                lastChunkByteLength: byteLength,
              });
            }
          }
        });
      }
      logMicrophoneDebug('Requesting getUserMedia', {
        constraints: { video: false, audio: true },
      });
      const stream = await window.navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      cleanupStreamDebug = bindMediaStreamDebugEvents(stream, 'microphone');
      const tracks = getDebugTracks(stream);
      logMicrophoneDebug('getUserMedia resolved', {
        active: stream.active,
        trackCount: tracks.length,
        tracks: tracks.map((track) => ({
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      });
      mic.setStream(stream);
      logMicrophoneDebug('MicrophoneStream received MediaStream');

      audioContext = new window.AudioContext();
      logMicrophoneDebug('AudioContext created', {
        state: audioContext.state,
        sampleRate: audioContext.sampleRate,
      });
      const detectedSampleRate = Math.round(audioContext.sampleRate || 48000);

      setRecording(true);
      logMicrophoneDebug('Recording state set to true', {
        detectedSampleRate,
      });
      await startStream(
        mic,
        languageCode,
        speakerLabel,
        languageOptions,
        enableMultiLanguage,
        detectedSampleRate
      );
    } catch (e) {
      logMicrophoneDebug('Failed to start microphone transcription', {
        error: e instanceof Error ? { name: e.name, message: e.message } : e,
      });
      setError(
        e instanceof Error ? e : new Error('Failed to start microphone input')
      );
    } finally {
      cleanupStreamDebug?.();
      await audioContext?.close().catch(() => undefined);
      logMicrophoneDebug('AudioContext closed');
      mic.stop();
      logMicrophoneDebug(
        'MicrophoneStream stopped in startTranscription finally'
      );
      setRecording(false);
      setMicStream(undefined);
      logMicrophoneDebug('Recording state reset to false');
    }
  };

  const stopTranscription = () => {
    logMicrophoneDebug('stopTranscription called', {
      hasMicStream: !!micStream,
    });
    if (micStream) {
      micStream.stop();
      setRecording(false);
      setMicStream(undefined);
      logMicrophoneDebug('Mic stream stopped by stopTranscription');
    }
  };

  const clearTranscripts = () => {
    setRawTranscripts([]);
  };

  return {
    startTranscription,
    stopTranscription,
    recording,
    transcriptMic,
    clearTranscripts,
    rawTranscripts,
    error,
    clientReady: !!transcribeClient,
  };
};

export default useMicrophone;
