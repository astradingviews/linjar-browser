// Daftar host iklan/popup umum. Tambah sendiri sesuai kebutuhan.
export const AD_HOSTS = [
  "doubleclick.net", "googlesyndication.com", "googleadservices.com", "adservice.google.com",
  "popads.net", "popcash.net", "propellerads.com", "propellerclick.com", "exoclick.com",
  "exosrv.com", "juicyads.com", "trafficjunky.com", "adsterra.com", "adcash.com",
  "clickadu.com", "hilltopads.net", "adnxs.com", "taboola.com", "outbrain.com",
  "mgid.com", "revcontent.com", "zedo.com", "popunder.net", "ad-maven.com",
  "onclickads.net", "onclkds.com", "richpartners.com", "a-ads.com", "bidvertiser.com",
  "adskeeper.com", "yllix.com", "monetag.com", "profitablegatecpm.com", "highperformanceformat.com",
];

export function hostOf(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(url);
  return m ? m[1].toLowerCase() : "";
}

export function isAdUrl(url: string): boolean {
  const host = hostOf(url);
  return !!host && AD_HOSTS.some((d) => host === d || host.endsWith("." + d));
}

// Hanya http(s) dan about:blank yang boleh dimuat. intent://, market://, dll diblokir
// (dipakai iklan untuk memaksa membuka app/Play Store).
export function isAllowedScheme(url: string): boolean {
  return /^(https?:|about:blank|data:text\/html|blob:)/i.test(url);
}

// Dijalankan SEBELUM halaman dimuat, di semua frame (termasuk iframe iklan).
export const popupGuardScript = `
(function () {
  if (window.__apexGuard) return; window.__apexGuard = true;
  var last = 0;
  var mark = function () { last = Date.now(); };
  ['touchstart', 'mousedown', 'keydown'].forEach(function (t) { document.addEventListener(t, mark, true); });
  var post = function (o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} };
  window.open = function (url) { post({ type: 'popup', url: String(url || '') }); return null; };
  var realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.target === '_blank' && Date.now() - last > 800) { post({ type: 'popup', url: this.href }); return; }
    return realClick.apply(this, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[target=_blank]') : null;
    if (a && !e.isTrusted) { e.preventDefault(); e.stopImmediatePropagation(); post({ type: 'popup', url: a.href }); }
  }, true);
})(); true;
`;

// Dijalankan setelah halaman dimuat: deteksi URL media langsung.
export const mediaSniffScript = `
(function () {
  if (window.__apexSniff) return; window.__apexSniff = true;
  var re = /\\.(mp4|webm|mkv|m3u8|mpd)(\\?|#|$)/i;
  var sent = {};
  var send = function (u) {
    if (!u || sent[u] || u.indexOf('blob:') === 0 || !re.test(u)) return;
    sent[u] = 1;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'media', url: u })); } catch (e) {}
  };
  var scan = function () {
    document.querySelectorAll('video, video source, audio, audio source').forEach(function (n) { send(n.currentSrc || n.src); });
  };
  scan();
  try { new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] }); } catch (e) {}
  try {
    new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { send(e.name); }); }).observe({ type: 'resource', buffered: true });
  } catch (e) {}
})(); true;
`;
