interface ProgressBarProps {
  value: number // 0-100
  label?: string
  className?: string
}

export function ProgressBar({ value, label, className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={`w-full ${className}`}>
      {label && <p className="text-xs text-zinc-400 mb-1">{label}</p>}
      <div className="w-full bg-zinc-700 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
