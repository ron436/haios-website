// Vercel Serverless Function — proxies requests to Claude API
// Keeps ANTHROPIC_API_KEY server-side only

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { messages, system, action } = req.body;

    // Build the system prompt based on the action
    let systemPrompt = system;

    if (!systemPrompt) {
      if (action === 'chat') {
        systemPrompt = `You are the Haios Sprint Diagnostic assistant. You are helping a prospect understand where AI can create value in their business.

You ask exactly 3 questions in a conversational, consultative tone. You already know their primary goal from the card they selected.

Question flow:
1. "What is your industry and current team size?"
2. Based on their goal and Q1 answer, ask about their specific bottleneck or pain point. Reference their goal naturally. Give 2-3 examples relevant to their industry to help them think concretely.
3. Based on their answers so far, ask about their current experience with AI — are they using any tools, starting from scratch, or have had failed attempts?

Rules:
- Ask ONE question at a time
- Keep questions concise and conversational
- Reference their previous answers naturally
- Do NOT generate a sprint plan — that happens separately
- Do NOT pitch Haios services
- Sound like a smart consultant, not a chatbot`;
      } else if (action === 'sprint') {
        systemPrompt = `You are the Haios Sprint Plan Generator. Based on the diagnostic conversation, generate a structured 14-day sprint plan.

Output EXACTLY this JSON structure (no markdown, no code fences, just raw JSON):
{
  "title": "The [Specific] Sprint",
  "summary": "One sentence explaining why their current approach is costly, referencing their specific situation.",
  "opportunity": "One sentence describing the AI-powered solution, using language specific to their industry and problem.",
  "phases": [
    {
      "label": "Days 1–3",
      "title": "Knowledge Extraction",
      "description": "What we do in this phase, specific to their problem. 1-2 sentences."
    },
    {
      "label": "Days 4–7",
      "title": "[Context-Specific Phase Name]",
      "description": "What we build in this phase, specific to their problem. 1-2 sentences."
    },
    {
      "label": "Days 8–14",
      "title": "[Deployment Phase Name]",
      "description": "What we deploy and measure, specific to their problem. 1-2 sentences."
    }
  ],
  "captured": "What implicit knowledge we capture, specific to their domain. 1-2 sentences referencing turning individual expertise into a company asset.",
  "outcome": "What they have after 14 days. Specific, measurable outcome with a metric like 90%+ accuracy or 80% reduction."
}

Rules:
- Make everything specific to their industry, team size, and stated problem
- Use their own language back to them
- The title should be memorable and descriptive (e.g., "The Support Intelligence & Triage Sprint")
- Phase 1 is always "Knowledge Extraction"
- Always reference the Haios methodology: context before compute
- Sound confident and expert, not salesy`;
      }
    }

    const anthropicBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'API request failed',
        status: response.status
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
