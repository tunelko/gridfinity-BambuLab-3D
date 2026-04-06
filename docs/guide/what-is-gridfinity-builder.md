# What is Gridfinity Builder?

**Gridfinity Builder** is a browser-based parametric CAD tool for designing, previewing, and exporting 3D-printable [Gridfinity](https://gridfinity.xyz) storage layouts.

Built for makers, 3D printing enthusiasts, and anyone who wants to organize their workspace with the Gridfinity modular storage system.

> Gridfinity is an open-source modular storage system created by [Zack Freedman](https://www.youtube.com/@ZackFreedman). This tool helps you design custom bin layouts and export them as 3MF files ready for slicing.

## Why Gridfinity Builder?

- **No installation** — runs entirely in the browser (or install as PWA for offline use)
- **Real-time 3D preview** — see your bins as you design them
- **Accurate geometry** — follows the official Gridfinity specification with precise dimensions
- **Export to 3MF** — watertight meshes ready for Bambu Studio, PrusaSlicer, or Cura
- **Fully client-side** — no server, no uploads, your data stays local

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 + TypeScript | UI framework |
| Vite 6 | Build tool |
| Three.js | 3D rendering |
| Manifold 3D (WASM) | CSG geometry engine |
| Zustand | State management |
| Tailwind CSS 4 | Styling |
| JSZip | 3MF export packaging |
| Workbox (PWA) | Offline caching |
