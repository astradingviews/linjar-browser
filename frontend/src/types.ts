export type Screen = "home" | "browser" | "tabs" | "downloads" | "player";
export type Engine = "Google" | "DuckDuckGo";
export type MediaItem = { url: string; type: "MP4" | "WEBM" | "HLS" | "MEDIA"; referer?: string };
export type BrowserTab = {
  id: string;
  url: string; // URL saat ini (diupdate dari WebView)
  navUrl: string; // URL yang diminta user (mengubah ini = navigasi)
  title: string;
  incognito: boolean;
  desktop: boolean;
  canGoBack: boolean;
  gen: number; // naik = WebView dibuat ulang (ganti UA / mode privat / popup guard)
};
export type DownloadItem = {
  id: string;
  url: string;
  name: string;
  status: "downloading" | "done" | "failed";
  progress: number; // 0..1
  type: string;
  localUri?: string;
};
