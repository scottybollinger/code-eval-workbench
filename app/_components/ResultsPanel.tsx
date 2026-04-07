'use client'

import type { EvaluationResult } from '@/lib/types'

type Props = {
  result: EvaluationResult | null
}

export default function ResultsPanel({ result }: Props) {
  if (!result) return null

  const { generatedCode, testResults, totalDurationMs, fatalError } = result

  const passCount = testResults.filter((r) => r.passed).length
  const total = testResults.length

  return (
    <div className="space-y-6">
      {/* Generated code */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Generated Code
        </h2>
        <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-950 p-4 text-sm text-zinc-100 font-mono leading-relaxed">
          {generatedCode || <span className="text-zinc-500 italic">No code generated</span>}
        </pre>
      </section>

      {/* Fatal error (LLM or sandbox failure before any tests ran) */}
      {fatalError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Fatal error: </span>
          {fatalError}
        </div>
      )}

      {/* Test results */}
      {testResults.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Test Results
            </h2>
            <span className={`text-sm font-semibold ${passCount === total ? 'text-emerald-600' : 'text-red-600'}`}>
              {passCount}/{total} passed &middot; {totalDurationMs}ms total
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200">
            {testResults.map((r, i) => (
              <div
                key={i}
                className={[
                  'border-b border-zinc-100 px-4 py-3 last:border-b-0',
                  r.passed ? 'bg-white' : 'bg-red-50',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold ${r.passed ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {r.passed ? '✓ PASS' : '✗ FAIL'}
                    </span>
                    <span className="text-sm text-zinc-700">{r.testCase.description}</span>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">{r.durationMs}ms</span>
                </div>

                {/* Failure detail */}
                {!r.passed && (
                  <div className="mt-2 space-y-1 pl-10 text-xs font-mono">
                    <div>
                      <span className="text-zinc-400">expected </span>
                      <span className="text-emerald-700">
                        {JSON.stringify(r.testCase.expected)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400">received </span>
                      <span className="text-red-700">
                        {r.error ? (
                          <span className="font-sans not-italic text-red-600">{r.error}</span>
                        ) : (
                          JSON.stringify(r.actual)
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
