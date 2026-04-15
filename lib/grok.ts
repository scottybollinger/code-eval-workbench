// Server-only module — never import this from a client component.
//
// Calls the xAI (Grok) chat completions API using its OpenAI-compatible
// interface.  Reads XAI_API_KEY from the environment; the key is never
// included in any client-facing bundle or response.
//
// generateCode strips markdown code fences from the response so the raw
// JavaScript string can be passed directly to the sandbox.

const XAI_BASE_URL = 'https://api.x.ai/v1'

const SYSTEM_PROMPT =
  'You are a coding assistant. Write clean, correct JavaScript. ' +
  'Respond with only the raw JavaScript code — no markdown fences, ' +
  'no prose, no explanations.'

export async function generateCode(prompt: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set')
  }

  const model = process.env.GROK_MODEL
  if (!model) {
    throw new Error('GROK_MODEL environment variable is not set')
  }

  const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`xAI API error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const raw: string = data.choices[0].message.content

  return stripCodeFences(raw)
}

// Strip ```js / ```javascript / ``` fences that the model may emit despite
// being asked not to.
function stripCodeFences(code: string): string {
  return code
    .replace(/^```(?:javascript|js|typescript|ts)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
}
