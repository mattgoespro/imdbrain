import { Router } from 'express'
import type { RatingsStore } from '../services/ratings-store.js'
import type { HealthResponse } from '../types.js'

export function healthRouter(store: RatingsStore): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    const body: HealthResponse = {
      ok: true,
      ready: store.ready(),
      syncedAt: store.lastSyncedAt(),
      titleCount: store.titleCount()
    }
    res.status(store.ready() ? 200 : 503).json(body)
  })

  return router
}
