'use client'

import { useEffect, useState } from 'react'
import ChallengeSelector from './_components/ChallengeSelector'
import RunButton from './_components/RunButton'
import ResultsPanel from './_components/ResultsPanel'
import ErrorBanner from './_components/ErrorBanner'
import type { ChallengeInfo, EvaluationResult } from '@/lib/types'

export default function Home() {
  const [challenges, setChallenges] = useState<ChallengeInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/challenges')
      .then((r) => r.json())
      .then(setChallenges)
      .catch(() => setError('Failed to load challenges'))
  }, [])

  async function handleRun() {
    if (!selectedId) return
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: selectedId }),
      })
      const data: EvaluationResult = await res.json()

      if (data.fatalError) {
        setError(data.fatalError)
        // Still show generated code if we have it
        if (data.generatedCode) setResult(data)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">code-eval-workbench</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Evaluates Grok&rsquo;s solutions to coding challenges against predefined test cases in a
          sandboxed environment.
        </p>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Challenge selection */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Select a Challenge
        </h2>
        <ChallengeSelector
          challenges={challenges}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setResult(null)
            setError(null)
          }}
        />
      </section>

      {/* Run */}
      <RunButton
        disabled={!selectedId}
        loading={loading}
        onClick={handleRun}
      />

      {/* Results */}
      <ResultsPanel result={result} />
    </main>
  )
}
