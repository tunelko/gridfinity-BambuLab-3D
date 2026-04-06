import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Gridfinity Builder',
  description: 'Browser-based parametric CAD tool for Gridfinity storage layouts',
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg' }],
  ],
  vite: {
    server: {
      allowedHosts: ['gridfinity-docs.securedev.codes'],
    },
  },

  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'Gridfinity Builder',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/2d-grid' },
      { text: 'Reference', link: '/reference/specification' },
      { text: 'Live Demo', link: 'https://gridfinity.securedev.codes/' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Gridfinity Builder?', link: '/guide/what-is-gridfinity-builder' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Docker Setup', link: '/guide/docker' },
        ],
      },
      {
        text: 'Features',
        items: [
          { text: '2D Grid Editor', link: '/features/2d-grid' },
          { text: '3D Preview', link: '/features/3d-preview' },
          { text: 'Bin Configuration', link: '/features/bin-configuration' },
          { text: '3MF Export', link: '/features/export' },
          { text: 'Multi-Selection', link: '/features/multi-selection' },
          { text: 'Copy & Paste', link: '/features/copy-paste' },
          { text: 'Groups & Templates', link: '/features/groups-templates' },
          { text: 'Save, Load & Share', link: '/features/save-load-share' },
          { text: 'Auto-Fill & Optimization', link: '/features/auto-fill' },
          { text: 'Bill of Materials', link: '/features/bom' },
          { text: 'PWA & Offline', link: '/features/pwa' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Gridfinity Specification', link: '/reference/specification' },
          { text: 'Printer Presets', link: '/reference/printer-presets' },
          { text: 'Bin Presets', link: '/reference/bin-presets' },
          { text: 'Keyboard Shortcuts', link: '/reference/keyboard-shortcuts' },
          { text: 'Browser Compatibility', link: '/reference/browser-compatibility' },
        ],
      },
      {
        text: 'Architecture',
        items: [
          { text: 'Project Structure', link: '/architecture/project-structure' },
          { text: 'Geometry Pipeline', link: '/architecture/geometry-pipeline' },
          { text: 'CSG Algorithm', link: '/architecture/csg-algorithm' },
          { text: '3MF Format', link: '/architecture/3mf-format' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/tunelko/gridfinity-BambuLab-3D' },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/tunelko/gridfinity-BambuLab-3D/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Gridfinity is MIT licensed by <a href="https://www.youtube.com/@ZackFreedman">Zack Freedman</a>',
      copyright: 'Built by <a href="https://github.com/tunelko">tunelko</a>',
    },
  },
})
