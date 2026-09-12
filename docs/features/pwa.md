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

Workbox precaches the production application bundle and matching assets after
service-worker installation. Fonts are cached when fetched successfully:

- Application code and assets
- WASM binaries (Manifold CSG engine, up to 10MB limit)
- Google Fonts (runtime cache, CacheFirst strategy)

With the required assets cached, geometry generation and ZIP/3MF/STL export can run
offline. A first visit without a network connection cannot populate that cache.
Optional GitHub Gist publishing always requires network access.

## Updating

The Vite PWA configuration uses `registerType: 'prompt'`, not `autoUpdate`.
Do not assume that an already-open tab is running the latest deployment.

To force an immediate update:

1. Scroll to the bottom of the sidebar
2. Click **"Check for Updates"**
3. This clears all caches, unregisters service workers, and hard-reloads
