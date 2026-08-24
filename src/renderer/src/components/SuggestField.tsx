import { useEffect, useState, type JSX } from 'react'
import type { KeywordRef, PersonRef } from '../../../shared/types'

export default function SuggestField<T extends { id: number; name: string }>({
  label,
  placeholder,
  values,
  onChange,
  search
}: {
  label: string
  placeholder: string
  values: T[]
  onChange: (values: T[]) => void
  search: (query: string) => Promise<T[]>
}): JSX.Element {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<T[]>([])

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    const handle = window.setTimeout(() => {
      search(query)
        .then(setHits)
        .catch(() => setHits([]))
    }, 220)
    return () => window.clearTimeout(handle)
  }, [query, search])

  function add(item: T): void {
    if (!values.some((v) => v.id === item.id)) onChange([...values, item])
    setQuery('')
    setHits([])
  }

  return (
    <label className="mb-1 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      <div className="relative">
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
        />
        {hits.length ? (
          <div className="absolute top-[calc(100%+0.25rem)] right-0 left-0 z-6 overflow-hidden rounded-app border border-line bg-raised shadow-panel">
            {hits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                className="block w-full border-0 bg-transparent px-2.5 py-2 text-left hover:bg-accent-soft"
                onClick={() => add(hit)}
              >
                {hit.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/6 py-1 pr-2 pl-2.5 text-xs" key={value.id}>
            {value.name}
            <button
              type="button"
              className="border-0 bg-transparent px-0.5 text-muted"
              onClick={() => onChange(values.filter((v) => v.id !== value.id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </label>
  )
}

export function personSearch(query: string): Promise<PersonRef[]> {
  return window.api.searchPeople(query)
}

export function keywordSearch(query: string): Promise<KeywordRef[]> {
  return window.api.searchKeywords(query)
}
