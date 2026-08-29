import type { JSX } from 'react'
import { cn } from '../../lib/cn'

export default function RatingScale({
  rating,
  onRate
}: {
  rating?: number
  onRate: (n: number) => void
}): JSX.Element {
  return (
    <div className="mb-3.5 flex gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={cn(
            'h-8 flex-1 rounded-lg border p-0 text-xs font-650 transition-[background,color] duration-140',
            rating != null && rating >= n
              ? 'border-accent bg-accent text-accent-ink'
              : 'border-line bg-[rgba(8,8,10,0.4)] text-muted'
          )}
          onClick={() => onRate(n)}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
