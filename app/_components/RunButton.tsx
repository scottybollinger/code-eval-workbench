'use client'

type Props = {
  disabled: boolean
  loading: boolean
  onClick: () => void
}

export default function RunButton({ disabled, loading, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors',
        disabled || loading
          ? 'cursor-not-allowed bg-zinc-100 text-zinc-400'
          : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800',
      ].join(' ')}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
      )}
      {loading ? 'Running…' : 'Run Evaluation'}
    </button>
  )
}
