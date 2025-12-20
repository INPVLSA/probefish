import { http, HttpResponse } from 'msw';
import { openAIResponses, anthropicResponses } from '@/__fixtures__/llmResponses';

export const handlers = [
  // OpenAI Chat Completions API
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json(openAIResponses.simple);
  }),

  // Anthropic Messages API
  http.post('https://api.anthropic.com/v1/messages', () => {
    return HttpResponse.json(anthropicResponses.simple);
  }),

  // Generic endpoint for testing HTTP endpoint execution
  http.get('https://api.example.com/test', () => {
    return HttpResponse.json({ result: 'success', message: 'Test endpoint response' });
  }),

  http.post('https://api.example.com/test', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      result: 'success',
      received: body,
    });
  }),

  // Error scenario handlers
  http.post('https://api.openai.com/v1/chat/completions/error', () => {
    return HttpResponse.json(openAIResponses.error, { status: 429 });
  }),

  http.get('https://api.example.com/error', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),

  http.get('https://api.example.com/timeout', async () => {
    // Simulate a slow response
    await new Promise((resolve) => setTimeout(resolve, 100));
    return HttpResponse.json({ result: 'delayed' });
  }),
];

// Handler for OpenAI judge scoring
export const judgeHandlers = [
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const body = (await request.json()) as { messages?: Array<{ content: string }> };
    const messages = body.messages || [];
    const lastMessage = messages[messages.length - 1]?.content || '';

    // Return different responses based on the prompt content
    if (lastMessage.includes('score') || lastMessage.includes('evaluate')) {
      return HttpResponse.json(openAIResponses.judgeScore);
    }

    return HttpResponse.json(openAIResponses.simple);
  }),
];
