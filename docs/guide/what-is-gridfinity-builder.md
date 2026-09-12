# What is Gridfinity Builder?

**Gridfinity Builder** is a browser-based parametric CAD tool for designing, previewing, and exporting 3D-printable [Gridfinity](https://gridfinity.xyz) storage layouts.

Built for makers, 3D printing enthusiasts, and anyone who wants to organize their workspace with the Gridfinity modular storage system.

> Gridfinity is an open-source modular storage system created by [Zack Freedman](https://www.youtube.com/@ZackFreedman). This tool helps you design custom bin layouts and download 3MF and STL geometry for your slicer.

## Why Gridfinity Builder?

- **No installation** — runs entirely in the browser (or install as PWA for offline use)
- **Real-time 3D preview** — see your bins as you design them
- **Mating geometry** — follows the community Gridfinity drawing, with dimensional tests and a printable [fit test](/guide/fit-test)
- **ZIP, 3MF and STL export** — a complete 3MF plus one STL per part, or direct 3MF; automated mesh round-trip checks do not replace slicer-specific validation
- **Local geometry generation** — preview and export run in the browser; optional GitHub Gist sharing uploads a layout only when requested

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React 18 + TypeScript | UI framework |
| Vite 8 | Application build tool |
| Three.js | 3D rendering |
| Manifold 3D (WASM) | CSG geometry engine |
| Zustand | State management |
| Tailwind CSS 4 | Styling |
| JSZip | 3MF and download ZIP packaging |
| Workbox (PWA) | Offline caching |

![Production application with a six-bin layout](/images/workspace-3d.png)

See [export contents and validation](../features/export.md) and [dimensional reference](../reference/specification.md) before printing.
