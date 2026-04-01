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
  upsertTrailingPartialTranscript,
} from './useAudioTranscription';

const SCREEN_AUDIO_DEBUG_PREFIX = '[useScreenAudio]';

const logScreenAudioDebug = (
  message: string,
  data?: Record<string, unknown>
) => {
  if (data) {
    console.log(`${SCREEN_AUDIO_DEBUG_PREFIX} ${message}`, data);
    return;
  }

  console.log(`${SCREEN_AUDIO_DEBUG_PREFIX} ${message}`);
};

const bindScreenStreamDebugEvents = (
  stream: MediaStream,
  source: string
): (() => void) => {
  const canListenToStream =
    typeof stream.addEventListener === 'function' &&
    typeof stream.removeEventListener === 'function';

  const onTrackChange = () => {
    logScreenAudioDebug(`${source} stream track changed`, {
      active: stream.active,
      trackCount: stream.getTracks().length,
    });
  };
  const onInactive = () => {
    logScreenAudioDebug(`${source} stream became inactive`, {
      active: stream.active,
      trackStates: stream.getTracks().map((track) => ({
        kind: track.kind,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      })),
    });
  };

  if (canListenToStream) {
    stream.addEventListener('addtrack', onTrackChange);
    stream.addEventListener('removetrack', onTrackChange);
    stream.addEventListener('inactive', onInactive);
  }

  const cleanups = stream.getTracks().map((track, index) => {
    const onEnded = () => {
      logScreenAudioDebug(`${source} track ended`, {
        index,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
    };
    const onMute = () => {
      logScreenAudioDebug(`${source} track mute`, {
        index,
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
    };
    const onUnmute = () => {
      logScreenAudioDebug(`${source} track unmute`, {
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
      stream.removeEventListener('addtrack', onTrackChange);
      stream.removeEventListener('removetrack', onTrackChange);
      stream.removeEventListener('inactive', onInactive);
    }
    cleanups.forEach((cleanup) => {
      cleanup();
    });
  };
};

const useScreenAudio = () => {
  const [screenStream, setScreenStream] = useState<
    MicrophoneStream | undefined
  >();
  const [recording, setRecording] = useState(false);
  const [rawTranscripts, setRawTranscripts] = useState<RawTranscript[]>([]);
  const [language, setLanguage] = useState<string>('ja-JP');
  const [transcribeClient, setTranscribeClient] =
    useState<TranscribeStreamingClient>();
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [preparedDisplayStream, setPreparedDisplayStream] =
    useState<MediaStream | null>(null);

  // Check browser support
  useEffect(() => {
    const supported =
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function';
    setIsSupported(supported);
  }, []);

  const transcriptScreen = useMemo(() => {
    return buildTranscriptView(rawTranscripts, language);
  }, [rawTranscripts, language]);

  // Initialize transcribe client with race condition protection
  useEffect(() => {
    if (transcribeClient) return;

    let cancelled = false;
    let client: TranscribeStreamingClient | undefined;
    let handedOff = false;

    const setupClient = async () => {
      try {
        logScreenAudioDebug('Initializing transcribe client');
        client = await createTranscribeClient();
        if (!client) {
          logScreenAudioDebug(
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
        setError('');
        logScreenAudioDebug('Transcribe client ready');
      } catch (clientError) {
        if (!cancelled) {
          logScreenAudioDebug('Transcribe client initialization failed', {
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
              ? clientError.message
              : 'Failed to initialize screen audio client'
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

  // Dispose transcribe client on unmount
  useEffect(() => {
    return () => {
      transcribeClient?.destroy();
    };
  }, [transcribeClient]);

  const startStream = async (
    stream: MicrophoneStream,
    languageCode?: LanguageCode,
    speakerLabel: boolean = false,
    languageOptions?: string[],
    enableMultiLanguage: boolean = false
  ) => {
    if (!transcribeClient) {
      logScreenAudioDebug(
        'startStream skipped because transcribe client is unavailable'
      );
      return;
    }

    // Update Language
    if (languageCode) {
      setLanguage(languageCode);
    }

    const command = buildStartStreamCommand({
      stream: stream as unknown as AsyncIterable<Buffer>,
      languageCode,
      speakerLabel,
      languageOptions,
      enableMultiLanguage,
      mediaSampleRateHertz: 48000,
    });

    try {
      logScreenAudioDebug('Sending transcribe streaming command', {
        languageCode,
        speakerLabel,
        languageOptions,
        enableMultiLanguage,
      });
      const response = await transcribeClient.send(command);
      logScreenAudioDebug('Transcribe streaming command accepted', {
        hasTranscriptStream: !!response.TranscriptResultStream,
      });

      if (response.TranscriptResultStream) {
        // This snippet should be put into an async function
        for await (const event of response.TranscriptResultStream) {
          if (
            event.TranscriptEvent?.Transcript?.Results &&
            event.TranscriptEvent.Transcript?.Results.length > 0
          ) {
            // Get multiple possible results, but this code only processes a single result
            const result = event.TranscriptEvent.Transcript?.Results[0];
            logScreenAudioDebug('Received transcript event', {
              resultCount: event.TranscriptEvent.Transcript?.Results.length,
            });

            // Update Language
            if (result.LanguageCode) {
              setLanguage(result.LanguageCode);
            }

            setRawTranscripts((prev) => {
              return upsertTrailingPartialTranscript(
                prev,
                normalizeTranscriptResult(result, '')
              );
            });
          }
        }
      }
    } catch (error) {
      console.error('Screen audio transcription error:', error);
      logScreenAudioDebug('Transcribe streaming failed', {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : error,
      });
      setError('Screen audio transcription failed');
      stopTranscription();
    } finally {
      logScreenAudioDebug(
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
    if (!isSupported) {
      setError('Screen audio capture is not supported in this browser');
      return;
    }

    const stream = new MicrophoneStream();
    let cleanupDisplayDebug: (() => void) | undefined;
    let cleanupAudioOnlyDebug: (() => void) | undefined;
    try {
      setError('');
      setScreenStream(stream);

      // Request screen audio capture
      // Note: Most browsers require video to be true when capturing audio
      logScreenAudioDebug('Requesting getDisplayMedia', {
        constraints: {
          video: { displaySurface: 'monitor' },
          audio: true,
        },
      });
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
      });
      cleanupDisplayDebug = bindScreenStreamDebugEvents(
        displayStream,
        'display'
      );
      logScreenAudioDebug('getDisplayMedia resolved', {
        active: displayStream.active,
        tracks: displayStream.getTracks().map((track) => ({
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      });

      // Extract only the audio track
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available in screen capture');
      }

      // Create a new MediaStream with only audio
      const audioOnlyStream = new MediaStream(audioTracks);
      cleanupAudioOnlyDebug = bindScreenStreamDebugEvents(
        audioOnlyStream,
        'audio-only'
      );

      // Stop the video track to save resources
      const videoTracks = displayStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.stop();
      });
      logScreenAudioDebug('Video tracks stopped after extracting audio', {
        videoTrackCount: videoTracks.length,
      });

      stream.setStream(audioOnlyStream);
      setRecording(true);
      logScreenAudioDebug('Recording state set to true');
      await startStream(
        stream,
        languageCode,
        speakerLabel,
        languageOptions,
        enableMultiLanguage
      );
    } catch (e) {
      console.log('Screen audio capture error:', e);
      logScreenAudioDebug('Failed to start screen audio capture', {
        error: e instanceof Error ? { name: e.name, message: e.message } : e,
      });
      if (e instanceof Error) {
        if (e.name === 'NotAllowedError') {
          setError('Screen audio access was denied');
        } else if (e.name === 'NotSupportedError') {
          setError('Screen audio capture is not supported');
        } else {
          setError('Failed to start screen audio capture');
        }
      }
    } finally {
      cleanupDisplayDebug?.();
      cleanupAudioOnlyDebug?.();
      stream.stop();
      setRecording(false);
      setScreenStream(undefined);
      logScreenAudioDebug('Recording state reset to false');
    }
  };

  /**
   * Prepares screen capture by requesting user permission and screen selection.
   * This function only handles the preparation phase (getDisplayMedia) without starting
   * the actual recording. This allows synchronization with microphone recording by
   * completing user interactions upfront, then starting both recordings simultaneously.
   *
   * @returns Promise<MediaStream> The prepared display stream with audio tracks
   * @throws Error if screen capture is not supported or user denies permission
   */
  const prepareScreenCapture = async (): Promise<MediaStream> => {
    if (!isSupported) {
      throw new Error('Screen audio capture is not supported in this browser');
    }

    try {
      setError('');
      logScreenAudioDebug('Preparing screen capture with getDisplayMedia');

      // Request screen audio capture
      // Note: Most browsers require video to be true when capturing audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
      });
      logScreenAudioDebug('prepareScreenCapture resolved', {
        active: displayStream.active,
        tracks: displayStream.getTracks().map((track) => ({
          kind: track.kind,
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      });

      // Check if audio track is available
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available in screen capture');
      }

      setPreparedDisplayStream(displayStream);
      logScreenAudioDebug('Prepared display stream cached');
      return displayStream;
    } catch (e) {
      console.log('Screen audio capture preparation error:', e);
      logScreenAudioDebug('prepareScreenCapture failed', {
        error: e instanceof Error ? { name: e.name, message: e.message } : e,
      });
      if (e instanceof Error) {
        if (e.name === 'NotAllowedError') {
          setError('Screen audio access was denied');
        } else if (e.name === 'NotSupportedError') {
          setError('Screen audio capture is not supported');
        } else {
          setError('Failed to prepare screen audio capture');
        }
      }
      throw e;
    }
  };

  /**
   * Starts screen audio transcription using a pre-prepared display stream.
   * This function is designed to work with prepareScreenCapture() for synchronized
   * recording. It extracts audio tracks from the provided stream and begins
   * transcription without additional user interaction delays.
   *
   * @param displayStream The MediaStream obtained from prepareScreenCapture()
   * @param languageCode Optional language code for transcription
   * @param speakerLabel Whether to enable speaker recognition
   */
  const startTranscriptionWithStream = async (
    displayStream: MediaStream,
    languageCode?: LanguageCode,
    speakerLabel?: boolean,
    languageOptions?: string[],
    enableMultiLanguage?: boolean
  ) => {
    const stream = new MicrophoneStream();
    let cleanupDisplayDebug: (() => void) | undefined;
    let cleanupAudioOnlyDebug: (() => void) | undefined;
    try {
      setError('');
      setScreenStream(stream);
      cleanupDisplayDebug = bindScreenStreamDebugEvents(
        displayStream,
        'prepared-display'
      );
      logScreenAudioDebug(
        'Starting transcription from prepared display stream',
        {
          active: displayStream.active,
          trackCount: displayStream.getTracks().length,
        }
      );

      // Extract only the audio track
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available in screen capture');
      }

      // Create a new MediaStream with only audio
      const audioOnlyStream = new MediaStream(audioTracks);
      cleanupAudioOnlyDebug = bindScreenStreamDebugEvents(
        audioOnlyStream,
        'prepared-audio-only'
      );

      // Stop the video track to save resources
      const videoTracks = displayStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.stop();
      });
      logScreenAudioDebug('Prepared display video tracks stopped', {
        videoTrackCount: videoTracks.length,
      });

      stream.setStream(audioOnlyStream);
      setRecording(true);
      logScreenAudioDebug('Recording state set to true from prepared stream');
      await startStream(
        stream,
        languageCode,
        speakerLabel,
        languageOptions,
        enableMultiLanguage
      );
    } catch (e) {
      console.log('Screen audio transcription error:', e);
      logScreenAudioDebug(
        'Failed to start screen audio transcription from prepared stream',
        {
          error: e instanceof Error ? { name: e.name, message: e.message } : e,
        }
      );
      if (e instanceof Error) {
        setError('Failed to start screen audio transcription');
      }
    } finally {
      cleanupDisplayDebug?.();
      cleanupAudioOnlyDebug?.();
      stream.stop();
      setRecording(false);
      setScreenStream(undefined);
      logScreenAudioDebug(
        'Recording state reset to false from prepared stream'
      );
      // Clean up prepared stream
      if (preparedDisplayStream === displayStream) {
        setPreparedDisplayStream(null);
      }
    }
  };

  const stopTranscription = () => {
    logScreenAudioDebug('stopTranscription called', {
      hasScreenStream: !!screenStream,
      hasPreparedDisplayStream: !!preparedDisplayStream,
    });
    if (screenStream) {
      screenStream.stop();
      setRecording(false);
      setScreenStream(undefined);
      logScreenAudioDebug('Screen stream stopped by stopTranscription');
    }

    // Clean up prepared stream if exists
    if (preparedDisplayStream) {
      preparedDisplayStream.getTracks().forEach((track) => {
        track.stop();
      });
      setPreparedDisplayStream(null);
      logScreenAudioDebug('Prepared display stream tracks stopped');
    }
  };

  const clearTranscripts = () => {
    setRawTranscripts([]);
    setError('');
  };

  return {
    startTranscription,
    prepareScreenCapture,
    startTranscriptionWithStream,
    stopTranscription,
    recording,
    transcriptScreen,
    clearTranscripts,
    isSupported,
    error,
    rawTranscripts,
  };
};

export default useScreenAudio;
