import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const STORAGE_ROOT = process.env.STORAGE_ROOT || join(process.cwd(), "storage");

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.\./g, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, _contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const destination = join(STORAGE_ROOT, key);
  await mkdir(join(destination, ".."), { recursive: true });
  await writeFile(destination, data);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGet(relKey: string) {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string) {
  return `/manus-storage/${normalizeKey(relKey)}`;
}
