# PWA & Offline

Gridfinity Builder is a Progressive Web App — install it on your device for offline use.

## Installation

### Chrome / Edge (Desktop)

1. Visit [gridfinity.securedev.codes](https://gridfinity.securedev.codes/)
2. Click the install icon in the address bar (or the browser menu → "Install app")
3. The app opens in its own window

### Chrome (Android)

1. Visit the site in Chrome
2. Tap "Add to Home Screen" in the browser menu
3. The app icon appears on your home screen

### Safari (iOS / macOS)

1. Visit the site in Safari
2. Tap the Share button → "Add to Home Screen" (iOS) or "Add to Dock" (macOS)

## Offline Support

After the first visit, all assets are cached via **Service Worker** (Workbox):

- Application code and assets
- WASM binaries (Manifold CSG engine, up to 10MB limit)
- Google Fonts (runtime cache, CacheFirst strategy)

You can design, preview, and export 3MF files entirely offline.

## Updating

The app uses **autoUpdate** registration — it checks for updates in the background and applies them on next load.

To force an immediate update:

1. Scroll to the bottom of the sidebar
2. Click **"Check for Updates"**
3. This clears all caches, unregisters service workers, and hard-reloads
