import type { JSX } from 'react'

export default function ValueChips<T extends { id: number; name: string }>({
  values,
  onRemove
}: {
  values: T[]
  onRemove: (id: number) => void
}): JSX.Element {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-white/6 py-1 pr-2 pl-2.5 text-xs"
          key={value.id}
        >
          {value.name}
          <button
            type="button"
            className="border-0 bg-transparent px-0.5 text-muted"
            onClick={() => onRemove(value.id)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}
