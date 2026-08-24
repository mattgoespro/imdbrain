import type { JSX } from 'react'

export default function CatalogLoader({ label }: { label: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-[13px] text-muted">
      <div
        className="size-7 animate-catalog rounded-full border-2 border-accent/18 border-t-accent shadow-[0_0_18px_rgba(255,122,60,0.22)]"
        aria-hidden="true"
      />
      <p className="m-0">{label}</p>
    </div>
  )
}
