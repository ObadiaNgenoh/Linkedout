import type { Express, Request, Response } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { comments, messages, postReactions, posts, users, verifications } from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { broadcast } from "./realtime";

function fail(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message });
}
function parseTags(tags: unknown) {
  if (Array.isArray(tags)) return tags.filter((tag): tag is string => typeof tag === "string").slice(0, 8);
  return [];
}
function publicUser(user: typeof users.$inferSelect, includeEmail = false) {
  return { id: user.id, name: user.name, username: user.username, email: includeEmail ? user.email : null, profilePhotoUrl: user.profilePhotoUrl, bio: user.bio, createdAt: user.createdAt };
}

export function registerAppApi(app: Express) {
  app.post("/api/users/signup", async (req, res) => {
    const { deviceId, name, username, email, bio } = req.body ?? {};
    if (!deviceId || !name || !username || !email) return fail(res, 400, "name, username, email and deviceId are required");
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const normalizedUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (normalizedUsername.length < 3) return fail(res, 400, "username must be at least 3 characters");
    const usernameMatch = await db.select().from(users).where(eq(users.username, normalizedUsername)).limit(1);
    if (usernameMatch.length && usernameMatch[0].openId !== String(deviceId)) return fail(res, 409, "That username is already taken");
    const existing = await db.select().from(users).where(eq(users.openId, String(deviceId))).limit(1);
    if (existing.length) {
      await db.update(users).set({ name: String(name).trim(), username: normalizedUsername, email: String(email).trim().toLowerCase(), bio: bio ? String(bio).slice(0, 500) : null, lastSignedIn: new Date() }).where(eq(users.id, existing[0].id));
    } else {
      await db.insert(users).values({ openId: String(deviceId), name: String(name).trim(), username: normalizedUsername, email: String(email).trim().toLowerCase(), bio: bio ? String(bio).slice(0, 500) : null, loginMethod: "email-no-verification" });
    }
    const result = await db.select().from(users).where(eq(users.openId, String(deviceId))).limit(1);
    return res.json({ user: publicUser(result[0], true) });
  });

  app.get("/api/users/:id", async (req, res) => {
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const result = await db.select().from(users).where(eq(users.id, Number(req.params.id))).limit(1);
    if (!result.length) return fail(res, 404, "User not found");
    return res.json({ user: publicUser(result[0], true) });
  });

  app.get("/api/users", async (_req, res) => {
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const result = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
    return res.json({ users: result.map((user) => publicUser(user, false)) });
  });

  app.put("/api/users/:id", async (req, res) => {
    const { name, username, bio } = req.body ?? {};
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const update: Record<string, string | null> = {};
    if (typeof name === "string") update.name = name.trim().slice(0, 120);
    if (typeof username === "string") update.username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (typeof bio === "string") update.bio = bio.slice(0, 500);
    if (Object.keys(update).length) await db.update(users).set(update).where(eq(users.id, Number(req.params.id)));
    const result = await db.select().from(users).where(eq(users.id, Number(req.params.id))).limit(1);
    return res.json({ user: publicUser(result[0], true) });
  });

  app.post("/api/users/:id/profile-photo", async (req, res) => {
    const { dataUri, contentType } = req.body ?? {};
    if (typeof dataUri !== "string" || !dataUri.startsWith("data:")) return fail(res, 400, "A base64 data URI is required");
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return fail(res, 400, "Invalid image data");
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 5 * 1024 * 1024) return fail(res, 413, "Profile photo must be under 5MB");
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const uploaded = await storagePut(`profiles/${req.params.id}/avatar`, buffer, String(contentType || match[1]));
    await db.update(users).set({ profilePhotoUrl: uploaded.url }).where(eq(users.id, Number(req.params.id)));
    return res.json({ profilePhotoUrl: uploaded.url });
  });

  app.post("/api/verifications", async (req, res) => {
    const { userId, company, proofType } = req.body ?? {};
    if (!userId || !company || !proofType) return fail(res, 400, "userId, company and proofType are required");
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    await db.insert(verifications).values({ userId: Number(userId), company: String(company).trim(), proofType: String(proofType), status: "approved" });
    return res.json({ verified: true, status: "approved" });
  });

  app.get("/api/feed", async (_req, res) => {
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const rows = await db.select().from(posts).orderBy(desc(posts.createdAt)).limit(50);
    if (!rows.length) return res.json({ posts: [] });
    const authorIds = [...new Set(rows.map((row) => row.authorId))];
    const authorRows = await db.select().from(users).where(inArray(users.id, authorIds));
    const authorMap = new Map(authorRows.map((user) => [user.id, publicUser(user)]));
    const postIds = rows.map((row) => row.id);
    const reactionRows = await db.select().from(postReactions).where(inArray(postReactions.postId, postIds));
    const commentRows = await db.select().from(comments).where(inArray(comments.postId, postIds));
    return res.json({ posts: rows.map((row) => ({ ...row, tags: row.tags ? JSON.parse(row.tags) : [], author: authorMap.get(row.authorId), reactions: reactionRows.filter((reaction) => reaction.postId === row.id).length, comments: commentRows.filter((comment) => comment.postId === row.id).length })) });
  });

  app.post("/api/posts", async (req, res) => {
    const { authorId, company, role, duration, reason, tags } = req.body ?? {};
    if (!authorId || !company || !reason) return fail(res, 400, "authorId, company and reason are required");
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const verified = await db.select().from(verifications).where(and(eq(verifications.userId, Number(authorId)), eq(verifications.company, String(company).trim()), eq(verifications.status, "approved"))).limit(1);
    if (!verified.length) return fail(res, 403, "Verify that you worked at this company before posting about it");
    const insert = await db.insert(posts).values({ authorId: Number(authorId), company: String(company).trim().slice(0, 160), role: role ? String(role).slice(0, 160) : null, duration: duration ? String(duration).slice(0, 64) : null, reason: String(reason).slice(0, 300), tags: JSON.stringify(parseTags(tags)) });
    const postId = Number(insert[0].insertId);
    const row = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    broadcast({ type: "feed:new", payload: { post: row[0] } });
    return res.status(201).json({ post: row[0] });
  });

  app.post("/api/posts/:id/reactions", async (req, res) => {
    const { userId } = req.body ?? {};
    if (!userId) return fail(res, 400, "userId is required");
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    await db.insert(postReactions).values({ postId: Number(req.params.id), userId: Number(userId) }).onDuplicateKeyUpdate({ set: { userId: Number(userId) } });
    broadcast({ type: "feed:reaction", payload: { postId: Number(req.params.id), userId: Number(userId) } });
    return res.json({ ok: true });
  });

  app.post("/api/posts/:id/comments", async (req, res) => {
    const { authorId, body } = req.body ?? {};
    if (!authorId || !body) return fail(res, 400, "authorId and body are required");
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const insert = await db.insert(comments).values({ postId: Number(req.params.id), authorId: Number(authorId), body: String(body).slice(0, 600) });
    broadcast({ type: "feed:comment", payload: { postId: Number(req.params.id), commentId: Number(insert[0].insertId) } });
    return res.status(201).json({ ok: true });
  });

  app.get("/api/messages", async (req, res) => {
    const userId = Number(req.query.userId);
    if (!userId) return fail(res, 400, "userId is required");
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const rows = await db.select().from(messages).where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId))).orderBy(desc(messages.createdAt)).limit(100);
    return res.json({ messages: rows });
  });

  app.post("/api/messages", async (req, res) => {
    const { senderId, recipientId, body } = req.body ?? {};
    if (!senderId || !recipientId || !body) return fail(res, 400, "senderId, recipientId and body are required");
    const db = await getDb();
    if (!db) return fail(res, 503, "Database is not available");
    const insert = await db.insert(messages).values({ senderId: Number(senderId), recipientId: Number(recipientId), body: String(body).slice(0, 2000) });
    const messageId = Number(insert[0].insertId);
    const row = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    broadcast({ type: "message:new", payload: { message: row[0] } });
    return res.status(201).json({ message: row[0] });
  });
}
