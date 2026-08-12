import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { completeChat } from './chat.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDirectory = path.resolve('public');

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(publicDirectory));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/chat', async (request, response) => {
  try {
    const result = await completeChat(request.body?.messages);
    response.json({ message: result.output, model: result.model });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const isInputError = message.startsWith('message') || message.startsWith('the final');
    response.status(isInputError ? 400 : 502).json({
      error: isInputError ? message : 'The model service is unavailable. Please try again.'
    });
  }
});

app.listen(port, () => {
  console.log(`Banking chatbot listening on http://localhost:${port}`);
});

