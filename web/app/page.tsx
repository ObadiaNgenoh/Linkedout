"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { FormEvent, useEffect, useMemo, useState } from "react";

type User = {
  id: number;
  name: string | null;
  username: string | null;
  email?: string | null;
  profilePhotoUrl?: string | null;
  bio?: string | null;
  followers?: number;
  following?: number;
  linked?: boolean;
};
type Post = {
  id: number;
  authorId: number;
  company: string;
  role: string | null;
  duration: string | null;
  reason: string;
  content?: string | null;
  postType?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  tags: string[];
  viewCount: number;
  reposts: number;
  reactions: number;
  comments: number;
  liked?: boolean;
  reposted?: boolean;
  createdAt: string;
  author?: User;
};
type Signal = {
  id: number;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};
const API = "https://api.linkedout.us.ci";
const PUBLIC_APP_URL = "https://linkedout.us.ci";
async function api(path: string, options?: RequestInit) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("linkedout-session")
      : null;
  const response = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}
function ago(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  return minutes < 1
    ? "now"
    : minutes < 60
      ? `${minutes}m`
      : `${Math.floor(minutes / 60)}h`;
}
function mediaData(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null),
    [posts, setPosts] = useState<Post[]>([]),
    [people, setPeople] = useState<User[]>([]),
    [signals, setSignals] = useState<Signal[]>([]),
    [tab, setTab] = useState("wire"),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState(""),
    [live, setLive] = useState(false),
    [authOpen, setAuthOpen] = useState(false),
    [authMode, setAuthMode] = useState<"signup" | "login">("signup"),
    [authPending, setAuthPending] = useState(false),
    [authEmail, setAuthEmail] = useState(""),
    [composeOpen, setComposeOpen] = useState(false),
    [commentPost, setCommentPost] = useState<Post | null>(null),
    [profile, setProfile] = useState<User | null>(null);
  const load = async () => {
    try {
      const [feed, members] = await Promise.all([
        api(`/api/feed?viewerId=${user?.id || 0}`),
        api(`/api/users?viewerId=${user?.id || 0}`),
      ]);
      setPosts(feed.posts);
      setPeople(members.users);
      if (user) {
        const signalResult = await api(`/api/notifications?userId=${user.id}`);
        setSignals(signalResult.notifications);
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not load The Wire",
      );
    }
  };
  useEffect(() => {
    const saved = localStorage.getItem("linkedout-user");
    if (saved) setUser(JSON.parse(saved));
    else setAuthOpen(true);
  }, []);
  useEffect(() => {
    load();
  }, [user?.id]);
  useEffect(() => {
    const socket = new WebSocket("wss://api.linkedout.us.ci/ws");
    socket.onopen = () => setLive(true);
    socket.onclose = () => setLive(false);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (
        [
          "out:new",
          "out:reaction",
          "out:comment",
          "out:repost",
          "link:changed",
          "signal:new",
        ].includes(data.type)
      )
        load();
    };
    return () => socket.close();
  }, [user?.id]);
  const visible = useMemo(
    () =>
      posts.filter(
        (post) =>
          !query ||
          `${post.company} ${post.role || ""} ${post.content || post.reason} ${post.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [posts, query],
  );
  async function requestCode(data: {
    name?: string;
    username?: string;
    email: string;
    purpose: "signup" | "login";
  }) {
    try {
      await api("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          deviceId:
            localStorage.getItem("linkedout-device") || crypto.randomUUID(),
        }),
      });
      localStorage.setItem(
        "linkedout-device",
        localStorage.getItem("linkedout-device") || crypto.randomUUID(),
      );
      setAuthEmail(data.email);
      setAuthMode(data.purpose);
      setAuthPending(true);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not send verification code",
      );
    }
  }
  async function verifyCode(code: string) {
    try {
      const result = await api("/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: authEmail, code }),
      });
      setUser(result.user);
      localStorage.setItem("linkedout-user", JSON.stringify(result.user));
      localStorage.setItem("linkedout-session", result.sessionToken);
      setAuthOpen(false);
      setAuthPending(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Verification failed");
    }
  }
  async function act(path: string, body: object) {
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update");
    }
  }
  async function comment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !commentPost) return;
    const form = new FormData(event.currentTarget);
    await act(`/api/posts/${commentPost.id}/comments`, {
      authorId: user.id,
      body: form.get("body"),
    });
    setCommentPost(null);
  }
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("media") as File | null;
    try {
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          authorId: user.id,
          company: form.get("company") || "The Wire",
          role: form.get("role"),
          duration: form.get("duration"),
          reason: form.get("content"),
          content: form.get("content"),
          tags: String(form.get("tags") || "")
            .split(/[, ]+/)
            .filter(Boolean),
          postType: file?.size
            ? file.type.startsWith("video")
              ? "video"
              : "photo"
            : "text",
          mediaDataUri: file?.size ? await mediaData(file) : undefined,
        }),
      });
      setComposeOpen(false);
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not publish out",
      );
    }
  }
  function logout() {
    localStorage.removeItem("linkedout-user");
    localStorage.removeItem("linkedout-session");
    setUser(null);
    setAuthMode("login");
    setAuthPending(false);
    setAuthOpen(true);
  }
  return (
    <main>
      <header>
        <div className="brand">
          <span className="mark">↗</span>
          <strong>LINKEDOUT</strong>
        </div>
        <div className="header-actions">
          <span className={live ? "live" : "offline"}>
            ● {live ? "LIVE WIRE" : "OFFLINE"}
          </span>
          <button className="search-pill" onClick={() => setTab("search")}>
            ⌕ Search
          </button>
          <button className="post-button" onClick={() => setComposeOpen(true)}>
            ＋ New post
          </button>
        </div>
      </header>
      <div className="layout">
        <aside>
          <div className="side-identity">
            <div className="avatar">{user?.name?.[0] || "?"}</div>
            <div>
              <b>{user?.name || "Your exit identity"}</b>
              <small>@{user?.username || "not_signed_up"}</small>
            </div>
          </div>
          {[
            ["wire", "The Wire"],
            ["network", "Network"],
            [
              "signals",
              `Signals${signals.filter((signal) => !signal.readAt).length ? ` · ${signals.filter((signal) => !signal.readAt).length}` : ""}`,
            ],
            ["profile", "Profile"],
          ].map(([key, label]) => (
            <button
              className={tab === key ? "side-link active" : "side-link"}
              key={key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
          <div className="side-note">
            Your people.
            <br />
            Your conversations.
            <br />
            <b>Share freely.</b>
          </div>
        </aside>
        <section className="content">
          {tab === "wire" && (
            <>
              <Hero
                title={
                  <>
                    Your feed
                    <br />
                    <em>your people.</em>
                  </>
                }
                sub="Share what is happening in your world, discover people you like, and join the conversation."
              />
              <div className="search-box">
                <span>⌕</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search posts, people, or topics"
                />
              </div>
              <div className="section-heading">
                <span>LATEST FROM YOUR COMMUNITY</span>
                <small>{visible.length} posts</small>
              </div>
              <Feed
                posts={visible}
                user={user}
                onLike={(post) =>
                  act(`/api/posts/${post.id}/reactions`, { userId: user?.id })
                }
                onRepost={(post) =>
                  act(`/api/posts/${post.id}/repost`, { userId: user?.id })
                }
                onComment={setCommentPost}
                onProfile={setProfile}
              />
            </>
          )}
          {tab === "search" && (
            <>
              <Hero
                title={
                  <>
                    Find your
                    <br />
                    <em>people.</em>
                  </>
                }
                sub="Search the community for posts, people, and topics you care about."
              />
              <div className="search-box">
                <span>⌕</span>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search posts, people, or topics"
                />
              </div>
              <Feed
                posts={visible}
                user={user}
                onLike={(post) =>
                  act(`/api/posts/${post.id}/reactions`, { userId: user?.id })
                }
                onRepost={(post) =>
                  act(`/api/posts/${post.id}/repost`, { userId: user?.id })
                }
                onComment={setCommentPost}
                onProfile={setProfile}
              />
            </>
          )}
          {tab === "network" && (
            <>
              <Hero
                title={
                  <>
                    Your
                    <br />
                    <em>links.</em>
                  </>
                }
                sub="Follow members whose work stories make you feel less alone."
              />
              <div className="people">
                {people
                  .filter((person) => person.id !== user?.id)
                  .map((person) => (
                    <div className="person" key={person.id}>
                      <div className="avatar">{person.name?.[0] || "?"}</div>
                      <div>
                        <b>{person.name || `@${person.username}`}</b>
                        <small>
                          @{person.username} · {person.followers || 0} followers
                        </small>
                        <p>{person.bio || "No bio yet."}</p>
                      </div>
                      <button
                        className={person.linked ? "linked" : ""}
                        onClick={() =>
                          act(`/api/users/${person.id}/follow`, {
                            followerId: user?.id,
                          })
                        }
                      >
                        {person.linked ? "Linked" : "Link"}
                      </button>
                    </div>
                  ))}
              </div>
            </>
          )}
          {tab === "signals" && (
            <>
              <Hero
                title={
                  <>
                    Your
                    <br />
                    <em>Signals.</em>
                  </>
                }
                sub="Likes, comments, links, pass-it-ons, and messages that need your attention."
              />
              <div className="signals">
                {signals.length ? (
                  signals.map((signal) => (
                    <div
                      className={signal.readAt ? "signal" : "signal unread"}
                      key={signal.id}
                    >
                      <span className="signal-icon">
                        {signal.type === "link"
                          ? "↗"
                          : signal.type === "reaction"
                            ? "♡"
                            : signal.type === "comment"
                              ? "◌"
                              : "⤴"}
                      </span>
                      <div>
                        <b>{signal.message}</b>
                        <small>
                          {ago(signal.createdAt)} · {signal.type}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    <b>No signals yet.</b>
                    <span>
                      When someone links with or reacts to you, it will appear
                      here.
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "profile" && user && (
            <>
              <div className="profile-card">
                <div className="profile-avatar">{user.name?.[0] || "?"}</div>
                <span className="eyebrow">EXIT IDENTITY</span>
                <h1>{user.name}</h1>
                <p>
                  @{user.username} · {user.followers || 0} followers ·{" "}
                  {user.following || 0} following
                </p>
                <p>{user.bio || "Add a bio about the work you left behind."}</p>
              </div>
              <button className="logout" onClick={logout}>
                ↪ Log out on this device
              </button>
              <small className="muted">
                Your stored profile, outs, links, and messages are not deleted.
              </small>
            </>
          )}
        </section>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button
          className={
            tab === "wire" ? "mobile-nav-item active" : "mobile-nav-item"
          }
          onClick={() => setTab("wire")}
        >
          <span>⌂</span>
          <small>Feed</small>
        </button>
        <button
          className={
            tab === "search" ? "mobile-nav-item active" : "mobile-nav-item"
          }
          onClick={() => setTab("search")}
        >
          <span>⌕</span>
          <small>Search</small>
        </button>
        <button
          className="mobile-nav-item mobile-nav-post"
          onClick={() => setComposeOpen(true)}
        >
          <span>＋</span>
          <small>Post</small>
        </button>
        <button
          className={
            tab === "network" ? "mobile-nav-item active" : "mobile-nav-item"
          }
          onClick={() => setTab("network")}
        >
          <span>♧</span>
          <small>Network</small>
        </button>
        <button
          className={
            tab === "signals" || tab === "profile"
              ? "mobile-nav-item active"
              : "mobile-nav-item"
          }
          onClick={() => setTab("signals")}
        >
          <span>♡</span>
          <small>Activity</small>
        </button>
      </nav>
      {notice && (
        <button className="notice" onClick={() => setNotice("")}>
          {notice}
        </button>
      )}
      <AuthModal
        open={authOpen}
        mode={authMode}
        pending={authPending}
        email={authEmail}
        onRequest={requestCode}
        onVerify={verifyCode}
        onSwitch={() => {
          setAuthMode(authMode === "signup" ? "login" : "signup");
          setAuthPending(false);
        }}
      />
      {composeOpen && (
        <Modal title="Drop an out.">
          <form onSubmit={publish}>
            <p>Share a thought, photo, or video. Context is optional.</p>
            <label>
              Optional context
              <input
                name="company"
                placeholder="A place, event, company, or topic"
              />
            </label>
            <label>
              Optional role / detail
              <input name="role" placeholder="Add a little context" />
            </label>
            <label>
              Your post
              <textarea
                name="content"
                maxLength={5000}
                required
                placeholder="What’s happening?"
              />
            </label>
            <label>
              Tags
              <input name="tags" placeholder="#music #travel #life" />
            </label>
            <label>
              Photo or video
              <input name="media" type="file" accept="image/*,video/*" />
            </label>
            <button className="primary">Publish post →</button>
          </form>
        </Modal>
      )}
      {commentPost && (
        <Modal title="Join the conversation.">
          <form onSubmit={comment}>
            <p>Keep it useful and respectful. No threats or doxxing.</p>
            <textarea
              name="body"
              required
              placeholder="Add your perspective..."
            />
            <button className="primary">Comment on this out →</button>
          </form>
        </Modal>
      )}
      {profile && (
        <Modal title={profile.name || `@${profile.username}`}>
          <div className="profile-mini">
            <div className="profile-avatar">{profile.name?.[0] || "?"}</div>
            <h2>@{profile.username}</h2>
            <p>{profile.bio || "No bio yet."}</p>
            <p>
              {profile.followers || 0} followers · {profile.following || 0}{" "}
              following
            </p>
            <button
              className="primary"
              onClick={() => {
                act(`/api/users/${profile.id}/follow`, {
                  followerId: user?.id,
                });
                setProfile(null);
              }}
            >
              {profile.linked ? "Unlink" : "Link"} with this exit identity
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
function AuthModal({
  open,
  mode,
  pending,
  email,
  onRequest,
  onVerify,
  onSwitch,
}: {
  open: boolean;
  mode: "signup" | "login";
  pending: boolean;
  email: string;
  onRequest: (data: {
    name?: string;
    username?: string;
    email: string;
    purpose: "signup" | "login";
  }) => void;
  onVerify: (code: string) => void;
  onSwitch: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  if (!open) return null;
  return (
    <Modal
      title={
        pending
          ? "Check your inbox."
          : mode === "signup"
            ? "Create your exit identity."
            : "Welcome back."
      }
    >
      <div className="auth-brand">
        <span className="legal-mark">↗</span>
        <strong>LINKEDOUT</strong>
      </div>
      {pending ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onVerify(String(form.get("code") || ""));
          }}
        >
          <p>
            We sent a six-digit code to <b>{email}</b>. It expires in 10
            minutes.
          </p>
          <label>
            VERIFICATION CODE
            <input
              name="code"
              inputMode="numeric"
              autoFocus
              required
              minLength={6}
              maxLength={6}
              placeholder="123456"
            />
          </label>
          <button className="primary">Verify email →</button>
          <button
            type="button"
            className="search-pill"
            onClick={() => onSwitch()}
          >
            Use a different email
          </button>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onRequest({
              name: mode === "signup" ? String(form.get("name")) : undefined,
              username:
                mode === "signup" ? String(form.get("username")) : undefined,
              email: String(form.get("email")),
              purpose: mode,
            });
          }}
        >
          <p>
            {mode === "signup"
              ? "Create an account with your email. No password required."
              : "Sign in with the email you used for LinkedOut."}
          </p>
          {mode === "signup" && (
            <>
              <label>
                NAME
                <input name="name" required placeholder="Your name" />
              </label>
              <label>
                USERNAME
                <input name="username" required placeholder="your_alias" />
              </label>
            </>
          )}
          <label>
            EMAIL
            <input
              name="email"
              required
              type="email"
              placeholder="you@email.com"
            />
          </label>
          {mode === "signup" && (
            <label className="consent-check">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                required
              />
              <span>
                I agree to the <a href="/terms">Terms of Use</a> and{" "}
                <a href="/privacy">Privacy Policy</a>.
              </span>
            </label>
          )}
          <button className="primary" disabled={mode === "signup" && !agreed}>
            {mode === "signup"
              ? "Send verification code →"
              : "Email me a login code →"}
          </button>
          <button type="button" className="search-pill" onClick={onSwitch}>
            {mode === "signup"
              ? "Already have an account? Log in"
              : "New here? Create an account"}
          </button>
        </form>
      )}
    </Modal>
  );
}
function Hero({ title, sub }: { title: React.ReactNode; sub: string }) {
  return (
    <div className="hero">
      <span className="eyebrow">A SOCIAL SPACE FOR REAL PEOPLE</span>
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  );
}
function Feed({
  posts,
  user,
  onLike,
  onRepost,
  onComment,
  onProfile,
}: {
  posts: Post[];
  user: User | null;
  onLike: (post: Post) => void;
  onRepost: (post: Post) => void;
  onComment: (post: Post) => void;
  onProfile: (user: User) => void;
}) {
  return posts.length ? (
    <div className="feed">
      {posts.map((post) => (
        <article className="post" key={post.id}>
          <div className="post-top">
            <button
              className="avatar avatar-button"
              onClick={() => post.author && onProfile(post.author)}
            >
              {post.author?.name?.[0] || "?"}
            </button>
            <div>
              <button
                className="author-button"
                onClick={() => post.author && onProfile(post.author)}
              >
                <b>
                  {post.author?.name || `@${post.author?.username || "member"}`}
                </b>
              </button>
              <small>
                @{post.author?.username || "member"} · {ago(post.createdAt)}
              </small>
            </div>
            <span className="badge">✓ VERIFIED</span>
          </div>
          {post.company !== "The Wire" && (
            <span className="context">
              ABOUT {post.company.toUpperCase()}{" "}
              {post.duration ? `· ${post.duration.toUpperCase()}` : ""}
            </span>
          )}
          <p className="reason">{post.content || post.reason}</p>
          {post.mediaUrl &&
            (post.mediaType?.startsWith("video") ? (
              <video
                className="media"
                controls
                src={`${API}${post.mediaUrl}`}
              />
            ) : (
              <img
                className="media"
                src={`${API}${post.mediaUrl}`}
                alt="Media attached to out"
              />
            ))}
          <div className="tags">
            {post.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="metrics">
            <span>{post.viewCount || 0} views</span>
            <span>{post.reactions || 0} likes</span>
            <span>{post.comments || 0} comments</span>
            <span>{post.reposts || 0} reposts</span>
          </div>
          <div className="post-footer">
            <button
              onClick={() => onLike(post)}
              className={post.liked ? "active-action" : ""}
            >
              ♡ Like
            </button>
            <button onClick={() => onComment(post)}>◌ Comment</button>
            <button
              onClick={() => onRepost(post)}
              className={post.reposted ? "active-action" : ""}
            >
              ⤴ Repost
            </button>
            <button
              onClick={() =>
                navigator.clipboard?.writeText(
                  `${PUBLIC_APP_URL}/?out=${post.id}`,
                )
              }
            >
              ↗ Share
            </button>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <div className="empty">
      <b>Your feed is waiting.</b>
      <span>
        Follow people you like or publish the first post in your community.
      </span>
    </div>
  );
}
function Modal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="backdrop">
      <div className="modal">
        <div className="handle" />
        <span className="eyebrow">LINKEDOUT</span>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
