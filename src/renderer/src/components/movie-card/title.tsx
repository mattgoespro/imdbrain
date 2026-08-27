import type { JSX } from 'react'
import AgeCaption from './age-caption'

export default function Title({
  title,
  rating
}: {
  title: string
  rating?: string
}): JSX.Element {
  return (
    <h4 className="mt-0 mb-1.5 text-[15px] font-650 tracking-tightish">
      {title}
      <AgeCaption rating={rating} />
    </h4>
  )
}
