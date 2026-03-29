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

    const setupClient = async () => {
      try {
        const transcribe = await createTranscribeClient();
        if (!transcribe || cancelled) {
          return;
        }

        setTranscribeClient(transcribe);
        setError(null);
      } catch (clientError) {
        if (!cancelled) {
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
    if (!transcribeClient) return;

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
      const response = await transcribeClient.send(command);

      if (response.TranscriptResultStream) {
        for await (const event of response.TranscriptResultStream) {
          const results = event.TranscriptEvent?.Transcript?.Results ?? [];
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
      setError(
        error instanceof Error ? error : new Error('Speech recognition failed')
      );
      console.error(error);
      stopTranscription();
    } finally {
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
    let audioContext: AudioContext | undefined;
    try {
      setError(null);
      setMicStream(mic);
      const stream = await window.navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      mic.setStream(stream);

      audioContext = new window.AudioContext();
      const detectedSampleRate = Math.round(audioContext.sampleRate || 48000);

      setRecording(true);
      await startStream(
        mic,
        languageCode,
        speakerLabel,
        languageOptions,
        enableMultiLanguage,
        detectedSampleRate
      );
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error('Failed to start microphone input')
      );
    } finally {
      await audioContext?.close().catch(() => undefined);
      mic.stop();
      setRecording(false);
      setMicStream(undefined);
    }
  };

  const stopTranscription = () => {
    if (micStream) {
      micStream.stop();
      setRecording(false);
      setMicStream(undefined);
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
