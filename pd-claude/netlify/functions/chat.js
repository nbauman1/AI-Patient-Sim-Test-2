exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  console.log('API key present:', !!ANTHROPIC_API_KEY);
  console.log('API key prefix:', ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.substring(0, 10) : 'none');

  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'API key not configured on server.' })
    };
  }

  const { userMessage, conversationHistory } = JSON.parse(event.body);
  console.log('User message:', userMessage);

  const SYSTEM_PROMPT = `You are a routing assistant for a clinical training simulation. A clinician is taking a history from John Smith, a 68-year-old with early Parkinson's disease.

Classify the clinician's message into exactly one topic key. Respond ONLY with a valid JSON object — no other text, no markdown, no explanation.

TOPIC KEYS:
- early_symptoms: asking about main symptoms, tremor, stiffness, walking, handwriting, daily activities — also includes general opening questions like "what's wrong", "what brings you in", "how can I help", "what seems to be the problem", "what's going on", "what are your symptoms", "what is the problem you're having", "what's been going on"
- early_symptoms_followup: specifically probing facial expression, hypomimia, voice changes, hypophonia, quieter voice, expressiveness
- onset: when symptoms started, how long ago, age at onset, timeline
- onset_followup: asking about earlier symptoms before the tremor, shoulder pain, frozen shoulder, prodromal symptoms, symptoms before the main ones
- progression: how symptoms changed over time, getting worse, sudden changes, falls, disability — includes phrases like "did it come on quickly", "did it appear slowly", "has it gotten worse", "is it progressing", "how fast", "sudden or gradual", "how long has it been getting worse", "rate of progression", "deteriorating", "did your symptoms appear quickly or slowly"
- progression_followup: specifically asking about freezing of gait, freezing episodes, feet stopping, doorways, feet freezing, getting stuck when walking
- family: family history of similar conditions, relatives with tremor or movement disorders
- family_followup: probing further relatives beyond parents, uncles, aunts, extended family, wheelchair use, other relatives
- drugs: current medications, what John takes now — includes any phrasing like "are you taking any medication", "what medication are you on", "any tablets", "any pills", "what do you take", "are you on anything", "any prescriptions", "are you on any meds"
- drugs_followup: specifically asking about past medications, previous drugs, metoclopramide, anti-nausea, reflux, dopamine blockers, historical drug use, medications in the past
- rbd: sleep behaviour, acting out dreams, moving or shouting in sleep, REM sleep disorder — includes phrases like "how do you sleep", "any sleep problems", "sleep issues", "disturbances at night", "restless sleep", "does your partner say anything about your sleep", "any unusual sleep behaviour", "nighttime movements"
- rbd_followup: specifically asking about how long the sleep issues have been happening, duration, timeline of RBD, when it started, how long ago
- neuro: memory, cognition, mood, hallucinations, behaviour, psychiatric symptoms — includes phrases like "how's your mood", "how are you feeling emotionally", "any depression", "feeling low", "mental health", "memory problems", "forgetful", "confused", "seeing things", "hearing things", "mood changes", "anxiety", "feeling sad", "emotional state", "how are you in yourself", "any psychological symptoms"
- neuro_followup: specifically asking about vivid dreams (not acting them out), cognitive slowing, thinking speed, processing speed, slow thinking, dreams that are unusually intense
- autonomic: dizziness, bladder, bowel, constipation, fainting, orthostatic hypotension, erectile dysfunction — includes phrases like "any dizziness", "feel lightheaded", "bladder issues", "toilet problems", "bowel changes", "constipated", "pass out", "faint", "dizzy when standing", "autonomic symptoms", "bodily functions", "sexual function"
- autonomic_followup: specifically asking about fainting episodes, blackouts, losing consciousness, postural syncope, passing out, collapsing, ever fainted
- vague: unclear follow-up with no specific topic — e.g. "tell me more", "go on", "anything else?", "any other problems?", "what else?", "ok", "okay", "cool", "right", "I see", "got it", "interesting", "and?", "yes", "no", "sure", "really?". These are not clinical questions and should never route to a topic.
- fallback: completely off-topic, irrelevant, or nothing to do with medical history or clinical assessment

Important rules:
1. Only route to a _followup key if the clinician is asking something genuinely specific and targeted at that deeper layer of information.
2. If the message is vague, non-specific, or just an acknowledgement, always use "vague" — even if a topic was just discussed.
3. Do NOT let the previous topic in the conversation bias your classification. Each message should be classified on its own meaning. A general question like "what are your symptoms" or "what brings you in" should always route to early_symptoms regardless of what was just discussed.
4. After a vague or fallback exchange, treat the next message generously — if it could plausibly map to any real topic, route it there rather than vague or fallback.
5. Use "fallback" only for truly off-topic messages that have nothing to do with medical history or clinical assessment.
6. When in doubt between vague and a real topic, lean toward the real topic if the message has any clinical intent.

Respond ONLY with: {"topic": "key_here", "feedback": "1-2 sentence clinical commentary on the quality of this question."}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [
          ...conversationHistory.slice(-12),
          { role: 'user', content: userMessage }
        ]
      })
    });

    const data = await res.json();
    console.log('Claude response status:', res.status);
    console.log('Claude response data:', JSON.stringify(data).substring(0, 200));

    if (data.error) {
      console.log('Claude error:', data.error);
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: data.error.message })
      };
    }

    let raw = '';
    let parsed = { topic: 'fallback', feedback: '' };
    try {
      raw = data.content[0].text.trim();
      // Strip markdown code fences if Claude wraps response in them
      raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(raw);
    } catch(e) {
      parsed = { topic: 'fallback', feedback: '' };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(parsed)
    };

  } catch(err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
