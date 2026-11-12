import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { ActivityIndicator, Alert, BackHandler, Keyboard, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest, WebViewMessageEvent, WebViewNavigation } from "react-native-webview/lib/WebViewTypes";

import { isAdUrl, isAllowedScheme, mediaSniffScript, popupGuardScript } from "@/src/adblock";
import { storage } from "@/src/storage";
import { useStyles } from "@/src/styles";
import { useTheme } from "@/src/theme";
import type { BrowserTab, DownloadItem, Engine, MediaItem, Screen } from "@/src/types";
import { DownloadsView, HomeView, PlayerView, TabsView } from "@/src/views";

const BrowserWebView = WebView as unknown as ComponentType<Record<string, unknown>>;

const HOME_URL = "https://www.google.com";
const MAX_TABS = 8;
const DESKTOP_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MEDIA_RE = /\.(mp4|mkv|webm|m3u8|mpd)(\?|#|$)/i;

function normalizeUrl(value: string, engine: Engine) {
  const t = value.trim();
  if (!t) return HOME_URL;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([/?#].*)?$/i.test(t)) return `http://${t}`;
  if (/^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(t)) return `https://${t}`;
  return `${engine === "Google" ? "https://www.google.com/search?q=" : "https://duckduckgo.com/?q="}${encodeURIComponent(t)}`;
}

function mediaFromUrl(url: string, referer?: string): MediaItem {
  const l = url.toLowerCase();
  const type = l.includes(".m3u8") || l.includes(".mpd") ? "HLS" : l.includes(".webm") ? "WEBM" : l.includes(".mp4") ? "MP4" : "MEDIA";
  return { url, type, referer };
}

const newTab = (url = HOME_URL): BrowserTab => ({
  id: `tab-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  url, navUrl: url, title: "Tab baru", incognito: false, desktop: false, canGoBack: false, gen: 0,
});

export default function Index() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const webRefs = useRef<Record<string, WebView | null>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [screen, setScreen] = useState<Screen>("home");
  const [engine, setEngine] = useState<Engine>("Google");
  const [query, setQuery] = useState("");
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [newTab()]);
  const [activeTab, setActiveTab] = useState(() => "");
  const [address, setAddress] = useState(HOME_URL);
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaItem | null>(null);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [downloadsLoaded, setDownloadsLoaded] = useState(false);
  const [playerSpeed, setPlayerSpeed] = useState(1);
  const [playerLocked, setPlayerLocked] = useState(false);
  const [blocker, setBlocker] = useState(true);
  const [blockedCount, setBlockedCount] = useState(0);
  const [toast, setToast] = useState<{ url: string } | null>(null);

  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  const activeId = active.id;

  useEffect(() => { if (!activeTab) setActiveTab(tabs[0].id); }, [activeTab, tabs]);

  // Muat unduhan; item yang menggantung "downloading" dari sesi lalu dianggap gagal.
  useEffect(() => {
    storage.get<DownloadItem[]>("apex_downloads", []).then((saved) => {
      setDownloads(saved.map((d) => (d.status === "downloading" ? { ...d, status: "failed" as const } : d)));
      setDownloadsLoaded(true);
    });
    storage.get<boolean>("apex_blocker", true).then(setBlocker);
  }, []);
  useEffect(() => { if (downloadsLoaded) storage.set("apex_downloads", downloads); }, [downloads, downloadsLoaded]);

  const patchTab = useCallback((id: string, patch: Partial<BrowserTab>) => {
    setTabs((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  // Buat ulang WebView tab (dibutuhkan saat ganti User-Agent, mode privat, atau popup guard).
  const remount = useCallback((id: string, patch: Partial<BrowserTab> = {}) => {
    setTabs((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch, navUrl: t.url, gen: t.gen + 1 } : t)));
  }, []);

  const openUrl = useCallback((value: string) => {
    const url = normalizeUrl(value, engine);
    patchTab(activeId, { navUrl: url, url });
    setAddress(url);
    setMedia(null);
    setScreen("browser");
    Keyboard.dismiss();
  }, [engine, patchTab, activeId]);

  const showToast = useCallback((url: string) => {
    setToast({ url });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const onPopupBlocked = useCallback((url: string) => {
    setBlockedCount((c) => c + 1);
    showToast(url);
  }, [showToast]);

  const toggleBlocker = () => {
    const next = !blocker;
    setBlocker(next);
    storage.set("apex_blocker", next);
    setTabs((cur) => cur.map((t) => ({ ...t, navUrl: t.url, gen: t.gen + 1 })));
  };

  const onWebMessage = (tabId: string) => (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "media" && data.url && tabId === activeId) setMedia(mediaFromUrl(data.url, active.url));
      else if (data.type === "popup" && blocker) onPopupBlocked(String(data.url || ""));
    } catch { /* halaman bisa mengirim string sembarang */ }
  };

  const shouldLoad = (req: ShouldStartLoadRequest) => {
    if (!isAllowedScheme(req.url)) return false; // intent://, market://, dll
    if (blocker && isAdUrl(req.url)) { onPopupBlocked(req.url); return false; }
    if (MEDIA_RE.test(req.url)) setMedia(mediaFromUrl(req.url, active.url));
    return true;
  };

  const allowPopup = () => {
    if (toast?.url && /^https?:/i.test(toast.url)) openUrl(toast.url);
    setToast(null);
  };

  const startDownload = useCallback(async (item: MediaItem) => {
    if (item.type === "HLS") {
      Alert.alert("Stream HLS/DASH", "Stream ini bisa diputar, tetapi belum bisa disimpan sebagai satu file.");
      return;
    }
    if (Platform.OS === "web" || !FileSystem.documentDirectory) {
      Alert.alert("Unduhan", "Unduhan lokal hanya tersedia di build Android/iOS.");
      return;
    }
    const id = `${Date.now()}`;
    const ext = item.type === "WEBM" ? "webm" : "mp4";
    const name = `apex-${id}.${ext}`;
    const dir = `${FileSystem.documentDirectory}downloads/`;
    const dest = `${dir}${name}`;
    setDownloads((cur) => [{ id, url: item.url, name, status: "downloading", progress: 0, type: item.type }, ...cur]);
    const update = (patch: Partial<DownloadItem>) => setDownloads((cur) => cur.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      let lastStep = 0;
      const task = FileSystem.createDownloadResumable(
        item.url, dest, item.referer ? { headers: { Referer: item.referer } } : {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite <= 0) return;
          const p = totalBytesWritten / totalBytesExpectedToWrite;
          if (p - lastStep >= 0.05) { lastStep = p; update({ progress: p }); }
        },
      );
      const result = await task.downloadAsync();
      if (result && result.status === 200) update({ status: "done", progress: 1, localUri: result.uri });
      else { update({ status: "failed" }); FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {}); }
    } catch {
      update({ status: "failed" });
    }
    setScreen("downloads");
  }, []);

  const deleteDownload = (d: DownloadItem) => {
    if (d.localUri) FileSystem.deleteAsync(d.localUri, { idempotent: true }).catch(() => {});
    setDownloads((cur) => cur.filter((x) => x.id !== d.id));
  };

  const openPlayer = (item: MediaItem) => { setMedia(item); setPlayerLocked(false); setPlayerSpeed(1); setScreen("player"); };

  const switchTab = (tab: BrowserTab) => { setActiveTab(tab.id); setAddress(tab.url); setMedia(null); setScreen("browser"); };
  const addTab = () => {
    if (tabs.length >= MAX_TABS) { Alert.alert("Tab penuh", `Maksimal ${MAX_TABS} tab.`); return; }
    const t = newTab();
    setTabs((cur) => [...cur, t]);
    setActiveTab(t.id); setAddress(t.url); setMedia(null); setScreen("browser");
  };
  const closeTab = (id: string) => {
    delete webRefs.current[id];
    if (tabs.length === 1) { const t = newTab(); setTabs([t]); setActiveTab(t.id); setAddress(t.url); return; }
    const idx = tabs.findIndex((t) => t.id === id);
    const rest = tabs.filter((t) => t.id !== id);
    setTabs(rest);
    if (id === activeId) { const next = rest[Math.min(idx, rest.length - 1)]; setActiveTab(next.id); setAddress(next.url); }
  };

  // Tombol back Android: riwayat WebView -> Home -> keluar.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screen === "player") { setScreen("browser"); return true; }
      if (screen === "browser" && active.canGoBack) { webRefs.current[activeId]?.goBack(); return true; }
      if (screen !== "home") { setScreen("home"); return true; }
      return false;
    });
    return () => sub.remove();
  }, [screen, active.canGoBack, activeId]);

  const showBrowser = screen === "browser";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.content, { paddingTop: insets.top + 12 }]}>
        {screen !== "player" && (
          <View style={styles.brandRow}>
            <View>
              <Text style={styles.eyebrow}>APEX / MOBILE WEB</Text>
              <Text style={styles.brandTitle}>Apex <Text style={styles.brandAccent}>Browser</Text></Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{active.incognito ? "PRIVATE" : "READY"}</Text>
            </View>
          </View>
        )}

        {/* Browser tetap ter-mount (disembunyikan) agar halaman & riwayat tidak hilang saat pindah layar */}
        <View style={showBrowser ? styles.browserFrame : styles.hidden}>
          <View style={styles.browserToolbar}>
            <Pressable accessibilityLabel="Kembali" onPress={() => webRefs.current[activeId]?.goBack()} style={styles.iconButton}><Ionicons name="arrow-back" size={20} color={colors.onSurface} /></Pressable>
            <TextInput testID="browser-address-input" value={address} onChangeText={setAddress} onSubmitEditing={() => openUrl(address)} autoCapitalize="none" autoCorrect={false} selectTextOnFocus style={styles.addressInput} placeholder="Ketik URL atau cari" placeholderTextColor={colors.muted} />
            <Pressable accessibilityLabel="Muat ulang" onPress={() => webRefs.current[activeId]?.reload()} style={styles.iconButton}><Ionicons name="refresh" size={19} color={colors.onSurface} /></Pressable>
          </View>
          <View style={styles.browserSubbar}>
            <Pressable testID="desktop-toggle" onPress={() => remount(activeId, { desktop: !active.desktop })} style={[styles.modeChip, active.desktop && styles.modeChipActive]}>
              <Ionicons name="desktop-outline" size={14} color={active.desktop ? colors.onBrandTertiary : colors.muted} />
              <Text style={[styles.modeText, active.desktop && { color: colors.onBrandTertiary }]}>Desktop</Text>
            </Pressable>
            <Pressable testID="private-toggle" onPress={() => remount(activeId, { incognito: !active.incognito })} style={[styles.modeChip, active.incognito && styles.incognitoChip]}>
              <Ionicons name="eye-off-outline" size={14} color={active.incognito ? colors.onBrandTertiary : colors.muted} />
              <Text style={[styles.modeText, active.incognito && { color: colors.onBrandTertiary }]}>Private</Text>
            </Pressable>
            <Pressable testID="popup-toggle" onPress={toggleBlocker} style={[styles.modeChip, blocker && styles.modeChipActive]}>
              <Ionicons name="shield-outline" size={14} color={blocker ? colors.onBrandTertiary : colors.muted} />
              <Text style={[styles.modeText, blocker && { color: colors.onBrandTertiary }]}>Popup {blocker ? `ON${blockedCount ? ` · ${blockedCount}` : ""}` : "OFF"}</Text>
            </Pressable>
            {loading && <ActivityIndicator size="small" color={colors.brand} />}
          </View>

          {Platform.OS === "web" ? (
            <View style={styles.webPreviewFallback}>
              <Ionicons name="phone-portrait-outline" size={34} color={colors.brand} />
              <Text style={styles.webPreviewTitle}>WebView native</Text>
              <Text style={styles.webPreviewBody}>Browsing aktif di build Android/iOS.</Text>
            </View>
          ) : (
            <View style={styles.flex}>
              {tabs.map((tab) => (
                <BrowserWebView
                  key={`${tab.id}-${tab.gen}`}
                  ref={(r: WebView | null) => { webRefs.current[tab.id] = r; }}
                  source={{ uri: tab.navUrl }}
                  style={tab.id === activeId ? styles.webview : styles.hidden}
                  javaScriptEnabled
                  domStorageEnabled
                  incognito={tab.incognito}
                  cacheEnabled={!tab.incognito}
                  thirdPartyCookiesEnabled={!tab.incognito}
                  userAgent={tab.desktop ? DESKTOP_UA : undefined}
                  injectedJavaScriptBeforeContentLoaded={blocker ? popupGuardScript : undefined}
                  injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
                  injectedJavaScript={mediaSniffScript}
                  onMessage={onWebMessage(tab.id)}
                  onOpenWindow={(e: { nativeEvent: { targetUrl: string } }) => {
                    // Popup native (window.open / target=_blank dari iframe). Diblokir bila popup guard ON.
                    if (blocker) onPopupBlocked(e.nativeEvent.targetUrl);
                    else if (tab.id === activeId) openUrl(e.nativeEvent.targetUrl);
                  }}
                  onLoadStart={() => { if (tab.id === activeId) { setLoading(true); setMedia(null); } }}
                  onLoadEnd={() => { if (tab.id === activeId) setLoading(false); }}
                  onNavigationStateChange={(s: WebViewNavigation) => {
                    patchTab(tab.id, { url: s.url, title: s.title || tab.title, canGoBack: s.canGoBack });
                    if (tab.id === activeId) setAddress(s.url);
                  }}
                  onShouldStartLoadWithRequest={shouldLoad}
                  setSupportMultipleWindows
                  allowsFullscreenVideo
                  mediaPlaybackRequiresUserAction
                  originWhitelist={["http://*", "https://*", "about:*"]}
                />
              ))}
            </View>
          )}

          {media && (
            <Pressable onPress={() => openPlayer(media)} style={({ pressed }) => [styles.snifferFab, pressed && styles.pressed]}>
              <Ionicons name="sparkles" size={18} color={colors.onBrandPrimary} />
              <View>
                <Text style={styles.snifferTitle}>Media terdeteksi</Text>
                <Text style={styles.snifferMeta}>{media.type} · Ketuk untuk memutar</Text>
              </View>
            </Pressable>
          )}
          {toast && !media && (
            <View style={styles.toast}>
              <Ionicons name="shield-checkmark" size={18} color={colors.brand} />
              <Text numberOfLines={2} style={styles.toastText}>Popup diblokir{toast.url ? `: ${toast.url}` : ""}</Text>
              <Pressable onPress={allowPopup} hitSlop={8}><Text style={styles.toastAction}>BUKA</Text></Pressable>
            </View>
          )}
        </View>

        {screen === "home" && (
          <HomeView query={query} setQuery={setQuery} engine={engine} setEngine={setEngine} submitSearch={() => openUrl(query)} openUrl={openUrl} styles={styles} colors={colors} media={media} onPlay={() => media && openPlayer(media)} />
        )}
        {screen === "tabs" && <TabsView tabs={tabs} activeTab={activeId} onSwitch={switchTab} onAdd={addTab} onClose={closeTab} styles={styles} colors={colors} />}
        {screen === "downloads" && (
          <DownloadsView downloads={downloads} onPlay={(d) => d.localUri && openPlayer({ url: d.localUri, type: d.type as MediaItem["type"] })} onDelete={deleteDownload} styles={styles} colors={colors} />
        )}
        {screen === "player" && media && (
          <PlayerView media={media} locked={playerLocked} speed={playerSpeed} onLock={() => setPlayerLocked((v) => !v)} onSpeed={() => setPlayerSpeed((v) => (v >= 2 ? 0.5 : v + 0.5))} onDownload={() => startDownload(media)} onBack={() => setScreen("browser")} styles={styles} colors={colors} />
        )}
      </View>

      {screen !== "player" && (
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {([["home", "Home", "home-outline"], ["browser", "Browser", "globe-outline"], ["tabs", "Tabs", "copy-outline"], ["downloads", "Unduhan", "download-outline"]] as const).map(([key, label, icon]) => (
            <Pressable key={key} testID={`nav-${key}`} onPress={() => setScreen(key)} style={({ pressed }) => [styles.navItem, screen === key && styles.navItemActive, pressed && styles.pressed]}>
              <Ionicons name={icon} size={21} color={screen === key ? colors.brand : colors.muted} />
              <Text style={[styles.navLabel, screen === key && styles.navLabelActive]}>{label}</Text>
              {key === "tabs" && <View style={styles.tabCount}><Text style={styles.tabCountText}>{tabs.length}</Text></View>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
