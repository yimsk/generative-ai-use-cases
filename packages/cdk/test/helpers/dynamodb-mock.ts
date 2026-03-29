/**
 * Shared DynamoDB mock for repository tests.
 * Intercepts the module-level dynamoDbDocument.send() calls.
 */

const sendMock = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({
      send: sendMock,
    })),
  },
  BatchWriteCommand: jest.fn((args) => args),
  UpdateCommand: jest.fn((args) => ({ ...args, _type: 'UpdateCommand' })),
  QueryCommand: jest.fn((args) => args),
  BatchGetCommand: jest.fn((args) => args),
  DeleteCommand: jest.fn((args) => args),
  PutCommand: jest.fn((args) => args),
  TransactWriteCommand: jest.fn((args) => args),
}));

export { sendMock };
