# Browser Compatibility

Gridfinity Builder requires WASM support and a modern browser with ES2020+ capabilities.

## Support Matrix

| Browser | Support | Install | Offline |
|---------|---------|---------|---------|
| **Chrome / Edge** | Full | Yes (PWA prompt) | Yes |
| **Firefox** | Full | No prompt | Yes |
| **Safari (macOS)** | Partial | Manual (Add to Dock) | Yes |
| **Safari (iOS)** | Partial | Manual (Add to Home) | Yes |

## Requirements

- **WebAssembly** — Required for the Manifold CSG geometry engine
- **WebGL 2** — Required for the Three.js 3D viewport
- **Web Workers** — Used for background geometry generation
- **ES2020+** — Modern JavaScript features (optional chaining, nullish coalescing)
- **Web Crypto API** — Used for encrypting GitHub tokens in localStorage

## Known Limitations

- **Firefox**: No install prompt for PWA, but offline caching works via Service Worker
- **Safari**: WebAssembly performance may be slower than Chromium browsers
- **Mobile**: The UI is designed for desktop; mobile works but with limited screen space for the 2D/3D viewports
