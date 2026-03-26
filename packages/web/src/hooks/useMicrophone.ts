import {
  Item,
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
  LanguageCode,
} from '@aws-sdk/client-transcribe-streaming';
import MicrophoneStream from 'microphone-stream';
import { useState, useEffect, useMemo } from 'react';
import update from 'immutability-helper';
import { Buffer } from 'buffer';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Transcript } from 'generative-ai-use-cases';

const pcmEncodeChunk = (chunk: Buffer) => {
  const input = MicrophoneStream.toRaw(chunk);
  let offset = 0;
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return Buffer.from(buffer);
};

const region = import.meta.env.VITE_APP_REGION;
const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID;
const idPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID;
const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

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
  const [rawTranscripts, setRawTranscripts] = useState<
    {
      resultId: string;
      startTime: number;
      endTime: number;
      isPartial: boolean;
      transcripts: Transcript[];
      languageCode?: string;
    }[]
  >([]);
  const [language, setLanguage] = useState<string>('ja-JP');
  const [transcribeClient, setTranscribeClient] =
    useState<TranscribeStreamingClient>();

  const transcriptMic = useMemo(() => {
    const transcripts: Transcript[] = rawTranscripts.flatMap(
      (t) => t.transcripts
    );
    // If the speaker is continuous, merge
    const mergedTranscripts = transcripts.reduce((prev, item) => {
      if (
        prev.length === 0 ||
        item.speakerLabel !== prev[prev.length - 1].speakerLabel
      ) {
        prev.push({
          speakerLabel: item.speakerLabel,
          transcript: item.transcript,
        });
      } else {
        prev[prev.length - 1].transcript += ' ' + item.transcript;
      }
      return prev;
    }, [] as Transcript[]);
    // If Japanese, remove spaces
    if (language === 'ja-JP') {
      return mergedTranscripts.map((item) => ({
        ...item,
        transcript: item.transcript.replace(/ /g, ''),
      }));
    }
    return mergedTranscripts;
  }, [rawTranscripts, language]);

  useEffect(() => {
    if (transcribeClient) return;

    let cancelled = false;

    const setupClient = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (!token || cancelled) {
          return;
        }

        const transcribe = new TranscribeStreamingClient({
          region,
          credentials: fromCognitoIdentityPool({
            clientConfig: { region },
            identityPoolId: idPoolId,
            logins: {
              [providerName]: token,
            },
          }),
        });

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

    const audioStream = async function* () {
      for await (const chunk of mic as unknown as Buffer[]) {
        yield {
          AudioEvent: {
            AudioChunk: pcmEncodeChunk(chunk),
          },
        };
      }
    };

    // Best Practice: https://docs.aws.amazon.com/transcribe/latest/dg/streaming.html
    let commandParams: Partial<
      ConstructorParameters<typeof StartStreamTranscriptionCommand>[0]
    >;

    if (enableMultiLanguage) {
      // Multi-language identification mode (bidirectional translation)
      commandParams = {
        LanguageCode: undefined,
        IdentifyLanguage: false,
        IdentifyMultipleLanguages: true,
        LanguageOptions: languageOptions
          ? languageOptions.join(',')
          : 'en-US,ja-JP',
      };
    } else if (languageCode) {
      // Specific language mode
      commandParams = {
        LanguageCode: languageCode,
        IdentifyLanguage: false,
        IdentifyMultipleLanguages: false,
        LanguageOptions: undefined,
      };
    } else {
      // Auto language identification mode
      commandParams = {
        LanguageCode: undefined,
        IdentifyLanguage: true,
        IdentifyMultipleLanguages: false,
        LanguageOptions: languageOptions
          ? languageOptions.join(',')
          : 'en-US,ja-JP',
      };
    }

    const command = new StartStreamTranscriptionCommand({
      ...commandParams,
      MediaEncoding: 'pcm',
      MediaSampleRateHertz: mediaSampleRateHertz,
      AudioStream: audioStream(),
      ShowSpeakerLabel: speakerLabel,
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

            // Process Multiple Speaker
            const transcriptItems =
              result.Alternatives?.flatMap(
                (alternative) => alternative.Items ?? []
              ) ?? [];
            // Merge consecutive transcript with same Speaker
            const mergedTranscripts = transcriptItems.reduce((acc, curr) => {
              if (acc.length > 0 && curr.Type === 'punctuation') {
                acc[acc.length - 1].Content += curr.Content || '';
              } else if (
                acc.length > 0 &&
                acc[acc.length - 1].Speaker === curr.Speaker
              ) {
                acc[acc.length - 1].Content += ' ' + (curr.Content || '');
              } else {
                acc.push(curr);
              }
              return acc;
            }, [] as Item[]);
            const transcripts: Transcript[] = mergedTranscripts?.map(
              (item) => ({
                speakerLabel: item.Speaker ? 'spk_' + item.Speaker : undefined,
                transcript: item.Content || '',
              })
            );

            const normalizedResult = {
              resultId: result.ResultId ?? `mic-${Date.now()}-${Math.random()}`,
              startTime: result.StartTime ?? 0,
              endTime: result.EndTime ?? 0,
              isPartial: result.IsPartial ?? false,
              transcripts,
              languageCode: result.LanguageCode,
            };

            setRawTranscripts((prev) => {
              const existingIndex = prev.findIndex(
                (entry) => entry.resultId === normalizedResult.resultId
              );

              if (existingIndex === -1) {
                return update(prev, {
                  $push: [normalizedResult],
                });
              }

              return update(prev, {
                $splice: [[existingIndex, 1, normalizedResult]],
              });
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
