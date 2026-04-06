# Auto-Fill & Optimization

## Auto-Fill

Fill all empty grid space with bins of a chosen size.

1. Open the **AUTO-FILL** section in the sidebar
2. Set the desired bin size (W x D x H)
3. Click **"Fill Empty Space"**

The algorithm scans the grid row-by-row and places bins in every available space. A toast shows how many bins were placed.

## Optimize Layout

Automatically find the **smallest baseplate** that fits all your bins.

1. Open the **TOOLS** section
2. Click **"Optimize Layout"**

The optimizer uses a greedy bin-packing heuristic:

1. Sorts bins by area (largest first)
2. Tries all possible grid sizes from smallest to current
3. Attempts to pack all bins using a first-fit algorithm
4. If a smaller grid works, it re-packs all bins and resizes the grid

::: info
The optimizer preserves all bin configurations (features, labels, groups) — only positions change.
:::

## Print Labels

Generate a printable label sheet for all your bins:

1. Click **"Print Labels"** in TOOLS
2. A new window opens with formatted labels
3. The browser print dialog appears automatically

Each label shows:
- Bin name
- Grid units (e.g., 2x2x3u)
- Real-world dimensions in mm
- Grid position
- Features (dividers, stacking lip, magnets)
