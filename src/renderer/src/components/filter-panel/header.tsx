import type { JSX } from 'react'
import { btn } from '../../lib/ui'

export default function Header({ onReset }: { onReset: () => void }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="kicker">Filters</h3>
      <button className={btn('ghost')} type="button" onClick={onReset}>
        Reset
      </button>
    </div>
  )
}
