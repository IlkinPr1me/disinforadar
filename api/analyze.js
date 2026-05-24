export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, lang } = req.body;
  if (!text || text.trim().length < 10) {
    return res.status(400).json({ error: "Text too short" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: "Server misconfigured: missing API key" });
  }

  const LANG_INSTRUCTION = {
    en: "Respond with ALL text fields in English.",
    ru: "Respond with ALL text fields in Russian (all values in the JSON must be in Russian).",
    ka: "Respond with ALL text fields in Georgian language (all values in the JSON must be in Georgian).",
  };

  const langInstruction = LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.en;

  const SYSTEM_PROMPT = `You are an expert analyst specializing in disinformation, information warfare, and geopolitical narratives, with deep knowledge of Georgia (the country), the South Caucasus region, Russian hybrid warfare tactics, and Euro-Atlantic integration issues.

Analyze the provided text for disinformation indicators. Respond ONLY with a valid JSON object, no markdown, no extra text.

IMPORTANT LANGUAGE RULE: ${langInstruction}

Return this exact structure:
{
  "riskScore": <number 0-100>,
  "riskLevel": "<low|medium|high|critical>",
  "narrativeType": "<string>",
  "probableSource": "<string>",
  "indicators": ["<indicator 1>", "<indicator 2>", "<indicator 3>"],
  "recommendation": "<string>",
  "summary": "<2-3 sentence analysis summary>"
}

Note: riskLevel must always be one of: low, medium, high, critical (in English, regardless of language).

Scoring:
- 0-25: Low risk, likely neutral or factual
- 26-50: Medium risk, some bias or unverified claims
- 51-75: High risk, clear disinformation tactics
- 76-100: Critical, coordinated information operation

Focus on: emotional manipulation, false balance, absence of sources, anti-EU/NATO framing, pro-Russian narratives, internal destabilization attempts.`;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze this text for disinformation:\n\n${text}` },
        ],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return res.status(502).json({ error: "Groq API error", detail: err });
    }

    const data = await groqRes.json();
    const raw = data.choices[0].message.content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: "Analysis failed", detail: e.message });
  }
}
