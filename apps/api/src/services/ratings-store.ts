import type { ImdbRating } from "../types.js";
import type { CatalogDatabase } from "./catalog-db.js";

export class RatingsStore {
  private ratings = new Map<string, ImdbRating>();
  private syncedAt: string | null = null;

  constructor(private readonly catalog?: CatalogDatabase) {}

  ready(): boolean {
    return this.ratings.size > 0;
  }

  titleCount(): number {
    return this.ratings.size;
  }

  lastSyncedAt(): string | null {
    return this.syncedAt;
  }

  replace(ratings: Map<string, ImdbRating>, syncedAt: string): void {
    this.ratings = ratings;
    this.syncedAt = syncedAt;
    this.catalog?.upsertRatings(ratings);
  }

  lookup(ids: string[]): Record<string, ImdbRating | null> {
    const ratings: Record<string, ImdbRating | null> = {};
    for (const id of ids) {
      ratings[id] = this.ratings.get(id.toLowerCase()) ?? null;
    }
    return ratings;
  }

  forIds(ids: string[]): Map<string, ImdbRating> {
    const matched = new Map<string, ImdbRating>();
    for (const id of ids) {
      const rating = this.ratings.get(id.toLowerCase());
      if (rating) matched.set(id.toLowerCase(), rating);
    }
    return matched;
  }
}
