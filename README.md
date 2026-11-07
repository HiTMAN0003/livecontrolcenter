# Live Duo

Watch two YouTube lives in one window. Each side has the video and live chat. Watching and likes stay blank until you save an optional YouTube Data API key.

## Run locally

```bash
npm install
npm run dev
```

Open the URL the dev server prints (port 8080).

## Use

1. Paste a YouTube link for Live 1 and Live 2, then press Play.
2. Uncheck **Show video** to keep the chat and stop that player.
3. Optional: save a YouTube API key under **Counts**. Both lives share one request every 20 seconds (about 4,320 quota units per day if the tab stays open).

No sign-in is required to use the page.
