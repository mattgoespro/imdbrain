import { PORT, SYNC_INTERVAL_MS } from './config.js'
import { createApp } from './app.js'
import { syncDataset } from './services/dataset.js'
import { RatingsStore } from './services/ratings-store.js'

const store = new RatingsStore()
const app = createApp(store)

app.listen(PORT, () => {
  console.log(`IMDb ratings API listening on http://127.0.0.1:${PORT}`)
})

void syncDataset(store).then(
  () => {
    console.log(`Loaded ${store.titleCount()} IMDb ratings (synced ${store.lastSyncedAt()})`)
  },
  (error: unknown) => {
    console.error('Initial IMDb ratings sync failed.', error)
  }
)

setInterval(() => {
  void syncDataset(store).catch((error: unknown) => {
    console.warn('Scheduled IMDb ratings refresh failed.', error)
  })
}, SYNC_INTERVAL_MS).unref()
