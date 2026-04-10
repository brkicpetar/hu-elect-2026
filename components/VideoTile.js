import { useEffect, useRef, useState } from "react";

const isHLS = (url) =>
  ["m3u8", "/m1", "/novas", "/proxy"].some((k) => url.includes(k));

const isEmbed = (url) =>
  url?.startsWith("embed:") ||
  url?.includes("player.php") ||
  url?.includes("youtube.com") ||
  url?.includes("youtu.be");

const getEmbedUrl = (url) =>
  url?.startsWith("embed:") ? url.slice(6) : url;

export default function VideoTile({
  channel,
  isAudioActive,
  onActivateAudio,
}) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const modeRef = useRef(null);
  const destroyedRef = useRef(false);

  const [status, setStatus] = useState("idle");

  // ----------------------------
  // CLEAN VIDEO RESET (CRITICAL)
  // ----------------------------
  const resetVideo = (video) => {
    try {
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.currentTime = 0;
    } catch {}
  };

  // ----------------------------
  // CLEANUP PLAYER
  // ----------------------------
  const destroyPlayer = () => {
    const p = playerRef.current;

    if (!p) return;

    try {
      if (modeRef.current === "hls") {
        p.destroy();
      } else if (modeRef.current === "mpegts") {
        p.destroy?.();
        p.stopLoad?.();
        p.detachMedia?.();
      }
    } catch {}

    playerRef.current = null;
    modeRef.current = null;
  };

  useEffect(() => {
    destroyedRef.current = false;

    const video = videoRef.current;
    const url = channel.stream;

    if (!url || !video) {
      setStatus("idle");
      return;
    }

    if (isEmbed(url)) {
      setStatus("playing");
      return;
    }

    setStatus("loading");

    const loadStream = async () => {
      destroyPlayer();
      resetVideo(video);

      if (destroyedRef.current) return;

      // =========================
      // HLS PATH
      // =========================
      if (isHLS(url)) {
        const Hls = (await import("hls.js")).default;
        if (destroyedRef.current) return;

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
          });

          modeRef.current = "hls";
          playerRef.current = hls;

          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, async () => {
            if (destroyedRef.current) return;

            try {
              video.muted = true;
              await video.play();
              video.muted = !isAudioActive;
              setStatus("playing");
            } catch {
              setStatus("error");
            }
          });

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              console.warn("HLS fatal error", data);
              setStatus("error");
            }
          });

          return;
        }

        video.src = url;
        setStatus("playing");
        return;
      }

      // =========================
      // MPEGTS PRIMARY PATH
      // =========================
      const mpegts = (await import("mpegts.js")).default;
      if (destroyedRef.current) return;

      if (!mpegts.isSupported()) {
        setStatus("error");
        return;
      }

      const player = mpegts.createPlayer(
        {
          type: "mpegts",
          isLive: true,
          url,
          hasAudio: true,
          hasVideo: true,
        },
        {
          enableWorker: true,

          // 🔥 stability FIRST (fixes your MSE crash)
          enableStashBuffer: true,
          stashInitialSize: 768,

          liveBufferLatencyChasing: true,
          liveBufferLatencyMinRemain: 1,
          liveBufferLatencyMaxLatency: 8,
        }
      );

      modeRef.current = "mpegts";
      playerRef.current = player;

      player.attachMediaElement(video);
      player.load();

      // ----------------------------
      // FATAL ERROR HANDLING
      // ----------------------------
      player.on(mpegts.Events.ERROR, (_, detail) => {
        console.warn("MPEGTS ERROR:", detail);

        setStatus("error");

        destroyPlayer();
      });

      // ----------------------------
      // START PLAY SAFELY
      // ----------------------------
      player.on(mpegts.Events.STREAM_LOADED, async () => {
        if (destroyedRef.current) return;

        try {
          await video.play();
          setStatus("playing");
        } catch {
          setStatus("error");
        }
      });
    };

    loadStream();

    return () => {
      destroyedRef.current = true;
      destroyPlayer();
    };
  }, [channel.stream]);

  // ----------------------------
  // AUDIO CONTROL
  // ----------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isAudioActive;
  }, [isAudioActive]);

  const toggleFullscreen = () => {
    const el = document.getElementById(`tile-${channel.id}`);
    if (!document.fullscreenElement) el?.requestFullscreen();
    else document.exitFullscreen();
  };

  const embedUrl =
    channel.stream && isEmbed(channel.stream)
      ? getEmbedUrl(channel.stream)
      : null;

  return (
    <div
      id={`tile-${channel.id}`}
      className="video-tile"
      style={{
        position: "relative",
        background: "#0a0a0a",
        borderRadius: "6px",
        overflow: "hidden",
        border: isAudioActive
          ? `2px solid ${channel.color}`
          : "2px solid #1a1a1a",
        aspectRatio: "16/9",
        cursor: "pointer",
      }}
      onClick={() => onActivateAudio(channel.id)}
    >
      {embedUrl ? (
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      {/* LABEL */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: channel.color,
          color: "#fff",
          fontSize: 11,
          padding: "2px 8px",
          borderRadius: 3,
          fontFamily: "monospace",
        }}
      >
        {channel.name}
      </div>

      {/* STATUS */}
      {status === "loading" && (
        <div style={overlayStyle}>connecting…</div>
      )}

      {status === "error" && (
        <div style={overlayStyle}>
          stream error
        </div>
      )}

      {/* FULLSCREEN */}
      {status === "playing" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: "rgba(0,0,0,0.5)",
            border: "none",
            color: "#aaa",
            padding: "3px 6px",
            cursor: "pointer",
          }}
        >
          ⛶
        </button>
      )}
    </div>
  );
}

const overlayStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0a0a0a",
  color: "#555",
  fontFamily: "monospace",
  fontSize: 12,
};