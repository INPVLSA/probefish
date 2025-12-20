import mongoose from 'mongoose';

export const testSuiteIds = {
  prompt: new mongoose.Types.ObjectId(),
  endpoint: new mongoose.Types.ObjectId(),
};

export const testProjectId = new mongoose.Types.ObjectId();
export const testPromptId = new mongoose.Types.ObjectId();
export const testEndpointId = new mongoose.Types.ObjectId();

export const testValidationRules = {
  contains: { type: 'contains' as const, value: 'expected text', severity: 'fail' as const },
  excludes: { type: 'excludes' as const, value: 'forbidden word', severity: 'fail' as const },
  minLength: { type: 'minLength' as const, value: 10, severity: 'fail' as const },
  maxLength: { type: 'maxLength' as const, value: 500, severity: 'warning' as const },
  regex: { type: 'regex' as const, value: '^[A-Z]', severity: 'fail' as const },
  jsonSchema: {
    type: 'jsonSchema' as const,
    value: JSON.stringify({
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' } },
    }),
    severity: 'fail' as const,
  },
  maxResponseTime: { type: 'maxResponseTime' as const, value: 5000, severity: 'warning' as const },
};

export const testJudgeConfig = {
  enabled: true,
  model: 'gpt-4o-mini',
  scoringCriteria: [
    { name: 'accuracy', description: 'How accurate is the response?', weight: 0.4 },
    { name: 'relevance', description: 'How relevant is the response?', weight: 0.3 },
    { name: 'clarity', description: 'How clear is the response?', weight: 0.3 },
  ],
  validationRules: [
    {
      criteria: 'accuracy',
      operator: 'gte' as const,
      threshold: 7,
      severity: 'fail' as const,
    },
  ],
};

export const testCases = [
  {
    name: 'Basic test case',
    inputs: { question: 'What is 2+2?', context: 'Math' },
    expectedOutput: '4',
    notes: 'Simple arithmetic test',
  },
  {
    name: 'Complex test case',
    inputs: { question: 'Explain gravity', context: 'Physics' },
    expectedOutput: 'Gravity is a force...',
    notes: 'Science explanation test',
  },
];

export const testSuites = {
  prompt: {
    _id: testSuiteIds.prompt,
    projectId: testProjectId,
    name: 'Prompt Test Suite',
    description: 'Test suite for prompt testing',
    targetType: 'prompt' as const,
    targetId: testPromptId,
    targetVersion: 1,
    testCases: testCases,
    validationRules: [testValidationRules.contains, testValidationRules.minLength],
    judgeConfig: testJudgeConfig,
    lastRunAt: null,
    lastRunStatus: null,
    runHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  endpoint: {
    _id: testSuiteIds.endpoint,
    projectId: testProjectId,
    name: 'Endpoint Test Suite',
    description: 'Test suite for endpoint testing',
    targetType: 'endpoint' as const,
    targetId: testEndpointId,
    targetVersion: null,
    testCases: testCases,
    validationRules: [testValidationRules.maxResponseTime],
    judgeConfig: null,
    lastRunAt: null,
    lastRunStatus: null,
    runHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};
