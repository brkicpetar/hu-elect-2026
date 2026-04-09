import { useEffect } from "react";
import { SOCIAL_ACCOUNTS } from "../lib/config";

export default function SocialPanel({ visible }) {
  useEffect(() => {
    // Load Twitter widget script
    if (window.twttr) {
      window.twttr.widgets.load();
    } else {
      const script = document.createElement("script");
      script.src = "https://platform.twitter.com/widgets.js";
      script.async = true;
      script.charset = "utf-8";
      document.head.appendChild(script);
    }

    // Load Facebook SDK
    if (!window.FB) {
      window.fbAsyncInit = function () {
        window.FB.init({ xfbml: true, version: "v19.0" });
      };
      const fbScript = document.createElement("script");
      fbScript.src = "https://connect.facebook.net/en_US/sdk.js";
      fbScript.async = true;
      fbScript.defer = true;
      fbScript.crossOrigin = "anonymous";
      document.head.appendChild(fbScript);
    } else {
      window.FB.XFBML.parse();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        background: "#0d0d0d",
        borderTop: "1px solid #1a1a1a",
        padding: "12px 16px",
        overflowY: "auto",
        maxHeight: 420,
      }}
    >
      <div
        style={{
          color: "#555",
          fontSize: 9,
          fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        Social feeds
      </div>

      {/* Twitter timelines */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SOCIAL_ACCOUNTS.twitter.map((acc) => (
          <div key={acc.handle}>
            <div
              style={{
                color: "#444",
                fontSize: 9,
                fontFamily: "monospace",
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: acc.color, fontSize: 11 }}>𝕏</span> @{acc.handle} — {acc.label}
            </div>
            <a
              className="twitter-timeline"
              data-theme="dark"
              data-height="280"
              data-chrome="noheader nofooter noborders transparent"
              data-tweet-limit="5"
              href={`https://twitter.com/${acc.handle}`}
            >
              Tweets by @{acc.handle}
            </a>
          </div>
        ))}

        {/* Facebook pages */}
        <div id="fb-root" />
        {SOCIAL_ACCOUNTS.facebook.map((page) => (
          <div key={page.pageUrl}>
            <div style={{ color: "#444", fontSize: 9, fontFamily: "monospace", marginBottom: 4 }}>
              <span style={{ color: "#1565c0" }}>f</span> {page.label}
            </div>
            <div
              className="fb-page"
              data-href={page.pageUrl}
              data-tabs="timeline"
              data-width="260"
              data-height="200"
              data-small-header="true"
              data-adapt-container-width="true"
              data-hide-cover="true"
              data-show-facepile="false"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
