import type { Express, Response } from "express";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { comments, emailChallenges, follows, messages, notifications, postReactions, postViews, posts, reposts, sessions, users, verifications } from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { broadcast } from "./realtime";
import { ENV } from "./_core/env";

function fail(res: Response, status: number, message: string) { return res.status(status).json({ error: message }); }
function parseTags(tags: unknown) { return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string").slice(0, 12) : []; }
function publicUser(user: typeof users.$inferSelect, includeEmail = false, stats?: { followers: number; following: number; linked: boolean }) {
  return { id: user.id, name: user.name, username: user.username, email: includeEmail ? user.email : null, profilePhotoUrl: user.profilePhotoUrl, bio: user.bio, createdAt: user.createdAt, followers: stats?.followers ?? 0, following: stats?.following ?? 0, linked: stats?.linked ?? false };
}
function mediaFromDataUri(dataUri: unknown) {
  if (typeof dataUri !== "string" || !dataUri.startsWith("data:")) return null;
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  return { mime: match[1], buffer };
}
function normalizeEmail(value: unknown) { return String(value || "").trim().toLowerCase(); }
function hashValue(value: string) { return createHash("sha256").update(value).digest("hex"); }
function authToken() { return randomBytes(32).toString("base64url"); }
async function sendVerificationEmail(email: string, code: string, purpose: "signup" | "login") {
  if (!ENV.resendApiKey || !ENV.resendFromEmail) throw new Error("Email delivery is not configured");
  const action = purpose === "signup" ? "finish creating your LinkedOut account" : "sign in to LinkedOut";
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${ENV.resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: ENV.resendFromEmail, to: [email], subject: `${code} is your LinkedOut verification code`, text: `Use ${code} to ${action}. This code expires in 10 minutes. If you did not request it, you can ignore this email.`, html: `<div style="font-family:Arial,Helvetica,sans-serif;background:#f7f2e8;padding:32px;color:#141414"><div style="max-width:520px;margin:auto;background:#fffdf8;border:1px solid #ded5c8;border-radius:16px;padding:28px"><p style="letter-spacing:2px;font-weight:800;color:#f05a47">LINKEDOUT</p><h1 style="font-size:28px">Your verification code</h1><p>Use this code to ${action}:</p><p style="font-size:36px;letter-spacing:8px;font-weight:900;margin:24px 0">${code}</p><p style="color:#766f67">It expires in 10 minutes. If you did not request it, you can ignore this email.</p></div></div>` }) });
  if (!response.ok) throw new Error("Resend could not deliver the verification email");
}
async function notify(db: Awaited<ReturnType<typeof getDb>>, recipientId: number, actorId: number, type: "link" | "reaction" | "comment" | "repost" | "message", message: string, postId?: number) {
  if (!db || recipientId === actorId) return;
  await db.insert(notifications).values({ recipientId, actorId, type, message, postId: postId ?? null });
  broadcast({ type: "signal:new", payload: { recipientId, actorId, kind: type, postId } });
}
async function userStats(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, viewerId?: number) {
  const [followers, following, linked] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(follows).where(eq(follows.followingId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(follows).where(eq(follows.followerId, userId)),
    viewerId ? db.select().from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followingId, userId))).limit(1) : Promise.resolve([]),
  ]);
  return { followers: Number(followers[0]?.count || 0), following: Number(following[0]?.count || 0), linked: Boolean(linked.length) };
}

export function registerAppApi(app: Express) {
  app.post("/api/auth/request-code", async (req, res) => {
    const { email, name, username, deviceId, purpose = "signup" } = req.body ?? {};
    const normalizedEmail = normalizeEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return fail(res, 400, "A valid email address is required");
    if (purpose !== "signup" && purpose !== "login") return fail(res, 400, "Invalid authentication purpose");
    if (purpose === "signup" && (!String(name || "").trim() || !String(username || "").trim())) return fail(res, 400, "Name and username are required for signup");
    const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (purpose === "login" && !existing.length) return fail(res, 404, "No LinkedOut account exists for that email");
    const normalizedUsername = String(username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (purpose === "signup" && normalizedUsername.length < 3) return fail(res, 400, "Username must be at least 3 characters");
    if (purpose === "signup") { const usernameMatch = await db.select().from(users).where(eq(users.username, normalizedUsername)).limit(1); if (usernameMatch.length && usernameMatch[0].email !== normalizedEmail) return fail(res, 409, "That username is already taken"); }
    const code = String(randomInt(100000, 1000000));
    await db.delete(emailChallenges).where(eq(emailChallenges.email, normalizedEmail));
    await db.insert(emailChallenges).values({ email: normalizedEmail, codeHash: hashValue(code), purpose, name: name ? String(name).trim().slice(0, 120) : null, username: normalizedUsername || existing[0]?.username || null, deviceId: deviceId ? String(deviceId).slice(0, 128) : null, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
    try { await sendVerificationEmail(normalizedEmail, code, purpose); } catch (error) { await db.delete(emailChallenges).where(eq(emailChallenges.email, normalizedEmail)); return fail(res, 503, error instanceof Error ? error.message : "Email delivery is unavailable"); }
    return res.json({ ok: true, expiresInSeconds: 600 });
  });

  app.post("/api/auth/verify-code", async (req, res) => {
    const { email, code } = req.body ?? {}; const normalizedEmail = normalizeEmail(email); const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    const challengeRows = await db.select().from(emailChallenges).where(eq(emailChallenges.email, normalizedEmail)).orderBy(desc(emailChallenges.createdAt)).limit(1); const challenge = challengeRows[0];
    if (!challenge || challenge.expiresAt.getTime() < Date.now()) return fail(res, 400, "That code has expired. Request a new one.");
    if (challenge.attempts >= 5) return fail(res, 429, "Too many attempts. Request a new code.");
    if (hashValue(String(code || "").trim()) !== challenge.codeHash) { await db.update(emailChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(emailChallenges.id, challenge.id)); return fail(res, 400, "That verification code is incorrect"); }
    await db.delete(emailChallenges).where(eq(emailChallenges.id, challenge.id));
    let userRows = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1); let user = userRows[0];
    if (!user) { const openId = `email:${normalizedEmail}`; await db.insert(users).values({ openId, name: challenge.name || normalizedEmail.split("@")[0], username: challenge.username || `member_${randomInt(1000, 9999)}`, email: normalizedEmail, loginMethod: "email-code", lastSignedIn: new Date() }); user = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0]; }
    else await db.update(users).set({ lastSignedIn: new Date(), ...(challenge.name ? { name: challenge.name } : {}), ...(challenge.username ? { username: challenge.username } : {}) }).where(eq(users.id, user.id));
    const token = authToken(); await db.insert(sessions).values({ userId: user.id, tokenHash: hashValue(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    return res.json({ user: publicUser(user, true, await userStats(db, user.id)), sessionToken: token, expiresInSeconds: 30 * 24 * 60 * 60, verified: true });
  });

  app.post("/api/users/signup", async (req, res) => {
    const { deviceId, name, username, email, bio } = req.body ?? {};
    if (!deviceId || !name || !username || !email) return fail(res, 400, "name, username, email and deviceId are required");
    const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    const normalizedUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (normalizedUsername.length < 3) return fail(res, 400, "username must be at least 3 characters");
    const usernameMatch = await db.select().from(users).where(eq(users.username, normalizedUsername)).limit(1);
    if (usernameMatch.length && usernameMatch[0].openId !== String(deviceId)) return fail(res, 409, "That username is already taken");
    const existing = await db.select().from(users).where(eq(users.openId, String(deviceId))).limit(1);
    if (existing.length) await db.update(users).set({ name: String(name).trim(), username: normalizedUsername, email: String(email).trim().toLowerCase(), bio: bio ? String(bio).slice(0, 500) : null, lastSignedIn: new Date() }).where(eq(users.id, existing[0].id));
    else await db.insert(users).values({ openId: String(deviceId), name: String(name).trim(), username: normalizedUsername, email: String(email).trim().toLowerCase(), bio: bio ? String(bio).slice(0, 500) : null, loginMethod: "email-no-verification" });
    const result = await db.select().from(users).where(eq(users.openId, String(deviceId))).limit(1);
    return res.json({ user: publicUser(result[0], true, await userStats(db, result[0].id)) });
  });

  app.get("/api/users/:id", async (req, res) => {
    const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    const result = await db.select().from(users).where(eq(users.id, Number(req.params.id))).limit(1);
    if (!result.length) return fail(res, 404, "User not found");
    return res.json({ user: publicUser(result[0], true, await userStats(db, result[0].id, Number(req.query.viewerId) || undefined)) });
  });

  app.get("/api/users", async (req, res) => {
    const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    const result = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
    const viewerId = Number(req.query.viewerId) || undefined;
    return res.json({ users: await Promise.all(result.map(async (user) => publicUser(user, false, await userStats(db, user.id, viewerId)))) });
  });

  app.put("/api/users/:id", async (req, res) => {
    const { name, username, bio } = req.body ?? {}; const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    const update: Record<string, string | null> = {};
    if (typeof name === "string") update.name = name.trim().slice(0, 120);
    if (typeof username === "string") update.username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    if (typeof bio === "string") update.bio = bio.slice(0, 500);
    if (Object.keys(update).length) await db.update(users).set(update).where(eq(users.id, Number(req.params.id)));
    const result = await db.select().from(users).where(eq(users.id, Number(req.params.id))).limit(1);
    return res.json({ user: publicUser(result[0], true, await userStats(db, result[0].id)) });
  });

  app.post("/api/users/:id/profile-photo", async (req, res) => {
    const parsed = mediaFromDataUri(req.body?.dataUri); if (!parsed || !parsed.mime.startsWith("image/")) return fail(res, 400, "A base64 image data URI is required");
    if (parsed.buffer.length > 8 * 1024 * 1024) return fail(res, 413, "Image must be under 8MB");
    const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    const uploaded = await storagePut(`profiles/${req.params.id}/avatar`, parsed.buffer, parsed.mime);
    await db.update(users).set({ profilePhotoUrl: uploaded.url }).where(eq(users.id, Number(req.params.id)));
    return res.json({ profilePhotoUrl: uploaded.url });
  });

  app.post("/api/verifications", async (req, res) => {
    const { userId, company, proofType } = req.body ?? {}; if (!userId || !company || !proofType) return fail(res, 400, "userId, company and proofType are required");
    const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    await db.insert(verifications).values({ userId: Number(userId), company: String(company).trim(), proofType: String(proofType), status: "approved" });
    return res.json({ verified: true, status: "approved" });
  });

  app.get("/api/feed", async (req, res) => {
    const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    const rows = await db.select().from(posts).orderBy(desc(posts.createdAt)).limit(50); if (!rows.length) return res.json({ posts: [] });
    const viewerId = Number(req.query.viewerId) || 0;
    if (viewerId) for (const row of rows) { try { await db.insert(postViews).values({ postId: row.id, userId: viewerId }); await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, row.id)); } catch {} }
    const authorIds = [...new Set(rows.map((row) => row.authorId))]; const authorRows = await db.select().from(users).where(inArray(users.id, authorIds)); const authorMap = new Map(authorRows.map((user) => [user.id, publicUser(user)]));
    const postIds = rows.map((row) => row.id); const reactionRows = await db.select().from(postReactions).where(inArray(postReactions.postId, postIds)); const commentRows = await db.select().from(comments).where(inArray(comments.postId, postIds)); const repostRows = await db.select().from(reposts).where(inArray(reposts.postId, postIds));
    return res.json({ posts: rows.map((row) => ({ ...row, tags: row.tags ? JSON.parse(row.tags) : [], content: row.content || row.reason, author: authorMap.get(row.authorId), reactions: reactionRows.filter((r) => r.postId === row.id).length, comments: commentRows.filter((c) => c.postId === row.id).length, reposts: repostRows.filter((r) => r.postId === row.id).length, liked: viewerId ? reactionRows.some((r) => r.postId === row.id && r.userId === viewerId) : false, reposted: viewerId ? repostRows.some((r) => r.postId === row.id && r.userId === viewerId) : false })) });
  });

  app.post("/api/posts", async (req, res) => {
    const { authorId, company = "The Wire", role, duration, reason, content, tags, postType = "text", mediaDataUri } = req.body ?? {};
    if (!authorId || (!reason && !content)) return fail(res, 400, "authorId and post content are required");
    const db = await getDb(); if (!db) return fail(res, 503, "Database is not available");
    const companyName = String(company).trim().slice(0, 160); const isCompanyStory = companyName !== "The Wire";
    if (isCompanyStory) { const verified = await db.select().from(verifications).where(and(eq(verifications.userId, Number(authorId)), eq(verifications.company, companyName), eq(verifications.status, "approved"))).limit(1); if (!verified.length) return fail(res, 403, "Verify that you worked at this company before posting about it"); }
    let mediaUrl: string | null = null; let mediaType: string | null = null;
    if (mediaDataUri) { const parsed = mediaFromDataUri(mediaDataUri); if (!parsed || !["image/", "video/"].some((prefix) => parsed.mime.startsWith(prefix))) return fail(res, 400, "Only image or video media is supported"); if (parsed.buffer.length > (parsed.mime.startsWith("video/") ? 50 : 8) * 1024 * 1024) return fail(res, 413, "Media exceeds the upload limit"); const uploaded = await storagePut(`posts/${authorId}/media`, parsed.buffer, parsed.mime); mediaUrl = uploaded.url; mediaType = parsed.mime; }
    const normalizedType = mediaType?.startsWith("video/") ? "video" : mediaType ? "photo" : isCompanyStory ? "exit" : "text";
    const body = String(content || reason).slice(0, 5000); const insert = await db.insert(posts).values({ authorId: Number(authorId), company: companyName, role: role ? String(role).slice(0, 160) : null, duration: duration ? String(duration).slice(0, 64) : null, reason: body.slice(0, 300), content: body, postType: normalizedType, mediaUrl, mediaType, tags: JSON.stringify(parseTags(tags)) });
    const postId = Number(insert[0].insertId); const row = await db.select().from(posts).where(eq(posts.id, postId)).limit(1); broadcast({ type: "out:new", payload: { post: row[0] } }); return res.status(201).json({ post: row[0] });
  });

  app.post("/api/posts/:id/reactions", async (req, res) => {
    const { userId } = req.body ?? {}; if (!userId) return fail(res, 400, "userId is required"); const db = await getDb(); if (!db) return fail(res, 503, "Database is not available"); const postId = Number(req.params.id); const existing = await db.select().from(postReactions).where(and(eq(postReactions.postId, postId), eq(postReactions.userId, Number(userId)))).limit(1); const post = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    if (existing.length) await db.delete(postReactions).where(eq(postReactions.id, existing[0].id)); else { await db.insert(postReactions).values({ postId, userId: Number(userId) }); if (post[0]) await notify(db, post[0].authorId, Number(userId), "reaction", "Someone said same-here to your out.", postId); }
    broadcast({ type: "out:reaction", payload: { postId, userId: Number(userId), liked: !existing.length } }); return res.json({ liked: !existing.length });
  });

  app.get("/api/posts/:id/comments", async (req, res) => { const db = await getDb(); if (!db) return fail(res, 503, "Database is not available"); const rows = await db.select().from(comments).where(eq(comments.postId, Number(req.params.id))).orderBy(desc(comments.createdAt)).limit(100); const ids = [...new Set(rows.map((row) => row.authorId))]; const people = ids.length ? await db.select().from(users).where(inArray(users.id, ids)) : []; const map = new Map(people.map((person) => [person.id, publicUser(person)])); return res.json({ comments: rows.map((row) => ({ ...row, author: map.get(row.authorId) })) }); });
  app.post("/api/posts/:id/comments", async (req, res) => { const { authorId, body } = req.body ?? {}; if (!authorId || !body) return fail(res, 400, "authorId and body are required"); const db = await getDb(); if (!db) return fail(res, 503, "Database is not available"); const postId = Number(req.params.id); const insert = await db.insert(comments).values({ postId, authorId: Number(authorId), body: String(body).slice(0, 600) }); const post = await db.select().from(posts).where(eq(posts.id, postId)).limit(1); if (post[0]) await notify(db, post[0].authorId, Number(authorId), "comment", "Someone commented on your out.", postId); broadcast({ type: "out:comment", payload: { postId, commentId: Number(insert[0].insertId) } }); return res.status(201).json({ ok: true }); });

  app.post("/api/users/:id/follow", async (req, res) => { const followerId = Number(req.body?.followerId); const followingId = Number(req.params.id); if (!followerId || !followingId || followerId === followingId) return fail(res, 400, "A member cannot link to themselves"); const db = await getDb(); if (!db) return fail(res, 503, "Database is not available"); const existing = await db.select().from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))).limit(1); if (existing.length) await db.delete(follows).where(eq(follows.id, existing[0].id)); else { await db.insert(follows).values({ followerId, followingId }); await notify(db, followingId, followerId, "link", "You have a new LinkedOut link."); } broadcast({ type: "link:changed", payload: { followerId, followingId, linked: !existing.length } }); return res.json({ linked: !existing.length }); });

  app.post("/api/posts/:id/repost", async (req, res) => { const userId = Number(req.body?.userId); const postId = Number(req.params.id); if (!userId) return fail(res, 400, "userId is required"); const db = await getDb(); if (!db) return fail(res, 503, "Database is not available"); const existing = await db.select().from(reposts).where(and(eq(reposts.postId, postId), eq(reposts.userId, userId))).limit(1); if (existing.length) await db.delete(reposts).where(eq(reposts.id, existing[0].id)); else { await db.insert(reposts).values({ postId, userId }); const original = await db.select().from(posts).where(eq(posts.id, postId)).limit(1); if (original[0]) await notify(db, original[0].authorId, userId, "repost", "Someone passed on your out.", postId); } broadcast({ type: "out:repost", payload: { postId, userId, reposted: !existing.length } }); return res.json({ reposted: !existing.length }); });

  app.get("/api/notifications", async (req, res) => { const userId = Number(req.query.userId); if (!userId) return fail(res, 400, "userId is required"); const db = await getDb(); if (!db) return fail(res, 503, "Database is not available"); const rows = await db.select().from(notifications).where(eq(notifications.recipientId, userId)).orderBy(desc(notifications.createdAt)).limit(100); return res.json({ notifications: rows }); });
  app.post("/api/notifications/read", async (req, res) => { const userId = Number(req.body?.userId); const db = await getDb(); if (!db) return fail(res, 503, "Database is not available"); if (userId) await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.recipientId, userId))); return res.json({ ok: true }); });

  app.get("/api/messages", async (req, res) => { const userId = Number(req.query.userId); if (!userId) return fail(res, 400, "userId is required"); const db = await getDb(); if (!db) return fail(res, 503, "Database is not available"); const rows = await db.select().from(messages).where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId))).orderBy(desc(messages.createdAt)).limit(100); return res.json({ messages: rows }); });
  app.post("/api/messages", async (req, res) => { const { senderId, recipientId, body } = req.body ?? {}; if (!senderId || !recipientId || !body) return fail(res, 400, "senderId, recipientId and body are required"); const db = await getDb(); if (!db) return fail(res, 503, "Database is not available"); const insert = await db.insert(messages).values({ senderId: Number(senderId), recipientId: Number(recipientId), body: String(body).slice(0, 2000) }); const messageId = Number(insert[0].insertId); const row = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1); await notify(db, Number(recipientId), Number(senderId), "message", "You have a new direct message."); broadcast({ type: "message:new", payload: { message: row[0] } }); return res.status(201).json({ message: row[0] }); });
}
