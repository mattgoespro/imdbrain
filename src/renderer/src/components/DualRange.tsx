import { useState, type JSX } from 'react'

export default function DualRange({
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChange
}: {
  min: number
  max: number
  step: number
  valueMin: number
  valueMax: number
  onChange: (nextMin: number, nextMax: number) => void
}): JSX.Element {
  const [lastMoved, setLastMoved] = useState<'min' | 'max'>('min')
  const span = max - min || 1
  const fillLeft = ((valueMin - min) / span) * 100
  const fillWidth = ((valueMax - valueMin) / span) * 100

  return (
    <div className="dual-range">
      <div className="dual-range-track" />
      <div className="dual-range-fill" style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        aria-label="Minimum runtime"
        className={lastMoved === 'min' ? 'is-top' : ''}
        onChange={(e) => {
          const next = Number(e.target.value)
          setLastMoved('min')
          onChange(Math.min(next, valueMax - step), valueMax)
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        aria-label="Maximum runtime"
        className={lastMoved === 'max' ? 'is-top' : ''}
        onChange={(e) => {
          const next = Number(e.target.value)
          setLastMoved('max')
          onChange(valueMin, Math.max(next, valueMin + step))
        }}
      />
    </div>
  )
}
