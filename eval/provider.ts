import type { ApiProvider, CallApiContextParams, ProviderOptions, ProviderResponse } from 'promptfoo';
import { parseEvaluationMessages } from '../src/chat.js';
import { requestCompletion } from '../src/openrouter.js';
import { toModelMessages } from '../src/policy.js';

export default class BankingChatProvider implements ApiProvider {
  private readonly providerId: string;

  constructor(options: ProviderOptions) {
    this.providerId = options.id || 'northstar-banking-chatbot';
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt: string, context?: CallApiContextParams): Promise<ProviderResponse> {
    try {
      const messages = parseEvaluationMessages(prompt, context?.vars?.messages);
      const result = await requestCompletion(toModelMessages(messages));
      return { output: result.output, tokenUsage: result.tokenUsage, metadata: { model: result.model } };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Evaluation provider failed' };
    }
  }
}

