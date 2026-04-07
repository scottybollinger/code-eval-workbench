// Shared TypeScript types used across API routes and UI components.

import type { Challenge, TestCase } from './challenges'

export type { Challenge, TestCase }

// Result for a single test case after sandbox execution
export type TestResult = {
  testCase: TestCase
  passed: boolean
  // Actual return value from the executed code (JSON-serializable)
  actual: unknown
  // Wall-clock time in milliseconds for this individual test
  durationMs: number
  // stderr or thrown error message from the sandbox, if any
  error?: string
}

// Full result returned by POST /api/evaluate
export type EvaluationResult = {
  challengeId: string
  // Raw code string returned by the LLM (may include attempted markdown)
  generatedCode: string
  testResults: TestResult[]
  // Total wall-clock time: LLM call start → last test finish
  totalDurationMs: number
  // Set when the evaluation could not run at all (e.g. LLM API failure)
  fatalError?: string
}

// Request body for POST /api/evaluate
export type EvaluateRequest = {
  challengeId: string
}

// Lightweight challenge info returned by GET /api/challenges (no test case internals)
export type ChallengeInfo = {
  id: string
  title: string
  failureModeHint: string
}
