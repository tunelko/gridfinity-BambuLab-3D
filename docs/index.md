---
layout: home

hero:
  name: Gridfinity Builder
  text: Parametric CAD for 3D-printable storage
  tagline: Design bin layouts, inspect mating geometry, and export models for your slicer.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Open Application
      link: https://gridfinity.securedev.codes/
    - theme: alt
      text: GitHub
      link: https://github.com/tunelko/gridfinity-BambuLab-3D

features:
  - title: Layout editor
    details: Drag, drop, resize, and rotate bins on a real-time SVG grid with collision detection and snap-to-grid.
  - title: Geometry inspection
    details: See your bins rendered in 3D with PBR materials, X-Ray mode, and Blueprint mode — powered by Three.js.
  - title: Mating profiles
    details: Fixed foot and socket profiles, dimensional tests, and a printable fit kit. Validate physical fit with your own printer and material.
  - title: ZIP, 3MF and STL output
    details: Download a ZIP with a complete 3MF and one STL per part, or choose direct 3MF. Normal exports exclude the preview baseplate; Fit Test includes a small printable baseplate.
  - title: Editing tools
    details: Shift+Click multi-selection, Ctrl+C/V/D for copy-paste, Ctrl+A select all, with bulk group and color assignment.
  - title: Local workflow
    details: Generate models in the browser, save layouts locally, and use cached application assets offline. Publishing to GitHub Gist is optional.
---

![Gridfinity Builder production application with six bins in the 3D viewport](/images/workspace-3d.png)

Actual application capture, September 2026. Start with the [fit test](/guide/fit-test), review the [dimensional reference](/reference/specification), and check the [export validation boundary](/features/export#validation-and-compatibility).
