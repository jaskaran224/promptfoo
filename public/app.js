const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const sendButton = document.querySelector('#send-button');
const clearButton = document.querySelector('#clear-button');
const messagesElement = document.querySelector('#messages');
let messages = [];

function renderMessage(role, content) {
  const article = document.createElement('article');
  article.className = `message ${role}`;
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = role === 'assistant' ? 'N' : 'Y';
  const body = document.createElement('div');
  const speaker = document.createElement('span');
  speaker.className = 'speaker';
  speaker.textContent = role === 'assistant' ? 'Assistant' : 'You';
  const text = document.createElement('p');
  text.textContent = content;
  body.append(speaker, text);
  article.append(avatar, body);
  messagesElement.append(article);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const content = input.value.trim();
  if (!content || sendButton.disabled) return;

  messages.push({ role: 'user', content });
  renderMessage('user', content);
  input.value = '';
  sendButton.disabled = true;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    messages.push({ role: 'assistant', content: data.message });
    renderMessage('assistant', data.message);
  } catch (error) {
    messages.pop();
    renderMessage('assistant', error instanceof Error ? error.message : 'The assistant is unavailable.');
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

clearButton.addEventListener('click', () => {
  messages = [];
  messagesElement.replaceChildren();
  renderMessage('assistant', 'Conversation cleared. How can I help with a general banking question?');
  input.focus();
});

