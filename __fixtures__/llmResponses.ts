export const openAIResponses = {
  simple: {
    choices: [
      {
        message: { content: 'This is a test response.' },
        finish_reason: 'stop',
      },
    ],
    model: 'gpt-4o-mini',
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  },
  judgeScore: {
    choices: [
      {
        message: {
          content: JSON.stringify({
            scores: {
              accuracy: { score: 8, reason: 'Good accuracy' },
              relevance: { score: 9, reason: 'Highly relevant' },
              clarity: { score: 7, reason: 'Generally clear' },
            },
            overall_reasoning: 'Good overall performance',
          }),
        },
        finish_reason: 'stop',
      },
    ],
    model: 'gpt-4o-mini',
    usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
  },
  judgeValidation: {
    choices: [
      {
        message: {
          content: JSON.stringify({
            passed: true,
            reason: 'The response meets all the validation criteria.',
          }),
        },
        finish_reason: 'stop',
      },
    ],
    model: 'gpt-4o-mini',
    usage: { prompt_tokens: 40, completion_tokens: 30, total_tokens: 70 },
  },
  error: {
    error: {
      message: 'Rate limit exceeded',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded',
    },
  },
};

export const anthropicResponses = {
  simple: {
    content: [{ type: 'text', text: 'This is an Anthropic response.' }],
    model: 'claude-3-5-haiku-latest',
    usage: { input_tokens: 10, output_tokens: 20 },
    stop_reason: 'end_turn',
  },
  judgeScore: {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          scores: {
            accuracy: { score: 9, reason: 'Excellent accuracy' },
            relevance: { score: 8, reason: 'Very relevant' },
          },
          overall_reasoning: 'High quality response',
        }),
      },
    ],
    model: 'claude-3-5-haiku-latest',
    usage: { input_tokens: 60, output_tokens: 80 },
    stop_reason: 'end_turn',
  },
};

export const endpointResponses = {
  success: {
    status: 200,
    data: { result: 'success', message: 'Operation completed' },
    headers: { 'content-type': 'application/json' },
    responseTime: 150,
  },
  error: {
    status: 500,
    data: { error: 'Internal server error' },
    headers: { 'content-type': 'application/json' },
    responseTime: 50,
  },
  timeout: {
    status: 408,
    data: null,
    headers: {},
    responseTime: 30000,
  },
};
