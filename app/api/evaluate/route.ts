import { challenges } from '@/lib/challenges'
import { generateCode } from '@/lib/grok'
import { runTestCases } from '@/lib/sandbox'
import type { EvaluateRequest, EvaluationResult } from '@/lib/types'

// POST /api/evaluate
//
// Body:  EvaluateRequest  { challengeId: string }
// Returns: EvaluationResult
//
// Pipeline:
//   1. Validate challengeId
//   2. Call xAI API to generate code for the challenge prompt
//   3. Run the generated code against all test cases in the sandbox
//   4. Return the full EvaluationResult — including generated code, per-test
//      results, timing, and any fatal errors

export async function POST(request: Request): Promise<Response> {
  let body: EvaluateRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { challengeId } = body
  const challenge = challenges.find((c) => c.id === challengeId)

  if (!challenge) {
    return Response.json({ error: `Unknown challenge: "${challengeId}"` }, { status: 400 })
  }

  const startMs = Date.now()

  // Step 1: generate code from the LLM
  let generatedCode: string
  try {
    generatedCode = await generateCode(challenge.prompt)
  } catch (err) {
    const result: EvaluationResult = {
      challengeId,
      generatedCode: '',
      testResults: [],
      totalDurationMs: Date.now() - startMs,
      fatalError: `LLM error: ${err instanceof Error ? err.message : String(err)}`,
    }
    return Response.json(result, { status: 200 })
  }

  // Step 2: run test cases in the sandbox
  try {
    const testResults = await runTestCases(
      generatedCode,
      challenge.functionName,
      challenge.testCases
    )

    const result: EvaluationResult = {
      challengeId,
      generatedCode,
      testResults,
      totalDurationMs: Date.now() - startMs,
    }
    return Response.json(result, { status: 200 })
  } catch (err) {
    const result: EvaluationResult = {
      challengeId,
      generatedCode,
      testResults: [],
      totalDurationMs: Date.now() - startMs,
      fatalError: `Sandbox error: ${err instanceof Error ? err.message : String(err)}`,
    }
    return Response.json(result, { status: 200 })
  }
}
