import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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

type Story = {
  id: number;
  company: string;
  role: string;
  duration: string;
  reason: string;
  tags: string[];
  votes: number;
  verified: boolean;
};

const STORIES: Story[] = [
  {
    id: 1,
    company: "Safaricom",
    role: "Marketing · Nairobi",
    duration: "8 months",
    reason: "My manager called it a flat structure. It was actually one person approving every comma, at midnight, on WhatsApp.",
    tags: ["#Micromanagement", "#NoRaise"],
    votes: 184,
    verified: true,
  },
  {
    id: 2,
    company: "KCB Group",
    role: "Product · Digital",
    duration: "1 yr 3 mo",
    reason: "The ‘family’ asked me to work through two weekends, then used my bonus to buy team pizza. I needed a salary, not a slice.",
    tags: ["#FakeFamilyCulture", "#UnpaidOvertime"],
    votes: 96,
    verified: true,
  },
  {
    id: 3,
    company: "Twiga Foods",
    role: "Operations · Nairobi",
    duration: "4 months",
    reason: "Every problem was ‘an exciting opportunity to stretch’. The stretch was always unpaid and always mine.",
    tags: ["#UnpaidOvertime", "#Burnout"],
    votes: 72,
    verified: true,
  },
];

const tabs = [
  { key: "feed", label: "The Tea", icon: "newspaper-outline" },
  { key: "search", label: "Search", icon: "search-outline" },
  { key: "company", label: "Company", icon: "business-outline" },
  { key: "you", label: "You", icon: "person-outline" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("feed");
  const [query, setQuery] = useState("");
  const [liked, setLiked] = useState<number[]>([]);
  const [sheet, setSheet] = useState<"verify" | "compose" | null>(null);
  const [verified, setVerified] = useState(false);
  const [company, setCompany] = useState("Safaricom");
  const [reason, setReason] = useState("");

  const filteredStories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return STORIES;
    return STORIES.filter((story) =>
      [story.company, story.role, story.reason, ...story.tags].join(" ").toLowerCase().includes(normalized),
    );
  }, [query]);

  const openCompose = () => setSheet(verified ? "compose" : "verify");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}><View style={styles.logoDoor} /></View>
            <Text style={styles.wordmark}>LINKEDOUT</Text>
          </View>
          <Pressable style={styles.headerButton} onPress={openCompose}>
            <Ionicons name="add" size={20} color={C.ink} />
            <Text style={styles.headerButtonText}>Spill</Text>
          </Pressable>
        </View>

        {activeTab === "feed" && <FeedView stories={filteredStories} liked={liked} onLike={(id) => setLiked((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id])} onSearch={() => setActiveTab("search")} />}
        {activeTab === "search" && <SearchView query={query} setQuery={setQuery} stories={filteredStories} liked={liked} onLike={(id) => setLiked((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id])} />}
        {activeTab === "company" && <CompanyView />}
        {activeTab === "you" && <YouView verified={verified} onVerify={openCompose} />}

        <View style={styles.bottomBar}>
          {tabs.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Pressable key={tab.key} style={styles.tab} onPress={() => setActiveTab(tab.key)}>
                <Ionicons name={tab.icon as keyof typeof Ionicons.glyphMap} size={22} color={selected ? C.coral : C.muted} />
                <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.modalDismiss} onPress={() => setSheet(null)} />
          {sheet === "verify" ? (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.kicker}>PROOF TO POST</Text>
              <Text style={styles.sheetTitle}>No proof, no pile-on.</Text>
              <Text style={styles.sheetBody}>Upload an offer letter, payslip, or work email. We auto-blur it, check it once, then delete it. No names. No receipts left behind.</Text>
              {[
                ["document-text-outline", "Offer letter"],
                ["card-outline", "Payslip"],
                ["mail-outline", "Work email"],
              ].map(([icon, label]) => (
                <Pressable key={label} style={styles.proofOption} onPress={() => { setVerified(true); setSheet("compose"); }}>
                  <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={21} color={C.coral} />
                  <Text style={styles.proofLabel}>{label}</Text>
                  <Ionicons name="arrow-forward" size={18} color={C.ink} />
                </Pressable>
              ))}
              <Text style={styles.privacyNote}><Ionicons name="shield-checkmark-outline" size={15} color={C.ink} /> Checked by AI + human · deleted after review</Text>
            </View>
          ) : (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.kicker}>VERIFIED EX-EMPLOYEE</Text>
              <Text style={styles.sheetTitle}>Say what the exit survey wouldn’t.</Text>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>COMPANY *</Text>
                <TextInput value={company} onChangeText={setCompany} placeholder="e.g. Safaricom" placeholderTextColor={C.muted} style={styles.input} />
                <Text style={styles.fieldLabel}>REAL REASON YOU QUIT * <Text style={styles.counter}>{reason.length}/300</Text></Text>
                <TextInput value={reason} onChangeText={(v) => setReason(v.slice(0, 300))} multiline placeholder="No corporate spin. What actually happened?" placeholderTextColor={C.muted} style={[styles.input, styles.textArea]} />
                <Text style={styles.fieldLabel}>TAGS</Text>
                <View style={styles.tagWrap}>{["#Micromanagement", "#NoRaise", "#Burnout"].map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>
                <Pressable style={[styles.publishButton, !company.trim() || !reason.trim() ? styles.disabled : undefined]} disabled={!company.trim() || !reason.trim()} onPress={() => { setReason(""); setSheet(null); }}><Text style={styles.publishText}>Post anonymously</Text><Ionicons name="arrow-forward" size={18} color={C.cream} /></Pressable>
                <Text style={styles.publishNote}>Your post will show as “Verified Ex-Employee”. No profile. No picture.</Text>
              </ScrollView>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function FeedView({ stories, liked, onLike, onSearch }: { stories: Story[]; liked: number[]; onLike: (id: number) => void; onSearch: () => void }) {
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.hero}>
      <View style={styles.stamp}><Text style={styles.stampText}>ANONYMOUS</Text><Text style={styles.stampText}>VERIFIED</Text></View>
      <Text style={styles.heroTitle}>THE TEA{`\n`}NO CORPORATE SPIN.</Text>
      <Text style={styles.heroBody}>Real quit stories from people who worked there.</Text>
    </View>
    <Pressable style={styles.searchStrip} onPress={onSearch}><Ionicons name="search" size={18} color={C.muted} /><Text style={styles.searchPlaceholder}>Search a company before you sign...</Text><Ionicons name="arrow-forward" size={18} color={C.ink} /></Pressable>
    <View style={styles.sectionRow}><Text style={styles.sectionTitle}>LATEST EXITS</Text><Text style={styles.sectionMeta}>{stories.length} stories</Text></View>
    {stories.map((story) => <StoryCard key={story.id} story={story} liked={liked.includes(story.id)} onLike={() => onLike(story.id)} />)}
    <View style={styles.footerNote}><Text style={styles.footerQuote}>“Everyone has a story.”</Text><Text style={styles.footerSub}>Make yours useful.</Text></View>
  </ScrollView>;
}

function SearchView({ query, setQuery, stories, liked, onLike }: { query: string; setQuery: (v: string) => void; stories: Story[]; liked: number[]; onLike: (id: number) => void }) {
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.kicker}>SEARCH THE RECEIPTS</Text><Text style={styles.pageTitle}>Before you accept, ask around.</Text>
    <View style={styles.searchInputWrap}><Ionicons name="search" size={19} color={C.coral} /><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Safaricom Marketing" placeholderTextColor={C.muted} style={styles.searchInput} /></View>
    <View style={styles.resultBanner}><Text style={styles.resultNumber}>{stories.length}</Text><View><Text style={styles.resultTitle}>stories found</Text><Text style={styles.resultSub}>{query ? `matching “${query}”` : "across the companies people quit"}</Text></View></View>
    {stories.map((story) => <StoryCard key={story.id} story={story} liked={liked.includes(story.id)} onLike={() => onLike(story.id)} />)}
  </ScrollView>;
}

function StoryCard({ story, liked, onLike }: { story: Story; liked: boolean; onLike: () => void }) {
  return <View style={styles.card}>
    <View style={styles.cardTop}><View><Text style={styles.company}>{story.company}</Text><Text style={styles.role}>{story.role}  ·  {story.duration}</Text></View><View style={styles.verifiedPill}><Ionicons name="checkmark-circle" size={13} color={C.ink} /><Text style={styles.verifiedText}>VERIFIED</Text></View></View>
    <Text style={styles.reason}>{story.reason}</Text>
    <View style={styles.tagWrap}>{story.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>
    <View style={styles.cardBottom}><Text style={styles.anonymous}>ANONYMOUS · {story.role.split("·")[0].trim().toUpperCase()}</Text><Pressable onPress={onLike} style={[styles.sameHere, liked && styles.sameHereActive]}><Ionicons name={liked ? "heart" : "heart-outline"} size={16} color={liked ? C.cream : C.coral} /><Text style={[styles.sameHereText, liked && styles.sameHereTextActive]}>{liked ? "Same here" : "Same here"}  {story.votes + (liked ? 1 : 0)}</Text></Pressable></View>
  </View>;
}

function CompanyView() {
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.kicker}>COMPANY FILE · 027</Text><View style={styles.companyHeader}><View style={styles.companyIcon}><Text style={styles.companyIconText}>S</Text></View><View><Text style={styles.pageTitle}>Safaricom</Text><Text style={styles.role}>Marketing · Nairobi</Text></View></View>
    <View style={styles.statCard}><Text style={styles.kicker}>AVERAGE STAY</Text><Text style={styles.bigStat}>4.2 <Text style={styles.bigStatUnit}>months</Text> <Text style={styles.skull}>💀</Text></Text><Text style={styles.statCaption}>based on 27 verified exit stories</Text></View>
    <View style={styles.card}><Text style={styles.kicker}>WHY PEOPLE ACTUALLY LEAVE</Text><View style={styles.wordCloud}><Text style={[styles.cloudWord, { color: C.coral, fontSize: 28 }]}>micromanagement</Text><Text style={[styles.cloudWord, { color: C.ink, fontSize: 18 }]}>no raise</Text><Text style={[styles.cloudWord, { color: "#A16B3D", fontSize: 21 }]}>burnout</Text><Text style={[styles.cloudWord, { color: C.coral, fontSize: 16 }]}>overtime</Text><Text style={[styles.cloudWord, { color: C.ink, fontSize: 14 }]}>fake family</Text><Text style={[styles.cloudWord, { color: "#6E8A6B", fontSize: 20 }]}>leadership</Text></View></View>
    <Text style={styles.sectionTitle}>TOP TOXIC TAGS</Text><View style={styles.ranked}><Rank n="01" label="#Micromanagement" value="68%" /><Rank n="02" label="#UnpaidOvertime" value="54%" /><Rank n="03" label="#NoRaise" value="41%" /></View>
    <View style={styles.comeback}><View><Text style={styles.kicker}>WOULD YOU COME BACK?</Text><Text style={styles.comebackTitle}>The door is open.</Text></View><View style={styles.split}><Text style={styles.yes}>12% YES</Text><Text style={styles.no}>88% NO</Text></View></View>
    <View style={styles.employer}><Ionicons name="megaphone-outline" size={19} color={C.coral} /><View style={{ flex: 1 }}><Text style={styles.employerLabel}>EMPLOYER REPLY</Text><Text style={styles.employerText}>“We’re listening. Anonymous feedback helps us do better.”</Text><Text style={styles.employerBy}>— Safaricom People Team · public reply</Text></View></View>
  </ScrollView>;
}

function Rank({ n, label, value }: { n: string; label: string; value: string }) { return <View style={styles.rank}><Text style={styles.rankNum}>{n}</Text><Text style={styles.rankLabel}>{label}</Text><Text style={styles.rankValue}>{value}</Text></View>; }

function YouView({ verified, onVerify }: { verified: boolean; onVerify: () => void }) {
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Text style={styles.kicker}>YOUR EXIT FILE</Text><Text style={styles.pageTitle}>Anonymous by default.</Text><Text style={styles.pageBody}>You don’t need a profile to make a workplace safer. Your proof is only a one-time check.</Text><View style={styles.youCard}><View style={styles.youIcon}><Ionicons name={verified ? "shield-checkmark" : "shield-outline"} size={28} color={C.ink} /></View><View style={{ flex: 1 }}><Text style={styles.youTitle}>{verified ? "Verified Ex-Employee" : "Not verified yet"}</Text><Text style={styles.youSub}>{verified ? "You can post your real quit story." : "Verify once to unlock posting."}</Text></View>{verified && <Ionicons name="checkmark-circle" size={22} color={C.coral} />}</View><Pressable style={styles.primaryOutline} onPress={onVerify}><Text style={styles.primaryOutlineText}>{verified ? "Share another story" : "Verify to post"}</Text><Ionicons name="arrow-forward" size={18} color={C.coral} /></Pressable><View style={styles.boundary}><Text style={styles.kicker}>WHAT WE DON’T DO</Text><Text style={styles.boundaryText}>No DMs. No resumes. No job applications. No video. No fake AI summaries. Just the real story.</Text></View></ScrollView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper }, shell: { flex: 1, backgroundColor: C.paper }, header: { height: 68, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.line }, brandRow: { flexDirection: "row", alignItems: "center", gap: 9 }, logoMark: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.ink, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-7deg" }] }, logoDoor: { width: 11, height: 14, borderWidth: 3, borderColor: C.coral, borderRightWidth: 0, transform: [{ rotate: "-12deg" }] }, wordmark: { color: C.ink, fontWeight: "900", letterSpacing: 1.7, fontSize: 17 }, headerButton: { flexDirection: "row", gap: 5, alignItems: "center", backgroundColor: C.yellow, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 }, headerButtonText: { fontWeight: "800", color: C.ink }, content: { padding: 20, paddingBottom: 110, gap: 16 }, hero: { paddingTop: 11, paddingBottom: 3 }, stamp: { alignSelf: "flex-start", borderWidth: 1, borderColor: C.coral, paddingHorizontal: 8, paddingVertical: 4, transform: [{ rotate: "-3deg" }], marginBottom: 12 }, stampText: { color: C.coral, fontSize: 9, fontWeight: "900", letterSpacing: 1.7 }, heroTitle: { fontSize: 42, lineHeight: 40, fontWeight: "900", color: C.ink, letterSpacing: -1.4 }, heroBody: { color: C.muted, fontSize: 15, marginTop: 10 }, searchStrip: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }, searchPlaceholder: { flex: 1, color: C.muted, fontSize: 13 }, sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 }, sectionTitle: { fontSize: 12, letterSpacing: 1.5, fontWeight: "900", color: C.ink }, sectionMeta: { fontSize: 12, color: C.muted }, card: { backgroundColor: C.cream, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.line, gap: 13, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, company: { color: C.ink, fontSize: 20, fontWeight: "900", letterSpacing: -0.4 }, role: { color: C.muted, fontSize: 12, marginTop: 3 }, verifiedPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.sage, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, alignSelf: "flex-start" }, verifiedText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7 }, reason: { color: C.ink, fontSize: 16, lineHeight: 23 }, tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, tag: { backgroundColor: C.lavender, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 7 }, tagText: { color: C.ink, fontSize: 11, fontWeight: "700" }, cardBottom: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, anonymous: { color: C.muted, fontSize: 9, letterSpacing: 0.7, flex: 1 }, sameHere: { borderWidth: 1, borderColor: C.coral, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4 }, sameHereActive: { backgroundColor: C.coral }, sameHereText: { color: C.coral, fontSize: 11, fontWeight: "800" }, sameHereTextActive: { color: C.cream }, footerNote: { paddingVertical: 20, alignItems: "center" }, footerQuote: { fontSize: 25, fontWeight: "900", color: C.ink }, footerSub: { color: C.coral, fontWeight: "800", marginTop: 4 }, bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 78, backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line, flexDirection: "row", justifyContent: "space-around", paddingTop: 10 }, tab: { alignItems: "center", gap: 4, minWidth: 66 }, tabLabel: { fontSize: 10, color: C.muted, fontWeight: "700" }, tabLabelActive: { color: C.coral }, modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20,20,20,0.42)" }, modalDismiss: { flex: 1 }, sheet: { backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 30, maxHeight: "82%" }, sheetHandle: { width: 44, height: 5, backgroundColor: C.line, borderRadius: 5, alignSelf: "center", marginBottom: 20 }, kicker: { color: C.coral, fontSize: 10, fontWeight: "900", letterSpacing: 1.6, marginBottom: 7 }, sheetTitle: { color: C.ink, fontSize: 30, lineHeight: 32, fontWeight: "900", letterSpacing: -0.6, marginBottom: 9 }, sheetBody: { color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 17 }, proofOption: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.line, padding: 15, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 9 }, proofLabel: { color: C.ink, fontSize: 15, fontWeight: "800", flex: 1 }, privacyNote: { color: C.muted, fontSize: 11, textAlign: "center", marginTop: 9 }, fieldLabel: { color: C.ink, fontSize: 10, letterSpacing: 1.3, fontWeight: "900", marginTop: 7, marginBottom: 7 }, counter: { color: C.muted, fontWeight: "500", letterSpacing: 0 }, input: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 13, color: C.ink, fontSize: 15 }, textArea: { minHeight: 120, textAlignVertical: "top" }, publishButton: { backgroundColor: C.coral, borderRadius: 13, padding: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 20 }, publishText: { color: C.cream, fontWeight: "900", fontSize: 15 }, disabled: { opacity: 0.45 }, publishNote: { color: C.muted, fontSize: 11, textAlign: "center", marginTop: 10 }, pageTitle: { color: C.ink, fontSize: 31, lineHeight: 34, fontWeight: "900", letterSpacing: -0.7 }, pageBody: { color: C.muted, fontSize: 15, lineHeight: 22 }, searchInputWrap: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.coral, borderRadius: 13, padding: 12, flexDirection: "row", alignItems: "center", gap: 9 }, searchInput: { flex: 1, color: C.ink, fontSize: 16 }, resultBanner: { backgroundColor: C.yellow, borderRadius: 15, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 }, resultNumber: { color: C.ink, fontSize: 39, lineHeight: 40, fontWeight: "900" }, resultTitle: { color: C.ink, fontSize: 16, fontWeight: "900" }, resultSub: { color: C.ink, opacity: 0.7, fontSize: 12, marginTop: 2 }, companyHeader: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 4 }, companyIcon: { width: 58, height: 58, borderRadius: 16, backgroundColor: C.coral, alignItems: "center", justifyContent: "center" }, companyIconText: { color: C.cream, fontWeight: "900", fontSize: 32 }, statCard: { backgroundColor: C.ink, borderRadius: 16, padding: 18 }, bigStat: { color: C.yellow, fontWeight: "900", fontSize: 39, marginTop: 8 }, bigStatUnit: { fontSize: 17, color: C.cream }, skull: { fontSize: 24 }, statCaption: { color: "#BEB9B0", fontSize: 12, marginTop: 2 }, wordCloud: { minHeight: 150, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 18 }, cloudWord: { fontWeight: "900" }, ranked: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.line, borderRadius: 15, overflow: "hidden" }, rank: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: C.line }, rankNum: { color: C.coral, fontSize: 11, fontWeight: "900", width: 36 }, rankLabel: { flex: 1, color: C.ink, fontWeight: "800", fontSize: 14 }, rankValue: { color: C.muted, fontWeight: "800" }, comeback: { backgroundColor: C.sage, borderRadius: 15, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, comebackTitle: { color: C.ink, fontWeight: "900", fontSize: 18 }, split: { alignItems: "flex-end", gap: 3 }, yes: { color: "#557055", fontSize: 13, fontWeight: "900" }, no: { color: C.coral, fontSize: 13, fontWeight: "900" }, employer: { backgroundColor: C.lavender, borderRadius: 15, padding: 15, flexDirection: "row", gap: 10 }, employerLabel: { color: C.coral, fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginBottom: 6 }, employerText: { color: C.ink, fontSize: 14, lineHeight: 20, fontWeight: "700" }, employerBy: { color: C.muted, fontSize: 11, marginTop: 7 }, youCard: { backgroundColor: C.yellow, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }, youIcon: { width: 48, height: 48, backgroundColor: C.cream, borderRadius: 14, alignItems: "center", justifyContent: "center" }, youTitle: { color: C.ink, fontWeight: "900", fontSize: 16 }, youSub: { color: C.ink, opacity: 0.7, marginTop: 3, fontSize: 12 }, primaryOutline: { borderWidth: 1.5, borderColor: C.coral, padding: 14, borderRadius: 13, flexDirection: "row", justifyContent: "center", gap: 8 }, primaryOutlineText: { color: C.coral, fontWeight: "900", fontSize: 15 }, boundary: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 18, marginTop: 9 }, boundaryText: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 3 },
});
