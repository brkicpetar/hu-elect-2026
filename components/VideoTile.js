import { useEffect, useRef, useState } from "react";

const HLSType = ["m3u8", "/m1", "/novas", "/proxy"];

const isHLS = (url) => HLSType.some((key) => url?.includes(key));

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

  const resetVideo = (video) => {
    try {
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.currentTime = 0;
    } catch {}
  };

  const destroyPlayer = () => {
    const p = playerRef.current;
    if (!p) return;

    try {
      if (modeRef.current === "hls") {
        p.destroy();
      } else if (modeRef.current === "mpegts") {
        p.stopLoad?.();
        p.detachMedia?.();
        p.destroy?.();
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

    let firstSegmentDropped = false;

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
              console.warn("HLS fatal error:", data);
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
      // MPEGTS PRIMARY (FIXED)
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

          // 🔥 stability first (fixes your MSE crash)
          enableStashBuffer: true,
          stashInitialSize: 1024,

          liveBufferLatencyChasing: true,
          liveBufferLatencyMinRemain: 1,
          liveBufferLatencyMaxLatency: 8,
        }
      );

      playerRef.current = player;
      modeRef.current = "mpegts";

      player.attachMediaElement(video);
      player.load();

      // =========================
      // DROP FIRST BAD SEGMENT
      // =========================
      player.on(mpegts.Events.MEDIA_SEGMENT_LOADED, () => {
        if (!firstSegmentDropped) {
          firstSegmentDropped = true;
          console.warn("Dropping first unstable TS segment");
          return;
        }
      });

      // =========================
      // SAFE START
      // =========================
      player.on(mpegts.Events.STREAM_LOADED, async () => {
        if (destroyedRef.current) return;

        try {
          await video.play();
          setStatus("playing");
        } catch {
          setStatus("error");
        }
      });

      // =========================
      // HARD RECOVERY (MSE SAFE)
      // =========================
      const recover = () => {
        try {
          player.destroy();
        } catch {}

        playerRef.current = null;
        modeRef.current = null;

        setStatus("error");

        // IMPORTANT: full reset is required for MSE corruption
        setTimeout(() => {
          window.location.reload();
        }, 500);
      };

      player.on(mpegts.Events.ERROR, (type, detail) => {
        console.warn("MPEGTS ERROR:", type, detail);
        recover();
      });
    };

    loadStream();

    return () => {
      destroyedRef.current = true;
      destroyPlayer();
    };
  }, [channel.stream]);

  // mute sync
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
        transition: "border-color 0.2s",
        cursor: "pointer",
        aspectRatio: "16/9",
      }}
      onClick={() => onActivateAudio(channel.id)}
    >
      {embedUrl ? (
        <iframe
          src={embedUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          }}
          allowFullScreen
          allow="autoplay; fullscreen"
          scrolling="no"
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
            display: "block",
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
          fontFamily: "'DM Mono', monospace",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.08em",
          padding: "2px 8px",
          borderRadius: 3,
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        {channel.name}
      </div>

      {/* STATUS */}
      {status === "loading" && (
        <div style={overlayStyle}>connecting…</div>
      )}

      {status === "error" && (
        <div style={overlayStyle}>stream error</div>
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
            borderRadius: 3,
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