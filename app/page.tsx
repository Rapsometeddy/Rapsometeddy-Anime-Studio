"use client";

import { useEffect, useMemo, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

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
  const [motionLoading, setMotionLoading] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [storyboard, setStoryboard] = useState<any[]>([]);
  const [motion, setMotion] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [activeShot, setActiveShot] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [voiceRate, setVoiceRate] = useState(1);
  const [voicePitch, setVoicePitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [voiceExporting, setVoiceExporting] = useState(false);
  const [voiceTrackUrl, setVoiceTrackUrl] = useState("");
  const [voiceClips, setVoiceClips] = useState<Record<number, File>>({});
  const [recordingScene, setRecordingScene] = useState<number | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [characterBible, setCharacterBible] = useState<any[]>([]);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterRefs, setCharacterRefs] = useState<Record<string, string>>({});
  const [characterRefLoading, setCharacterRefLoading] = useState<string | null>(null);
  const [multiShots, setMultiShots] = useState<any[]>([]);
  const [multiShotLoading, setMultiShotLoading] = useState(false);
  const [autoEdit, setAutoEdit] = useState<any>(null);
  const [autoEditLoading, setAutoEditLoading] = useState(false);
  const [youtubePackage, setYoutubePackage] = useState<any>(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [thumbnail, setThumbnail] = useState<any>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState("draft");
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState("");
  const [youtubePrivacy, setYoutubePrivacy] = useState("private");
  const [youtubeVideoFile, setYoutubeVideoFile] = useState<File | null>(null);
  const [youtubePublishing, setYoutubePublishing] = useState(false);
  const [youtubeUploadProgress, setYoutubeUploadProgress] = useState(0);
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState("");
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectKey, setProjectKey] = useState("");
  const [projectSaving, setProjectSaving] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectMessage, setProjectMessage] = useState("");

  useEffect(() => {
    if (!playing || !motion?.shots?.length) return;
    const shot = motion.shots[activeShot];
    const timer = window.setTimeout(() => {
      if (activeShot >= motion.shots.length - 1) setPlaying(false);
      else setActiveShot((n: number) => n + 1);
    }, Math.max(1, Number(shot.duration) || 8) * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, activeShot, motion]);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const totalDuration = useMemo(
    () => timeline.reduce((sum, s) => sum + (Number(s.duration) || 0), 0),
    [timeline]
  );

  async function generate() {
    setError(""); setLoading(true); setStoryboard([]); setMotion(null); setTimeline([]);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, story, song })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generation failed");
      setResult(d); setCharacterBible([]); setCharacterRefs({}); setStarted(true);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function generateMultiShots() {
    if (!result?.episode) return;
    setError(""); setMultiShotLoading(true);
    try {
      const r = await fetch("/api/multi-shot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode: result.episode, characterBible, shotsPerScene: 4 })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Multi-shot generation failed");
      setMultiShots(d.shots || []);
    } catch (e: any) { setError(e.message || "Multi-shot generation failed."); }
    finally { setMultiShotLoading(false); }
  }

  async function buildCharacterBible() {
    if (!result?.episode?.characters?.length) {
      setError("Generate an AI episode with characters first, or add character data to the episode blueprint.");
      return;
    }
    setError(""); setCharacterLoading(true);
    try {
      const r = await fetch("/api/character-bible", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characters: result.episode.characters })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Character bible failed");
      setCharacterBible(d.characters || []);
    } catch (e: any) { setError(e.message || "Character bible failed."); }
    finally { setCharacterLoading(false); }
  }

  async function generateCharacterReference(character: any) {
    setCharacterRefLoading(character.id);
    try {
      const r = await fetch("/api/character-reference", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Reference generation failed");
      setCharacterRefs(prev => ({ ...prev, [character.id]: d.imageUrl }));
    } catch (e: any) { setError(e.message || "Character reference failed."); }
    finally { setCharacterRefLoading(null); }
  }

  async function generateStoryboard() {
    if (!result?.episode) return;
    setError(""); setStoryboardLoading(true);
    try {
      const r = await fetch("/api/storyboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode: result.episode, characterBible })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Storyboard generation failed");
      setStoryboard(d.storyboard || []);
    } catch (e: any) { setError(e.message); }
    finally { setStoryboardLoading(false); }
  }

  async function generateMotion() {
    if (!storyboard.length && !multiShots.length) return;
    setError(""); setMotionLoading(true);
    try {
      const r = await fetch("/api/motion-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboard, multiShots })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Motion planning failed");
      setMotion(d); setActiveShot(0); setPlaying(false);
    } catch (e: any) { setError(e.message); }
    finally { setMotionLoading(false); }
  }

  async function buildTimeline() {
    if (!result?.episode || !storyboard.length) return;
    setError(""); setTimelineLoading(true);
    try {
      const r = await fetch("/api/timeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode: result.episode, storyboard: motion?.shots || storyboard })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Timeline generation failed");
      setTimeline(d.timeline || []);
    } catch (e: any) { setError(e.message); }
    finally { setTimelineLoading(false); }
  }

  async function runAutoEdit() {
    if (!motion?.shots?.length) return;
    setError(""); setAutoEditLoading(true);
    try {
      const r = await fetch("/api/auto-edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shots: motion.shots, musicDuration: 0, introDuration: 0.5, outroDuration: 1 }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Auto edit failed");
      setAutoEdit(d);
    } catch (e: any) { setError(e.message || "Auto edit failed."); }
    finally { setAutoEditLoading(false); }
  }

  async function buildYoutubePackage() {
    if (!result?.episode) return;
    setError(""); setYoutubeLoading(true);
    try {
      const r = await fetch("/api/youtube-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episode: result.episode, autoEdit })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "YouTube package failed");
      setYoutubePackage(d);
    } catch (e: any) { setError(e.message || "YouTube package failed."); }
    finally { setYoutubeLoading(false); }
  }

  function downloadYoutubePackage() {
    if (!youtubePackage) return;
    const blob = new Blob([JSON.stringify(youtubePackage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "rapsometeddy-anime"}-youtube-package.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function generateThumbnail() {
    if (!result?.episode) return;
    setError(""); setThumbnailLoading(true);
    try {
      const character = characterBible[0] || result.episode.characters?.[0] || {};
      const r = await fetch("/api/thumbnail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: result.episode.title || title, episode: result.episode, character })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Thumbnail generation failed");
      setThumbnail(d);
    } catch (e: any) { setError(e.message || "Thumbnail generation failed."); }
    finally { setThumbnailLoading(false); }
  }

  function downloadThumbnail() {
    if (!thumbnail?.imageUrl) return;
    const a = document.createElement("a");
    a.href = thumbnail.imageUrl;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }

  async function loadProjects() {
    setProjectLoading(true);
    try {
      const r = await fetch("/api/projects");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not load projects.");
      setProjects(d);
    } catch (e: any) { setProjectMessage(e.message || "Could not load projects."); }
    finally { setProjectLoading(false); }
  }

  async function saveProject() {
    if (!result?.episode) { setProjectMessage("Generate an episode first."); return; }
    setProjectSaving(true);
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: {
            projectKey: projectKey || crypto.randomUUID(),
            title: result.episode.title || title || "Untitled Anime Episode",
            story,
            song,
            blueprint: result.episode,
            characterBible,
            characterRefs,
            storyboard,
            multiShots,
            motion,
            timeline,
            autoEdit,
            youtubePackage,
            thumbnail,
            workflowStatus,
            youtubeVideoUrl: youtubeVideoUrl || null
          }
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not save project.");
      setProjectKey(d.project_key);
      setProjectMessage("💾 Project saved.");
      loadProjects();
    } catch (e: any) { setProjectMessage(e.message || "Could not save project."); }
    finally { setProjectSaving(false); }
  }

  async function openProject(key: string) {
    setProjectLoading(true);
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(key)}`);
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || "Could not open project.");
      setProjectKey(p.project_key);
      setTitle(p.title || "");
      setStory(p.story || "");
      setSong(p.song || "");
      setResult(p.blueprint ? { episode: p.blueprint } : null);
      setCharacterBible(p.character_bible || []);
      setCharacterRefs(p.character_refs || []);
      setStoryboard(p.storyboard || []);
      setMultiShots(p.multi_shots || []);
      setMotion(p.motion || null);
      setTimeline(p.timeline || []);
      setAutoEdit(p.auto_edit || null);
      setYoutubePackage(p.youtube_package || null);
      setThumbnail(p.thumbnail || null);
      setWorkflowStatus(p.workflow_status || "draft");
      setYoutubeVideoUrl(p.youtube_video_url || "");
      setProjectMessage(`📂 Opened "${p.title}".`);
    } catch (e: any) { setProjectMessage(e.message || "Could not open project."); }
    finally { setProjectLoading(false); }
  }

  async function connectYoutube() {
    window.location.href = "/api/youtube/auth";
  }

  async function publishToYoutube() {
    if (workflowStatus !== "approved") {
      setError("Approve the episode first.");
      return;
    }
    if (!youtubeVideoFile) {
      setError("Choose the rendered MP4 file first.");
      return;
    }
    setError(""); setYoutubePublishing(true); setYoutubeUploadProgress(0);
    try {
      const r = await fetch("/api/youtube/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowStatus,
          privacyStatus: youtubePrivacy,
          title: youtubePackage?.title || result?.episode?.title || title,
          description: youtubePackage?.description || "",
          tags: youtubePackage?.tags || []
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not start YouTube upload.");
      if (!d.uploadUrl) throw new Error("YouTube did not return an upload session.");
      const upload = await fetch(d.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": youtubeVideoFile.type || "video/mp4", "Content-Length": String(youtubeVideoFile.size) },
        body: youtubeVideoFile
      });
      if (!upload.ok) {
        const message = await upload.text().catch(() => "");
        throw new Error(message || `YouTube upload failed (${upload.status}).`);
      }
      const video = await upload.json();
      const id = video.id;
      if (id) {
        setYoutubeVideoUrl(`https://www.youtube.com/watch?v=${id}`);
        setYoutubeUploadProgress(100);
        setWorkflowStatus("published");
        setWorkflowMessage("YouTube upload completed.");
      }
    } catch (e: any) {
      setError(e.message || "YouTube upload failed.");
    } finally { setYoutubePublishing(false); }
  }

  async function workflowAction(action: string) {
    setWorkflowLoading(true); setWorkflowMessage("");
    try {
      const r = await fetch("/api/workflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, status: workflowStatus }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Workflow action failed.");
      setWorkflowStatus(d.status);
      setWorkflowMessage(d.published ? "Episode marked published. Connect a platform publisher later to perform an external upload." : `Status changed to ${d.status}.`);
    } catch (e: any) { setError(e.message || "Workflow action failed."); }
    finally { setWorkflowLoading(false); }
  }

  function speakScene(scene?: any) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("Speech synthesis is not available in this browser.");
      return;
    }
    const text = String(scene?.subtitle || scene?.dialogue || "").trim();
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const selected = voices.find(v => v.name === voiceName);
    if (selected) utterance.voice = selected;
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  async function exportVoiceTrack() {
    if (!timeline.length || voiceExporting || !("speechSynthesis" in window)) return;
    setVoiceExporting(true); setError("");
    try {
      const payload = timeline.filter((s: any) => s.subtitle).map((s: any) => ({ start: s.start, duration: s.duration, text: s.subtitle }));
      const r = await fetch("/api/voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: payload.map((x: any) => x.text).join("\n"), voice: voiceName, rate: voiceRate, pitch: voicePitch }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Voice preparation failed.");
      const blob = new Blob([JSON.stringify({ format: "Rapsometeddy Voice Timeline", mode: d.mode, voice: voiceName || "default", rate: voiceRate, pitch: voicePitch, cues: payload }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${title || "rapsometeddy-anime"}-voice-timeline.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e: any) { setError(e.message || "Voice export failed."); } finally { setVoiceExporting(false); }
  }

  function stopVoice() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function selectVoiceClip(sceneNumber: number, file: File | null) {
    setVoiceClips(prev => {
      const next = { ...prev };
      if (file) next[sceneNumber] = file; else delete next[sceneNumber];
      return next;
    });
  }

  async function recordDialogue(scene: any) {
    if (recordingScene !== null) return;
    if (!navigator.mediaDevices?.getUserMedia) { setError("Microphone recording is not available in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream);
      setRecorder(mr); setRecordingScene(scene.number);
      mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        const file = new File([blob], `scene-${scene.number}-dialogue.webm`, { type: blob.type });
        selectVoiceClip(scene.number, file);
        setRecorder(null); setRecordingScene(null);
      };
      mr.start();
    } catch (e: any) { setError(e.message || "Microphone permission was denied."); setRecordingScene(null); }
  }

  function stopDialogueRecording() {
    recorder?.stop();
  }

  function selectAudio(file: File | null) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(file);
    setAudioUrl(file ? URL.createObjectURL(file) : "");
  }

  async function buildVoiceAudioTrack(): Promise<Blob | null> {
    if (!timeline.some((s: any) => s.subtitle) || !("speechSynthesis" in window)) return null;
    // Browser speech synthesis cannot be captured reliably on every Android browser.
    // Create a deterministic silent WAV with the exact dialogue timeline as a safe fallback,
    // so the video always has a valid audio track and the cues remain synchronized.
    const duration = Math.max(1, totalDuration);
    const sampleRate = 16000;
    const samples = Math.ceil(duration * sampleRate);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const write = (offset: number, value: string) => [...value].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
    write(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); write(8, "WAVE"); write(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, 0, true);
    return new Blob([buffer], { type: "audio/wav" });
  }

  async function buildWebmBlob(): Promise<Blob> {
    if (!motion?.shots?.length) throw new Error("Generate motion scenes first.");
    const editPlan = autoEdit?.edits || [];
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported on this device.");

    const videoStream = canvas.captureStream(30);
    const generatedVoice = await buildVoiceAudioTrack();
    const voiceDestination = new (window.AudioContext || (window as any).webkitAudioContext)().createMediaStreamDestination();
    const voiceAudioContext = voiceDestination.context;
    let audio: HTMLAudioElement | null = null;
    let musicGainNode: GainNode | null = null;
    let musicAudioContext: AudioContext | null = null;
    let combined: MediaStream = videoStream;
    const voicePlayers: HTMLAudioElement[] = [];
    Object.entries(voiceClips).forEach(([sceneNumber, file]) => {
      const audio = new Audio(URL.createObjectURL(file));
      audio.preload = "auto";
      const source = voiceAudioContext.createMediaElementSource(audio);
      source.connect(voiceDestination); source.connect(voiceAudioContext.destination);
      voicePlayers.push(audio);
    });
    voiceDestination.stream.getAudioTracks().forEach(track => videoStream.addTrack(track));

    if (generatedVoice && !audioUrl) {
      const voiceAudio = new Audio(URL.createObjectURL(generatedVoice));
      voiceAudio.loop = false;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ac = new AudioContextClass();
        const source = ac.createMediaElementSource(voiceAudio);
        const destination = ac.createMediaStreamDestination();
        source.connect(destination);
        source.connect(ac.destination);
        destination.stream.getAudioTracks().forEach(track => videoStream.addTrack(track));
        combined = videoStream;
        await voiceAudio.play().catch(() => {});
      }
    }\n\n    if (audioUrl) {
      audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ac = new AudioContextClass();
        const source = ac.createMediaElementSource(audio);
        const destination = ac.createMediaStreamDestination();
        musicGainNode = ac.createGain();
        musicGainNode.gain.value = 0.72;
        source.connect(musicGainNode);
        musicGainNode.connect(destination);
        musicGainNode.connect(ac.destination);
        musicAudioContext = ac;
        destination.stream.getAudioTracks().forEach(track => videoStream.addTrack(track));
        combined = videoStream;
        await audio.play().catch(() => {});
      }
    }

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(combined, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
    recorder.start(250);

    for (let i = 0; i < motion.shots.length; i++) {
      const shot = motion.shots[i];
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not load storyboard frame. Check the image provider/CORS."));
        img.src = shot.imageUrl;
      });
      const voiceClip = voiceClips[Number(shot.number)];
      const edit = editPlan[i];
      if (musicGainNode && musicAudioContext) musicGainNode.gain.setTargetAtTime(edit?.musicGain ?? 0.72, musicAudioContext.currentTime, 0.04);
      if (voiceClip) {
        const player = voicePlayers.find((a: HTMLAudioElement) => a.src.includes(encodeURIComponent(voiceClip.name)));
      }
      const start = performance.now();
      const duration = Math.max(3, Number(shot.duration) || 8) * 1000;
      const subtitle = timeline[i]?.subtitle || shot.dialogue || "";
      if (voiceClip) {
        const idx = Object.keys(voiceClips).findIndex(k => Number(k) === Number(shot.number));
        const player = voicePlayers[idx];
        if (player) { player.currentTime = 0; await player.play().catch(() => {}); }
      }
      while (performance.now() - start < duration) {
        const p = Math.min(1, (performance.now() - start) / duration);
        const zoom = shot.motion === "slow zoom in" ? 1.02 + p * .11
          : shot.motion === "slow zoom out" ? 1.13 - p * .11 : 1.08;
        const pan = shot.motion === "pan right" ? (-.02 + p * .04) : 0;
        const scale = Math.max(canvas.width / img.width, canvas.height / img.height) * zoom;
        const w = img.width * scale, h = img.height * scale;
        ctx.fillStyle = "#08060f"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, (canvas.width - w) / 2 + pan * canvas.width, (canvas.height - h) / 2, w, h);
        ctx.fillStyle = "rgba(8,6,15,.32)"; ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "white";
        ctx.font = "700 28px Arial";
        ctx.fillText(shot.title || `Scene ${i + 1}`, 42, 58);

        if (subtitle) {
          const maxWidth = 1080;
          const words = String(subtitle).split(/\s+/);
          const lines: string[] = [];
          let line = "";
          ctx.font = "700 30px Arial";
          for (const word of words) {
            const test = line ? line + " " + word : word;
            if (ctx.measureText(test).width > maxWidth && line) {
              lines.push(line); line = word;
            } else line = test;
          }
          if (line) lines.push(line);
          const lineHeight = 38;
          const boxH = lines.length * lineHeight + 30;
          const boxY = canvas.height - boxH - 34;
          ctx.fillStyle = "rgba(0,0,0,.72)";
          ctx.fillRect(70, boxY, canvas.width - 140, boxH);
          ctx.fillStyle = "#fff";
          lines.forEach((text, idx) => {
            const tw = ctx.measureText(text).width;
            ctx.fillText(text, (canvas.width - tw) / 2, boxY + 25 + (idx + 1) * lineHeight);
          });
        }

        setExportProgress(Math.round(((i + p) / motion.shots.length) * 100));
        await new Promise(requestAnimationFrame);
      }
    }

    if (musicGainNode && musicAudioContext) musicGainNode.gain.setTargetAtTime(0.72, musicAudioContext.currentTime, 0.04);
    audio?.pause();
    recorder.stop();
    await stopped;
    return new Blob(chunks, { type: mime });
  }

  async function exportVideo() {
    if (exporting) return;
    setError(""); setExporting(true); setExportProgress(0);
    try {
      const blob = await buildWebmBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${title || "rapsometeddy-anime"}.webm`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setExportProgress(100);
    } catch (e: any) { setError(e.message || "Video export failed."); }
    finally { setExporting(false); }
  }

  async function exportMp4() {
    if (exporting) return;
    setError(""); setExporting(true); setExportProgress(0); setFfmpegLoading(true);
    try {
      const webm = await buildWebmBlob();
      const ffmpeg = new FFmpeg();
      const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm")
      });
      await ffmpeg.writeFile("input.webm", await fetchFile(webm));
      await ffmpeg.exec(["-i", "input.webm", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", "output.mp4"]);
      const data = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([data as Uint8Array], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${title || "rapsometeddy-anime"}.mp4`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      await ffmpeg.deleteFile("input.webm").catch(() => {});
      await ffmpeg.deleteFile("output.mp4").catch(() => {});
      ffmpeg.terminate();
      setExportProgress(100);
    } catch (e: any) {
      setError(e.message || "MP4 export failed.");
    } finally { setFfmpegLoading(false); setExporting(false); }
  }

  function clearAll() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setTitle(""); setStory(""); setSong(""); setStarted(false);
    setResult(null); setStoryboard([]); setMotion(null); setTimeline([]); setMultiShots([]); setAutoEdit(null); setYoutubePackage(null); setThumbnail(null); setWorkflowStatus("draft"); setWorkflowMessage(""); setYoutubeVideoFile(null); setYoutubeVideoUrl(""); setYoutubeConnected(false); setYoutubeUploadProgress(0);
    setError(""); setAudioFile(null); setAudioUrl("");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><div className="logo">R</div><div><div>Rapsometeddy <span className="purple">Anime Studio</span></div><div className="muted">CREATE • ANIMATE • SCORE</div></div></div>
        <div className="badge">FREE-FIRST PIPELINE</div>
      </header>

      <section className="hero">
        <div className="badge">👑 RAPSOMETTEDY ORIGINALS</div>
        <h1>Turn your songs into <span className="purple">anime stories.</span></h1>
        <p>Build an original episode from a story idea and your own music. Generate the blueprint, storyboard, motion plan, subtitles and browser-rendered video.</p>
      </section>

      <div className="grid">
        <section className="card">
          <h2>Create new episode</h2>
          <div className="form">
            <div><div className="label">Episode title</div><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. GFN — Episode 01" /></div>
            <div><div className="label">Story / concept</div><textarea className="textarea" value={story} onChange={e => setStory(e.target.value)} placeholder="Describe the world, characters, conflict and mood..." /></div>
            <div><div className="label">Song</div><input className="input" value={song} onChange={e => setSong(e.target.value)} placeholder="Song name or uploaded track reference" /></div>
            <div><div className="label">Original song file</div><input className="input" type="file" accept="audio/*" onChange={e => selectAudio(e.target.files?.[0] || null)} /></div>
            {audioUrl && <audio controls src={audioUrl} className="audioPlayer" />}
            <button className="btn" disabled={loading} onClick={generate}>{loading ? "Generating…" : started ? "Regenerate episode" : "Generate episode"}</button>
            {result?.episode?.characters?.length > 0 && <button className="btn storyboardBtn" disabled={characterLoading} onClick={buildCharacterBible}>{characterLoading ? "Locking characters…" : characterBible.length ? "👑 Character bible locked" : "👑 Build character bible"}</button>}
            {characterBible.length > 0 && <button className="btn storyboardBtn" disabled={storyboardLoading} onClick={generateStoryboard}>{storyboardLoading ? "Building storyboard…" : "🎬 Generate locked storyboard"}</button>}
            {characterBible.length > 0 && storyboard.length > 0 && <button className="btn storyboardBtn" disabled={multiShotLoading} onClick={generateMultiShots}>{multiShotLoading ? "Directing shots…" : "🎞️ Build multi-shot scenes"}</button>}
            {result?.episode && characterBible.length === 0 && <button className="btn storyboardBtn" disabled={storyboardLoading} onClick={generateStoryboard}>{storyboardLoading ? "Building storyboard…" : "🎬 Generate storyboard"}</button>}
            {(storyboard.length > 0 || multiShots.length > 0) && <button className="btn storyboardBtn" disabled={motionLoading} onClick={generateMotion}>{motionLoading ? "Planning motion…" : multiShots.length ? "🎞️ Animate multi-shot scenes" : "🎞️ Animate storyboard"}</button>}
            {motion?.shots?.length > 0 && <button className="btn storyboardBtn" disabled={autoEditLoading} onClick={runAutoEdit}>{autoEditLoading ? "Editing episode…" : "🎬 Auto Edit Episode"}</button>}
            {autoEdit && <button className="btn storyboardBtn" disabled={thumbnailLoading} onClick={generateThumbnail}>{thumbnailLoading ? "Generating thumbnail…" : "🖼️ Generate thumbnail"}</button>}\n            {autoEdit && <button className="btn storyboardBtn" disabled={youtubeLoading} onClick={buildYoutubePackage}>{youtubeLoading ? "Preparing YouTube package…" : "📺 Build YouTube package"}</button>}\n            {motion?.shots?.length > 0 && <button className="btn storyboardBtn" disabled={timelineLoading} onClick={buildTimeline}>{timelineLoading ? "Building timeline…" : "💬 Build dialogue + subtitle timeline"}</button>}
            {error && <div className="error">{error}</div>}
            <button className="btn secondary" onClick={clearAll}>Clear</button>
          </div>
        </section>

        <aside className="card">
          <h2>Production pipeline</h2>
          <div className="steps">{steps.map((s, i) => <div className="step" key={s}><span className="dot" /><div><div>{s}</div><div className="muted">{i === 4 && timeline.length ? "Timeline ready" : storyboard.length && i === 2 ? "Storyboard ready" : motion?.shots?.length && i === 3 ? "Motion ready" : started && i === 0 ? "Episode generated" : "Waiting for episode"}</div></div></div>)}</div>
        </aside>
      </div>

      {result && <section className="card result"><div className="resultHeader"><div><div className="badge">EPISODE BLUEPRINT</div><h2>{result.episode?.title}</h2><p className="muted">{result.episode?.logline}</p></div>{result.mode && <div className="modePill">{result.mode}</div>}</div>{result.notice && <div className="notice">{result.notice}</div>}<h3>Scenes</h3>{(result.episode?.scenes || []).map((s: any) => <div className="scene" key={s.number}><b>{s.number}. {s.title}</b><div className="muted">{s.prompt}</div>{s.dialogue && <p>{s.dialogue}</p>}</div>)}</section>}

      {result && <section className="card workflowCard">
        <div className="resultHeader"><div><div className="badge">🚦 EPISODE WORKFLOW</div><h2>Preview → Approve → Publish</h2><p className="muted">Publishing stays behind an explicit approval gate.</p></div><div className="modePill">{workflowStatus.toUpperCase()}</div></div>
        <div className="workflowSteps"><span className={workflowStatus === "draft" ? "active" : ""}>1. Draft</span><span className={workflowStatus === "review" ? "active" : ""}>2. Review</span><span className={workflowStatus === "approved" ? "active" : ""}>3. Approved</span><span className={workflowStatus === "published" ? "active" : ""}>4. Published</span></div>
        <div className="motionControls">
          {workflowStatus === "draft" && <button className="btn" disabled={workflowLoading} onClick={() => workflowAction("submit")}>👀 Submit for review</button>}
          {workflowStatus === "review" && <><button className="btn" disabled={workflowLoading} onClick={() => workflowAction("approve")}>✅ Approve episode</button><button className="btn secondary" disabled={workflowLoading} onClick={() => workflowAction("reject")}>↩️ Send back to draft</button></>}
          {workflowStatus === "approved" && <button className="btn secondary" disabled={workflowLoading} onClick={() => workflowAction("reject")}>↩️ Reopen draft</button>}
          {workflowStatus === "published" && <span className="notice">🚀 Published on YouTube.</span>}
        </div>
        {workflowMessage && <div className="notice">{workflowMessage}</div>}
      </section>

      <section className="card projectLibraryCard">
        <div className="resultHeader"><div><div className="badge">🗂️ PROJECT LIBRARY</div><h2>Save & reopen episodes</h2><p className="muted">Your episode blueprint, characters, storyboard, motion, edit plan, thumbnail and YouTube package are stored in Supabase.</p></div></div>
        <div className="motionControls">
          <button className="btn" disabled={projectSaving || !result?.episode} onClick={saveProject}>{projectSaving ? "Saving…" : "💾 Save project"}</button>
          <button className="btn secondary" disabled={projectLoading} onClick={loadProjects}>↻ Refresh library</button>
        </div>
        {projectMessage && <div className="notice">{projectMessage}</div>}
        <div className="projectList">
          {projects.length === 0 && <div className="muted">No saved episodes loaded yet.</div>}
          {projects.map((p) => <button key={p.project_key} className="projectRow" onClick={() => openProject(p.project_key)}>
            <span><b>{p.title}</b><small>{new Date(p.updated_at).toLocaleString()} • {p.workflow_status}</small></span><span>Open →</span>
          </button>)}
        </div>
      </section>

      {result && <section className="card youtubePublisherCard">
        <div className="resultHeader"><div><div className="badge">📺 YOUTUBE PUBLISHER</div><h2>Connect and upload</h2><p className="muted">OAuth connects your own YouTube channel. The MP4 is uploaded directly from your device to the YouTube upload session.</p></div><div className="modePill">{youtubeConnected ? "CONNECTED" : "NOT CONNECTED"}</div></div>
        <div className="ytPublishGrid">
          <div>
            <div className="label">YouTube connection</div>
            <button className="btn" onClick={connectYoutube}>🔗 Connect YouTube</button>
            <div className="muted">Requires Google OAuth environment variables in Vercel.</div>
          </div>
          <div>
            <div className="label">Privacy</div>
            <select className="input" value={youtubePrivacy} onChange={e => setYoutubePrivacy(e.target.value)}>
              <option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option>
            </select>
            <div className="muted">YouTube may restrict uploads from unverified API projects to private visibility.</div>
          </div>
          <div>
            <div className="label">Rendered MP4</div>
            <input className="input" type="file" accept="video/mp4,video/*" onChange={e => setYoutubeVideoFile(e.target.files?.[0] || null)} />
            {youtubeVideoFile && <div className="muted">🎬 {youtubeVideoFile.name} • {(youtubeVideoFile.size / 1024 / 1024).toFixed(1)} MB</div>}
          </div>
        </div>
        <div className="motionControls">
          <button className="btn storyboardBtn" disabled={youtubePublishing || workflowStatus !== "approved" || !youtubeVideoFile} onClick={publishToYoutube}>
            {youtubePublishing ? `Uploading ${youtubeUploadProgress}%…` : "🚀 Upload approved episode"}
          </button>
        </div>
        {youtubeVideoUrl && <div className="notice">✅ Uploaded: <a href={youtubeVideoUrl} target="_blank" rel="noreferrer">{youtubeVideoUrl}</a></div>}
        <div className="notice">Approval gate: the upload button only works while the episode is <b>approved</b>.</div>
      </section>

      {characterBible.length > 0 && <section className="card characterCard">
        <div className="resultHeader"><div><div className="badge">👑 CHARACTER CONSISTENCY ENGINE</div><h2>Character Bible</h2><p className="muted">These visual locks are reused in storyboard prompts so the cast stays consistent from scene to scene.</p></div><div className="modePill">LOCKED</div></div>
        <div className="characterGrid">{characterBible.map((c: any) => <article className="characterPanel" key={c.id}>
          <div className="characterRefWrap">{characterRefs[c.id] ? <img src={characterRefs[c.id]} alt={c.name + " reference sheet"} className="characterRef" /> : <div className="characterPlaceholder"><span>👑</span><b>{c.name}</b><small>Reference sheet not generated</small></div>}</div>
          <div className="characterBody"><h3>{c.name}</h3><div className="muted">{c.role} • {c.age}</div><p><b>Look:</b> {c.appearance}</p><p><b>Hair:</b> {c.hair} · <b>Eyes:</b> {c.eyes}</p><p><b>Outfit:</b> {c.outfit}</p><p><b>Palette:</b> {c.palette}</p><div className="lockBox">🔒 {c.consistency_anchor}</div>
            <button className="btn storyboardBtn" disabled={characterRefLoading === c.id} onClick={() => generateCharacterReference(c)}>{characterRefLoading === c.id ? "Generating reference…" : characterRefs[c.id] ? "Regenerate reference" : "🎨 Generate reference sheet"}</button>
          </div>
        </article>)}</div>
      </section>

      {multiShots.length > 0 && <section className="card multiShotCard">
        <div className="resultHeader"><div><div className="badge">🎞️ MULTI-SHOT DIRECTOR</div><h2>{multiShots.length} cinematic shots</h2><p className="muted">Each scene is broken into establishing, character, reaction/action and closing shots.</p></div><div className="modePill">4 SHOTS / SCENE</div></div>
        <div className="multiShotGrid">{multiShots.map((s: any) => <article className="shotCard" key={s.id}>
          <img src={s.imageUrl} alt={s.title} />
          <div className="shotInfo"><b>Shot {s.shotInScene}</b><span>Scene {s.sceneNumber}</span><strong>{s.camera}</strong><small>{s.duration.toFixed(1)}s</small></div>
          {s.dialogue && <p className="shotDialogue">“{s.dialogue}”</p>}
        </article>)}</div>
      </section>

      {storyboard.length > 0 && <section className="card storyboard"><div className="resultHeader"><div><div className="badge">VISUAL STORYBOARD</div><h2>{result?.episode?.title || "Episode storyboard"}</h2><p className="muted">Cinematic frames become the visual base for motion, dialogue and subtitles.</p></div><div className="modePill">{storyboard.length} frames</div></div><div className="storyboardGrid">{storyboard.map((frame: any) => <article className="frameCard" key={frame.number}><div className="frameImageWrap"><img src={frame.imageUrl} alt={`Storyboard frame ${frame.number}: ${frame.title}`} className="frameImage" loading="lazy" /><span className="frameNumber">{String(frame.number).padStart(2, "0")}</span></div><div className="frameBody"><h3>{frame.title}</h3><div className="muted">{frame.duration}s • cinematic 16:9</div>{frame.dialogue && <p>{frame.dialogue}</p>}</div></article>)}</div></section>}

      {motion?.shots?.length > 0 && <section className="card motionStudio"><div className="resultHeader"><div><div className="badge">MOTION PREVIEW</div><h2>Anime scene player</h2><p className="muted">{motion.totalDuration}s planned runtime • {motion.shots.length} shots</p></div><div className="modePill">{playing ? "PLAYING" : "READY"}</div></div><div className="motionStage"><img src={motion.shots[activeShot].imageUrl} alt={motion.shots[activeShot].title} className={`motionImage ${String(motion.shots[activeShot].motion || "").replaceAll(" ", "-")}`} /><div className="motionOverlay"><b>{String(motion.shots[activeShot].number).padStart(2,"0")} · {motion.shots[activeShot].title}</b><span>{motion.shots[activeShot].motion} • {motion.shots[activeShot].transition}</span></div></div><div className="motionControls"><button className="btn" onClick={() => setPlaying(v => !v)}>{playing ? "⏸ Pause" : "▶ Play"}</button><button className="btn secondary" onClick={() => setActiveShot(n => n >= motion.shots.length - 1 ? 0 : n + 1)}>Next shot →</button></div><div className="shotStrip">{motion.shots.map((shot: any, i: number) => <button key={shot.number} className={`shotChip ${i === activeShot ? "active" : ""}`} onClick={() => {setActiveShot(i);setPlaying(false)}}>{String(shot.number).padStart(2,"0")}</button>)}</div></section>}

      {autoEdit && <section className="card autoEditCard">
        <div className="resultHeader"><div><div className="badge">🎬 AUTO EDIT ENGINE</div><h2>Episode cut assembled</h2><p className="muted">{autoEdit.totalDuration}s final runtime • {autoEdit.edits?.length || 0} shots • dialogue-aware music mix</p></div><div className="modePill">READY</div></div>
        <div className="editTimeline">{(autoEdit.edits || []).map((e: any) => <article className="editRow" key={e.order}><span className="editIndex">{String(e.order).padStart(2,"0")}</span><div><b>{e.title}</b><div className="muted">{formatTime(e.start)} → {formatTime(e.start + e.duration)} • {e.motion}</div></div><span className="editMix">{e.musicDuck ? "🎙️ MUSIC DUCK" : "🎵 FULL MUSIC"}</span></article>)}</div>
        <div className="notice">🎵 Original music: {autoEdit.audioMix?.music}. During dialogue, the planned music level drops to {Math.round((autoEdit.audioMix?.dialogueMusicGain || 0.35) * 100)}%.</div>
      </section>

      {thumbnail && <section className="card thumbnailCard">
        <div className="resultHeader"><div><div className="badge">🖼️ THUMBNAIL STUDIO</div><h2>Episode thumbnail</h2><p className="muted">AI-generated 16:9 artwork using the Rapsometeddy visual identity.</p></div><div className="modePill">FLUX</div></div>
        <div className="thumbnailPreview"><img src={thumbnail.imageUrl} alt={thumbnail.title + " thumbnail"} /></div>
        <div className="ytBlock"><b>Generation prompt</b><div className="copyBox">{thumbnail.prompt}</div></div>
        <div className="motionControls"><button className="btn" onClick={generateThumbnail}>🔄 Regenerate</button><button className="btn secondary" onClick={downloadThumbnail}>🖼️ Open full thumbnail</button></div>
      </section>

      {youtubePackage && <section className="card youtubeCard">
        <div className="resultHeader"><div><div className="badge">📺 YOUTUBE PACKAGE</div><h2>Upload-ready episode metadata</h2><p className="muted">Title, description, chapters, tags and thumbnail direction generated from your episode.</p></div><div className="modePill">READY</div></div>
        <div className="ytBlock"><b>Title</b><div className="copyBox">{youtubePackage.title}</div></div>
        <div className="ytBlock"><b>Description</b><pre className="copyBox pre">{youtubePackage.description}</pre></div>
        <div className="ytBlock"><b>Tags</b><div className="tagList">{(youtubePackage.tags || []).map((t: string) => <span className="tag" key={t}>{t}</span>)}</div></div>
        <div className="ytBlock"><b>Thumbnail prompt</b><div className="copyBox">{youtubePackage.thumbnailPrompt}</div></div>
        <div className="ytBlock"><b>Upload checklist</b>{(youtubePackage.uploadChecklist || []).map((x: string) => <div className="check" key={x}>☐ {x}</div>)}</div>
        <button className="btn storyboardBtn" onClick={downloadYoutubePackage}>⬇️ Export YouTube package</button>
      </section>

      {timeline.length > 0 && <section className="card voiceCard">
        <div className="resultHeader"><div><div className="badge">VOICE LAB • FREE</div><h2>Dialogue voice preview</h2><p className="muted">Uses your device/browser speech engine, so no paid voice API is required. This is a preview layer; the final voice recording can be replaced later.</p></div><div className="modePill">{voices.length} voices</div></div>
        <div className="form">
          <div><div className="label">Voice</div><select className="input" value={voiceName} onChange={e => setVoiceName(e.target.value)}><option value="">Default device voice</option>{voices.map(v => <option key={v.name + v.lang} value={v.name}>{v.name} · {v.lang}</option>)}</select></div>
          <div><div className="label">Rate: {voiceRate.toFixed(1)}</div><input type="range" min="0.6" max="1.4" step="0.1" value={voiceRate} onChange={e => setVoiceRate(Number(e.target.value))} /></div>
          <div><div className="label">Pitch: {voicePitch.toFixed(1)}</div><input type="range" min="0.6" max="1.4" step="0.1" value={voicePitch} onChange={e => setVoicePitch(Number(e.target.value))} /></div>
          <div className="motionControls"><button className="btn" disabled={speaking || !timeline[0]?.subtitle} onClick={() => speakScene(timeline[0])}>{speaking ? "🔊 Speaking…" : "🔊 Test first dialogue"}</button><button className="btn secondary" onClick={stopVoice}>⏹ Stop</button><button className="btn storyboardBtn" disabled={voiceExporting} onClick={exportVoiceTrack}>{voiceExporting ? "Preparing…" : "🎙️ Export voice timeline"}</button></div>
        </div>
        <div className="timeline">{timeline.map((s: any) => <article className="timelineRow" key={s.number}><div className="timecode">{formatTime(s.start)}–{formatTime(s.start + s.duration)}</div><div className="timelineMain"><b>Scene {s.number} · {s.title}</b><div className="subtitleBox">{s.subtitle || "No dialogue"}</div>
          {s.subtitle && <div className="motionControls"><button className="btn secondary" onClick={() => speakScene(s)}>🔊 Browser preview</button><button className="btn secondary" onClick={() => recordingScene === s.number ? stopDialogueRecording() : recordDialogue(s)}>{recordingScene === s.number ? "⏹ Stop recording" : "🎙️ Record dialogue"}</button><label className="btn secondary">📁 Use audio<input hidden type="file" accept="audio/*" onChange={e => selectVoiceClip(s.number, e.target.files?.[0] || null)} /></label></div>}
          {voiceClips[s.number] && <div className="muted">🎙️ Real voice clip attached — it will be mixed into the exported video.</div>}</div></article>)}</div>
      </section>}

      {timeline.length > 0 && <section className="card timelineCard"><div className="resultHeader"><div><div className="badge">DIALOGUE + SUBTITLES</div><h2>Episode timeline</h2><p className="muted">{totalDuration}s • subtitles will be burned into the rendered video.</p></div><div className="modePill">READY</div></div><div className="timeline">{timeline.map((s: any) => <article className="timelineRow" key={s.number}><div className="timecode">{formatTime(s.start)}–{formatTime(s.start + s.duration)}</div><div className="timelineMain"><b>Scene {s.number} · {s.title}</b><div className="muted">{s.duration}s • {s.motion}</div><div className="subtitleBox">{s.subtitle || "No dialogue — instrumental/visual scene"}</div></div></article>)}</div></section>}

      {motion?.shots?.length > 0 && <section className="card exportCard"><div className="resultHeader"><div><div className="badge">VIDEO EXPORT</div><h2>Render episode</h2><p className="muted">Canvas renderer adds cinematic motion and subtitles. FFmpeg converts the result to MP4 on-device.</p></div><div className="modePill">WEBM → MP4</div></div><div className="exportButtons"><button className="btn" disabled={exporting} onClick={exportVideo}>{exporting ? `Rendering ${exportProgress}%…` : "⬇️ Export WebM"}</button><button className="btn storyboardBtn" disabled={exporting || ffmpegLoading} onClick={exportMp4}>{ffmpegLoading ? "Converting MP4…" : "🎬 Export MP4"}</button></div><div className="progress"><div className="progressBar" style={{width: `${exportProgress}%`}} /></div>{audioFile ? <div className="muted">🎵 {audioFile.name} will be included when browser audio capture is supported.</div> : <div className="muted">Add an original audio file above to include music in the browser render.</div>}</section>}

      <footer className="footer">Rapsometeddy Anime Studio • AI-assisted creative workspace • Preview → Approve → Publish</footer>
    </main>
  );
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
