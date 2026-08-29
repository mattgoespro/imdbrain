import type { JSX } from 'react'
import { AgeCaption } from '../movie-card'

export default function Heading({
  title,
  rating
}: {
  title: string
  rating?: string
}): JSX.Element {
  return (
    <h2 className="mt-0 mb-1.5 text-2xl font-650 tracking-title [text-shadow:0_10px_28px_rgba(0,0,0,0.95),0_2px_8px_rgba(0,0,0,0.8)]">
      {title}
      <AgeCaption rating={rating} />
    </h2>
  )
}
