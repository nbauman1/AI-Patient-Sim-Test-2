export function GET() {
  return new Response('chat endpoint is live', { status: 200 });
}

export async function POST(request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return Response.json({ error: 'Missing message' }, { status: 400 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 300,
        system: 'You are simulating a patient for a medical training demo. Stay in character. Answer naturally. Do not mention being an AI.',
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data?.error?.message || 'Anthropic request failed' },
        { status: response.status }
      );
    }

    const reply =
      data?.content?.map(part => part.text).filter(Boolean).join('\n') ||
      'No response returned.';

    return Response.json({ reply });
  } catch (err) {
    return Response.json(
      { error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}
