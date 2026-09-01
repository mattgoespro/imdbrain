import { CATALOG_DB_PATH } from "../config.js";
import { CatalogDatabase } from "../services/catalog-db.js";
import { enrichPosters } from "../services/tmdb-posters.js";

const catalog = new CatalogDatabase(CATALOG_DB_PATH);

try {
  const result = await enrichPosters(catalog);
  console.log(
    `Poster lookup finished: ${result.found} found, ${result.missing} without artwork, ${result.errors} errors`,
  );
} finally {
  catalog.close();
}
