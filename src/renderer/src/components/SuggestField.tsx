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
    <label className="field">
      {label}
      <div className="suggest">
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
        />
        {hits.length ? (
          <div className="suggest-list">
            {hits.map((hit) => (
              <button key={hit.id} type="button" onClick={() => add(hit)}>
                {hit.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="chips">
        {values.map((value) => (
          <span className="chip" key={value.id}>
            {value.name}
            <button type="button" onClick={() => onChange(values.filter((v) => v.id !== value.id))}>
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
