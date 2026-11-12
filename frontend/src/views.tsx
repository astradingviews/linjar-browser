import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import type { useStyles } from "@/src/styles";
import type { ThemeColors } from "@/src/theme";
import type { BrowserTab, DownloadItem, Engine, MediaItem } from "@/src/types";

type Styles = ReturnType<typeof useStyles>;
type Common = { styles: Styles; colors: ThemeColors };

export const shortcuts = [
  { label: "Google", icon: "logo-google" as const, url: "https://www.google.com" },
  { label: "YouTube", icon: "logo-youtube" as const, url: "https://m.youtube.com" },
  { label: "Vimeo", icon: "play-circle-outline" as const, url: "https://vimeo.com" },
  { label: "Twitch", icon: "logo-twitch" as const, url: "https://www.twitch.tv" },
];

export function HomeView(p: Common & {
  query: string; setQuery: (v: string) => void; engine: Engine; setEngine: (e: Engine) => void;
  submitSearch: () => void; openUrl: (u: string) => void; media: MediaItem | null; onPlay: () => void;
}) {
  const { styles, colors } = p;
  return (
    <ScrollView contentContainerStyle={styles.homeContent} keyboardShouldPersistTaps="handled">
      <View style={styles.heroBlock}>
        <Text style={styles.heroKicker}>PRIVATE. FAST. FOCUSED.</Text>
        <Text style={styles.heroTitle}>{"Your web, under\nyour control."}</Text>
        <Text style={styles.heroBody}>Browser ringan dengan pemblokir popup dan pemutar video bawaan.</Text>
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={colors.brand} />
        <TextInput testID="home-search-input" value={p.query} onChangeText={p.setQuery} onSubmitEditing={p.submitSearch} returnKeyType="go" autoCapitalize="none" autoCorrect={false} placeholder="Cari atau ketik URL" placeholderTextColor={colors.muted} style={styles.searchInput} />
        <Pressable testID="engine-toggle" onPress={() => p.setEngine(p.engine === "Google" ? "DuckDuckGo" : "Google")} style={styles.engineButton}>
          <Text style={styles.engineText}>{p.engine === "Google" ? "G" : "D"}</Text>
        </Pressable>
      </View>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Speed dial</Text>
        <Text style={styles.sectionHint}>{p.engine}</Text>
      </View>
      <View style={styles.shortcutGrid}>
        {shortcuts.map((s) => (
          <Pressable key={s.label} onPress={() => p.openUrl(s.url)} style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}>
            <View style={styles.shortcutIcon}><Ionicons name={s.icon} size={22} color={colors.brand} /></View>
            <Text style={styles.shortcutLabel}>{s.label}</Text>
            <Text style={styles.shortcutDomain}>{s.url.replace("https://", "").replace("www.", "")}</Text>
          </Pressable>
        ))}
      </View>
      {p.media && (
        <Pressable onPress={p.onPlay} style={styles.detectedCard}>
          <View style={styles.detectedIcon}><Ionicons name="videocam" size={20} color={colors.onBrandPrimary} /></View>
          <View style={styles.flex}>
            <Text style={styles.detectedTitle}>Video siap</Text>
            <Text style={styles.detectedBody}>Ada sumber media di tab aktif.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.brand} />
        </Pressable>
      )}
      <View style={styles.infoCard}>
        <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
        <View style={styles.flex}>
          <Text style={styles.infoTitle}>Aman by design</Text>
          <Text style={styles.infoBody}>Hanya link media langsung yang boleh Anda simpan. DRM dan stream terproteksi tidak pernah di-bypass.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

export function TabsView(p: Common & {
  tabs: BrowserTab[]; activeTab: string; onSwitch: (t: BrowserTab) => void; onAdd: () => void; onClose: (id: string) => void;
}) {
  const { styles, colors } = p;
  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Tab terbuka</Text>
        <Pressable testID="new-tab" onPress={p.onAdd} style={styles.smallAction}>
          <Ionicons name="add" size={17} color={colors.onBrandPrimary} />
          <Text style={styles.smallActionText}>Tab baru</Text>
        </Pressable>
      </View>
      {p.tabs.map((tab) => (
        <Pressable key={tab.id} onPress={() => p.onSwitch(tab)} style={[styles.tabCard, tab.id === p.activeTab && styles.tabCardActive]}>
          <View style={styles.tabPreview}>
            <Ionicons name={tab.incognito ? "eye-off-outline" : "globe-outline"} size={25} color={tab.id === p.activeTab ? colors.brand : colors.muted} />
          </View>
          <View style={styles.flex}>
            <View style={styles.tabTitleRow}>
              <Text numberOfLines={1} style={styles.tabTitle}>{tab.title}</Text>
              {tab.incognito && <Text style={styles.privateTag}>PRIVATE</Text>}
            </View>
            <Text numberOfLines={1} style={styles.tabUrl}>{tab.url}</Text>
          </View>
          <Pressable testID={`close-tab-${tab.id}`} accessibilityLabel={`Tutup ${tab.title}`} onPress={() => p.onClose(tab.id)} hitSlop={8} style={styles.closeButton}>
            <Ionicons name="close" size={19} color={colors.muted} />
          </Pressable>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function DownloadsView(p: Common & {
  downloads: DownloadItem[]; onPlay: (d: DownloadItem) => void; onDelete: (d: DownloadItem) => void;
}) {
  const { styles, colors } = p;
  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle}>Unduhan</Text>
          <Text style={styles.sectionHint}>Penyimpanan lokal app</Text>
        </View>
        <View style={styles.downloadBadge}><Text style={styles.downloadBadgeText}>{p.downloads.length}</Text></View>
      </View>
      {p.downloads.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="download-outline" size={36} color={colors.muted} />
          <Text style={styles.emptyTitle}>Belum ada unduhan</Text>
          <Text style={styles.emptyBody}>Video langsung yang terdeteksi bisa disimpan dari pemutar.</Text>
        </View>
      ) : (
        p.downloads.map((d) => (
          <View key={d.id} style={styles.downloadCard}>
            <View style={styles.fileIcon}>
              <Ionicons name={d.status === "done" ? "play" : "cloud-download-outline"} size={19} color={colors.brand} />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.downloadName}>{d.name}</Text>
              <Text style={styles.downloadMeta}>
                {d.type} · {d.status === "done" ? "Siap diputar" : d.status === "failed" ? "Gagal" : `Mengunduh ${Math.round(d.progress * 100)}%`}
              </Text>
              {d.status === "downloading" && (
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(d.progress * 100)}%` }]} /></View>
              )}
            </View>
            {d.status === "done" && (
              <Pressable onPress={() => p.onPlay(d)} style={styles.downloadAction}><Ionicons name="play" size={17} color={colors.onBrandPrimary} /></Pressable>
            )}
            <Pressable onPress={() => p.onDelete(d)} style={styles.deleteAction}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

export function PlayerView(p: Common & {
  media: MediaItem; locked: boolean; speed: number; onLock: () => void; onSpeed: () => void; onDownload: () => void; onBack: () => void;
}) {
  const { styles, colors, media } = p;
  const ref = useRef<VideoView>(null);
  const isLocal = media.url.startsWith("file:");
  const player = useVideoPlayer(
    isLocal || !media.referer ? media.url : { uri: media.url, headers: { Referer: media.referer } },
    (pl) => { pl.play(); },
  );
  useEffect(() => { player.playbackRate = p.speed; }, [player, p.speed]);

  return (
    <View style={styles.player}>
      <View style={styles.playerTop}>
        <Pressable onPress={p.onBack} style={styles.playerButton}><Ionicons name="arrow-back" size={22} color={colors.onSurface} /></Pressable>
        <View style={styles.playerTitleBlock}>
          <Text style={styles.playerKicker}>PEMUTAR BAWAAN</Text>
          <Text numberOfLines={1} style={styles.playerTitle}>{media.type} {isLocal ? "(lokal)" : "stream"}</Text>
        </View>
        <Pressable onPress={p.onLock} style={[styles.playerButton, p.locked && styles.playerButtonActive]}>
          <Ionicons name={p.locked ? "lock-closed" : "lock-open-outline"} size={20} color={p.locked ? colors.onBrandPrimary : colors.onSurface} />
        </Pressable>
      </View>
      <View style={styles.flex}>
        <VideoView ref={ref} player={player} style={styles.playerVideo} nativeControls={!p.locked} allowsPictureInPicture contentFit="contain" />
        {p.locked && <View style={styles.lockOverlay} />}
      </View>
      <View style={styles.playerControls}>
        <Text style={styles.gestureHint}>{p.locked ? "Layar terkunci: sentuhan dinonaktifkan." : "Kunci layar agar tidak tersentuh tak sengaja."}</Text>
        <View style={styles.playerActions}>
          <Pressable onPress={p.onSpeed} style={styles.controlChip}><Ionicons name="speedometer-outline" size={17} color={colors.brand} /><Text style={styles.controlText}>{p.speed.toFixed(1)}x</Text></Pressable>
          {!isLocal && <Pressable onPress={p.onDownload} style={styles.controlChip}><Ionicons name="download-outline" size={17} color={colors.brand} /><Text style={styles.controlText}>Simpan</Text></Pressable>}
          <Pressable onPress={() => ref.current?.enterFullscreen()} style={styles.controlChip}><Ionicons name="expand-outline" size={17} color={colors.brand} /><Text style={styles.controlText}>Penuh</Text></Pressable>
        </View>
      </View>
    </View>
  );
}
