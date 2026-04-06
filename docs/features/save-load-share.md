# Save, Load & Share

## Save to Browser

Save your layouts to browser localStorage for quick access.

1. Open the **LAYOUT** section in the sidebar
2. Click "Save Layout"
3. Enter a name and press Save

Saved layouts persist across browser sessions. You can have multiple saved layouts and load any of them.

## Load Layout

Click "Load Layout" to see a dropdown of all saved layouts. Click one to load it, or click the "x" button to delete it.

## URL Sharing

Share your exact layout with anyone via a URL:

1. Click **"Copy Share Link"**
2. The entire layout is encoded in the URL hash (base64)
3. Send the link — the recipient sees your exact design when they open it

::: info
URL sharing is great for quick sharing but the URLs can be long for complex layouts. For persistent sharing, use JSON export or GitHub Gist.
:::

## JSON Export / Import

### Export

Click **"Export JSON"** to download your layout as a `.json` file containing all bin configurations, grid size, and metadata.

### Import

Click **"Import JSON"** and select a previously exported file. This replaces your current layout.

## GitHub Gist Sharing

Share your layout as a public GitHub Gist:

1. Click **"Share as GitHub Gist"**
2. A confirmation modal shows the layout summary (grid size, bin count, visibility)
3. If no token is saved, you'll be prompted for a **GitHub Personal Access Token** with `gist` scope
4. The token is encrypted with **AES-256-GCM** before storing in localStorage
5. The Gist URL is copied to your clipboard

::: tip
Create a token at [github.com/settings/tokens](https://github.com/settings/tokens/new?scopes=gist&description=Gridfinity+Builder) with only the `gist` scope.
:::
