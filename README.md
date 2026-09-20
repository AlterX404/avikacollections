# Avika Collection - deployment-ready version

This package fixes the previous deployment problem by placing a real `index.html` at the ZIP root.

## Fastest deployment

### Netlify Drop
1. Extract this ZIP.
2. Drag the **extracted folder itself** into Netlify Drop.
3. Netlify serves `index.html` automatically.

### GitHub Pages
Upload the root files of this package to your repository, then enable **Settings → Pages → Deploy from a branch** and choose the repository root.

The original React/Vinext application is preserved in `source-app/`. The root storefront is a self-contained static build so it works without Node, a database, or a special server.
