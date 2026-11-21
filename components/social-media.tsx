import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const COLORS = {
  ink: "#141414",
  cream: "#FFFDF8",
  coral: "#F05A47",
  muted: "#766F67",
  line: "#DED5C8",
  yellow: "#F4D35E",
};

export function VideoPost({
  uri,
  compact = false,
}: {
  uri: string;
  compact?: boolean;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return (
    <View style={[styles.videoFrame, compact && styles.videoCompact]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={styles.videoBadge}>
        <Ionicons name="play" size={11} color={COLORS.cream} />
        <Text style={styles.videoBadgeText}>AUTOPLAY · SOUND OFF</Text>
      </View>
      <Pressable
        style={styles.videoControl}
        onPress={() => {
          player.muted = !player.muted;
        }}
      >
        <Ionicons
          name={player.muted ? "volume-mute" : "volume-high"}
          size={17}
          color={COLORS.cream}
        />
      </Pressable>
    </View>
  );
}

export function LinkedText({ text, style }: { text: string; style?: object }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (!/^https?:\/\//.test(part))
          return <Text key={`${part}-${index}`}>{part}</Text>;
        return (
          <Text
            key={`${part}-${index}`}
            style={styles.link}
            onPress={() => Linking.openURL(part.replace(/[),.;]+$/, ""))}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

export function LinkPreview({
  url,
  title,
  description,
}: {
  url: string;
  title?: string;
  description?: string;
}) {
  return (
    <Pressable style={styles.linkCard} onPress={() => Linking.openURL(url)}>
      <View style={styles.linkIcon}>
        <Ionicons name="link" size={20} color={COLORS.ink} />
      </View>
      <View style={styles.linkCopy}>
        <Text style={styles.linkTitle} numberOfLines={2}>
          {title || "Open linked opportunity"}
        </Text>
        <Text style={styles.linkDescription} numberOfLines={2}>
          {description || url}
        </Text>
        <Text style={styles.linkDomain}>
          {url.replace(/^https?:\/\//, "").split("/")[0]}
        </Text>
      </View>
      <Ionicons name="arrow-up-right-box" size={18} color={COLORS.coral} />
    </Pressable>
  );
}

export function FilterStrip({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterStrip}>
      {["original", "sunset", "rose", "noir"].map((filter) => (
        <Pressable
          key={filter}
          onPress={() => onChange(filter)}
          style={[
            styles.filterChip,
            value === filter && styles.filterChipActive,
          ]}
        >
          <Text
            style={[
              styles.filterText,
              value === filter && styles.filterTextActive,
            ]}
          >
            {filter.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function FilterPreview({
  uri,
  filter,
}: {
  uri: string;
  filter: string;
}) {
  const tint =
    filter === "sunset"
      ? "rgba(245, 126, 55, 0.25)"
      : filter === "rose"
        ? "rgba(223, 83, 111, 0.20)"
        : filter === "noir"
          ? "rgba(20, 20, 20, 0.34)"
          : "transparent";
  return (
    <View style={styles.previewFrame}>
      <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
      <View
        pointerEvents="none"
        style={[styles.previewTint, { backgroundColor: tint }]}
      />
      <View style={styles.previewLabel}>
        <Ionicons name="color-filter-outline" size={13} color={COLORS.cream} />
        <Text style={styles.previewLabelText}>
          {filter.toUpperCase()} PREVIEW
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  videoFrame: {
    width: "100%",
    height: 280,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: COLORS.ink,
    position: "relative",
  },
  videoCompact: { height: 220 },
  video: { width: "100%", height: "100%" },
  videoBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(20,20,20,0.72)",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  videoBadgeText: {
    color: COLORS.cream,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  videoControl: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,20,20,0.72)",
  },
  link: {
    color: COLORS.coral,
    textDecorationLine: "underline",
    fontWeight: "700",
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.yellow,
  },
  linkIcon: {
    width: 37,
    height: 37,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.cream,
  },
  linkCopy: { flex: 1, gap: 2 },
  linkTitle: { color: COLORS.ink, fontWeight: "900", fontSize: 13 },
  linkDescription: { color: COLORS.ink, opacity: 0.72, fontSize: 11 },
  linkDomain: {
    color: COLORS.ink,
    opacity: 0.55,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  filterStrip: { flexDirection: "row", gap: 7, marginVertical: 4 },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: COLORS.cream,
  },
  filterChipActive: {
    borderColor: COLORS.coral,
    backgroundColor: COLORS.coral,
  },
  filterText: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  filterTextActive: { color: COLORS.cream },
  previewFrame: {
    height: 170,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: COLORS.ink,
    position: "relative",
    marginTop: 8,
  },
  previewImage: { width: "100%", height: "100%" },
  previewTint: { ...StyleSheet.absoluteFill },
  previewLabel: {
    position: "absolute",
    bottom: 9,
    left: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(20,20,20,0.72)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  previewLabelText: {
    color: COLORS.cream,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
});
