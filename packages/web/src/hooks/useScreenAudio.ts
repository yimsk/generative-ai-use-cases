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

  useEffect(() => {
    // break if already set
    if (transcribeClient) return;

    void createTranscribeClient().then((transcribe) => {
      if (!transcribe) {
        return;
      }

      setTranscribeClient(transcribe);
    });
  }, [transcribeClient]);

  const startStream = async (
    stream: MicrophoneStream,
    languageCode?: LanguageCode,
    speakerLabel: boolean = false,
    languageOptions?: string[],
    enableMultiLanguage: boolean = false
  ) => {
    if (!transcribeClient) return;

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
      const response = await transcribeClient.send(command);

      if (response.TranscriptResultStream) {
        // This snippet should be put into an async function
        for await (const event of response.TranscriptResultStream) {
          if (
            event.TranscriptEvent?.Transcript?.Results &&
            event.TranscriptEvent.Transcript?.Results.length > 0
          ) {
            // Get multiple possible results, but this code only processes a single result
            const result = event.TranscriptEvent.Transcript?.Results[0];

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
      setError('Screen audio transcription failed');
      stopTranscription();
    } finally {
      stopTranscription();
      transcribeClient.destroy();
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
    try {
      setError('');
      setScreenStream(stream);

      // Request screen audio capture
      // Note: Most browsers require video to be true when capturing audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
      });

      // Extract only the audio track
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available in screen capture');
      }

      // Create a new MediaStream with only audio
      const audioOnlyStream = new MediaStream(audioTracks);

      // Stop the video track to save resources
      const videoTracks = displayStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.stop();
      });

      stream.setStream(audioOnlyStream);
      setRecording(true);
      await startStream(
        stream,
        languageCode,
        speakerLabel,
        languageOptions,
        enableMultiLanguage
      );
    } catch (e) {
      console.log('Screen audio capture error:', e);
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
      stream.stop();
      setRecording(false);
      setScreenStream(undefined);
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

      // Request screen audio capture
      // Note: Most browsers require video to be true when capturing audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
      });

      // Check if audio track is available
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available in screen capture');
      }

      setPreparedDisplayStream(displayStream);
      return displayStream;
    } catch (e) {
      console.log('Screen audio capture preparation error:', e);
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
    try {
      setError('');
      setScreenStream(stream);

      // Extract only the audio track
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available in screen capture');
      }

      // Create a new MediaStream with only audio
      const audioOnlyStream = new MediaStream(audioTracks);

      // Stop the video track to save resources
      const videoTracks = displayStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.stop();
      });

      stream.setStream(audioOnlyStream);
      setRecording(true);
      await startStream(
        stream,
        languageCode,
        speakerLabel,
        languageOptions,
        enableMultiLanguage
      );
    } catch (e) {
      console.log('Screen audio transcription error:', e);
      if (e instanceof Error) {
        setError('Failed to start screen audio transcription');
      }
    } finally {
      stream.stop();
      setRecording(false);
      setScreenStream(undefined);
      // Clean up prepared stream
      if (preparedDisplayStream === displayStream) {
        setPreparedDisplayStream(null);
      }
    }
  };

  const stopTranscription = () => {
    if (screenStream) {
      screenStream.stop();
      setRecording(false);
      setScreenStream(undefined);
    }

    // Clean up prepared stream if exists
    if (preparedDisplayStream) {
      preparedDisplayStream.getTracks().forEach((track) => {
        track.stop();
      });
      setPreparedDisplayStream(null);
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
