import type { JSX } from 'react'

export default function Stat({
  label,
  value
}: {
  label: string
  value: string
}): JSX.Element {
  return (
    <div>
      <small className="mb-1 block text-[10px] tracking-[0.12em] text-faint uppercase">{label}</small>
      <b className="tabular text-[22px] tracking-[-0.05em]">{value}</b>
    </div>
  )
}
