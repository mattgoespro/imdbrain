export interface ImdbRating {
  rating: number;
  votes: number;
}

export interface HealthResponse {
  ok: boolean;
  ready: boolean;
  syncedAt: string | null;
  titleCount: number;
}

export interface RatingsResponse {
  syncedAt: string | null;
  ratings: Record<string, ImdbRating | null>;
}
