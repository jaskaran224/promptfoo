import { requestCompletion } from './openrouter.js';
import { toModelMessages, validateMessages, type ChatMessage } from './policy.js';

export async function completeChat(input: unknown) {
  const messages = validateMessages(input);
  return requestCompletion(toModelMessages(messages));
}

export function parseEvaluationMessages(prompt: string, candidate: unknown): ChatMessage[] {
  if (Array.isArray(candidate)) {
    return validateMessages(candidate);
  }

  try {
    const parsed = JSON.parse(prompt) as unknown;
    if (Array.isArray(parsed)) {
      const withoutSystem = parsed.filter(
        (message) => !message || typeof message !== 'object' || Reflect.get(message, 'role') !== 'system'
      );
      return validateMessages(withoutSystem);
    }
  } catch {
    // Red-team strategies commonly pass the current user turn as plain text.
  }

  return validateMessages([{ role: 'user', content: prompt }]);
}

