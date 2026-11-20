import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  username: varchar("username", { length: 32 }),
  email: varchar("email", { length: 320 }),
  profilePhotoUrl: varchar("profilePhotoUrl", { length: 1024 }),
  bio: text("bio"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const verifications = mysqlTable("verifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  company: varchar("company", { length: 160 }).notNull(),
  proofType: varchar("proofType", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  authorId: int("authorId").notNull(),
  company: varchar("company", { length: 160 }).notNull(),
  role: varchar("role", { length: 160 }),
  duration: varchar("duration", { length: 64 }),
  reason: varchar("reason", { length: 300 }).notNull(),
  content: text("content"),
  postType: mysqlEnum("postType", ["exit", "text", "photo", "video", "repost"]).default("exit").notNull(),
  mediaUrl: varchar("mediaUrl", { length: 1024 }),
  mediaType: varchar("mediaType", { length: 80 }),
  tags: text("tags"),
  viewCount: int("viewCount").default(0).notNull(),
  repostCount: int("repostCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const postReactions = mysqlTable("postReactions", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ uniqueReaction: uniqueIndex("post_reaction_unique").on(table.postId, table.userId) }));

export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  authorId: int("authorId").notNull(),
  body: varchar("body", { length: 600 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const follows = mysqlTable("follows", {
  id: int("id").autoincrement().primaryKey(),
  followerId: int("followerId").notNull(),
  followingId: int("followingId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ uniqueFollow: uniqueIndex("follow_unique").on(table.followerId, table.followingId) }));

export const postViews = mysqlTable("postViews", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ uniqueView: uniqueIndex("post_view_unique").on(table.postId, table.userId) }));

export const reposts = mysqlTable("reposts", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ uniqueRepost: uniqueIndex("repost_unique").on(table.postId, table.userId) }));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientId: int("recipientId").notNull(),
  actorId: int("actorId").notNull(),
  type: mysqlEnum("type", ["link", "reaction", "comment", "repost", "message"]).notNull(),
  postId: int("postId"),
  message: varchar("message", { length: 240 }).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  senderId: int("senderId").notNull(),
  recipientId: int("recipientId").notNull(),
  body: varchar("body", { length: 2000 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  readAt: timestamp("readAt"),
});

export const emailChallenges = mysqlTable("emailChallenges", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  codeHash: varchar("codeHash", { length: 128 }).notNull(),
  purpose: mysqlEnum("purpose", ["signup", "login"]).notNull(),
  name: text("name"),
  username: varchar("username", { length: 32 }),
  deviceId: varchar("deviceId", { length: 128 }),
  expiresAt: timestamp("expiresAt").notNull(),
  attempts: int("attempts").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
});

type UserRow = typeof users.$inferSelect;
export type User = Omit<UserRow, "username" | "profilePhotoUrl" | "bio"> & Partial<Pick<UserRow, "username" | "profilePhotoUrl" | "bio">>;
export type InsertUser = typeof users.$inferInsert;
