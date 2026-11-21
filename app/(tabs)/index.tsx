import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import {
  VideoPost,
  LinkedText,
  LinkPreview,
  FilterStrip,
  FilterPreview,
} from "../../components/social-media";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = {
  paper: "#F7F2E8",
  ink: "#141414",
  muted: "#766F67",
  line: "#DED5C8",
  coral: "#F05A47",
  yellow: "#F4D35E",
  cream: "#FFFDF8",
  sage: "#D9E5D6",
  lavender: "#E5DDF2",
};
const API =
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.linkedout.us.ci";
const WS = API.replace(/^http/, "ws") + "/ws";
const PUBLIC_APP_URL = "https://linkedout.us.ci";

type User = {
  id: number;
  name: string | null;
  username: string | null;
  email: string | null;
  profilePhotoUrl: string | null;
  bio: string | null;
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
  createdAt: string;
  reactions: number;
  comments: number;
  reposts?: number;
  viewCount?: number;
  liked?: boolean;
  reposted?: boolean;
  author?: User;
};
type Message = {
  id: number;
  senderId: number;
  recipientId: number;
  body: string;
  createdAt: string;
};
type ConnectionStatus = "connecting" | "connected" | "lost";
type Screen =
  | "feed"
  | "reels"
  | "network"
  | "messages"
  | "chat"
  | "you"
  | "company"
  | "search"
  | "settings";

function imageUrl(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith("/") ? `${API}${url}` : url;
}
async function api(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem("linkedout-session");
  const response = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}
function timeAgo(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<Screen>("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);
  const [query, setQuery] = useState("");
  const [liked, setLiked] = useState<number[]>([]);
  const [sheet, setSheet] = useState<
    | "signup"
    | "edit"
    | "verify"
    | "compose"
    | "message"
    | "comments"
    | "photo"
    | null
  >(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [verifiedCompany, setVerifiedCompany] = useState("");
  const [notice, setNotice] = useState("");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [storyMode, setStoryMode] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authPending, setAuthPending] = useState(false);
  const [updateState, setUpdateState] = useState("Checking for OTA updates…");
  const [authEmail, setAuthEmail] = useState("");

  const loadFeed = useCallback(async () => {
    try {
      const result = await api(`/api/feed?viewerId=${user?.id || 0}`);
      setPosts(result.posts);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load feed");
    }
  }, [user?.id]);
  const loadPeople = useCallback(async () => {
    try {
      const result = await api(`/api/users?viewerId=${user?.id || 0}`);
      setPeople(result.users.filter((person: User) => person.id !== user?.id));
    } catch {}
  }, [user?.id]);
  const loadMessages = useCallback(async () => {
    if (!user) return;
    try {
      const result = await api(`/api/messages?userId=${user.id}`);
      setMessages(result.messages);
    } catch {}
  }, [user]);

  useEffect(() => {
    Updates.checkForUpdateAsync()
      .then(async (result) => {
        if (!result.isAvailable) {
          setUpdateState(`Up to date · ${Updates.channel || "preview"}`);
          return;
        }
        setUpdateState("Downloading latest LinkedOut update…");
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      })
      .catch(() =>
        setUpdateState(`OTA unavailable · ${Updates.channel || "preview"}`),
      );
  }, []);
  useEffect(() => {
    AsyncStorage.getItem("linkedout-user").then(async (raw) => {
      if (!raw) {
        setSheet("signup");
        return;
      }
      try {
        const saved = JSON.parse(raw) as User;
        const result = await api(`/api/users/${saved.id}`);
        setUser(result.user);
      } catch {
        setSheet("signup");
      }
    });
  }, []);
  useEffect(() => {
    if (user) {
      loadFeed();
      loadPeople();
      loadMessages();
    }
  }, [user, loadFeed, loadPeople, loadMessages]);
  useEffect(() => {
    if (!user) return;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      setConnectionStatus("connecting");
      try {
        socket = new WebSocket(WS);
        socket.onopen = () => {
          setConnectionStatus("connected");
          loadFeed();
        };
        socket.onclose = () => {
          setConnectionStatus("lost");
          if (!disposed) retry = setTimeout(connect, 3000);
        };
        socket.onerror = () => setConnectionStatus("lost");
        socket.onmessage = (event) => {
          try {
            const incoming = JSON.parse(event.data);
            if (
              [
                "feed:new",
                "feed:reaction",
                "feed:comment",
                "out:new",
                "out:reaction",
                "out:comment",
                "out:repost",
                "link:changed",
                "signal:new",
              ].includes(incoming.type)
            ) {
              loadFeed();
              loadPeople();
            }
            if (incoming.type === "message:new") loadMessages();
          } catch {}
        };
      } catch {
        setConnectionStatus("lost");
        retry = setTimeout(connect, 3000);
      }
    };
    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [user, loadFeed, loadPeople, loadMessages]);

  const signup = async (data: {
    name: string;
    username: string;
    email: string;
  }) => {
    try {
      const deviceId =
        (await AsyncStorage.getItem("linkedout-device")) ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await AsyncStorage.setItem("linkedout-device", deviceId);
      await api("/api/auth/request-code", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          name: authMode === "signup" ? data.name : undefined,
          username: authMode === "signup" ? data.username : undefined,
          email: data.email,
          purpose: authMode,
        }),
      });
      setAuthEmail(data.email);
      setAuthPending(true);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not send verification code",
      );
    }
  };
  const verifyAuth = async (code: string) => {
    try {
      const result = await api("/api/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: authEmail, code }),
      });
      setUser(result.user);
      await AsyncStorage.setItem("linkedout-user", JSON.stringify(result.user));
      await AsyncStorage.setItem("linkedout-session", result.sessionToken);
      setSheet(null);
      setAuthPending(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Verification failed");
    }
  };
  const updateProfile = async (data: {
    name: string;
    username: string;
    bio: string;
  }) => {
    if (!user) return;
    try {
      const result = await api(`/api/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      setUser(result.user);
      await AsyncStorage.setItem("linkedout-user", JSON.stringify(result.user));
      setSheet(null);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not update profile",
      );
    }
  };
  const uploadPhoto = async (fromCamera: boolean) => {
    if (!user) return;
    setSheet(null);
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          base64: true,
          quality: 0.82,
          allowsEditing: true,
          aspect: [1, 1],
        })
      : await ImagePicker.launchImageLibraryAsync({
          base64: true,
          quality: 0.82,
          allowsEditing: true,
          aspect: [1, 1],
        });
    if (result.canceled || !result.assets[0].base64) return;
    try {
      const asset = result.assets[0];
      const response = await api(`/api/users/${user.id}/profile-photo`, {
        method: "POST",
        body: JSON.stringify({
          dataUri: `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`,
          contentType: asset.mimeType || "image/jpeg",
        }),
      });
      const updated = { ...user, profilePhotoUrl: response.profilePhotoUrl };
      setUser(updated);
      await AsyncStorage.setItem("linkedout-user", JSON.stringify(updated));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Photo upload failed");
    }
  };
  const verify = async (company: string, proofType: string) => {
    if (!user) return;
    try {
      await api("/api/verifications", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, company, proofType }),
      });
      setVerifiedCompany(company);
      setSheet("compose");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Verification failed");
    }
  };
  const publish = async (data: {
    company: string;
    role: string;
    duration: string;
    reason: string;
    tags: string[];
    mediaDataUri?: string;
    mediaType?: string;
  }) => {
    if (!user) return;
    try {
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          authorId: user.id,
          content: data.reason,
          postType: data.mediaType?.startsWith("video")
            ? "video"
            : data.mediaType
              ? "photo"
              : "text",
          ...data,
        }),
      });
      setSheet(null);
      await loadFeed();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not publish");
    }
  };
  const react = async (postId: number) => {
    if (!user) return;
    setLiked((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId],
    );
    try {
      await api(`/api/posts/${postId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      await loadFeed();
    } catch {}
  };
  const repost = async (postId: number) => {
    if (!user) return;
    try {
      await api(`/api/posts/${postId}/repost`, {
        method: "POST",
        body: JSON.stringify({ userId: user.id }),
      });
      await loadFeed();
    } catch {}
  };
  const shareOut = async (postId: number) => {
    try {
      await Share.share({
        message: `${PUBLIC_APP_URL}/?out=${postId}`,
        url: `${PUBLIC_APP_URL}/?out=${postId}`,
      });
    } catch {}
  };
  const sendMessage = async (body: string) => {
    if (!user || !selectedRecipient) return;
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          senderId: user.id,
          recipientId: selectedRecipient.id,
          body,
        }),
      });
      setSheet(null);
      await loadMessages();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not send message",
      );
    }
  };
  const openExternal = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {}
  };
  const logout = async () => {
    await AsyncStorage.multiRemove(["linkedout-user", "linkedout-session"]);
    setUser(null);
    setAuthMode("login");
    setAuthPending(false);
    setScreen("feed");
    setPosts([]);
    setPeople([]);
    setMessages([]);
  };

  if (!user)
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.shell, styles.authShell]}>
          <SignupSheet
            mode={authMode}
            pending={authPending}
            email={authEmail}
            onSubmit={signup}
            onVerify={verifyAuth}
            onSwitch={() => {
              setAuthMode(authMode === "signup" ? "login" : "signup");
              setAuthPending(false);
            }}
            notice={notice}
          />
        </View>
      </SafeAreaView>
    );
  const visiblePosts = posts.filter(
    (post) =>
      !query ||
      [post.company, post.role, post.reason, ...(post.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <View style={styles.logoDoor} />
            </View>
            <Text style={styles.wordmark}>LINKEDOUT</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setScreen("search")}>
              <Ionicons name="search" size={21} color={C.ink} />
            </Pressable>
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                setStoryMode(false);
                setSheet("compose");
              }}
            >
              <Ionicons name="add" size={19} color={C.ink} />
              <Text style={styles.headerButtonText}>Post</Text>
            </Pressable>
          </View>
        </View>
        {screen === "feed" && (
          <FeedView
            posts={visiblePosts}
            user={user}
            connectionStatus={connectionStatus}
            liked={liked}
            onSearch={() => setScreen("search")}
            onLike={react}
            onRepost={repost}
            onShare={shareOut}
            onComment={(post) => {
              setSelectedPost(post);
              setSheet("comments");
            }}
            onCompany={(company) => {
              setSelectedCompany(company);
              setScreen("company");
            }}
            onCreateStory={() => {
              setStoryMode(true);
              setSheet("compose");
            }}
          />
        )}
        {screen === "reels" && (
          <ReelsView
            posts={posts.filter(
              (post) =>
                post.mediaType?.startsWith("video") ||
                post.postType === "video",
            )}
            onBack={() => setScreen("feed")}
          />
        )}
        {screen === "settings" && (
          <SettingsView
            updateState={updateState}
            onRefresh={async () => {
              try {
                const result = await Updates.checkForUpdateAsync();
                if (result.isAvailable) {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                } else
                  setUpdateState(
                    `Up to date · ${Updates.channel || "preview"}`,
                  );
              } catch {
                setUpdateState("OTA check failed");
              }
            }}
            onOpen={openExternal}
            onBack={() => setScreen("you")}
          />
        )}
        {screen === "search" && (
          <SearchView
            query={query}
            setQuery={setQuery}
            posts={visiblePosts}
            onBack={() => {
              setQuery("");
              setScreen("feed");
            }}
            onCompany={(company) => {
              setSelectedCompany(company);
              setScreen("company");
            }}
            onLike={react}
          />
        )}
        {screen === "network" && (
          <NetworkView
            people={people}
            onMessage={(person) => {
              setSelectedRecipient(person);
              setScreen("chat");
            }}
            onToggleLink={async (person) => {
              if (!user) return;
              await api(`/api/users/${person.id}/follow`, {
                method: "POST",
                body: JSON.stringify({ followerId: user.id }),
              });
              await loadPeople();
            }}
            onRefresh={loadPeople}
          />
        )}
        {screen === "messages" && (
          <MessagesView
            messages={messages}
            user={user}
            people={people}
            onPickRecipient={(person) => {
              setSelectedRecipient(person);
              setScreen("chat");
            }}
          />
        )}
        {screen === "chat" && selectedRecipient && (
          <ChatView
            messages={messages}
            user={user}
            recipient={selectedRecipient}
            onBack={() => setScreen("messages")}
            onSend={sendMessage}
          />
        )}
        {screen === "company" && (
          <CompanyView
            company={selectedCompany}
            posts={posts.filter((post) => post.company === selectedCompany)}
            onBack={() => setScreen("feed")}
          />
        )}
        {screen === "you" && (
          <ProfileView
            user={user}
            onEdit={() => setSheet("edit")}
            onPhoto={() => setSheet("photo")}
            onVerify={() => setSheet("verify")}
            onLogout={logout}
            onSettings={() => setScreen("settings")}
          />
        )}
        <View style={styles.bottomBar}>
          {(
            [
              ["feed", "newspaper-outline", "Feed"],
              ["reels", "play-circle-outline", "Reels"],
              ["network", "people-outline", "Network"],
              ["messages", "chatbubbles-outline", "Inbox"],
              ["you", "person-outline", "You"],
            ] as const
          ).map(([key, icon, label]) => (
            <Pressable
              key={key}
              style={styles.tab}
              onPress={() => setScreen(key)}
            >
              <Ionicons
                name={icon}
                size={21}
                color={screen === key ? C.coral : C.muted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  screen === key && styles.tabLabelActive,
                ]}
              >
                {label}
              </Text>
              {key === "messages" &&
                messages.some((message) => message.recipientId === user.id) && (
                  <View style={styles.unreadDot} />
                )}
            </Pressable>
          ))}
        </View>
      </View>
      <Modal
        visible={sheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setSheet(null)}
          />
          {sheet === "signup" && (
            <SignupSheet
              mode={authMode}
              pending={authPending}
              email={authEmail}
              onSubmit={signup}
              onVerify={verifyAuth}
              onSwitch={() => {
                setAuthMode(authMode === "signup" ? "login" : "signup");
                setAuthPending(false);
              }}
              notice={notice}
            />
          )}
          {sheet === "edit" && <EditSheet user={user} onSave={updateProfile} />}
          {sheet === "photo" && (
            <PhotoSheet
              onLibrary={() => uploadPhoto(false)}
              onCamera={() => uploadPhoto(true)}
            />
          )}
          {sheet === "verify" && <VerifySheet onDone={verify} />}
          {sheet === "compose" && (
            <ComposeSheet
              user={user}
              verifiedCompany={verifiedCompany}
              storyMode={storyMode}
              onPost={(data) => {
                setStoryMode(false);
                publish(data);
              }}
            />
          )}
          {sheet === "message" && (
            <MessageSheet recipient={selectedRecipient} onSend={sendMessage} />
          )}
          {sheet === "comments" && (
            <CommentsSheet post={selectedPost} user={user} onSent={loadFeed} />
          )}
        </KeyboardAvoidingView>
      </Modal>
      {notice ? (
        <Pressable style={styles.notice} onPress={() => setNotice("")}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function Avatar({ user, size = 38 }: { user?: User | null; size?: number }) {
  const url = imageUrl(user?.profilePhotoUrl);
  return url ? (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size * 0.34 }}
    />
  ) : (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size * 0.34 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {(user?.name || user?.username || "?")[0].toUpperCase()}
      </Text>
    </View>
  );
}
function FeedView({
  posts,
  user,
  connectionStatus,
  liked,
  onSearch,
  onLike,
  onRepost,
  onShare,
  onComment,
  onCompany,
  onCreateStory,
}: {
  posts: Post[];
  user: User;
  connectionStatus: ConnectionStatus;
  liked: number[];
  onSearch: () => void;
  onLike: (id: number) => void;
  onRepost: (id: number) => void;
  onShare: (id: number) => void;
  onComment: (post: Post) => void;
  onCompany: (company: string) => void;
  onCreateStory: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        {connectionStatus !== "connected" ? (
          <View style={styles.connectionBanner}>
            <View
              style={[
                styles.liveDot,
                connectionStatus === "connecting"
                  ? styles.liveDotConnecting
                  : styles.liveDotLost,
              ]}
            />
            <Text style={styles.connectionText}>
              {connectionStatus === "connecting"
                ? "Connecting…"
                : "Connection lost · reconnecting"}
            </Text>
          </View>
        ) : null}
        <Text style={styles.heroTitle}>YOUR FEED.</Text>
        <Text style={styles.heroBody}>
          Share what is happening in your world, discover people you like, and
          join the conversation.
        </Text>
      </View>
      <StoriesRail posts={posts} onCreateStory={onCreateStory} />
      <Pressable style={styles.profilePrompt} onPress={onSearch}>
        <Avatar user={user} />
        <View style={{ flex: 1 }}>
          <Text style={styles.promptTitle}>What's on your mind?</Text>
          <Text style={styles.promptSub}>
            Share a thought, photo, or video with your community.
          </Text>
        </View>
        <Ionicons name="search" size={20} color={C.coral} />
      </Pressable>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>LATEST FROM YOUR COMMUNITY</Text>
        <Text style={styles.sectionMeta}>{posts.length} posts</Text>
      </View>
      {posts.length ? (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            liked={post.liked || liked.includes(post.id)}
            onLike={() => onLike(post.id)}
            onRepost={() => onRepost(post.id)}
            onShare={() => onShare(post.id)}
            onComment={() => onComment(post)}
            onCompany={() => onCompany(post.company)}
          />
        ))
      ) : (
        <EmptyFeed />
      )}
    </ScrollView>
  );
}
function EmptyFeed() {
  return (
    <View style={styles.empty}>
      <Ionicons name="sparkles-outline" size={35} color={C.coral} />
      <Text style={styles.emptyTitle}>Your feed is waiting.</Text>
      <Text style={styles.emptyBody}>
        Follow people you like or share your first post with the community.
      </Text>
    </View>
  );
}
function StoriesRail({
  posts,
  onCreateStory,
}: {
  posts: Post[];
  onCreateStory: () => void;
}) {
  const stories = posts.filter((post) =>
    (post.tags || []).some((tag) => tag.toLowerCase() === "#story"),
  );
  return (
    <View style={styles.storiesBlock}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>STORIES</Text>
        <Text style={styles.sectionMeta}>Share a moment</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
      >
        <Pressable style={styles.storyCard} onPress={onCreateStory}>
          <View style={styles.storyAdd}>
            <Ionicons name="add" size={24} color={C.ink} />
          </View>
          <Text style={styles.storyName}>Your story</Text>
          <Text style={styles.storyHint}>Add photo or video</Text>
        </Pressable>
        {stories.map((story) => (
          <Pressable key={story.id} style={styles.storyCard}>
            <View style={styles.storyImageWrap}>
              {story.mediaUrl && story.mediaType?.startsWith("image") ? (
                <Image
                  source={{ uri: imageUrl(story.mediaUrl) || undefined }}
                  style={styles.storyImage}
                />
              ) : (
                <View style={styles.storyTextPreview}>
                  <Text style={styles.storyTextPreviewText} numberOfLines={3}>
                    {story.content || story.reason}
                  </Text>
                </View>
              )}
              <View style={styles.storyAvatar}>
                <Avatar user={story.author} size={30} />
              </View>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>
              {story.author?.username ? `@${story.author.username}` : "member"}
            </Text>
            <Text style={styles.storyHint} numberOfLines={1}>
              {timeAgo(story.createdAt)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
function PostCard({
  post,
  liked,
  onLike,
  onRepost,
  onShare,
  onComment,
  onCompany,
}: {
  post: Post;
  liked: boolean;
  onLike: () => void;
  onRepost: () => void;
  onShare: () => void;
  onComment: () => void;
  onCompany: () => void;
}) {
  const link = (post.content || post.reason)
    .match(/https?:\/\/[^\s]+/)?.[0]
    ?.replace(/[),.;]+$/, "");
  return (
    <View style={styles.card}>
      <View style={styles.identityRow}>
        <Avatar user={post.author} />
        <View style={{ flex: 1 }}>
          <View style={styles.identityLine}>
            <Text style={styles.alias}>
              {post.author?.name || `@${post.author?.username || "member"}`}
            </Text>
            <View style={styles.miniVerified}>
              <Ionicons name="checkmark-circle" size={12} color={C.ink} />
              <Text style={styles.miniVerifiedText}>MEMBER</Text>
            </View>
          </View>
          <Text style={styles.role}>
            {post.author?.username
              ? `@${post.author.username}`
              : "LinkedOut member"}{" "}
            · {timeAgo(post.createdAt)}
          </Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={19} color={C.muted} />
      </View>
      {post.company && post.company !== "The Wire" ? (
        <Pressable onPress={onCompany}>
          <Text style={styles.context}>
            ABOUT {post.company.toUpperCase()}{" "}
            {post.duration ? `· ${post.duration.toUpperCase()}` : ""}
          </Text>
        </Pressable>
      ) : null}
      <LinkedText text={post.content || post.reason} style={styles.reason} />
      {link ? (
        <LinkPreview
          url={link}
          title={
            post.author?.username === "remotejobs"
              ? "Remote job opportunity"
              : undefined
          }
        />
      ) : null}
      {post.mediaUrl ? (
        post.mediaType?.startsWith("video") ? (
          <VideoPost uri={imageUrl(post.mediaUrl) || post.mediaUrl} compact />
        ) : (
          <Image
            source={{ uri: imageUrl(post.mediaUrl) || undefined }}
            style={styles.postMedia}
          />
        )
      ) : null}
      <View style={styles.tagWrap}>
        {(post.tags || []).map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
      <View style={styles.reactionLine}>
        <Text style={styles.reactionMuted}>{post.viewCount || 0} views</Text>
        <Text style={styles.reactionMuted}>
          <Ionicons name="heart" size={13} color={C.coral} />{" "}
          {post.reactions || 0} likes
        </Text>
        <Text style={styles.reactionMuted}>{post.comments || 0} comments</Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable onPress={onLike} style={styles.cardAction}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={18}
            color={liked ? C.coral : C.ink}
          />
          <Text
            style={[
              styles.cardActionText,
              liked && styles.cardActionTextActive,
            ]}
          >
            Like
          </Text>
        </Pressable>
        <Pressable onPress={onComment} style={styles.cardAction}>
          <Ionicons name="chatbubble-outline" size={17} color={C.ink} />
          <Text style={styles.cardActionText}>Comment</Text>
        </Pressable>
        <Pressable onPress={onRepost} style={styles.cardAction}>
          <Ionicons name="share-social-outline" size={18} color={C.ink} />
          <Text style={styles.cardActionText}>Repost</Text>
        </Pressable>
        <Pressable onPress={onShare} style={styles.cardAction}>
          <Ionicons name="link-outline" size={18} color={C.ink} />
          <Text style={styles.cardActionText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}
function SearchView({
  query,
  setQuery,
  posts,
  onBack,
  onCompany,
  onLike,
}: {
  query: string;
  setQuery: (v: string) => void;
  posts: Post[];
  onBack: () => void;
  onCompany: (company: string) => void;
  onLike: (id: number) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.backRow} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color={C.ink} />
        <Text style={styles.backText}>Back to feed</Text>
      </Pressable>
      <Text style={styles.kicker}>SEARCH THE RECEIPTS</Text>
      <Text style={styles.pageTitle}>Before you accept, ask around.</Text>
      <View style={styles.searchInputWrap}>
        <Ionicons name="search" size={19} color={C.coral} />
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search company or role"
          placeholderTextColor={C.muted}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.resultBanner}>
        <Text style={styles.resultNumber}>{posts.length}</Text>
        <View>
          <Text style={styles.resultTitle}>real stories found</Text>
          <Text style={styles.resultSub}>
            {query ? `matching “${query}”` : "from your live database"}
          </Text>
        </View>
      </View>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          liked={false}
          onLike={() => onLike(post.id)}
          onRepost={() => {}}
          onShare={() => {}}
          onComment={() => {}}
          onCompany={() => onCompany(post.company)}
        />
      ))}
    </ScrollView>
  );
}
function NetworkView({
  people,
  onMessage,
  onToggleLink,
  onRefresh,
}: {
  people: User[];
  onMessage: (person: User) => void;
  onToggleLink: (person: User) => void;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionRow}>
        <Text style={styles.kicker}>YOUR NETWORK</Text>
        <Pressable onPress={onRefresh}>
          <Ionicons name="refresh" size={18} color={C.coral} />
        </Pressable>
      </View>
      <Text style={styles.pageTitle}>People who get it.</Text>
      <Text style={styles.pageBody}>
        Real profiles from your database. No seeded members.
      </Text>
      {people.length ? (
        people.map((person) => (
          <View style={styles.personCard} key={person.id}>
            <View style={styles.personMain}>
              <Avatar user={person} size={54} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alias}>
                  {person.name || `@${person.username}`}
                </Text>
                <Text style={styles.role}>@{person.username}</Text>
                <Text style={styles.role}>{person.bio || "No bio yet."}</Text>
              </View>
            </View>
            <View style={styles.networkActions}>
              <Pressable
                style={styles.connectButton}
                onPress={() => onToggleLink(person)}
              >
                <Ionicons
                  name={person.linked ? "link" : "add"}
                  size={16}
                  color={C.coral}
                />
                <Text style={styles.connectText}>
                  {person.linked ? "Linked" : "Link"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.connectButton}
                onPress={() => onMessage(person)}
              >
                <Ionicons name="chatbubble-outline" size={16} color={C.coral} />
                <Text style={styles.connectText}>Message</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <EmptyFeed />
      )}
    </ScrollView>
  );
}
function MessagesView({
  messages,
  user,
  people,
  onPickRecipient,
}: {
  messages: Message[];
  user: User;
  people: User[];
  onPickRecipient: (person: User) => void;
}) {
  const relevant = messages.slice(0, 30);
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>INBOX</Text>
      <Text style={styles.pageTitle}>Talk it out.</Text>
      <Text style={styles.pageBody}>
        Your conversations, in one place. Pick someone from your network to
        start chatting.
      </Text>
      {people.map((person) => (
        <Pressable
          key={person.id}
          style={styles.chatRow}
          onPress={() => onPickRecipient(person)}
        >
          <Avatar user={person} />
          <View style={{ flex: 1 }}>
            <Text style={styles.alias}>
              {person.name || `@${person.username}`}
            </Text>
            <Text style={styles.role}>@{person.username}</Text>
            <Text style={styles.chatPreview}>
              {relevant.find(
                (message) =>
                  message.senderId === person.id ||
                  message.recipientId === person.id,
              )?.body || "Start a conversation"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.muted} />
        </Pressable>
      ))}
      {!people.length && <EmptyFeed />}
      <Text style={styles.sectionTitle}>RECENT MESSAGES</Text>
      {relevant
        .filter((message) => message.senderId === user.id)
        .map((message) => (
          <View key={message.id} style={styles.sentMessage}>
            <Text style={styles.sentText}>{message.body}</Text>
            <Text style={styles.sentMeta}>{timeAgo(message.createdAt)}</Text>
          </View>
        ))}
    </ScrollView>
  );
}
function ChatView({
  messages,
  user,
  recipient,
  onBack,
  onSend,
}: {
  messages: Message[];
  user: User;
  recipient: User;
  onBack: () => void;
  onSend: (body: string) => void;
}) {
  const conversation = messages
    .filter(
      (message) =>
        (message.senderId === user.id &&
          message.recipientId === recipient.id) ||
        (message.senderId === recipient.id && message.recipientId === user.id),
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  const [draft, setDraft] = useState("");
  return (
    <View style={styles.chatScreen}>
      <View style={styles.chatHeader}>
        <Pressable onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={C.ink} />
        </Pressable>
        <Avatar user={recipient} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.chatTitle}>
            {recipient.name || `@${recipient.username}`}
          </Text>
          <Text style={styles.chatHandle}>@{recipient.username}</Text>
        </View>
        <Ionicons name="call-outline" size={20} color={C.muted} />
      </View>
      <ScrollView contentContainerStyle={styles.chatMessages}>
        {conversation.length ? (
          conversation.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.senderId === user.id
                  ? styles.bubbleMine
                  : styles.bubbleTheirs,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  message.senderId === user.id && styles.bubbleTextMine,
                ]}
              >
                {message.body}
              </Text>
              <Text
                style={[
                  styles.bubbleTime,
                  message.senderId === user.id && styles.bubbleTimeMine,
                ]}
              >
                {timeAgo(message.createdAt)}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.chatEmpty}>
            <Ionicons name="chatbubbles-outline" size={36} color={C.coral} />
            <Text style={styles.chatEmptyTitle}>Start the conversation</Text>
            <Text style={styles.chatEmptyBody}>
              Say hello to @{recipient.username}.
            </Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.chatComposer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={C.muted}
          multiline
          style={styles.chatInput}
        />
        <Pressable
          style={[styles.sendButton, !draft.trim() && styles.disabled]}
          disabled={!draft.trim()}
          onPress={() => {
            onSend(draft.trim());
            setDraft("");
          }}
        >
          <Ionicons name="arrow-up" size={20} color={C.cream} />
        </Pressable>
      </View>
    </View>
  );
}
function CompanyView({
  company,
  posts,
  onBack,
}: {
  company: string;
  posts: Post[];
  onBack: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.backRow} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color={C.ink} />
        <Text style={styles.backText}>Back to feed</Text>
      </Pressable>
      <Text style={styles.kicker}>COMPANY FILE</Text>
      <Text style={styles.pageTitle}>{company || "Select a company"}</Text>
      <Text style={styles.pageBody}>
        {company
          ? `${posts.length} verified stories in your database.`
          : "Tap a company on a real post to open its file."}
      </Text>
      <View style={styles.statCard}>
        <Text style={styles.kicker}>LIVE EXIT STORIES</Text>
        <Text style={styles.bigStat}>{posts.length}</Text>
        <Text style={styles.statCaption}>
          No fake numbers. No seeded testimonials.
        </Text>
      </View>
      {posts.length ? (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            liked={false}
            onLike={() => {}}
            onRepost={() => {}}
            onShare={() => {}}
            onComment={() => {}}
            onCompany={() => {}}
          />
        ))
      ) : (
        <EmptyFeed />
      )}
    </ScrollView>
  );
}
function ProfileView({
  user,
  onEdit,
  onPhoto,
  onVerify,
  onLogout,
  onSettings,
}: {
  user: User;
  onEdit: () => void;
  onPhoto: () => void;
  onVerify: () => void;
  onLogout: () => void;
  onSettings: () => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHero}>
        <Pressable onPress={onPhoto}>
          <Avatar user={user} size={78} />
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={13} color={C.cream} />
          </View>
        </Pressable>
        <Pressable onPress={onSettings} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={16} color={C.ink} />
          <Text style={styles.editText}>Settings</Text>
        </Pressable>
        <Pressable onPress={onEdit} style={styles.editButton}>
          <Ionicons name="pencil" size={15} color={C.ink} />
          <Text style={styles.editText}>Edit profile</Text>
        </Pressable>
        <Text style={styles.profileName}>{user.name}</Text>
        <Text style={styles.profileRole}>
          @{user.username} · {user.email}
        </Text>
        <Text style={styles.profileBio}>
          {user.bio || "Add a bio about the work you left behind."}
        </Text>
      </View>
      <View style={styles.youCard}>
        <View style={styles.youIcon}>
          <Ionicons name="shield-checkmark" size={28} color={C.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.youTitle}>Verification before company posts</Text>
          <Text style={styles.youSub}>
            Proof is checked once, then deleted.
          </Text>
        </View>
      </View>
      <Pressable style={styles.primaryOutline} onPress={onVerify}>
        <Text style={styles.primaryOutlineText}>Verify a former employer</Text>
        <Ionicons name="arrow-forward" size={18} color={C.coral} />
      </Pressable>
      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Ionicons name="log-out-outline" size={18} color={C.coral} />
        <Text style={styles.logoutText}>Log out on this device</Text>
      </Pressable>
      <Text style={styles.logoutNote}>
        Your stored profile, posts, and messages are not deleted.
      </Text>
    </ScrollView>
  );
}
function SignupSheet({
  mode,
  pending,
  email,
  onSubmit,
  onVerify,
  onSwitch,
  notice,
}: {
  mode: "signup" | "login";
  pending: boolean;
  email: string;
  onSubmit: (data: { name: string; username: string; email: string }) => void;
  onVerify: (code: string) => void;
  onSwitch: () => void;
  notice: string;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [localEmail, setLocalEmail] = useState(email);
  useEffect(() => setLocalEmail(email), [email]);
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <View style={styles.authBrand}>
        <View style={styles.logoMark}>
          <View style={styles.logoDoor} />
        </View>
        <Text style={styles.wordmark}>LINKEDOUT</Text>
      </View>
      <Text style={styles.kicker}>WELCOME TO LINKEDOUT</Text>
      <Text style={styles.sheetTitle}>
        {pending
          ? "Check your inbox."
          : mode === "signup"
            ? "Build your exit identity."
            : "Welcome back."}
      </Text>
      {pending ? (
        <>
          <Text style={styles.sheetBody}>
            We sent a six-digit verification code to {email}. It expires in 10
            minutes.
          </Text>
          <Text style={styles.fieldLabel}>VERIFICATION CODE</Text>
          <TextInput
            autoFocus
            value={localEmail === email ? "" : localEmail}
            onChangeText={setLocalEmail}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
            placeholderTextColor={C.muted}
            style={styles.input}
          />
          <Pressable
            style={[
              styles.publishButton,
              localEmail.length !== 6 && styles.disabled,
            ]}
            disabled={localEmail.length !== 6}
            onPress={() => onVerify(localEmail)}
          >
            <Text style={styles.publishText}>Verify email</Text>
            <Ionicons name="arrow-forward" size={18} color={C.cream} />
          </Pressable>
          <Pressable onPress={onSwitch}>
            <Text style={styles.privacyNote}>Use a different email</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.sheetBody}>
            {mode === "signup"
              ? "Create an account with your email. No password required."
              : "Sign in with the email you used for LinkedOut."}
          </Text>
          {mode === "signup" && (
            <>
              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={C.muted}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>USERNAME</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="your_alias"
                placeholderTextColor={C.muted}
                style={styles.input}
              />
            </>
          )}
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            value={localEmail}
            onChangeText={setLocalEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@email.com"
            placeholderTextColor={C.muted}
            style={styles.input}
          />
          {mode === "signup" ? (
            <Pressable
              style={styles.consentRow}
              onPress={() => setAgreed((value) => !value)}
            >
              <Ionicons
                name={agreed ? "checkbox" : "square-outline"}
                size={22}
                color={agreed ? C.coral : C.muted}
              />
              <Text style={styles.consentText}>
                I agree to the{" "}
                <Text
                  style={styles.consentLink}
                  onPress={() => Linking.openURL(`${PUBLIC_APP_URL}/terms`)}
                >
                  Terms of Use
                </Text>{" "}
                and{" "}
                <Text
                  style={styles.consentLink}
                  onPress={() => Linking.openURL(`${PUBLIC_APP_URL}/privacy`)}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[
              styles.publishButton,
              (!localEmail ||
                (mode === "signup" && (!name || !username || !agreed))) &&
                styles.disabled,
            ]}
            disabled={
              !localEmail ||
              (mode === "signup" && (!name || !username || !agreed))
            }
            onPress={() => onSubmit({ name, username, email: localEmail })}
          >
            <Text style={styles.publishText}>
              {mode === "signup"
                ? "Email me a verification code"
                : "Email me a login code"}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={C.cream} />
          </Pressable>
          <Pressable onPress={onSwitch}>
            <Text style={styles.privacyNote}>
              {mode === "signup"
                ? "Already have an account? Log in"
                : "New here? Create an account"}
            </Text>
          </Pressable>
        </>
      )}
      {notice ? <Text style={styles.errorText}>{notice}</Text> : null}
    </View>
  );
}
function EditSheet({
  user,
  onSave,
}: {
  user: User;
  onSave: (data: { name: string; username: string; bio: string }) => void;
}) {
  const [name, setName] = useState(user.name || "");
  const [username, setUsername] = useState(user.username || "");
  const [bio, setBio] = useState(user.bio || "");
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <Text style={styles.kicker}>EDIT PROFILE</Text>
      <Text style={styles.sheetTitle}>Make it yours.</Text>
      <Text style={styles.fieldLabel}>NAME</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} />
      <Text style={styles.fieldLabel}>USERNAME</Text>
      <TextInput
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={styles.input}
      />
      <Text style={styles.fieldLabel}>BIO</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        multiline
        style={[styles.input, styles.textAreaSmall]}
      />
      <Pressable
        style={styles.publishButton}
        onPress={() => onSave({ name, username, bio })}
      >
        <Text style={styles.publishText}>Save profile</Text>
        <Ionicons name="checkmark" size={18} color={C.cream} />
      </Pressable>
    </View>
  );
}
function PhotoSheet({
  onLibrary,
  onCamera,
}: {
  onLibrary: () => void;
  onCamera: () => void;
}) {
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <Text style={styles.kicker}>PROFILE PHOTO</Text>
      <Text style={styles.sheetTitle}>Show up as yourself.</Text>
      <Pressable style={styles.proofOption} onPress={onLibrary}>
        <Ionicons name="images-outline" size={21} color={C.coral} />
        <Text style={styles.proofLabel}>Choose from library</Text>
        <Ionicons name="arrow-forward" size={18} color={C.ink} />
      </Pressable>
      <Pressable style={styles.proofOption} onPress={onCamera}>
        <Ionicons name="camera-outline" size={21} color={C.coral} />
        <Text style={styles.proofLabel}>Take a photo</Text>
        <Ionicons name="arrow-forward" size={18} color={C.ink} />
      </Pressable>
    </View>
  );
}
function VerifySheet({
  onDone,
}: {
  onDone: (company: string, proofType: string) => void;
}) {
  const [company, setCompany] = useState("");
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <Text style={styles.kicker}>PROOF TO POST</Text>
      <Text style={styles.sheetTitle}>No proof, no pile-on.</Text>
      <Text style={styles.sheetBody}>
        Tell us which company you worked for and choose your proof type. The
        prototype stores the verification record; add secure document review
        before public launch.
      </Text>
      <Text style={styles.fieldLabel}>COMPANY</Text>
      <TextInput
        value={company}
        onChangeText={setCompany}
        placeholder="Company name"
        placeholderTextColor={C.muted}
        style={styles.input}
      />
      {[
        ["document-text-outline", "Offer letter", "offer-letter"],
        ["card-outline", "Payslip", "payslip"],
        ["mail-outline", "Work email", "work-email"],
      ].map(([icon, label, type]) => (
        <Pressable
          key={type}
          style={[styles.proofOption, !company && styles.disabled]}
          disabled={!company}
          onPress={() => onDone(company, type)}
        >
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={21}
            color={C.coral}
          />
          <Text style={styles.proofLabel}>{label}</Text>
          <Ionicons name="arrow-forward" size={18} color={C.ink} />
        </Pressable>
      ))}
      <Text style={styles.privacyNote}>
        <Ionicons name="shield-checkmark-outline" size={15} color={C.ink} /> No
        email verification or password is used yet
      </Text>
    </View>
  );
}
function ComposeSheet({
  user,
  verifiedCompany,
  storyMode,
  onPost,
}: {
  user: User;
  verifiedCompany: string;
  storyMode: boolean;
  onPost: (data: {
    company: string;
    role: string;
    duration: string;
    reason: string;
    tags: string[];
    mediaDataUri?: string;
    mediaType?: string;
  }) => void;
}) {
  const [content, setContent] = useState("");
  const [context, setContext] = useState(verifiedCompany);
  const [tags, setTags] = useState("");
  const [mediaDataUri, setMediaDataUri] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<string | undefined>();
  const [filter, setFilter] = useState("original");
  const attach = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets[0].base64) {
      const asset = result.assets[0];
      setMediaType(asset.mimeType || "image/jpeg");
      setMediaDataUri(
        `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`,
      );
    }
  };
  const chooseMedia = async () =>
    attach(
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        base64: true,
        quality: 0.82,
        allowsEditing: true,
      }),
    );
  const captureMedia = async () =>
    attach(
      await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        base64: true,
        quality: 0.82,
        videoMaxDuration: 60,
      }),
    );
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <Text style={styles.kicker}>
        {storyMode ? "CREATE A STORY" : `CREATE A POST · @${user.username}`}
      </Text>
      <Text style={styles.sheetTitle}>
        {storyMode ? "Share a moment." : "What’s happening?"}
      </Text>
      <Text style={styles.sheetBody}>
        Share a thought, photo, or video. Adding a company is optional and only
        adds context to your post.
      </Text>
      <TextInput
        autoFocus
        value={content}
        onChangeText={(v) => setContent(v.slice(0, 5000))}
        multiline
        maxLength={5000}
        placeholder="Share something with your community..."
        placeholderTextColor={C.muted}
        style={[styles.input, styles.textArea]}
      />
      <Text style={styles.fieldLabel}>OPTIONAL CONTEXT</Text>
      <TextInput
        value={context}
        onChangeText={setContext}
        placeholder="A company, place, event, or topic"
        placeholderTextColor={C.muted}
        style={styles.input}
      />
      <TextInput
        value={tags}
        onChangeText={setTags}
        placeholder="#travel #music #work"
        placeholderTextColor={C.muted}
        style={styles.input}
      />
      <View style={styles.mediaRow}>
        <Pressable style={styles.mediaButton} onPress={captureMedia}>
          <Ionicons name="camera-outline" size={18} color={C.coral} />
          <Text style={styles.connectText}>Camera</Text>
        </Pressable>
        <Pressable style={styles.mediaButton} onPress={chooseMedia}>
          <Ionicons name="images-outline" size={18} color={C.coral} />
          <Text style={styles.connectText}>
            {mediaType ? "Media attached" : "Library"}
          </Text>
        </Pressable>
      </View>
      {mediaType ? (
        <>
          {mediaDataUri && mediaType.startsWith("image") ? (
            <FilterPreview uri={mediaDataUri} filter={filter} />
          ) : null}
          <FilterStrip value={filter} onChange={setFilter} />
          <Text style={styles.filterNote}>
            Filter: {filter} · applied to the capture preview
          </Text>
        </>
      ) : null}
      <Pressable
        style={[styles.publishButton, !content.trim() && styles.disabled]}
        disabled={!content.trim()}
        onPress={() =>
          onPost({
            company: context.trim() || "The Wire",
            role: "",
            duration: "",
            reason: content.trim(),
            tags: Array.from(
              new Set([
                ...tags.split(/[, ]+/).filter(Boolean).slice(0, 12),
                ...(storyMode ? ["#story"] : []),
                ...(filter !== "original" ? [`#filter-${filter}`] : []),
              ]),
            ),
            mediaDataUri,
            mediaType,
          })
        }
      >
        <Text style={styles.publishText}>Publish post</Text>
        <Ionicons name="arrow-forward" size={18} color={C.cream} />
      </Pressable>
    </View>
  );
}
function ReelsView({ posts, onBack }: { posts: Post[]; onBack: () => void }) {
  return (
    <ScrollView
      pagingEnabled
      contentContainerStyle={styles.reelsContent}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.backRow} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color={C.cream} />
        <Text style={[styles.backText, { color: C.cream }]}>Back to feed</Text>
      </Pressable>
      <Text style={styles.reelsTitle}>LINKEDOUT REELS</Text>
      <Text style={styles.reelsSubtitle}>
        Short takes from the community. Videos autoplay muted as you scroll.
      </Text>
      {posts.length ? (
        posts.map((post) => (
          <View key={post.id} style={styles.reelCard}>
            <VideoPost uri={imageUrl(post.mediaUrl) || ""} />
            <Text style={styles.reelCaption}>
              {post.content || post.reason}
            </Text>
            <Text style={styles.reelMeta}>
              @{post.author?.username || "member"} · {timeAgo(post.createdAt)}
            </Text>
          </View>
        ))
      ) : (
        <View style={styles.reelsEmpty}>
          <Ionicons name="film-outline" size={38} color={C.yellow} />
          <Text style={styles.reelsEmptyTitle}>
            Your first reel is waiting.
          </Text>
          <Text style={styles.reelsEmptyBody}>
            Use Post → Camera and choose video to start the reel feed.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
function SettingsView({
  updateState,
  onRefresh,
  onOpen,
  onBack,
}: {
  updateState: string;
  onRefresh: () => void;
  onOpen: (url: string) => void;
  onBack: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable style={styles.backRow} onPress={onBack}>
        <Ionicons name="arrow-back" size={18} color={C.coral} />
        <Text style={styles.backText}>Back to profile</Text>
      </Pressable>
      <Text style={styles.pageTitle}>Make LinkedOut work for you.</Text>
      <View style={styles.settingCard}>
        <Text style={styles.settingLabel}>APP UPDATES</Text>
        <Text style={styles.settingValue}>{updateState}</Text>
        <Pressable style={styles.settingButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={16} color={C.coral} />
          <Text style={styles.connectText}>Check now</Text>
        </Pressable>
      </View>
      <Pressable
        style={styles.settingCard}
        onPress={() => onOpen(`${PUBLIC_APP_URL}/privacy`)}
      >
        <Text style={styles.settingLabel}>SAFETY & PRIVACY</Text>
        <Text style={styles.settingValue}>
          Control what you share and report harmful content.
        </Text>
        <Ionicons name="arrow-forward" size={18} color={C.coral} />
      </Pressable>
      <Pressable
        style={styles.settingCard}
        onPress={() => onOpen("mailto:support@linkedout.us.ci")}
      >
        <Text style={styles.settingLabel}>HELP</Text>
        <Text style={styles.settingValue}>Contact the LinkedOut team.</Text>
        <Ionicons name="mail-outline" size={18} color={C.coral} />
      </Pressable>
    </ScrollView>
  );
}
function MessageSheet({
  recipient,
  onSend,
}: {
  recipient: User | null;
  onSend: (body: string) => void;
}) {
  const [body, setBody] = useState("");
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <Text style={styles.kicker}>REAL-TIME MESSAGE</Text>
      <Text style={styles.sheetTitle}>
        Message {recipient?.name || `@${recipient?.username}`}
      </Text>
      <Text style={styles.sheetBody}>
        Your message will be stored and broadcast to their connected device
        through the live channel.
      </Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Write a safe-space message..."
        placeholderTextColor={C.muted}
        style={[styles.input, styles.textArea]}
      />
      <Pressable
        style={[styles.publishButton, !body && styles.disabled]}
        disabled={!body}
        onPress={() => onSend(body)}
      >
        <Text style={styles.publishText}>Send message</Text>
        <Ionicons name="arrow-forward" size={18} color={C.cream} />
      </Pressable>
    </View>
  );
}
function CommentsSheet({
  post,
  user,
  onSent,
}: {
  post: Post | null;
  user: User;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <Text style={styles.kicker}>CONVERSATION</Text>
      <Text style={styles.sheetTitle}>
        {post?.comments || 0} people are talking.
      </Text>
      <Text style={styles.sheetBody}>
        Keep it useful. No names, threats, or doxxing.
      </Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        placeholder="Add your perspective..."
        placeholderTextColor={C.muted}
        style={[styles.input, styles.textAreaSmall]}
      />
      <Pressable
        style={[styles.publishButton, !body && styles.disabled]}
        disabled={!body}
        onPress={async () => {
          await api(`/api/posts/${post?.id}/comments`, {
            method: "POST",
            body: JSON.stringify({ authorId: user.id, body }),
          });
          setBody("");
          onSent();
        }}
      >
        <Text style={styles.publishText}>Add comment</Text>
        <Ionicons name="arrow-forward" size={18} color={C.cream} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  shell: { flex: 1, backgroundColor: C.paper },
  authShell: { justifyContent: "center", paddingHorizontal: 18 },
  header: {
    height: 68,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-7deg" }],
  },
  logoDoor: {
    width: 11,
    height: 14,
    borderWidth: 3,
    borderColor: C.coral,
    borderRightWidth: 0,
    transform: [{ rotate: "-12deg" }],
  },
  wordmark: {
    color: C.ink,
    fontWeight: "900",
    letterSpacing: 1.7,
    fontSize: 17,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 15 },
  headerButton: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    backgroundColor: C.yellow,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  headerButtonText: { fontWeight: "800", color: C.ink },
  content: { padding: 20, paddingBottom: 110, gap: 16 },
  hero: { paddingTop: 10, gap: 7 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: C.muted },
  liveDotOn: {
    width: 7,
    height: 7,
    borderRadius: 5,
    backgroundColor: "#5A9E63",
  },
  liveText: {
    color: C.coral,
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: "900",
    flex: 1,
  },
  liveCount: { color: C.muted, fontSize: 10 },
  heroTitle: {
    fontSize: 39,
    lineHeight: 38,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: -1.3,
  },
  heroBody: { color: C.muted, fontSize: 15, lineHeight: 21 },
  profilePrompt: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promptTitle: { color: C.ink, fontWeight: "800", fontSize: 13 },
  promptSub: { color: C.muted, fontSize: 10, marginTop: 3, lineHeight: 14 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "900",
    color: C.ink,
  },
  sectionMeta: { fontSize: 12, color: C.muted },
  avatar: {
    backgroundColor: C.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.ink, fontWeight: "900" },
  postMedia: {
    width: "100%",
    height: 220,
    borderRadius: 13,
    backgroundColor: C.ink,
  },
  mediaPlaceholder: {
    backgroundColor: C.ink,
    color: C.cream,
    padding: 18,
    borderRadius: 13,
    overflow: "hidden",
  },
  card: {
    backgroundColor: C.cream,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12,
  },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  identityLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  alias: { color: C.ink, fontSize: 15, fontWeight: "900" },
  role: { color: C.muted, fontSize: 11, marginTop: 3 },
  miniVerified: {
    flexDirection: "row",
    gap: 2,
    alignItems: "center",
    backgroundColor: C.sage,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 5,
  },
  miniVerifiedText: { fontSize: 7, letterSpacing: 0.6, fontWeight: "900" },
  context: {
    color: C.coral,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "900",
  },
  reason: { color: C.ink, fontSize: 16, lineHeight: 23 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  tag: {
    backgroundColor: C.lavender,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
  },
  tagText: { color: C.ink, fontSize: 11, fontWeight: "700" },
  reactionLine: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reactionMuted: { color: C.muted, fontSize: 10 },
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardAction: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardActionText: { color: C.ink, fontSize: 11, fontWeight: "700" },
  cardActionTextActive: { color: C.coral },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: C.paper,
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 10,
  },
  tab: { alignItems: "center", gap: 4, minWidth: 66, position: "relative" },
  tabLabel: { fontSize: 10, color: C.muted, fontWeight: "700" },
  tabLabelActive: { color: C.coral },
  unreadDot: {
    width: 5,
    height: 5,
    backgroundColor: C.coral,
    borderRadius: 3,
    position: "absolute",
    top: -1,
    right: 24,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20,20,20,0.42)",
  },
  modalDismiss: { flex: 1 },
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 30,
    maxHeight: "88%",
  },
  authBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    alignSelf: "center",
    marginBottom: 24,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 12,
    marginBottom: 5,
  },
  consentText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  consentLink: { color: C.coral, fontWeight: "800" },
  sheetHandle: {
    width: 44,
    height: 5,
    backgroundColor: C.line,
    borderRadius: 5,
    alignSelf: "center",
    marginBottom: 20,
  },
  kicker: {
    color: C.coral,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 7,
  },
  sheetTitle: {
    color: C.ink,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginBottom: 9,
  },
  sheetBody: { color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 17 },
  fieldLabel: {
    color: C.ink,
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: "900",
    marginTop: 7,
    marginBottom: 7,
  },
  input: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 13,
    color: C.ink,
    fontSize: 15,
  },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  textAreaSmall: { minHeight: 80, textAlignVertical: "top" },
  counter: { color: C.muted, fontWeight: "500", letterSpacing: 0 },
  publishButton: {
    backgroundColor: C.coral,
    borderRadius: 13,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  publishText: { color: C.cream, fontWeight: "900", fontSize: 15 },
  disabled: { opacity: 0.45 },
  errorText: { color: C.coral, fontSize: 12, marginTop: 10 },
  notice: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: C.ink,
    padding: 13,
    borderRadius: 12,
  },
  noticeText: { color: C.cream, fontSize: 12, textAlign: "center" },
  pageTitle: {
    color: C.ink,
    fontSize: 31,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  pageBody: { color: C.muted, fontSize: 15, lineHeight: 22 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { color: C.ink, fontSize: 12, fontWeight: "800" },
  searchInputWrap: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.coral,
    borderRadius: 13,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: { flex: 1, color: C.ink, fontSize: 16 },
  resultBanner: {
    backgroundColor: C.yellow,
    borderRadius: 15,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  resultNumber: {
    color: C.ink,
    fontSize: 39,
    lineHeight: 40,
    fontWeight: "900",
  },
  resultTitle: { color: C.ink, fontSize: 16, fontWeight: "900" },
  resultSub: { color: C.ink, opacity: 0.7, fontSize: 12, marginTop: 2 },
  networkActions: { flexDirection: "row", gap: 8 },
  mediaButton: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  personCard: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 15,
    padding: 14,
    gap: 13,
  },
  personMain: { flexDirection: "row", gap: 12 },
  connectButton: {
    borderWidth: 1,
    borderColor: C.coral,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  connectText: { color: C.coral, fontWeight: "900", fontSize: 12 },
  mediaRow: { flexDirection: "row", gap: 8 },
  filterNote: { color: C.muted, fontSize: 10, textAlign: "center" },
  reelsContent: {
    backgroundColor: C.ink,
    minHeight: "100%",
    padding: 20,
    paddingBottom: 80,
    gap: 18,
  },
  reelsTitle: {
    color: C.cream,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  reelsSubtitle: { color: "#BEB8B0", fontSize: 14, lineHeight: 20 },
  reelCard: {
    backgroundColor: "#242424",
    borderRadius: 17,
    padding: 12,
    gap: 10,
  },
  reelCaption: { color: C.cream, fontSize: 16, lineHeight: 22 },
  reelMeta: { color: "#BEB8B0", fontSize: 11 },
  reelsEmpty: {
    backgroundColor: "#242424",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  reelsEmptyTitle: { color: C.cream, fontSize: 20, fontWeight: "900" },
  reelsEmptyBody: {
    color: "#BEB8B0",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  settingCard: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 15,
    padding: 16,
    gap: 9,
  },
  settingLabel: {
    color: C.coral,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "900",
  },
  settingValue: { color: C.ink, fontSize: 15, lineHeight: 21, flex: 1 },
  settingButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: C.coral,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  empty: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 9,
  },
  emptyTitle: { color: C.ink, fontSize: 19, fontWeight: "900" },
  emptyBody: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  chatRow: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  chatPreview: { color: C.muted, fontSize: 12, marginTop: 5 },
  sentMessage: { backgroundColor: C.lavender, padding: 12, borderRadius: 12 },
  sentText: { color: C.ink, fontSize: 14 },
  sentMeta: { color: C.muted, fontSize: 10, marginTop: 5 },
  statCard: { backgroundColor: C.ink, borderRadius: 16, padding: 18 },
  bigStat: { color: C.yellow, fontWeight: "900", fontSize: 45, marginTop: 8 },
  statCaption: { color: "#BEB9B0", fontSize: 12, marginTop: 2 },
  profileHero: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    padding: 18,
    alignItems: "flex-start",
    gap: 8,
    position: "relative",
  },
  cameraBadge: {
    position: "absolute",
    left: 55,
    top: 56,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: { color: C.ink, fontSize: 28, fontWeight: "900" },
  profileRole: { color: C.muted, fontSize: 13 },
  profileBio: { color: C.ink, fontSize: 14, lineHeight: 20, marginTop: 4 },
  editButton: {
    position: "absolute",
    top: 18,
    right: 16,
    backgroundColor: C.yellow,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 5,
  },
  editText: { color: C.ink, fontSize: 10, fontWeight: "900" },
  youCard: {
    backgroundColor: C.yellow,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  youIcon: {
    width: 48,
    height: 48,
    backgroundColor: C.cream,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  youTitle: { color: C.ink, fontWeight: "900", fontSize: 16 },
  youSub: { color: C.ink, opacity: 0.7, marginTop: 3, fontSize: 12 },
  primaryOutline: {
    borderWidth: 1.5,
    borderColor: C.coral,
    padding: 14,
    borderRadius: 13,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryOutlineText: { color: C.coral, fontWeight: "900", fontSize: 15 },
  proofOption: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.line,
    padding: 15,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 9,
  },
  proofLabel: { color: C.ink, fontSize: 15, fontWeight: "800", flex: 1 },
  privacyNote: {
    color: C.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 9,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: C.coral,
    borderRadius: 13,
    padding: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  logoutText: { color: C.coral, fontWeight: "900", fontSize: 14 },
  logoutNote: {
    color: C.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: -7,
  },
  settingsButton: {
    position: "absolute",
    right: 0,
    top: 0,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  connectionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF2E9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  liveDotConnecting: { backgroundColor: C.yellow },
  liveDotLost: { backgroundColor: C.coral },
  connectionText: { color: C.ink, fontSize: 12, fontWeight: "800" },
  storiesBlock: { gap: 10 },
  storiesRow: { gap: 10, paddingRight: 20 },
  storyCard: { width: 112, gap: 5 },
  storyAdd: {
    height: 142,
    borderRadius: 16,
    backgroundColor: C.yellow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  storyImageWrap: {
    height: 142,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: C.ink,
    position: "relative",
  },
  storyImage: { width: "100%", height: "100%" },
  storyTextPreview: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
    backgroundColor: C.coral,
  },
  storyTextPreviewText: {
    color: C.cream,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 18,
  },
  storyAvatar: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: C.yellow,
  },
  storyName: { color: C.ink, fontSize: 12, fontWeight: "900" },
  storyHint: { color: C.muted, fontSize: 10 },
  chatScreen: { flex: 1, backgroundColor: C.cream },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  chatTitle: { color: C.ink, fontSize: 16, fontWeight: "900" },
  chatHandle: { color: C.muted, fontSize: 12, marginTop: 2 },
  chatMessages: {
    padding: 20,
    gap: 10,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 4,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: C.coral,
    borderBottomRightRadius: 5,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: C.yellow,
    borderBottomLeftRadius: 5,
  },
  bubbleText: { color: C.ink, fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: C.cream },
  bubbleTime: { color: C.muted, fontSize: 9, alignSelf: "flex-end" },
  bubbleTimeMine: { color: "#FFE1D2" },
  chatEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 8,
  },
  chatEmptyTitle: { color: C.ink, fontWeight: "900", fontSize: 17 },
  chatEmptyBody: { color: C.muted, fontSize: 13 },
  chatComposer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  chatInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 42,
    backgroundColor: "#FFF8F0",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.line,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.coral,
    alignItems: "center",
    justifyContent: "center",
  },
});
