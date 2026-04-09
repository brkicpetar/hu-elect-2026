# HU/ELECT 2026 — Deployment Guide
# Complete step-by-step, no prior experience needed

---

## OVERVIEW

What you'll deploy:
1. The main app → Vercel (free) — your public URL
2. LibreTranslate → Render.com (free) — for article translation

Total cost: €0

---

## STEP 1 — Set up GitHub (5 minutes)

1. Go to https://github.com and create a free account if you don't have one
2. Click the "+" icon top-right → "New repository"
3. Name it: `hungary-osint`
4. Set to **Public** (required for free Vercel)
5. Click "Create repository"
6. On your computer, open a terminal (Windows: PowerShell or Terminal; Mac: Terminal)

```bash
# Navigate to the project folder (wherever you saved it)
cd path/to/hungary-osint

# Initialize git and push
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hungary-osint.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## STEP 2 — Deploy LibreTranslate on Render.com (10 minutes)

LibreTranslate is the free translation engine. You need your own instance.

1. Go to https://render.com and create a free account
2. Click "New" → "Web Service"
3. Choose "Deploy an existing image from a registry"
4. In the image field, enter: `libretranslate/libretranslate`
5. Give it a name: `libretranslate-hu`
6. Select: **Free** plan
7. Under "Environment Variables", add:
   - Key: `LT_DISABLE_WEB_UI` → Value: `false`
   - Key: `LT_LOAD_ONLY` → Value: `hu,en`
     (Serbian is not supported by LibreTranslate — hu and en only. The app uses English for both EN and SR display modes when reading Hungarian sources.)
8. Click "Deploy"
9. Wait ~5-10 minutes for it to start (free tier is slow to wake up)
10. **Copy the URL** it gives you — looks like: `https://libretranslate-hu.onrender.com`

⚠️ IMPORTANT: Free Render instances sleep after 15 minutes of inactivity.
   On first visit each day, translation may be slow for the first request.
   This is fine for your use case.

---

## STEP 3 — Deploy the app on Vercel (5 minutes)

1. Go to https://vercel.com and create a free account
   (sign up with GitHub — it's easier)
2. Click "Add New" → "Project"
3. Find `hungary-osint` in your GitHub repos and click "Import"
4. Vercel auto-detects Next.js — no framework settings needed
5. Before clicking Deploy, click **"Environment Variables"** and add:
   - Key: `NEXT_PUBLIC_LIBRETRANSLATE_URL`
   - Value: `https://libretranslate-hu.onrender.com` (your URL from Step 2)
6. Click **"Deploy"**
7. Wait ~2 minutes
8. You get a URL like: `https://hungary-osint.vercel.app`

✅ Share this URL with your friends — it works immediately, no login needed.

---

## STEP 4 — Configure your stream URLs (2 minutes)

Open `lib/config.js` and fill in the stream URLs:

```js
{ id: "rtl",  name: "RTL",  stream: "https://your-rtl-stream.m3u8" },
{ id: "ch4",  name: "Ch4",  stream: "https://your-4th-stream.m3u8" },
```

M1 and ATV are already configured.

After editing:
```bash
git add lib/config.js
git commit -m "add RTL stream"
git push
```

Vercel will automatically redeploy within 1-2 minutes.

---

## STEP 5 — Add your domain (optional, free)

In the Vercel dashboard:
- Go to your project → Settings → Domains
- Add any domain you own, or use the free `.vercel.app` URL

---

## TROUBLESHOOTING

**Streams not loading / black screen:**
- The stream URL may block cross-origin playback (CORS)
- Solution: use a CORS proxy. Add this to `next.config.js` rewrites and prefix stream URL with `/stream-proxy/`
- Or: use a free restreaming service like restream.io to republish the .m3u8

**Translation not working:**
- LibreTranslate on free Render tier sleeps. Wait 30 seconds after first request.
- Check the NEXT_PUBLIC_LIBRETRANSLATE_URL is set correctly in Vercel

**News feed empty:**
- Some RSS feeds block server-side fetching. Check Vercel function logs:
  Dashboard → your project → Functions → click the /api/news function

**ATV stream (HTTP not HTTPS):**
- Browsers block HTTP content on HTTPS pages (mixed content)
- You'll need to restream ATV through a proxy. See below.

---

## ATV STREAM FIX (if needed)

The ATV stream URL starts with `http://` which browsers block when your site is on `https://`.

Option A — Use a CORS proxy service (easiest):
Replace the ATV stream URL in config.js with:
`https://cors.eu.org/http://5.15.3.247:9988/stream/channel/79a8c00f96580b33b6599b9651cf89eb?profile=webtv-h264-aac-matrosk`

Option B — Set up a Cloudflare Worker (free) to proxy the stream:
```js
// worker.js
export default {
  async fetch(req) {
    const url = new URL(req.url);
    const target = "http://5.15.3.247:9988" + url.pathname + url.search;
    const res = await fetch(target, { headers: req.headers });
    return new Response(res.body, {
      headers: {
        ...Object.fromEntries(res.headers),
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
```
Deploy at https://workers.cloudflare.com (free), then use the worker URL in config.js.

---

## UPDATING THE PLATFORM

After any change to the code:
```bash
git add .
git commit -m "describe your change"
git push
```
Vercel redeploys automatically. Your friends see the update within ~2 minutes.

---

## ADDING MORE CHANNELS

In `lib/config.js`, edit the CHANNELS array.
You can have up to 4 channels in the 2×2 grid.
Channels with empty `stream: ""` show a placeholder tile.

## ADDING MORE RSS FEEDS

In `lib/config.js`, add to the RSS_FEEDS array:
```js
{ url: "https://example.com/rss", source: "Example", lang: "hu", category: "politics" },
```
Then push to GitHub.
