import type { ModelMessage } from './policy.js';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_MODEL = 'google/gemma-4-26b-a4b-it';

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export interface CompletionResult {
  output: string;
  model: string;
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
}

export async function requestCompletion(messages: ModelMessage[]): Promise<CompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'Banking Chatbot Promptfoo POC'
    },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 500 }),
    signal: AbortSignal.timeout(45_000)
  });

  const data = (await response.json()) as OpenRouterResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenRouter request failed with ${response.status}`);
  }

  const output = data.choices?.[0]?.message?.content?.trim();
  if (!output) {
    throw new Error('OpenRouter returned an empty response');
  }

  return {
    output,
    model,
    tokenUsage: data.usage
      ? {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens
        }
      : undefined
  };
}

