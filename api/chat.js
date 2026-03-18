export async function GET() {
  return new Response('chat endpoint is live', { status: 200 });
}

export async function POST(request) {
  try {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'API key not configured on server.' },
        { status: 500 }
      );
    }

    const { userMessage } = await request.json();

    const text = userMessage.toLowerCase().trim();

    // 🔥 1. HARD SHORTCUTS (cheapest + most reliable)
    if (
      text === "hi" ||
      text === "hello" ||
      text === "hey" ||
      text === "good morning" ||
      text === "good afternoon" ||
      text === "how are you" ||
      text === "how are you feeling"
    ) {
      return Response.json({ topic: "early_symptoms" });
    }

    if (
      text === "ok" ||
      text === "okay" ||
      text === "cool" ||
      text === "right" ||
      text === "i see" ||
      text === "got it"
    ) {
      return Response.json({ topic: "vague" });
    }

    // 🧠 2. COMPRESSED + MORE GENEROUS PROMPT
    const SYSTEM_PROMPT = `
You classify clinician questions about a Parkinson’s patient.

Return ONLY JSON:
{"topic":"key"}

Topics:
- early_symptoms: symptoms OR general opening questions (what’s wrong, how are you feeling, what brings you in, what’s going on)
- early_symptoms_followup: facial expression, quiet voice
- onset: when symptoms started
- onset_followup: earlier symptoms before tremor
- progression: worsening over time
- progression_followup: freezing of gait
- family: family history
- family_followup: extended relatives
- drugs: current meds
- drugs_followup: past meds, dopamine blockers
- rbd: sleep behavior
- rbd_followup: duration of sleep issues
- neuro: mood, memory, hallucinations
- neuro_followup: vivid dreams, slow thinking
- autonomic: dizziness, bowel, bladder
- autonomic_followup: fainting
- vague: filler (ok, sure, etc)
- fallback: unrelated

Rules:
- Be GENEROUS: if it could be a real topic, choose it
- Prefer early_symptoms for broad or unclear clinical questions
- Only use vague if it has no clinical intent
- Ignore prior context

Respond ONLY with:
{"topic":"key"}
`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50, // 🔥 smaller output
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userMessage }
        ]
      })
    });

    const data = await res.json();

    if (data.error) {
      return Response.json(
        { error: data.error.message || 'Anthropic request failed' },
        { status: 500 }
      );
    }

    let parsed = { topic: 'fallback' };

    try {
      let raw = data.content[0].text.trim();
      raw = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = { topic: 'fallback' };
    }

    return Response.json(parsed);

  } catch (err) {
    return Response.json(
      { error: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
