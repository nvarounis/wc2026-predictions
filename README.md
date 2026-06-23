# WC 2026 Predictions League

Static GitHub Pages website that reads live data from a Google Sheet and displays:

- match results from `ΑΠΟΤΕΛΕΣΜΑΤΑ`
- leaderboard from `ΑΠΟΤΕΛΕΣΜΑΤΑ`
- predictions from each player sheet

The sheets `stats` and `stats-2` are intentionally ignored.

## Google Sheet setup

1. Open the Google Sheet.
2. Go to **File → Share → Publish to web**.
3. Publish the spreadsheet or at least the sheets used by the site.
4. Keep sheet names exactly as listed in `app.js`.

## GitHub Pages setup

1. Create a public GitHub repository, for example `wc2026-platform`.
2. Upload `index.html`, `style.css`, `app.js`, and `README.md`.
3. Go to **Settings → Pages**.
4. Source: **Deploy from a branch**.
5. Branch: `main`, folder: `/root`.
6. Save. GitHub will provide the website URL.

## Change Google Sheet

Edit this value in `app.js`:

```js
spreadsheetId: '1nPgDATdA6U3_OHBuJwrXQcOWT0Lq9dU25QkpdlPDE1g'
```
