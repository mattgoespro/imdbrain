import { useState, type JSX } from 'react'
import { cn } from '../lib/cn'

type DualRangeProps = {
  min: number
  max: number
  step: number
  valueMin: number
  valueMax: number
  minLabel?: string
  maxLabel?: string
  onChange: (nextMin: number, nextMax: number) => void
}

const dualInput =
  'pointer-events-none absolute inset-0 m-0 w-full appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--color-accent-soft)] [&::-moz-range-track]:h-1 [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:shadow-[0_0_0_4px_var(--color-accent-soft)]'

export default function DualRange({
  min,
  max,
  step,
  valueMin,
  valueMax,
  minLabel,
  maxLabel,
  onChange
}: DualRangeProps): JSX.Element {
  const [lastMoved, setLastMoved] = useState<'min' | 'max'>('min')
  const span = max - min || 1
  const fillLeft = ((valueMin - min) / span) * 100
  const fillWidth = ((valueMax - valueMin) / span) * 100

  return (
    <div className="relative mt-0.5 mb-1 h-7">
      <div className="pointer-events-none absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full bg-track" />
      <div
        className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
        style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        aria-label={minLabel ?? 'Minimum'}
        className={cn(dualInput, lastMoved === 'min' && 'z-2')}
        onChange={(e) => {
          const next = Number(e.target.value)
          setLastMoved('min')
          onChange(Math.min(next, valueMax), valueMax)
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        aria-label={maxLabel ?? 'Maximum'}
        className={cn(dualInput, lastMoved === 'max' && 'z-2')}
        onChange={(e) => {
          const next = Number(e.target.value)
          setLastMoved('max')
          onChange(valueMin, Math.max(next, valueMin))
        }}
      />
    </div>
  )
}
