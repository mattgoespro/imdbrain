import { Router } from 'express'
import { z } from 'zod'
import { MAX_RATING_IDS } from '../config.js'
import type { RatingsStore } from '../services/ratings-store.js'
import type { RatingsResponse } from '../types.js'

const ratingsBody = z.object({
  ids: z
    .array(z.string().regex(/^tt\d+$/i, 'Must be an IMDb title id'))
    .max(MAX_RATING_IDS)
})

export function ratingsRouter(store: RatingsStore): Router {
  const router = Router()

  router.post('/', (req, res) => {
    if (!store.ready()) {
      res.status(503).json({ error: 'Ratings dataset is not ready yet.' })
      return
    }

    const { ids } = ratingsBody.parse(req.body)
    const body: RatingsResponse = {
      syncedAt: store.lastSyncedAt(),
      ratings: store.lookup(ids)
    }
    res.json(body)
  })

  return router
}
