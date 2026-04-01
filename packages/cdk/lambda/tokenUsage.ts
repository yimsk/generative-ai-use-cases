import { RecordedMessage, TokenUsageStats } from 'generative-ai-use-cases';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const getStatsTableName = () => process.env.STATS_TABLE_NAME!;
const dynamoDb = new DynamoDBClient({});
const dynamoDbDocument = DynamoDBDocumentClient.from(dynamoDb);

const createStatsKey = (dateStr: string, userId: string) => ({
  id: `stats#${dateStr}`,
  userId,
});

const createStatsMetricKey = (prefix: string, value: string) =>
  `${prefix}#${value}`;

const createEmptyTokenUsageStats = (
  date: string,
  userId: string
): TokenUsageStats => ({
  date,
  userId,
  executions: { overall: 0 },
  inputTokens: { overall: 0 },
  outputTokens: { overall: 0 },
  cacheReadInputTokens: { overall: 0 },
  cacheWriteInputTokens: { overall: 0 },
});

const mergeTokenUsageMetric = (
  target: Record<string, number>,
  source?: Record<string, number>
) => {
  if (!source) {
    return;
  }

  Object.entries(source).forEach(([key, value]) => {
    target[key] = (target[key] ?? 0) + value;
  });
};

const mergeTokenUsageStats = (
  target: TokenUsageStats,
  source: TokenUsageStats
) => {
  mergeTokenUsageMetric(target.executions, source.executions);
  mergeTokenUsageMetric(target.inputTokens, source.inputTokens);
  mergeTokenUsageMetric(target.outputTokens, source.outputTokens);
  mergeTokenUsageMetric(
    target.cacheReadInputTokens,
    source.cacheReadInputTokens
  );
  mergeTokenUsageMetric(
    target.cacheWriteInputTokens,
    source.cacheWriteInputTokens
  );
};

export async function updateTokenUsage(
  message: RecordedMessage
): Promise<void> {
  if (!message.metadata?.usage) {
    return;
  }

  const timestamp = message.createdDate.split('#')[0];
  const date = new Date(parseInt(timestamp));
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const userId = message.userId.replace('user#', '');
  const modelId = message.llmType || 'unknown';
  const usecase = message.usecase || 'unknown';
  const usage = message.metadata?.usage || {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheWriteInputTokens: 0,
  };

  try {
    await dynamoDbDocument.send(
      new UpdateCommand({
        TableName: getStatsTableName(),
        Key: createStatsKey(dateStr, userId),
        UpdateExpression: `
          SET
            #date = :date,
            executions.#overall = if_not_exists(executions.#overall, :zero) + :one,
            executions.#modelKey = if_not_exists(executions.#modelKey, :zero) + :one,
            executions.#usecaseKey = if_not_exists(executions.#usecaseKey, :zero) + :one,
            inputTokens.#overall = if_not_exists(inputTokens.#overall, :zero) + :inputTokens,
            inputTokens.#modelKey = if_not_exists(inputTokens.#modelKey, :zero) + :inputTokens,
            inputTokens.#usecaseKey = if_not_exists(inputTokens.#usecaseKey, :zero) + :inputTokens,
            outputTokens.#overall = if_not_exists(outputTokens.#overall, :zero) + :outputTokens,
            outputTokens.#modelKey = if_not_exists(outputTokens.#modelKey, :zero) + :outputTokens,
            outputTokens.#usecaseKey = if_not_exists(outputTokens.#usecaseKey, :zero) + :outputTokens,
            cacheReadInputTokens.#overall = if_not_exists(cacheReadInputTokens.#overall, :zero) + :cacheReadInputTokens,
            cacheReadInputTokens.#modelKey = if_not_exists(cacheReadInputTokens.#modelKey, :zero) + :cacheReadInputTokens,
            cacheReadInputTokens.#usecaseKey = if_not_exists(cacheReadInputTokens.#usecaseKey, :zero) + :cacheReadInputTokens,
            cacheWriteInputTokens.#overall = if_not_exists(cacheWriteInputTokens.#overall, :zero) + :cacheWriteInputTokens,
            cacheWriteInputTokens.#modelKey = if_not_exists(cacheWriteInputTokens.#modelKey, :zero) + :cacheWriteInputTokens,
            cacheWriteInputTokens.#usecaseKey = if_not_exists(cacheWriteInputTokens.#usecaseKey, :zero) + :cacheWriteInputTokens
        `,
        ExpressionAttributeNames: {
          '#date': 'date',
          '#overall': 'overall',
          '#modelKey': createStatsMetricKey('model', modelId),
          '#usecaseKey': createStatsMetricKey('usecase', usecase),
        },
        ExpressionAttributeValues: {
          ':date': dateStr,
          ':zero': 0,
          ':one': 1,
          ':inputTokens': usage.inputTokens || 0,
          ':outputTokens': usage.outputTokens || 0,
          ':cacheReadInputTokens': usage.cacheReadInputTokens || 0,
          ':cacheWriteInputTokens': usage.cacheWriteInputTokens || 0,
        },
      })
    );
  } catch (error) {
    console.error('Error updating token usage:', error);
    throw error;
  }
}

export const aggregateTokenUsage = async (
  startDate: string,
  endDate: string,
  userIds?: string[]
): Promise<TokenUsageStats[]> => {
  const uniqueUserIds = [...new Set(userIds ?? [])].filter(Boolean);
  if (uniqueUserIds.length === 0) {
    throw new Error('userIds is required');
  }

  const aggregateUserId = uniqueUserIds.join(',');

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const statsMap = new Map<string, TokenUsageStats>();

    const keys: ReturnType<typeof createStatsKey>[] = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      statsMap.set(
        dateStr,
        createEmptyTokenUsageStats(dateStr, aggregateUserId)
      );

      uniqueUserIds.forEach((userId) => {
        keys.push(createStatsKey(dateStr, userId));
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const chunkSize = 100;
    const keyChunks: Array<ReturnType<typeof createStatsKey>[]> = [];
    for (let i = 0; i < keys.length; i += chunkSize) {
      keyChunks.push(keys.slice(i, i + chunkSize));
    }

    const batchPromises = keyChunks.map((chunk) =>
      dynamoDbDocument.send(
        new BatchGetCommand({
          RequestItems: {
            [getStatsTableName()]: {
              Keys: chunk,
            },
          },
        })
      )
    );

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach((result) => {
      result.Responses?.[getStatsTableName()]?.forEach((item) => {
        const stats = item as TokenUsageStats;
        if (stats.date) {
          const existingStats = statsMap.get(stats.date);
          if (existingStats) {
            mergeTokenUsageStats(existingStats, stats);
          } else {
            const mergedStats = createEmptyTokenUsageStats(
              stats.date,
              aggregateUserId
            );
            mergeTokenUsageStats(mergedStats, stats);
            statsMap.set(stats.date, mergedStats);
          }
        }
      });
    });

    return Array.from(statsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } catch (error) {
    console.error('Error aggregating token usage:', error);
    throw error;
  }
};
