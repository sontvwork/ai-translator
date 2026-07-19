// Mocks the Groq/OpenRouter chat-completions endpoints at the network layer.
//
// `plan` is an ordered array of responses; the last entry repeats for any
// extra requests:
//   { text: 'Hello' }                         -> 200 SSE stream ending in [DONE]
//   { status: 429, message: '...', headers }  -> JSON error {error:{message}}
//
// Returns the captured `requests` array (url, authorization, body) so tests
// can assert request count, key rotation, model and prompt content.
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function sseBody(text) {
  // Split into two deltas so tests exercise stream assembly, not just one chunk.
  const mid = Math.ceil(text.length / 2);
  const parts = [text.slice(0, mid), text.slice(mid)].filter(Boolean);
  const events = parts.map(
    (part) => `data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`
  );
  return events.join('') + 'data: [DONE]\n\n';
}

export async function mockProvider(context, plan) {
  const requests = [];

  const handler = async (route, request) => {
    const step = plan[Math.min(requests.length, plan.length - 1)];
    requests.push({
      url: request.url(),
      authorization: request.headers()['authorization'],
      body: request.postDataJSON()
    });

    if (step.text !== undefined) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody(step.text)
      });
    } else {
      await route.fulfill({
        status: step.status,
        headers: step.headers || {},
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: step.message || 'mock error' } })
      });
    }
  };

  await context.route('https://api.groq.com/**', handler);
  await context.route('https://openrouter.ai/**', handler);
  return requests;
}
