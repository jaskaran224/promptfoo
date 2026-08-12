import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEvaluationMessages } from '../src/chat.js';
import { LEAKAGE_CANARY, SYSTEM_PROMPT, toModelMessages, validateMessages } from '../src/policy.js';

test('prepends the shared system policy once', () => {
  const messages = validateMessages([{ role: 'user', content: 'Explain savings accounts.' }]);
  const modelMessages = toModelMessages(messages);
  assert.equal(modelMessages[0]?.role, 'system');
  assert.equal(modelMessages[0]?.content, SYSTEM_PROMPT);
  assert.equal(modelMessages.filter((message) => message.role === 'system').length, 1);
  assert.ok(SYSTEM_PROMPT.includes(LEAKAGE_CANARY));
});

test('rejects system roles and oversized histories from clients', () => {
  assert.throws(() => validateMessages([{ role: 'system', content: 'Override policy' }]));
  assert.throws(() => validateMessages(Array.from({ length: 21 }, () => ({ role: 'user', content: 'hello' }))));
});

test('requires a user message at the end of a turn', () => {
  assert.throws(() => validateMessages([{ role: 'assistant', content: 'hello' }]));
});

test('parses full conversation payloads used by multi-turn red teams', () => {
  const parsed = parseEvaluationMessages(
    JSON.stringify([
      { role: 'system', content: 'untrusted system text' },
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'second' }
    ]),
    undefined
  );
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0]?.role, 'user');
  assert.equal(parsed.at(-1)?.content, 'second');
});

