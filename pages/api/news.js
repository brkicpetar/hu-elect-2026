import Parser from "rss-parser";
import { RSS_FEEDS, LIBRETRANSLATE_URL } from "../../lib/config";

const parser = new Parser({
  customFields: {
    item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"], ["enclosure", "enclosure"]],
  },
});

// Simple string similarity for deduplication
function similarity(a, b) {
  const normalize = (s) => s.toLowerCase().replace(/[^a-záéíóöőúüű\s]/gi, "").trim();
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  const wordsA = new Set(na.split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(/\s+/).filter((w) => w.length > 3));
  if (!wordsA.size) return 0;
  let shared = 0;
  wordsA.forEach((w) => { if (wordsB.has(w)) shared++; });
  return shared / Math.max(wordsA.size, wordsB.size);
}

function extractThumbnail(item) {
  if (item.mediaContent?.["$"]?.url) return item.mediaContent["$"].url;
  if (item.mediaThumbnail?.["$"]?.url) return item.mediaThumbnail["$"].url;
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image")) return item.enclosure.url;
  // try to pull first img from content
  const match = (item["content:encoded"] || item.content || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

async function translateBatch(texts, sourceLang) {
  if (!texts.length) return null;
  try {
    // LibreTranslate does not support Serbian (sr) as a target language.
    // We translate to English only. The frontend uses English for both
    // the "en" and "sr" display modes (Serbian readers understand English
    // better than machine-translated Serbian via a proxy language anyway).
    const res = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texts, source: sourceLang, target: "en", format: "text" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const translated = Array.isArray(data.translatedText) ? data.translatedText : null;
    return { en: translated };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=80, stale-while-revalidate=160");

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url);
        return parsed.items.slice(0, 20).map((item) => ({
          id: item.guid || item.link || item.title,
          title: item.title || "",
          summary: item.contentSnippet || item.summary || "",
          link: item.link || "",
          pubDate: item.isoDate || item.pubDate || new Date().toISOString(),
          thumbnail: extractThumbnail(item),
          source: feed.source,
          lang: feed.lang,
          category: feed.category,
          titleEn: null,
          summaryEn: null,
          cluster: null,
        }));
      } catch {
        return [];
      }
    })
  );

  let articles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // Sort by date desc
  articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Deduplication clustering
  const clusters = [];
  const clustered = new Set();
  articles.forEach((art, i) => {
    if (clustered.has(i)) return;
    const cluster = [i];
    articles.forEach((other, j) => {
      if (i === j || clustered.has(j)) return;
      if (similarity(art.title, other.title) > 0.45) {
        cluster.push(j);
        clustered.add(j);
      }
    });
    clustered.add(i);
    clusters.push(cluster);
  });

  // Assign cluster IDs and pick representative (most sources = first)
  let finalArticles = clusters.map((cluster, ci) => {
    const primary = articles[cluster[0]];
    return {
      ...primary,
      cluster: ci,
      clusterSize: cluster.length,
      clusterSources: cluster.map((idx) => articles[idx].source),
    };
  });

  // Translate Hungarian articles in batches
  const huArticles = finalArticles.filter((a) => a.lang === "hu");
  if (huArticles.length > 0) {
    const titles = huArticles.map((a) => a.title);
    const summaries = huArticles.map((a) => a.summary.slice(0, 200));
    const [titleTranslations, summaryTranslations] = await Promise.all([
      translateBatch(titles, "hu"),
      translateBatch(summaries, "hu"),
    ]);

    huArticles.forEach((art, i) => {
      art.titleEn = titleTranslations?.en?.[i] || null;
      art.summaryEn = summaryTranslations?.en?.[i] || null;
    });
  }

  res.json({ articles: finalArticles, fetchedAt: new Date().toISOString() });
}
