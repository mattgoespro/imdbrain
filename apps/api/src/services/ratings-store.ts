import type { ImdbRating } from '../types.js'

export class RatingsStore {
  private ratings = new Map<string, ImdbRating>()
  private syncedAt: string | null = null

  ready(): boolean {
    return this.ratings.size > 0
  }

  titleCount(): number {
    return this.ratings.size
  }

  lastSyncedAt(): string | null {
    return this.syncedAt
  }

  replace(ratings: Map<string, ImdbRating>, syncedAt: string): void {
    this.ratings = ratings
    this.syncedAt = syncedAt
  }

  lookup(ids: string[]): Record<string, ImdbRating | null> {
    const ratings: Record<string, ImdbRating | null> = {}
    for (const id of ids) {
      ratings[id] = this.ratings.get(id.toLowerCase()) ?? null
    }
    return ratings
  }
}
