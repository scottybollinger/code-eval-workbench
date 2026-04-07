'use client'

type Props = {
  message: string | null
  onDismiss: () => void
}

export default function ErrorBanner({ message, onDismiss }: Props) {
  if (!message) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span className="mt-0.5 shrink-0 text-red-500">✕</span>
      <p className="flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-red-400 hover:text-red-600"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  )
}
