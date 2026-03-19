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

    // 1. HARD SHORTCUTS — exact matches bypassing the model entirely
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

    // 2. AI CLASSIFICATION
    const SYSTEM_PROMPT = `
You are a classifier for a Parkinson's disease clinical history-taking simulation.
A clinician is interviewing a patient named John. Classify the clinician's message into exactly one topic.

Return ONLY valid JSON with no explanation, no markdown, no preamble:
{"topic":"key"}

TOPICS AND WHAT THEY COVER:
- early_symptoms: tremor, slowness, stiffness, rigidity, general opening questions about what's wrong or what brought the patient in
- early_symptoms_followup: facial expression (masked facies), quiet or soft voice, hypophonia
- onset: when symptoms first started, age at onset, how long ago it began, first noticing something was wrong
- onset_followup: symptoms that came before the tremor (e.g. shoulder stiffness, smell changes, constipation before motor symptoms)
- progression: how symptoms have changed or worsened over time, whether it's gradual or sudden
- progression_followup: freezing of gait, festination, getting stuck when walking or in doorways
- family: family history of Parkinson's, tremor, or neurological disease in parents or siblings
- family_followup: extended family — grandparents, aunts, uncles, cousins
- drugs: current medications, what the patient is currently taking
- drugs_followup: past medications, previous use of dopamine blockers, metoclopramide, antipsychotics, anti-sickness drugs
- rbd: sleep behaviour — acting out dreams, moving or shouting during sleep, REM sleep behaviour disorder
- rbd_followup: how long sleep issues have been present, duration of RBD symptoms
- neuro: mood (depression, anxiety), memory, cognitive changes, hallucinations
- neuro_followup: vivid dreams, slowed thinking, mild cognitive impairment
- autonomic: dizziness on standing, constipation, urinary symptoms, bowel or bladder issues
- autonomic_followup: fainting, syncope, near-blackouts
- vague: no clinical intent — acknowledgements, affirmations, filler words only
- fallback: genuinely unrelated to Parkinson's history-taking (e.g. asking about the weather, unrelated medical topics)

CLASSIFICATION RULES:
- LEAN TOWARD A MATCH. Only use fallback if the message has no plausible connection to any topic above.
- fallback should be rare. If there is any reasonable clinical interpretation, choose that topic instead.
- vague is only for messages with zero clinical content (e.g. "sure", "thanks", "interesting").
- Indirect, colloquial, or imperfect phrasing should still be matched — clinicians don't always ask textbook questions.

EXAMPLES OF TRICKY CASES THAT SHOULD MATCH (not fallback):
- "Has anything changed since this all started?" → progression
- "Any issues sleeping?" → rbd
- "Do you have relatives with similar problems?" → family
- "Are you on anything at the moment?" → drugs
- "Have you noticed anything with your balance or walking?" → progression_followup
- "Any bowel changes?" → autonomic
- "How's your mood been?" → neuro
- "Did anyone else in the family ever have a tremor?" → family
- "Was there anything before the shaking started?" → onset_followup
- "Any dizziness when you stand up?" → autonomic
- "Do you ever feel faint?" → autonomic_followup
- "Has your handwriting changed?" → early_symptoms
- "Any issues with your sense of smell?" → onset_followup
- "Do you take any regular tablets?" → drugs

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
        max_tokens: 50,
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
