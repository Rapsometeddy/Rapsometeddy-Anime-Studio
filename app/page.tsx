"use client";

import { useEffect, useState } from "react";

const steps = [
  "Story & script",
  "Character bible",
  "Anime artwork",
  "Motion / scenes",
  "Voices & subtitles",
  "Music + final edit",
  "YouTube-ready export"
];

export default function Home() {
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [song, setSong] = useState("");
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storyboardLoading, setStoryboardLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [storyboard, setStoryboard] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [motionLoading, setMotionLoading] = useState(false);
  const [motion, setMotion] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [activeShot, setActiveShot] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");

  useEffect(() => {
    if (!playing || !motion?.shots?.length) return;
    const shot = motion.shots[activeShot];
    const timer = window.setTimeout(() => {
      if (activeShot >= motion.shots.length - 1) setPlaying(false);
      else setActiveShot((n: number) => n + 1);
    }, Math.max(1, Number(shot.duration) || 8) * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, activeShot, motion]);

  async function generate() {
    setError("");
    setLoading(true);
    setStoryboard([]);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, story, song })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generation failed");
      setResult(d);
      setStarted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateStoryboard() {
    if (!result?.episode) return;
    setError("");
    setStoryboardLoading(true);
    try {
      const r = await fetch("/api/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode: result.episode })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Storyboard generation failed");
      setStoryboard(d.storyboard || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStoryboardLoading(false);
    }
  }

  async function generateMotion() {
    if (!storyboard.length) return;
    setError("");
    setMotionLoading(true);
    try {
      const r = await fetch("/api/motion-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyboard }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Motion planning failed");
      setMotion(d);
      setActiveShot(0);
      setPlaying(false);
    } catch (e: any) { setError(e.message); }
    finally { setMotionLoading(false); }
  }

  function selectAudio(file: File | null) {
    setAudioFile(file);
    setAudioUrl(file ? URL.createObjectURL(file) : "");
  }

  async function exportMp4() {
    if (!motion?.shots?.length || exporting) return;
    setError("");
    setExporting(true);
    setExportProgress(0);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1280; canvas.height = 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not supported on this device.");
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "";
      if (!mime) throw new Error("This browser does not support direct MP4 recording. Use the WebM export, then convert it with an FFmpeg-enabled renderer.");
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
      recorder.start(250);
      for (let i = 0; i < motion.shots.length; i++) {
        const shot = motion.shots[i];
        const img = new Image(); img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("Could not load storyboard frame.")); img.src = shot.imageUrl; });
        const start = performance.now();
        const duration = Math.max(3, Number(shot.duration) || 8) * 1000;
        while (performance.now() - start < duration) {
          const p = Math.min(1, (performance.now() - start) / duration);
          const zoom = shot.motion === "slow zoom in" ? 1.02 + p * .11 : shot.motion === "slow zoom out" ? 1.13 - p * .11 : 1.08;
          const pan = shot.motion === "pan right" ? (-.02 + p * .04) : 0;
          const scale = Math.max(canvas.width / img.width, canvas.height / img.height) * zoom;
          const w = img.width * scale, h = img.height * scale;
          ctx.fillStyle = "#08060f"; ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img, (canvas.width-w)/2 + pan*canvas.width, (canvas.height-h)/2, w, h);
          setExportProgress(Math.round(((i + p) / motion.shots.length) * 100));
          await new Promise(r => requestAnimationFrame(r));
        }
      }
      recorder.stop(); await stopped;
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${title || "rapsometeddy-anime"}.mp4`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setExportProgress(100);
    } catch (e: any) { setError(e.message || "MP4 export failed."); }
    finally { setExporting(false); }
  }

  async function buildWebmBlob() {
    if (!motion?.shots?.length) throw new Error("Generate the storyboard and motion plan first.");
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported on this device.");
    const videoStream = canvas.captureStream(30);
    let combined: MediaStream = videoStream;
    let audio: HTMLAudioElement | null = null;
    if (audioUrl) {
      audio = new Audio(audioUrl);
      const audioStream = (audio as any).captureStream?.() || (audio as any).mozCaptureStream?.();
      if (audioStream) combined = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
    }
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(combined, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
    recorder.start(250);
    if (audio) await audio.play();
    for (let i = 0; i < motion.shots.length; i++) {
      const shot = motion.shots[i];
      const img = new Image(); img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("Could not load storyboard frame.")); img.src = shot.imageUrl; });
      const startedAt = performance.now();
      const duration = Math.max(3, Number(shot.duration) || 8) * 1000;
      while (performance.now() - startedAt < duration) {
        const p = Math.min(1, (performance.now() - startedAt) / duration);
        const zoom = shot.motion === "slow zoom in" ? 1.02 + p * .11 : shot.motion === "slow zoom out" ? 1.13 - p * .11 : 1.08;
        const pan = shot.motion === "pan right" ? (-.02 + p * .04) : 0;
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height) * zoom;
        const w = img.width * scale, h = img.height * scale;
        ctx.fillStyle = "#08060f"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, (canvas.width - w) / 2 + pan * canvas.width, (canvas.height - h) / 2, w, h);
        ctx.fillStyle = "rgba(8,6,15,.35)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white"; ctx.font = "700 28px Arial"; ctx.fillText(shot.title || `Scene ${i + 1}`, 42, 58);
        setExportProgress(Math.round(((i + p) / motion.shots.length) * 100));
        await new Promise(r => requestAnimationFrame(r));
      }
    }
    if (audio) audio.pause();
    recorder.stop(); await stopped;
    return new Blob(chunks, { type: "video/webm" });
  }

  async function exportVideo() {
    if (exporting) return;
    setError(""); setExporting(true); setExportProgress(0);
    try {
      const blob = await buildWebmBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${title || "rapsometeddy-anime"}.webm`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setExportProgress(100);
    } catch (e: any) { setError(e.message || "Video export failed."); }
    finally { setExporting(false); }
  }

