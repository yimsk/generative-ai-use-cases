const { beforeEach, describe, expect, test, vi } = require('bun:test');
import { Model } from 'generative-ai-use-cases';

vi.resetModules = () => {};

const mockAmplifyConfigure = vi.fn();
const mockConnect = vi.fn();
const mockFromNodeProviderChain = vi.fn();
const mockInitBedrockRuntimeClient = vi.fn();
const mockRandomUUID = vi.fn();

vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: mockAmplifyConfigure,
  },
}));

vi.mock('aws-amplify/data', () => ({
  events: {
    connect: mockConnect,
  },
}));

vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: mockFromNodeProviderChain,
}));

vi.mock('../../lambda/utils/bedrockClient', () => ({
  initBedrockRuntimeClient: mockInitBedrockRuntimeClient,
}));

vi.mock('crypto', () => ({
  randomUUID: mockRandomUUID,
}));

vi.mock('@smithy/node-http-handler', () => ({
  NodeHttp2Handler: vi.fn().mockImplementation((config: unknown) => config),
}));

vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  class InvokeModelWithBidirectionalStreamCommand {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  }

  class ModelStreamErrorException extends Error {}

  return {
    InvokeModelWithBidirectionalStreamCommand,
    ModelStreamErrorException,
  };
});

type MockChannelEvent = {
  direction: 'ctob';
  event: string;
  data?: unknown;
};

type MockChannel = {
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  handlers?: {
    next: (event: { event: MockChannelEvent }) => Promise<void>;
    error: (error: unknown) => void;
  };
};

type BedrockEvent = {
  event: Record<string, unknown>;
};

const model: Model = {
  modelId: 'test-model-id',
  region: 'us-east-1',
  type: 'bedrock',
};

const nextTick = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};

const sleep = async (ms: number) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const toStreamChunk = (payload: Record<string, unknown>) => ({
  chunk: {
    bytes: new TextEncoder().encode(JSON.stringify(payload)),
  },
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function collectRequestEvents(body: AsyncIterable<unknown>) {
  const events: BedrockEvent[] = [];

  for await (const item of body as AsyncIterable<{
    chunk?: { bytes?: Uint8Array };
  }>) {
    const bytes = item.chunk?.bytes;

    if (!bytes) {
      continue;
    }

    events.push(JSON.parse(new TextDecoder().decode(bytes)) as BedrockEvent);
  }

  return events;
}

function createChannel(): MockChannel {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(function (this: MockChannel, handlers: unknown) {
      this.handlers = handlers as MockChannel['handlers'];
    }),
    close: vi.fn(),
  };
}

describe('speechToSpeechTask handler', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.MODEL_REGION = 'us-east-1';
    process.env.EVENT_API_ENDPOINT = 'https://example.com/graphql';
    process.env.AWS_DEFAULT_REGION = 'us-east-1';
    process.env.NAMESPACE = 'speech-to-speech';

    let uuidCounter = 0;
    mockRandomUUID.mockImplementation(() => `uuid-${++uuidCounter}`);
    mockFromNodeProviderChain.mockReturnValue(async () => ({
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      sessionToken: 'token',
    }));
  });

  test('preserves event publishing and request queue flow for one session', async () => {
    const channel = createChannel();
    const requestEventsBySend: BedrockEvent[][] = [];

    mockConnect.mockResolvedValue(channel);
    mockInitBedrockRuntimeClient.mockResolvedValue({
      send: vi.fn(
        async (command: { input: { body: AsyncIterable<unknown> } }) => {
          const handlers = channel.handlers;
          const collectedEventsPromise = collectRequestEvents(
            command.input.body
          );

          if (!handlers) {
            throw new Error('channel handlers were not registered');
          }

          await handlers.next({
            event: { direction: 'ctob', event: 'promptStart' },
          });
          await handlers.next({
            event: {
              direction: 'ctob',
              event: 'systemPrompt',
              data: 'system prompt',
            },
          });
          await handlers.next({
            event: { direction: 'ctob', event: 'audioStart' },
          });
          await handlers.next({
            event: {
              direction: 'ctob',
              event: 'audioInput',
              data: ['pcm-1', 'pcm-2'],
            },
          });
          await nextTick();
          await handlers.next({
            event: { direction: 'ctob', event: 'audioStop' },
          });

          requestEventsBySend.push(await collectedEventsPromise);

          return {
            body: (async function* () {
              yield toStreamChunk({
                event: {
                  contentStart: {
                    type: 'TEXT',
                    contentId: 'assistant-text-1',
                    role: 'ASSISTANT',
                    additionalModelFields: JSON.stringify({
                      generationStage: 'RESPONSE',
                    }),
                  },
                },
              });
              yield toStreamChunk({
                event: {
                  textOutput: {
                    contentId: 'assistant-text-1',
                    role: 'ASSISTANT',
                    content: 'hello',
                  },
                },
              });
              yield toStreamChunk({
                event: {
                  audioOutput: {
                    content: 'audio-out-1',
                  },
                },
              });
              yield toStreamChunk({
                event: {
                  audioOutput: {
                    content: 'audio-out-2',
                  },
                },
              });
              yield toStreamChunk({
                event: {
                  contentEnd: {
                    type: 'AUDIO',
                  },
                },
              });
              yield toStreamChunk({
                event: {
                  contentEnd: {
                    type: 'TEXT',
                    contentId: 'assistant-text-1',
                    role: 'ASSISTANT',
                    stopReason: 'FINISHED',
                  },
                },
              });
            })(),
          };
        }
      ),
    });

    const { handler } = await import('../../lambda/speechToSpeechTask');

    await handler({ channelId: 'channel-a', model });

    expect(mockConnect).toHaveBeenCalledWith('/speech-to-speech/channel-a');
    expect(requestEventsBySend).toHaveLength(1);

    const requestEvents = requestEventsBySend[0].map((item) => item.event);
    expect(requestEvents).toEqual([
      {
        sessionStart: {
          inferenceConfiguration: {
            maxTokens: 1024,
            topP: 0.9,
            temperature: 0.7,
          },
        },
      },
      {
        promptStart: {
          promptName: 'uuid-3',
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
            voiceId: 'tiffany',
          },
        },
      },
      {
        contentStart: {
          promptName: 'uuid-3',
          contentName: 'uuid-4',
          type: 'TEXT',
          interactive: true,
          role: 'SYSTEM',
          textInputConfiguration: {
            mediaType: 'text/plain',
          },
        },
      },
      {
        textInput: {
          promptName: 'uuid-3',
          contentName: 'uuid-4',
          content: 'system prompt',
        },
      },
      {
        contentEnd: {
          promptName: 'uuid-3',
          contentName: 'uuid-4',
        },
      },
      {
        contentStart: {
          promptName: 'uuid-3',
          contentName: 'uuid-5',
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
      {
        audioInput: {
          promptName: 'uuid-3',
          contentName: 'uuid-5',
          content: 'pcm-1',
        },
      },
      {
        audioInput: {
          promptName: 'uuid-3',
          contentName: 'uuid-5',
          content: 'pcm-2',
        },
      },
      {
        contentEnd: {
          promptName: 'uuid-3',
          contentName: 'uuid-5',
        },
      },
      {
        promptEnd: {
          promptName: 'uuid-3',
        },
      },
      {
        sessionEnd: {},
      },
    ]);

    expect(channel.publish.mock.calls).toEqual([
      [
        {
          direction: 'btoc',
          event: 'ready',
          data: undefined,
        },
      ],
      [
        {
          direction: 'btoc',
          event: 'textStart',
          data: {
            id: 'assistant-text-1',
            role: 'assistant',
            generationStage: 'RESPONSE',
          },
        },
      ],
      [
        {
          direction: 'btoc',
          event: 'textOutput',
          data: {
            id: 'assistant-text-1',
            role: 'assistant',
            content: 'hello',
          },
        },
      ],
      [
        {
          direction: 'btoc',
          event: 'audioOutput',
          data: ['audio-out-1', 'audio-out-2'],
        },
      ],
      [
        {
          direction: 'btoc',
          event: 'textStop',
          data: {
            id: 'assistant-text-1',
            role: 'assistant',
            stopReason: 'FINISHED',
          },
        },
      ],
      [
        {
          direction: 'btoc',
          event: 'end',
          data: undefined,
        },
      ],
    ]);
    expect(channel.close).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['empty string', ''],
    ['whitespace', '   '],
    ['truncated json', '{"generationStage":"RESPONSE"'],
    ['huge invalid string', `{"generationStage":"${'x'.repeat(5000)}`],
    ['null', null],
  ])(
    'keeps streaming on malformed additionalModelFields (%s)',
    async (_label: string, additionalModelFields: unknown) => {
      const channel = createChannel();

      mockConnect.mockResolvedValue(channel);
      mockInitBedrockRuntimeClient.mockResolvedValue({
        send: vi.fn(async () => ({
          body: (async function* () {
            yield toStreamChunk({
              event: {
                contentStart: {
                  type: 'TEXT',
                  contentId: 'assistant-text-1',
                  role: 'ASSISTANT',
                  additionalModelFields,
                },
              },
            });
            yield toStreamChunk({
              event: {
                textOutput: {
                  contentId: 'assistant-text-1',
                  role: 'ASSISTANT',
                  content: 'after malformed json',
                },
              },
            });
          })(),
        })),
      });

      const { handler } = await import('../../lambda/speechToSpeechTask');

      await expect(
        handler({ channelId: 'channel-malformed', model })
      ).resolves.toBeUndefined();

      expect(channel.publish).toHaveBeenCalledWith({
        direction: 'btoc',
        event: 'textStart',
        data: {
          id: 'assistant-text-1',
          role: 'assistant',
          generationStage: null,
        },
      });
      expect(channel.publish).toHaveBeenCalledWith({
        direction: 'btoc',
        event: 'textOutput',
        data: {
          id: 'assistant-text-1',
          role: 'assistant',
          content: 'after malformed json',
        },
      });
    }
  );

  test('still emits cleanup when response stream errors', async () => {
    const channel = createChannel();

    mockConnect.mockResolvedValue(channel);
    mockInitBedrockRuntimeClient.mockResolvedValue({
      send: vi.fn(
        async (command: { input: { body: AsyncIterable<unknown> } }) => {
          const handlers = channel.handlers;
          const collectedEventsPromise = collectRequestEvents(
            command.input.body
          );

          if (!handlers) {
            throw new Error('channel handlers were not registered');
          }

          await handlers.next({
            event: { direction: 'ctob', event: 'promptStart' },
          });
          await handlers.next({
            event: { direction: 'ctob', event: 'audioStart' },
          });
          await handlers.next({
            event: { direction: 'ctob', event: 'audioStop' },
          });
          await collectedEventsPromise;

          return {
            body: (async function* () {
              yield toStreamChunk({
                event: {
                  textOutput: {
                    contentId: 'assistant-text-1',
                    role: 'ASSISTANT',
                    content: 'partial',
                  },
                },
              });

              throw new Error('stream exploded');
            })(),
          };
        }
      ),
    });

    const { handler } = await import('../../lambda/speechToSpeechTask');

    await handler({ channelId: 'channel-error', model });

    expect(channel.publish).toHaveBeenNthCalledWith(1, {
      direction: 'btoc',
      event: 'ready',
      data: undefined,
    });
    expect(channel.publish).toHaveBeenNthCalledWith(2, {
      direction: 'btoc',
      event: 'textOutput',
      data: {
        id: 'assistant-text-1',
        role: 'assistant',
        content: 'partial',
      },
    });
    expect(channel.publish).toHaveBeenLastCalledWith({
      direction: 'btoc',
      event: 'end',
      data: undefined,
    });
    expect(channel.close).toHaveBeenCalledTimes(1);
  });

  test('isolates request state across concurrent sessions', async () => {
    const channels = new Map<string, MockChannel>();
    const requestEventsByChannel = new Map<string, BedrockEvent[]>();
    const secondSendStarted = createDeferred<void>();
    let sendIndex = 0;

    mockConnect.mockImplementation(async (path: string) => {
      const channel = createChannel();
      channels.set(path, channel);
      return channel;
    });

    mockInitBedrockRuntimeClient.mockImplementation(async () => {
      const currentSendIndex = sendIndex;
      sendIndex += 1;

      return {
        send: vi.fn(
          async (command: { input: { body: AsyncIterable<unknown> } }) => {
            const channelId =
              currentSendIndex === 0 ? 'channel-one' : 'channel-two';
            const path = `/speech-to-speech/${channelId}`;
            const channel = channels.get(path);

            if (!channel?.handlers) {
              throw new Error(`channel handlers missing for ${channelId}`);
            }

            const collectedEventsPromise = collectRequestEvents(
              command.input.body
            );

            if (currentSendIndex === 0) {
              await secondSendStarted.promise;
            } else {
              secondSendStarted.resolve();
            }

            await channel.handlers.next({
              event: { direction: 'ctob', event: 'promptStart' },
            });
            await channel.handlers.next({
              event: {
                direction: 'ctob',
                event: 'systemPrompt',
                data: `system-${channelId}`,
              },
            });
            await channel.handlers.next({
              event: { direction: 'ctob', event: 'audioStart' },
            });
            await channel.handlers.next({
              event: {
                direction: 'ctob',
                event: 'audioInput',
                data: [`pcm-${channelId}`],
              },
            });
            await sleep(150);
            await channel.handlers.next({
              event: { direction: 'ctob', event: 'audioStop' },
            });

            requestEventsByChannel.set(channelId, await collectedEventsPromise);

            return {
              body: (async function* () {})(),
            };
          }
        ),
      };
    });

    const { handler } = await import('../../lambda/speechToSpeechTask');

    await Promise.all([
      handler({ channelId: 'channel-one', model }),
      handler({ channelId: 'channel-two', model }),
    ]);

    const firstSessionEvents = requestEventsByChannel.get('channel-one');
    const secondSessionEvents = requestEventsByChannel.get('channel-two');

    expect(firstSessionEvents).toBeDefined();
    expect(secondSessionEvents).toBeDefined();

    const firstRequestEvents = firstSessionEvents!.map((item) => item.event);
    const secondRequestEvents = secondSessionEvents!.map((item) => item.event);

    const firstPromptName = (
      firstRequestEvents.find((item) => 'promptStart' in item)?.promptStart as {
        promptName: string;
      }
    ).promptName;
    const secondPromptName = (
      secondRequestEvents.find((item) => 'promptStart' in item)
        ?.promptStart as {
        promptName: string;
      }
    ).promptName;

    expect(firstPromptName).not.toEqual(secondPromptName);
    expect(firstRequestEvents).toEqual(
      expect.arrayContaining([
        {
          promptStart: expect.objectContaining({
            promptName: firstPromptName,
          }),
        },
        {
          textInput: expect.objectContaining({
            promptName: firstPromptName,
            content: 'system-channel-one',
          }),
        },
        {
          audioInput: expect.objectContaining({
            promptName: firstPromptName,
            content: 'pcm-channel-one',
          }),
        },
      ])
    );

    expect(secondRequestEvents).toEqual(
      expect.arrayContaining([
        {
          promptStart: expect.objectContaining({
            promptName: secondPromptName,
          }),
        },
        {
          textInput: expect.objectContaining({
            promptName: secondPromptName,
            content: 'system-channel-two',
          }),
        },
        {
          audioInput: expect.objectContaining({
            promptName: secondPromptName,
            content: 'pcm-channel-two',
          }),
        },
      ])
    );

    expect(
      channels.get('/speech-to-speech/channel-one')?.publish
    ).toHaveBeenCalledWith({
      direction: 'btoc',
      event: 'ready',
      data: undefined,
    });
    expect(
      channels.get('/speech-to-speech/channel-two')?.publish
    ).toHaveBeenCalledWith({
      direction: 'btoc',
      event: 'ready',
      data: undefined,
    });
  });
});
