import type { Express } from "express";
import { createReadStream } from "node:fs";
import { join } from "node:path";

const STORAGE_ROOT = process.env.STORAGE_ROOT || join(process.cwd(), "storage");

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) return res.status(400).send("Missing storage key");
    const safeKey = key.replace(/\.\./g, "");
    const file = join(STORAGE_ROOT, safeKey);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    createReadStream(file).on("error", () => res.status(404).end()).pipe(res);
  });
}
