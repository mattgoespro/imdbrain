import type { JSX } from 'react'

export default function Track({
  fillLeft,
  fillWidth
}: {
  fillLeft: number
  fillWidth: number
}): JSX.Element {
  return (
    <>
      <div className="pointer-events-none absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full bg-track" />
      <div
        className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
        style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
      />
    </>
  )
}
