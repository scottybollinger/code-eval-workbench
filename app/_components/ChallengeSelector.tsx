'use client'

import type { ChallengeInfo } from '@/lib/types'

type Props = {
  challenges: ChallengeInfo[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function ChallengeSelector({ challenges, selectedId, onSelect }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {challenges.map((c) => {
        const selected = c.id === selectedId
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={[
              'rounded-lg border p-4 text-left transition-colors',
              selected
                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50',
            ].join(' ')}
          >
            <p className={`font-medium ${selected ? 'text-indigo-700' : 'text-zinc-900'}`}>
              {c.title}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{c.failureModeHint}</p>
          </button>
        )
      })}
    </div>
  )
}
