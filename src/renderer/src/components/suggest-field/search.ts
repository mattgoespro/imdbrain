import type { KeywordRef, PersonRef } from '../../../../shared/types'

export function personSearch(query: string): Promise<PersonRef[]> {
  return window.api.searchPeople(query)
}

export function keywordSearch(query: string): Promise<KeywordRef[]> {
  return window.api.searchKeywords(query)
}
