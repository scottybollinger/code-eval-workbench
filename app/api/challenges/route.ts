import { challenges } from '@/lib/challenges'
import type { ChallengeInfo } from '@/lib/types'

// GET /api/challenges
//
// Returns the public-facing challenge list: id, title, and failure mode hint.
// Test case internals (args, expected values) are intentionally omitted so
// they cannot be leaked to the client or to the LLM via the browser.

export async function GET(): Promise<Response> {
  const info: ChallengeInfo[] = challenges.map(({ id, title, failureModeHint }) => ({
    id,
    title,
    failureModeHint,
  }))

  return Response.json(info)
}
