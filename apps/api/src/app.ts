import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/error.js";
import { healthRouter } from "./routes/health.js";
import { ratingsRouter } from "./routes/ratings.js";
import { syncDataset } from "./services/dataset.js";
import type { RatingsStore } from "./services/ratings-store.js";

const localhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function createApp(store: RatingsStore): express.Express {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || localhost.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin not allowed"));
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.use("/health", healthRouter(store));
  app.use("/ratings", ratingsRouter(store));
  app.post("/sync", async (_req, res, next) => {
    try {
      await syncDataset(store, true);
      res.json({
        ok: true,
        ready: store.ready(),
        syncedAt: store.lastSyncedAt(),
        titleCount: store.titleCount(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(errorHandler);
  return app;
}
