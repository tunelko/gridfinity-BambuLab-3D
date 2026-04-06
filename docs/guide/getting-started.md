# Getting Started

## Quick Start (Live Demo)

The fastest way to try Gridfinity Builder is the live demo:

**[gridfinity.securedev.codes](https://gridfinity.securedev.codes/)**

No installation required — works in any modern browser.

## Local Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+

### Install & Run

```bash
git clone https://github.com/tunelko/gridfinity-BambuLab-3D.git
cd gridfinity-BambuLab-3D
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
npm run build
npm run preview
```

The built files will be in the `dist/` directory, ready to serve with any static file server.

## Your First Layout

1. **Choose a baseplate** — Select a printer preset (e.g., Bambu Lab A1) or set custom grid dimensions
2. **Add bins** — Click a bin preset or the "+ Place 1x1 Bin" button, then click on the grid to place
3. **Configure** — Click a bin to select it, then adjust parameters in the configurator panel
4. **Preview in 3D** — Switch to Split or 3D view to see your bins rendered
5. **Export** — Click "Export All 3MF" in the toolbar to download a file ready for your slicer
