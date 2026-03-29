import { RecordedMessage, TokenUsageStats } from 'generative-ai-use-cases';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const STATS_TABLE_NAME: string = process.env.STATS_TABLE_NAME!;
const dynamoDb = new DynamoDBClient({});
const dynamoDbDocument = DynamoDBDocumentClient.from(dynamoDb);

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
        TableName: STATS_TABLE_NAME,
        Key: {
          id: `stats#${dateStr}`,
          userId: userId,
        },
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
          '#modelKey': `model#${modelId}`,
          '#usecaseKey': `usecase#${usecase}`,
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
  } catch (updateError) {
    console.log(
      'Record does not exist, creating initial structure:',
      updateError
    );
    try {
      await dynamoDbDocument.send(
        new UpdateCommand({
          TableName: STATS_TABLE_NAME,
          Key: {
            id: `stats#${dateStr}`,
            userId: userId,
          },
          UpdateExpression: `
              SET
                #date = :date,
                executions = :executionsObj,
                inputTokens = :inputTokensObj,
                outputTokens = :outputTokensObj,
                cacheReadInputTokens = :cacheReadInputTokensObj,
                cacheWriteInputTokens = :cacheWriteInputTokensObj
            `,
          ExpressionAttributeNames: {
            '#date': 'date',
          },
          ExpressionAttributeValues: {
            ':date': dateStr,
            ':executionsObj': {
              overall: 1,
              [`model#${modelId}`]: 1,
              [`usecase#${usecase}`]: 1,
            },
            ':inputTokensObj': {
              overall: usage.inputTokens || 0,
              [`model#${modelId}`]: usage.inputTokens || 0,
              [`usecase#${usecase}`]: usage.inputTokens || 0,
            },
            ':outputTokensObj': {
              overall: usage.outputTokens || 0,
              [`model#${modelId}`]: usage.outputTokens || 0,
              [`usecase#${usecase}`]: usage.outputTokens || 0,
            },
            ':cacheReadInputTokensObj': {
              overall: usage.cacheReadInputTokens || 0,
              [`model#${modelId}`]: usage.cacheReadInputTokens || 0,
              [`usecase#${usecase}`]: usage.cacheReadInputTokens || 0,
            },
            ':cacheWriteInputTokensObj': {
              overall: usage.cacheWriteInputTokens || 0,
              [`model#${modelId}`]: usage.cacheWriteInputTokens || 0,
              [`usecase#${usecase}`]: usage.cacheWriteInputTokens || 0,
            },
          },
        })
      );
    } catch (putError) {
      console.error('Error creating token usage:', putError);
    }
  }
}

export const aggregateTokenUsage = async (
  startDate: string,
  endDate: string,
  userIds?: string[]
): Promise<TokenUsageStats[]> => {
  const userId = userIds?.[0];
  if (!userId) {
    throw new Error('userId is required');
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const statsMap = new Map<string, TokenUsageStats>();

    const keys = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      statsMap.set(dateStr, {
        date: dateStr,
        userId,
        executions: { overall: 0 },
        inputTokens: { overall: 0 },
        outputTokens: { overall: 0 },
        cacheReadInputTokens: { overall: 0 },
        cacheWriteInputTokens: { overall: 0 },
      });

      keys.push({
        id: `stats#${dateStr}`,
        userId: userId,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const chunkSize = 100;
    const keyChunks = [];
    for (let i = 0; i < keys.length; i += chunkSize) {
      keyChunks.push(keys.slice(i, i + chunkSize));
    }

    const batchPromises = keyChunks.map((chunk) =>
      dynamoDbDocument.send(
        new BatchGetCommand({
          RequestItems: {
            [STATS_TABLE_NAME]: {
              Keys: chunk,
            },
          },
        })
      )
    );

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach((result) => {
      result.Responses?.[STATS_TABLE_NAME]?.forEach((item) => {
        const stats = item as TokenUsageStats;
        if (stats.date) {
          statsMap.set(stats.date, stats);
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
