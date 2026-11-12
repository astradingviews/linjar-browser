# Apex Browser (Expo / React Native)

Browser Android: multi-tab, popup blocker, deteksi video langsung, pemutar bawaan (expo-video), unduhan lokal.

## Jalankan di HP (dev)
```bash
cd frontend
npm install --legacy-peer-deps
npx expo start --android     # butuh dev build; Expo Go tidak cukup karena keyboard-controller & webview versi terbaru
```

## Build APK gratis
**A. GitHub Actions (disarankan)** — push folder ini ke repo GitHub, tab *Actions* -> *Build APK* -> *Run workflow*. APK ada di *Artifacts*.
**B. EAS Build (kuota gratis terbatas)**
```bash
cd frontend
npm i -g eas-cli && eas login
eas build -p android --profile preview
```
**C. Lokal** — butuh JDK 17 + Android SDK: `npx expo prebuild -p android && cd android && ./gradlew assembleRelease`
APK memakai debug keystore bawaan prebuild: cukup untuk pemakaian pribadi, belum untuk Play Store.

## Popup blocker
Lihat `src/adblock.ts`: override `window.open`, blokir klik `target=_blank` yang dibuat script, blokir skema `intent://`/`market://`, blokir navigasi ke host iklan (`AD_HOSTS`), dan popup native (`onOpenWindow`). Tombol *BUKA* di toast mengizinkan satu popup. Ini bukan ad-blocker penuh: request subresource (banner) tidak bisa dicegat dari react-native-webview.
