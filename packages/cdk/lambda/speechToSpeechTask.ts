import { Amplify } from 'aws-amplify';
import { events, EventsChannel } from 'aws-amplify/data';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { randomUUID } from 'crypto';
import {
  InvokeModelWithBidirectionalStreamCommand,
  InvokeModelWithBidirectionalStreamInput,
  InvokeModelWithBidirectionalStreamCommandOutput,
  ModelStreamErrorException,
} from '@aws-sdk/client-bedrock-runtime';
import { NodeHttp2Handler } from '@smithy/node-http-handler';
import {
  SpeechToSpeechEventType,
  SpeechToSpeechEvent,
  Model,
} from 'generative-ai-use-cases';
import { initBedrockRuntimeClient } from './utils/bedrockClient';

Object.assign(global, { WebSocket: require('ws') });

const MODEL_REGION = process.env.MODEL_REGION as string;

const MAX_AUDIO_INPUT_QUEUE_SIZE = 200;
const MIN_AUDIO_OUTPUT_QUEUE_SIZE = 10;
const MAX_AUDIO_OUTPUT_PER_BATCH = 20;

type BidirectionalStreamEvent = {
  event: Record<string, unknown>;
};

class SpeechToSpeechSession {
  private isActive = false;
  private isProcessingAudio = false;
  private isAudioStarted = false;
  private eventQueue: BidirectionalStreamEvent[] = [];
  private audioInputQueue: string[] = [];
  private audioOutputQueue: string[] = [];
  private promptName = randomUUID();
  private audioContentId = randomUUID();
  private channel: EventsChannel | null = null;

  start() {
    this.initialize();
    this.isActive = true;
    this.promptName = randomUUID();
  }

  getPromptName() {
    return this.promptName;
  }

  attachChannel(channel: EventsChannel) {
    this.channel = channel;
  }

  private clearQueue() {
    this.eventQueue = [];
    this.audioInputQueue = [];
    this.audioOutputQueue = [];
  }

  private initialize() {
    this.isActive = false;
    this.isProcessingAudio = false;
    this.isAudioStarted = false;
    this.channel = null;
    this.clearQueue();
  }

  async dispatchEvent(
    event: SpeechToSpeechEventType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any = undefined
  ) {
    if (!this.channel) {
      return;
    }

    try {
      await this.channel.publish({
        direction: 'btoc',
        event,
        data,
      } as SpeechToSpeechEvent);
    } catch (e) {
      console.error(
        'Failed to publish the event via channel. The channel might be closed',
        event,
        data
      );
    }
  }

  enqueueSessionStart() {
    this.eventQueue.push({
      event: {
        sessionStart: {
          inferenceConfiguration: {
            maxTokens: 1024,
            topP: 0.9,
            temperature: 0.7,
          },
        },
      },
    });
  }

  enqueuePromptStart() {
    this.eventQueue.push({
      event: {
        promptStart: {
          promptName: this.promptName,
          textOutputConfiguration: {
            mediaType: 'text/plain',
          },
          audioOutputConfiguration: {
            audioType: 'SPEECH',
            encoding: 'base64',
            mediaType: 'audio/lpcm',
            sampleRateHertz: 24000,
            sampleSizeBits: 16,
            channelCount: 1,
            // TODO: avoid hardcoding
            voiceId: 'tiffany',
          },
        },
      },
    });
  }

  enqueueSystemPrompt(prompt: string) {
    const contentName = randomUUID();

    this.eventQueue.push({
      event: {
        contentStart: {
          promptName: this.promptName,
          contentName,
          type: 'TEXT',
          interactive: true,
          role: 'SYSTEM',
          textInputConfiguration: {
            mediaType: 'text/plain',
          },
        },
      },
    });

    this.eventQueue.push({
      event: {
        textInput: {
          promptName: this.promptName,
          contentName,
          content: prompt,
        },
      },
    });

    this.eventQueue.push({
      event: {
        contentEnd: {
          promptName: this.promptName,
          contentName,
        },
      },
    });
  }

  enqueueAudioStart() {
    this.audioContentId = randomUUID();

    this.eventQueue.push({
      event: {
        contentStart: {
          promptName: this.promptName,
          contentName: this.audioContentId,
          type: 'AUDIO',
          interactive: true,
          role: 'USER',
          audioInputConfiguration: {
            audioType: 'SPEECH',
            encoding: 'base64',
            mediaType: 'audio/lpcm',
            sampleRateHertz: 16000,
            sampleSizeBits: 16,
            channelCount: 1,
          },
        },
      },
    });

    this.isAudioStarted = true;
  }

  enqueuePromptEnd() {
    this.eventQueue.push({
      event: {
        promptEnd: {
          promptName: this.promptName,
        },
      },
    });
  }

  enqueueSessionEnd() {
    this.eventQueue.push({
      event: {
        sessionEnd: {},
      },
    });
  }

  enqueueAudioStop() {
    this.isAudioStarted = false;

    this.clearQueue();

    this.eventQueue.push({
      event: {
        contentEnd: {
          promptName: this.promptName,
          contentName: this.audioContentId,
        },
      },
    });
  }

  enqueueAudioInput(audioInputBase64Array: string[]) {
    if (!this.isAudioStarted || !this.isActive) {
      return;
    }

    for (const audioInput of audioInputBase64Array) {
      this.audioInputQueue.push(audioInput);
    }

    while (this.audioInputQueue.length - MAX_AUDIO_INPUT_QUEUE_SIZE > 0) {
      this.audioInputQueue.shift();
    }

    if (!this.isProcessingAudio) {
      this.isProcessingAudio = true;
      void this.processAudioQueue();
    }
  }

  private async enqueueAudioOutput(audioOutput: string) {
    this.audioOutputQueue.push(audioOutput);

    if (this.audioOutputQueue.length > MIN_AUDIO_OUTPUT_QUEUE_SIZE) {
      const chunksToProcess: string[] = [];
      let processedChunks = 0;

      while (
        this.audioOutputQueue.length > 0 &&
        processedChunks < MAX_AUDIO_OUTPUT_PER_BATCH
      ) {
        const chunk = this.audioOutputQueue.shift();

        if (chunk) {
          chunksToProcess.push(chunk);
          processedChunks += 1;
        }
      }

      await this.dispatchEvent('audioOutput', chunksToProcess);
    }
  }

  private async forcePublishAudioOutput() {
    const chunksToProcess: string[] = [];

    while (this.audioOutputQueue.length > 0) {
      const chunk = this.audioOutputQueue.shift();
      if (chunk) {
        chunksToProcess.push(chunk);
      }
    }

    await this.dispatchEvent('audioOutput', chunksToProcess);
  }

  createAsyncIterator() {
    return {
      [Symbol.asyncIterator]: () => {
        return {
          next: async (): Promise<
            IteratorResult<InvokeModelWithBidirectionalStreamInput>
          > => {
            try {
              while (this.eventQueue.length === 0 && this.isActive) {
                await new Promise((s) => setTimeout(s, 100));
              }

              const nextEvent = this.eventQueue.shift();

              if (!nextEvent) {
                return { value: undefined, done: true };
              }

              if (nextEvent.event.sessionEnd) {
                this.isActive = false;
              }

              return {
                value: {
                  chunk: {
                    bytes: new TextEncoder().encode(JSON.stringify(nextEvent)),
                  },
                },
                done: false,
              };
            } catch (e) {
              console.error('Error in asyncIterator', e);
              return { value: undefined, done: true };
            }
          },
        };
      },
      return: async () => {
        return { value: undefined, done: true };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw: async (error: any) => {
        console.error(error);
        throw error;
      },
    };
  }

  private async processAudioQueue() {
    while (
      this.audioInputQueue.length > 0 &&
      this.isAudioStarted &&
      this.isActive
    ) {
      const audioChunk = this.audioInputQueue.shift();

      this.eventQueue.push({
        event: {
          audioInput: {
            promptName: this.promptName,
            contentName: this.audioContentId,
            content: audioChunk,
          },
        },
      });
    }

    if (this.isAudioStarted && this.isActive) {
      setTimeout(() => {
        void this.processAudioQueue();
      }, 0);
    } else {
      console.log('Processing audio is ended.');
      this.isProcessingAudio = false;
    }
  }

  async processResponseStream(
    response: InvokeModelWithBidirectionalStreamCommandOutput
  ) {
    if (!response.body) {
      throw new Error('Response body is null');
    }

    for await (const event of response.body) {
      try {
        if (event.chunk?.bytes) {
          const textResponse = new TextDecoder().decode(event.chunk.bytes);
          const jsonResponse = JSON.parse(textResponse);

          if (jsonResponse.event?.audioOutput) {
            await this.enqueueAudioOutput(jsonResponse.event.audioOutput.content);
          } else if (
            jsonResponse.event?.contentEnd &&
            jsonResponse.event?.contentEnd?.type === 'AUDIO'
          ) {
            await this.forcePublishAudioOutput();
          } else if (
            jsonResponse.event?.contentStart &&
            jsonResponse.event?.contentStart?.type === 'TEXT'
          ) {
            let generationStage = null;

            if (jsonResponse.event?.contentStart?.additionalModelFields) {
              generationStage = JSON.parse(
                jsonResponse.event?.contentStart?.additionalModelFields
              ).generationStage;
            }

            await this.dispatchEvent('textStart', {
              id: jsonResponse.event?.contentStart?.contentId,
              role: jsonResponse.event?.contentStart?.role?.toLowerCase(),
              generationStage,
            });
          } else if (jsonResponse.event?.textOutput) {
            await this.dispatchEvent('textOutput', {
              id: jsonResponse.event?.textOutput?.contentId,
              role: jsonResponse.event?.textOutput?.role?.toLowerCase(),
              content: jsonResponse.event?.textOutput?.content,
            });
          } else if (
            jsonResponse.event?.contentEnd &&
            jsonResponse.event?.contentEnd?.type === 'TEXT'
          ) {
            await this.dispatchEvent('textStop', {
              id: jsonResponse.event?.contentEnd?.contentId,
              role: jsonResponse.event?.contentEnd?.role?.toLowerCase(),
              stopReason: jsonResponse.event?.contentEnd?.stopReason,
            });
          }
        }
      } catch (e) {
        console.error('Error in processResponseStream', e);

        if (e instanceof ModelStreamErrorException) {
          console.log('Retrying...');
        } else {
          break;
        }
      }
    }
  }

  async finalize() {
    try {
      if (this.channel) {
        console.log('Sending "end" event...');
        await this.dispatchEvent('end');

        console.log('Close the channel');
        this.channel.close();
      }

      this.initialize();
      console.log('Session ended. Every parameters are initialized.');
    } catch (e) {
      console.error('Error during finalization', e);
    }
  }
}

export const handler = async (event: { channelId: string; model: Model }) => {
  const session = new SpeechToSpeechSession();

  try {
    console.log('event', event);

    const modelIdOrArn = event.model.modelId;

    /*
    // TODO: Uncomment this block when InvokeModelWithBidirectionalStreamCommand supports Inference Profile Arn
    // Also change 'const modelIdOrArn' above to 'let modelIdOrArn'
    try {
      const speechToSpeechModels = JSON.parse(process.env.SPEECH_TO_SPEECH_MODEL_IDS || '[]');
      const modelConfig = speechToSpeechModels.find((config: any) => config.modelId === event.model.modelId);
      if (modelConfig?.inferenceProfileArn) {
        modelIdOrArn = modelConfig.inferenceProfileArn;
        console.log('DEBUG: Using Inference Profile ARN for speech-to-speech:', modelIdOrArn);
      } else {
        console.log('DEBUG: No inference profile ARN found, using modelId:', modelIdOrArn);
      }
    } catch (error) {
      console.error('DEBUG: Error parsing SPEECH_TO_SPEECH_MODEL_IDS:', error);
      console.log('DEBUG: Falling back to modelId:', modelIdOrArn);
    }
    */

    session.start();

    console.log('promptName', session.getPromptName());

    const bedrockRuntimeClient = await initBedrockRuntimeClient({
      region: event.model.region ?? MODEL_REGION,
      requestHandler: new NodeHttp2Handler({
        requestTimeout: 300000,
        sessionTimeout: 300000,
        disableConcurrentStreams: false,
        maxConcurrentStreams: 1,
      }),
    });

    console.log('Bedrock client initialized');

    Amplify.configure(
      {
        API: {
          Events: {
            endpoint: process.env.EVENT_API_ENDPOINT!,
            region: process.env.AWS_DEFAULT_REGION!,
            defaultAuthMode: 'iam',
          },
        },
      },
      {
        Auth: {
          credentialsProvider: {
            getCredentialsAndIdentityId: async () => {
              const provider = fromNodeProviderChain();
              const credentials = await provider();
              return {
                credentials,
              };
            },
            clearCredentialsAndIdentityId: async () => {},
          },
        },
      }
    );

    console.log('Amplify configured');
    console.log(
      `Connect to the channel /${process.env.NAMESPACE}/${event.channelId}`
    );

    const channel = await events.connect(
      `/${process.env.NAMESPACE}/${event.channelId}`
    );
    session.attachChannel(channel);

    console.log('Connected!');

    channel.subscribe({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: async (data: any) => {
        const channelEvent = data?.event;
        if (channelEvent && channelEvent.direction === 'ctob') {
          if (channelEvent.event === 'promptStart') {
            session.enqueuePromptStart();
          } else if (channelEvent.event === 'systemPrompt') {
            session.enqueueSystemPrompt(channelEvent.data);
          } else if (channelEvent.event === 'audioStart') {
            session.enqueueAudioStart();
          } else if (channelEvent.event === 'audioInput') {
            session.enqueueAudioInput(channelEvent.data);
          } else if (channelEvent.event === 'audioStop') {
            session.enqueueAudioStop();
            session.enqueuePromptEnd();
            session.enqueueSessionEnd();
          }
        }
      },
      error: console.error,
    });

    console.log('Subscribed to the channel');

    session.enqueueSessionStart();

    console.log('Sleep...');
    await new Promise((s) => setTimeout(s, 1000));

    await session.dispatchEvent('ready');

    console.log("I'm ready");

    const asyncIterator = session.createAsyncIterator();

    console.log('Async iterator created');

    const response = await bedrockRuntimeClient.send(
      new InvokeModelWithBidirectionalStreamCommand({
        modelId: modelIdOrArn,
        body: asyncIterator,
      })
    );

    console.log('Bidirectional stream command sent');

    await session.processResponseStream(response);
  } catch (e) {
    console.error('Error in main process', e);
  } finally {
    await session.finalize();
  }
};
