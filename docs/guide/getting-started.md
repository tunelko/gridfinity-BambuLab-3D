# Getting Started

## Quick Start (Live Demo)

The fastest way to try Gridfinity Builder is the live demo:

**[gridfinity.securedev.codes](https://gridfinity.securedev.codes/)**

No installation is required. Use a browser with WebAssembly, Web Workers, and WebGL 2; see [browser requirements](../reference/browser-compatibility.md).

## Local Development

### Prerequisites

- Node.js 24, matching CI and Docker builds
- The npm version bundled with Node.js 24

### Install & Run

```bash
git clone https://github.com/tunelko/gridfinity-BambuLab-3D.git
cd gridfinity-BambuLab-3D
npm ci
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
5. **Check the fit** — Download **Fit Test**, check its dimensions in your slicer, and print the test pieces before a large layout
6. **Export** — Click **Export All** for the layout or **Export Bin** for the selected bin

![Layout editor and matching 3D preview](/images/workspace-overview.png)

The default **ZIP (3MF + STL)** download includes `model.3mf` and one STL per part. Extract it before importing either format; choose **3MF only** for a direct download. The displayed baseplate is a preview reference, not part of a normal bin export. These files contain geometry, not a configured printer profile or toolpaths. Follow the [fit-test guide](./fit-test.md) and [export instructions](../features/export.md).

## Documentation and checks

```bash
npm test
npm run export:fit-test
npm ci --prefix docs
npm run build --prefix docs
```

The fit kit is written to `artifacts/gridfinity-fit-test.3mf`. Documentation is built in `docs/.vitepress/dist/`. Automated checks do not replace slicer import and physical print checks.
