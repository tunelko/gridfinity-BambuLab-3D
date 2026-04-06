# Multi-Selection

Select multiple bins at once to perform bulk actions like group assignment, color changes, or deletion.

## How to Select

| Action | Result |
|--------|--------|
| **Click** a bin | Select only that bin (deselects others) |
| **Shift + Click** a bin | Toggle it in/out of the selection |
| **Ctrl + A** | Select all bins |
| **Click** empty space | Deselect all |

Multi-selection works both on the **2D grid** and in the **sidebar bin list**.

## Visual Feedback

- All selected bins show a **pulsing accent glow** on the 2D grid
- The sidebar highlights all selected bins in the list
- A badge at the top-left of the grid shows: `N selected | C copy | D dup | Del remove`

## Bulk Actions

When multiple bins are selected, a **bulk actions panel** appears in the sidebar:

### Group Assignment

Assign all selected bins to a group with one click. The group buttons show a highlight when all selected bins share the same group.

### Color Assignment

Change the color of all selected bins at once using the color palette.

### Bulk Delete

Remove all selected bins with the "Delete N Bins" button, or press `Delete` / `Backspace`.

## Single Selection Behavior

When only one bin is selected, the full **Bin Configurator** panel appears with all parameters (dimensions, features, appearance). Resize handles, rotate handle, and divider controls are only available for single selection.
