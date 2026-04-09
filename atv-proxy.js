// /api/atv-proxy.js
// Proxies the ATV HTTP stream through Vercel (HTTPS) with correct headers.
// This solves two problems:
//   1. Mixed content (HTTP stream on HTTPS page)
//   2. 403 Forbidden (ATV server checks Referer/User-Agent)
//
// NOTE: Vercel serverless functions have a 10s timeout on free tier and are
// NOT suitable for full video stream proxying (too much data). Instead, we only
// proxy the .m3u8 playlist and rewrite the segment URLs to go through this proxy
// as well. This is the standard approach for HLS proxying.

const ATV_BASE = "http://5.15.3.247:9988";
const ATV_STREAM_PATH = "/stream/channel/79a8c00f96580b33b6599b9651cf89eb";

const SPOOF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "http://www.atv.hu/",
  "Origin": "http://www.atv.hu",
};

export default async function handler(req, res) {
  // Set CORS headers so browser can access
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Build target URL — pass through any query params
  const query = new URLSearchParams(req.query).toString();
  const targetPath = req.query._path
    ? decodeURIComponent(req.query._path)
    : `${ATV_STREAM_PATH}?profile=webtv-h264-aac-matrosk`;

  const targetUrl = targetPath.startsWith("http")
    ? targetPath
    : `${ATV_BASE}${targetPath}${query && !targetPath.includes("?") ? "?" + query : ""}`;

  try {
    const upstream = await fetch(targetUrl, {
      headers: SPOOF_HEADERS,
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-store");

    // For m3u8 playlists, rewrite segment URLs to go through this proxy
    if (contentType.includes("mpegurl") || targetUrl.includes(".m3u8")) {
      const text = await upstream.text();
      // Rewrite absolute URLs in the playlist
      const rewritten = text.replace(
        /(https?:\/\/[^\s\n]+)/g,
        (url) => `/api/atv-proxy?_path=${encodeURIComponent(url)}`
      );
      return res.send(rewritten);
    }

    // For .ts segments and other binary, stream through
    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("ATV proxy error:", err.message);
    res.status(502).json({ error: err.message });
  }
}

export const config = {
  api: {
    responseLimit: "50mb",
  },
};
