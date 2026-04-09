import { formatDistanceToNow, parseISO } from "date-fns";

const CATEGORY_COLORS = {
  politics: "#e53935",
  international: "#1565c0",
  elections: "#f57f17",
};

const SOURCE_LANGS = {
  "444.hu": "hu",
  Telex: "hu",
  Index: "hu",
  Híradó: "hu",
  ATV: "hu",
  "NYT Europe": "en",
  "Politico EU": "en",
};

export default function NewsSidebar({ articles, displayLang, keywords, loading }) {
  const highlight = (text) => {
    if (!text || !keywords.length) return text;
    const pattern = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(pattern);
    return parts.map((part, i) =>
      pattern.test(part) ? (
        <mark key={i} style={{ background: "#f57f1740", color: "#f9a825", borderRadius: 2, padding: "0 2px" }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getTitle = (art) => {
    if (displayLang === "en" && art.titleEn) return art.titleEn;
    return art.title;
  };

  const getSummary = (art) => {
    if (displayLang === "en" && art.summaryEn) return art.summaryEn;
    return art.summary;
  };

  const hasKeyword = (art) => {
    if (!keywords.length) return false;
    const text = `${art.title} ${art.summary} ${art.titleEn || ""} ${art.titleSr || ""}`.toLowerCase();
    return keywords.some((k) => text.includes(k.toLowerCase()));
  };

  if (loading) {
    return (
      <div style={{ padding: "20px 16px", color: "#444", fontFamily: "monospace", fontSize: 12 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{ height: 80, background: "#141414", borderRadius: 4, marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ height: 14, background: "#141414", borderRadius: 2, width: "80%", marginBottom: 6 }} />
            <div style={{ height: 11, background: "#141414", borderRadius: 2, width: "60%" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "0 0 20px" }}>
      {articles.length === 0 && (
        <div style={{ padding: 20, color: "#444", fontSize: 12, fontFamily: "monospace" }}>no articles loaded</div>
      )}
      {articles.map((art, i) => {
        const isAlert = hasKeyword(art);
        const title = getTitle(art);
        const summary = getSummary(art);
        const timeAgo = (() => {
          try {
            return formatDistanceToNow(parseISO(art.pubDate), { addSuffix: true });
          } catch {
            return "";
          }
        })();

        return (
          <article
            key={art.id || i}
            style={{
              borderBottom: "1px solid #1a1a1a",
              padding: "14px 16px",
              background: isAlert ? "rgba(245, 127, 23, 0.04)" : "transparent",
              borderLeft: isAlert ? "3px solid #f57f17" : "3px solid transparent",
              transition: "background 0.2s",
              cursor: "pointer",
            }}
            onClick={() => window.open(art.link, "_blank")}
          >
            {/* Thumbnail */}
            {art.thumbnail && (
              <div
                style={{
                  width: "100%",
                  height: 100,
                  marginBottom: 10,
                  borderRadius: 4,
                  overflow: "hidden",
                  background: "#111",
                }}
              >
                <img
                  src={art.thumbnail}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => { e.target.parentNode.style.display = "none"; }}
                />
              </div>
            )}

            {/* Meta row */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <span
                style={{
                  background: CATEGORY_COLORS[art.category] || "#333",
                  color: "#fff",
                  fontSize: 9,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.08em",
                  padding: "1px 5px",
                  borderRadius: 2,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}
              >
                {art.source}
              </span>
              {art.clusterSize > 1 && (
                <span style={{ color: "#555", fontSize: 9, fontFamily: "monospace" }}>
                  +{art.clusterSize - 1} more
                </span>
              )}
              {isAlert && <span style={{ fontSize: 9, color: "#f9a825" }}>● ALERT</span>}
              <span style={{ color: "#444", fontSize: 9, fontFamily: "monospace", marginLeft: "auto" }}>
                {timeAgo}
              </span>
            </div>

            {/* Title */}
            <div
              style={{
                color: "#e0e0e0",
                fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: 500,
                lineHeight: 1.4,
                marginBottom: 6,
              }}
            >
              {highlight(title)}
            </div>

            {/* Summary */}
            {summary && (
              <div
                style={{
                  color: "#666",
                  fontSize: 11,
                  lineHeight: 1.5,
                  fontFamily: "'DM Sans', sans-serif",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {highlight(summary)}
              </div>
            )}

            {/* Cluster sources */}
            {art.clusterSources?.length > 1 && (
              <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {art.clusterSources.slice(1).map((s) => (
                  <span key={s} style={{ color: "#444", fontSize: 9, fontFamily: "monospace", border: "1px solid #222", padding: "1px 4px", borderRadius: 2 }}>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
