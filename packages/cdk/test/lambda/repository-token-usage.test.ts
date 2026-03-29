import { sendMock } from '../helpers/dynamodb-mock';

process.env.TABLE_NAME = 'test-table';
process.env.STATS_TABLE_NAME = 'test-stats-table';

import {
  batchCreateMessages,
  aggregateTokenUsage,
} from '../../lambda/repository';
import { ToBeRecordedMessage } from 'generative-ai-use-cases';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('aggregateTokenUsage characterization', () => {
  test('throws when userIds is undefined', async () => {
    await expect(
      aggregateTokenUsage('2024-01-01', '2024-01-02')
    ).rejects.toThrow('userId is required');
  });

  test('throws when userIds is empty array', async () => {
    await expect(
      aggregateTokenUsage('2024-01-01', '2024-01-02', [])
    ).rejects.toThrow('userId is required');
  });

  test('returns initialized stats for date range when no data exists', async () => {
    sendMock.mockResolvedValue({
      Responses: { 'test-stats-table': [] },
    });

    const result = await aggregateTokenUsage('2024-01-01', '2024-01-03', [
      'userA',
    ]);

    expect(result).toHaveLength(3);
    expect(result[0].date).toBe('2024-01-01');
    expect(result[1].date).toBe('2024-01-02');
    expect(result[2].date).toBe('2024-01-03');
    result.forEach((stat) => {
      expect(stat.executions.overall).toBe(0);
      expect(stat.inputTokens.overall).toBe(0);
      expect(stat.outputTokens.overall).toBe(0);
      expect(stat.cacheReadInputTokens.overall).toBe(0);
      expect(stat.cacheWriteInputTokens.overall).toBe(0);
    });
  });

  test('merges existing stats from DynamoDB into initialized map', async () => {
    sendMock.mockResolvedValue({
      Responses: {
        'test-stats-table': [
          {
            id: 'stats#2024-01-02',
            userId: 'userA',
            date: '2024-01-02',
            executions: { overall: 5, 'model#claude': 3 },
            inputTokens: { overall: 100 },
            outputTokens: { overall: 200 },
            cacheReadInputTokens: { overall: 10 },
            cacheWriteInputTokens: { overall: 20 },
          },
        ],
      },
    });

    const result = await aggregateTokenUsage('2024-01-01', '2024-01-03', [
      'userA',
    ]);

    expect(result[0].executions.overall).toBe(0);
    expect(result[1].executions.overall).toBe(5);
    expect(result[1].executions['model#claude']).toBe(3);
    expect(result[2].executions.overall).toBe(0);
  });

  test('re-throws on DynamoDB error', async () => {
    sendMock.mockRejectedValue(new Error('DynamoDB down'));

    await expect(
      aggregateTokenUsage('2024-01-01', '2024-01-02', ['userA'])
    ).rejects.toThrow('DynamoDB down');
  });
});

describe('batchCreateMessages token usage characterization', () => {
  test('messages without metadata.usage complete with single BatchWrite', async () => {
    sendMock.mockResolvedValue({});

    const messages: ToBeRecordedMessage[] = [
      { messageId: 'm1', role: 'user', content: 'hello', usecase: 'chat' },
    ];

    const result = await batchCreateMessages(messages, 'user1', 'chat1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('chat#chat1');
    expect(result[0].userId).toBe('user#user1');
    expect(result[0].feedback).toBe('none');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  test('messages with metadata.usage trigger stats update (UpdateCommand)', async () => {
    sendMock.mockResolvedValue({});

    const messages: ToBeRecordedMessage[] = [
      {
        messageId: 'm1',
        role: 'assistant',
        content: 'response',
        usecase: 'chat',
        llmType: 'claude-v3',
        metadata: {
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
        },
      },
    ];

    const result = await batchCreateMessages(messages, 'user1', 'chat1');

    expect(result).toHaveLength(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  test('token usage update failure falls back to create and is non-blocking', async () => {
    let callCount = 0;
    sendMock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({});
      }
      if (callCount === 2) {
        return Promise.reject(new Error('ValidationException'));
      }
      return Promise.resolve({});
    });

    const messages: ToBeRecordedMessage[] = [
      {
        messageId: 'm1',
        role: 'assistant',
        content: 'response',
        usecase: 'chat',
        llmType: 'claude-v3',
        metadata: {
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
        },
      },
    ];

    const result = await batchCreateMessages(messages, 'user1', 'chat1');

    expect(result).toHaveLength(1);
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test('both update phases failing is still non-blocking', async () => {
    let callCount = 0;
    sendMock.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({});
      return Promise.reject(new Error('both phases fail'));
    });

    const messages: ToBeRecordedMessage[] = [
      {
        messageId: 'm1',
        role: 'assistant',
        content: 'response',
        usecase: 'chat',
        llmType: 'claude-v3',
        metadata: {
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
        },
      },
    ];

    const result = await batchCreateMessages(messages, 'user1', 'chat1');

    expect(result).toHaveLength(1);
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  test('multiple messages with usage trigger parallel updates', async () => {
    sendMock.mockResolvedValue({});

    const messages: ToBeRecordedMessage[] = [
      {
        messageId: 'm1',
        role: 'user',
        content: 'hello',
        usecase: 'chat',
        metadata: {
          usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
        },
      },
      {
        messageId: 'm2',
        role: 'assistant',
        content: 'hi',
        usecase: 'chat',
        llmType: 'claude',
        metadata: {
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      },
    ];

    const result = await batchCreateMessages(messages, 'user1', 'chat1');

    expect(result).toHaveLength(2);
    expect(sendMock).toHaveBeenCalledTimes(3);
  });
});
