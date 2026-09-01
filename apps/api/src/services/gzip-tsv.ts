import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { SYNC_INTERVAL_MS } from "../config.js";

export function isStale(file: string, maxAgeMs = SYNC_INTERVAL_MS): boolean {
  return Date.now() - statSync(file).mtimeMs >= maxAgeMs;
}

export async function ensureGzipFile(
  url: string,
  file: string,
  force = false,
): Promise<string> {
  mkdirSync(dirname(file), { recursive: true });
  if (!force && existsSync(file) && !isStale(file)) return file;
  await downloadGzip(url, file);
  return file;
}

export async function downloadGzip(url: string, file: string): Promise<void> {
  const response = await fetch(url, {
    headers: { Accept: "application/gzip" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url} (${response.status})`);
  }

  const tmp = `${file}.${process.pid}.tmp`;
  try {
    await pipeline(
      Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      ),
      createWriteStream(tmp),
    );
    await rename(tmp, file);
  } catch (error) {
    if (existsSync(tmp)) await unlink(tmp).catch(() => undefined);
    throw error;
  }
}

export async function* readTsvRows(file: string): AsyncGenerator<string[]> {
  const lines = createInterface({
    input: createReadStream(file).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  let header = true;
  for await (const line of lines) {
    if (header) {
      header = false;
      continue;
    }
    if (!line) continue;
    yield line.split("\t");
  }
}

export function imdbValue(value: string | undefined): string | null {
  if (value == null || value === "" || value === "\\N") return null;
  return value;
}
