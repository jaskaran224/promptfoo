import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { completeChat } from './chat.js';
import type { ChatMessage } from './policy.js';

const terminal = createInterface({ input: stdin, output: stdout });
const messages: ChatMessage[] = [];

console.log('Northstar Bank demo assistant. Type /exit to quit or /clear to reset.');

while (true) {
  const input = (await terminal.question('\nYou: ')).trim();
  if (input === '/exit') break;
  if (input === '/clear') {
    messages.length = 0;
    console.log('Conversation cleared.');
    continue;
  }
  if (!input) continue;

  messages.push({ role: 'user', content: input });
  try {
    const result = await completeChat(messages);
    console.log(`Assistant: ${result.output}`);
    messages.push({ role: 'assistant', content: result.output });
  } catch (error) {
    messages.pop();
    console.error(error instanceof Error ? error.message : 'Unexpected error');
  }
}

terminal.close();

