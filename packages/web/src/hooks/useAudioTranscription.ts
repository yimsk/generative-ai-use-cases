import {
  Item,
  LanguageCode,
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
} from '@aws-sdk/client-transcribe-streaming';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Buffer } from 'buffer';
import update from 'immutability-helper';
import MicrophoneStream from 'microphone-stream';
import { Transcript } from 'generative-ai-use-cases';

export type RawTranscript = {
  resultId: string;
  startTime: number;
  endTime: number;
  isPartial: boolean;
  transcripts: Transcript[];
  languageCode?: string;
};

const region = import.meta.env.VITE_APP_REGION;
const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID;
const idPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID;
const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

export const pcmEncodeChunk = (chunk: Buffer) => {
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

export const buildTranscriptView = (
  rawTranscripts: RawTranscript[],
  language: string
) => {
  const transcripts: Transcript[] = rawTranscripts.flatMap(
    (t) => t.transcripts
  );
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

  if (language === 'ja-JP') {
    return mergedTranscripts.map((item) => ({
      ...item,
      transcript: item.transcript.replace(/ /g, ''),
    }));
  }

  return mergedTranscripts;
};

export const createTranscribeClient = async () => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    return undefined;
  }

  return new TranscribeStreamingClient({
    region,
    credentials: fromCognitoIdentityPool({
      clientConfig: { region },
      identityPoolId: idPoolId,
      logins: {
        [providerName]: token,
      },
    }),
  });
};

export const createAudioStream = (stream: AsyncIterable<Buffer>) => {
  return (async function* () {
    for await (const chunk of stream) {
      yield {
        AudioEvent: {
          AudioChunk: pcmEncodeChunk(chunk),
        },
      };
    }
  })();
};

export const buildStartStreamCommand = ({
  stream,
  languageCode,
  speakerLabel = false,
  languageOptions,
  enableMultiLanguage = false,
  mediaSampleRateHertz,
}: {
  stream: AsyncIterable<Buffer>;
  languageCode?: LanguageCode;
  speakerLabel?: boolean;
  languageOptions?: string[];
  enableMultiLanguage?: boolean;
  mediaSampleRateHertz: number;
}) => {
  let commandParams: Partial<
    ConstructorParameters<typeof StartStreamTranscriptionCommand>[0]
  >;

  if (enableMultiLanguage) {
    commandParams = {
      LanguageCode: undefined,
      IdentifyLanguage: false,
      IdentifyMultipleLanguages: true,
      LanguageOptions: languageOptions
        ? languageOptions.join(',')
        : 'en-US,ja-JP',
    };
  } else if (languageCode) {
    commandParams = {
      LanguageCode: languageCode,
      IdentifyLanguage: false,
      IdentifyMultipleLanguages: false,
      LanguageOptions: undefined,
    };
  } else {
    commandParams = {
      LanguageCode: undefined,
      IdentifyLanguage: true,
      IdentifyMultipleLanguages: false,
      LanguageOptions: languageOptions
        ? languageOptions.join(',')
        : 'en-US,ja-JP',
    };
  }

  return new StartStreamTranscriptionCommand({
    ...commandParams,
    MediaEncoding: 'pcm',
    MediaSampleRateHertz: mediaSampleRateHertz,
    AudioStream: createAudioStream(stream),
    ShowSpeakerLabel: speakerLabel,
  });
};

export const mapTranscriptItems = (items: Item[]) => {
  const mergedTranscripts = items.reduce((acc, curr) => {
    if (acc.length > 0 && curr.Type === 'punctuation') {
      acc[acc.length - 1].Content += curr.Content || '';
    } else if (acc.length > 0 && acc[acc.length - 1].Speaker === curr.Speaker) {
      acc[acc.length - 1].Content += ' ' + (curr.Content || '');
    } else {
      acc.push(curr);
    }
    return acc;
  }, [] as Item[]);

  return mergedTranscripts.map((item) => ({
    speakerLabel: item.Speaker ? 'spk_' + item.Speaker : undefined,
    transcript: item.Content || '',
  }));
};

export const normalizeTranscriptResult = (
  result: {
    ResultId?: string;
    StartTime?: number;
    EndTime?: number;
    IsPartial?: boolean;
    LanguageCode?: string;
    Alternatives?: Array<{ Items?: Item[] }>;
  },
  fallbackResultId?: string
): RawTranscript => {
  const transcriptItems =
    result.Alternatives?.flatMap((alternative) => alternative.Items ?? []) ??
    [];

  return {
    resultId:
      result.ResultId ??
      fallbackResultId ??
      `segment-${Date.now()}-${Math.random()}`,
    startTime: result.StartTime ?? 0,
    endTime: result.EndTime ?? 0,
    isPartial: result.IsPartial ?? false,
    transcripts: mapTranscriptItems(transcriptItems),
    languageCode: result.LanguageCode,
  };
};

export const upsertTranscriptById = (
  prev: RawTranscript[],
  next: RawTranscript
) => {
  const existingIndex = prev.findIndex(
    (entry) => entry.resultId === next.resultId
  );

  if (existingIndex === -1) {
    return update(prev, {
      $push: [next],
    });
  }

  return update(prev, {
    $splice: [[existingIndex, 1, next]],
  });
};

export const upsertTrailingPartialTranscript = (
  prev: RawTranscript[],
  next: RawTranscript
) => {
  if (prev.length === 0 || !prev[prev.length - 1].isPartial) {
    return update(prev, {
      $push: [next],
    });
  }

  return update(prev, {
    $splice: [[prev.length - 1, 1, next]],
  });
};
