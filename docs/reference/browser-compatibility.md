# Browser Compatibility

Gridfinity Builder requires WASM support and a modern browser with ES2020+ capabilities.

## Verification Status

The recorded geometry/export browser checks and the September 2026 documentation
captures used Chromium 152. They are not a cross-browser certification. Firefox,
Safari, Edge, and mobile devices have not been re-tested as part of this update.
Verify preview, export, and offline behaviour on the browser you intend to use.

## Requirements

- **WebAssembly** — Required for the Manifold CSG geometry engine
- **WebGL 2** — Required for the Three.js 3D viewport
- **Web Workers** — Used for background geometry generation
- **ES2020+** — Modern JavaScript features (optional chaining, nullish coalescing)
- **Web Crypto API** — Used for encrypting GitHub tokens in localStorage

## Known Limitations

- Installation controls and service-worker storage policies depend on the browser.
- Offline use requires the application assets to have been successfully cached beforehand; optional Gist publishing still needs network access.
- Desktop-sized screens provide more space for the sidebar and simultaneous 2D/3D views. Mobile interactions and performance need separate verification.
