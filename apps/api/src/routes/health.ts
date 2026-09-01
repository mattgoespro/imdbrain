import { Router } from "express";
import type { CatalogDatabase } from "../services/catalog-db.js";
import type { RatingsStore } from "../services/ratings-store.js";
import type { HealthResponse } from "../types.js";

export function healthRouter(store: RatingsStore, catalog: CatalogDatabase): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const meta = catalog.catalogMeta();
    const titleCount = catalog.titleCount();
    const body: HealthResponse = {
      ok: true,
      ready: titleCount > 0,
      syncedAt: store.lastSyncedAt(),
      titleCount,
      ratingsCount: store.titleCount(),
      catalogBuiltAt: meta.builtAt,
      catalogRevision: meta.revision,
    };
    res.status(body.ready ? 200 : 503).json(body);
  });

  return router;
}
