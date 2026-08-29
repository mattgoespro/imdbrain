import type { JSX, ReactNode } from 'react'

export default function Field({
  label,
  children
}: {
  label: ReactNode
  children: ReactNode
}): JSX.Element {
  return (
    <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  )
}
