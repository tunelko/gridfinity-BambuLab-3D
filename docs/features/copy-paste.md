# Copy & Paste

Duplicate bins quickly using familiar keyboard shortcuts.

## Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + C` | Copy selected bin(s) to clipboard |
| `Ctrl + V` | Paste clipboard (auto-place in first free position) |
| `Ctrl + D` | Duplicate (copy + paste in one shot) |

## How It Works

### Copy (`Ctrl + C`)

Copies all selected bins to an internal clipboard. The **relative positions** between bins are preserved, so a group of bins will maintain their spatial arrangement when pasted.

### Paste (`Ctrl + V`)

Finds the **first free position** on the grid where the entire copied group fits without collision, and places all bins there. The new bins are automatically selected.

If there's no room on the grid, a toast message appears: "No room to paste".

### Duplicate (`Ctrl + D`)

Shortcut for copy + immediate paste. Useful for quickly creating copies of a bin or group.

## Multi-Bin Copy

When multiple bins are selected:

1. All selected bins are copied together
2. Their relative offsets from the top-left bin are preserved
3. On paste, the entire group is placed as a unit

### Example

If you have a 2x2 bin at (0,0) and a 1x1 bin at (2,0) both selected:

- Copy preserves the offset: bin 2 is 2 cells to the right of bin 1
- Paste finds the first position where both fit and places them with the same relative layout

## Clipboard Indicator

When bins are in the clipboard, a small indicator appears at the bottom-right of the 2D grid showing the count and a hint to press `Ctrl + V`.
