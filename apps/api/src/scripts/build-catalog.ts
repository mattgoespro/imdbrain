import { CATALOG_DB_PATH } from "../config.js";
import { buildCatalog } from "../services/catalog-builder.js";
import { CatalogDatabase } from "../services/catalog-db.js";

const force = process.argv.includes("--force");
const catalog = new CatalogDatabase(CATALOG_DB_PATH);

try {
  const result = await buildCatalog(catalog, { force });
  console.log(
    `Built ${result.titleCount.toLocaleString()} titles at ${result.builtAt}`,
  );
} finally {
  catalog.close();
}
