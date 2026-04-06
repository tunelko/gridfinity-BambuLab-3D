# Bill of Materials

The BOM section appears automatically when you have bins on the grid. It provides a summary of your layout with cost estimation.

## Summary

Bins are grouped by type (same W x D x H dimensions):

```
2x  Small Parts     1x1x3u
1x  Deep Bin        2x2x6u
3x  Socket Tray     2x2x2u
```

## Calculations

| Metric | Formula |
|--------|---------|
| **Total volume** | Sum of plastic volume for all bins (cm³) |
| **PLA weight** | Volume × 1.24 g/cm³ (PLA density) |
| **Cost** | Weight × price per kg |

### Volume Calculation

The plastic volume is the **outer volume minus the inner cavity**:

```
Outer: outerW × outerD × totalH
Inner: (outerW - 2×wall) × (outerD - 2×wall) × (totalH - bottom - base)
Plastic = Outer - Inner
```

## Cost Estimator

The price per kg is configurable (default: 20 €/kg). Adjust it to match your filament cost.

The total cost is displayed in accent color at the bottom of the BOM section.

::: tip
This is an estimate of filament cost only. Actual weight may vary depending on infill percentage, supports, and slicer settings.
:::
