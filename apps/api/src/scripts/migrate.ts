import { CATALOG_DB_PATH } from "../config.js";
import { CatalogDatabase } from "../services/catalog-db.js";

new CatalogDatabase(CATALOG_DB_PATH);
console.log(`Catalog migrations applied: ${CATALOG_DB_PATH}`);
