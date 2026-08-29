import type { JSX } from 'react'
import type { MovieDetails } from '../../../../shared/types'
import CastCard from './cast-card'

export default function CastList({
  cast
}: {
  cast: NonNullable<MovieDetails['cast']>
}): JSX.Element | null {
  if (!cast.length) return null
  return (
    <div className="mt-2 flex gap-2.5 overflow-auto pb-2">
      {cast.slice(0, 8).map((person) => (
        <CastCard key={person.id} person={person} />
      ))}
    </div>
  )
}
