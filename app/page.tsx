"use client";

import { useState } from "react";

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

  function clearAll() {
    setTitle("");
    setStory("");
    setSong("");
    setStarted(false);
    setResult(null);
    setStoryboard([]);
    setError("");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo">R</div>
          <div>
            <div>Rapsometeddy <span className="purple">Anime Studio</span></div>
            <div className="muted">CREATE • ANIMATE • SCORE</div>
          </div>
        </div>
        <div className="badge">FREE-FIRST PIPELINE</div>
      </header>

      <section className="hero">
        <div className="badge">👑 RAPSOMETTEDY ORIGINALS</div>
        <h1>Turn your songs into <span className="purple">anime stories.</span></h1>
        <p>
          Build an original episode from a story idea and your own music. Generate the
          episode blueprint, then turn every scene into a visual storyboard.
        </p>
      </section>

      <div className="grid">
        <section className="card">
          <h2>Create new episode</h2>
          <div className="form">
            <div>
              <div className="label">Episode title</div>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. GFN — Episode 01" />
            </div>

            <div>
              <div className="label">Story / concept</div>
              <textarea className="textarea" value={story} onChange={e => setStory(e.target.value)} placeholder="Describe the world, characters, conflict and mood..." />
            </div>

            <div>
              <div className="label">Song</div>
              <input className="input" value={song} onChange={e => setSong(e.target.value)} placeholder="Song name or uploaded track reference" />
            </div>

            <button className="btn" disabled={loading} onClick={generate}>
              {loading ? "Generating…" : started ? "Regenerate episode" : "Generate episode"}
            </button>

            {result?.episode && (
              <button className="btn storyboardBtn" disabled={storyboardLoading} onClick={generateStoryboard}>
                {storyboardLoading ? "Building storyboard…" : "🎬 Generate storyboard"}
              </button>
            )}

            {error && <div className="error">{error}</div>}

            <button className="btn secondary" onClick={clearAll}>Clear</button>
          </div>
        </section>

        <aside className="card">
          <h2>Production pipeline</h2>
          <div className="steps">
            {steps.map((s, i) => (
              <div className="step" key={s}>
                <span className="dot" />
                <div>
                  <div>{s}</div>
                  <div className="muted">
                    {storyboard.length > 0 && i === 2
                      ? "Storyboard ready"
                      : started && i === 0
                        ? "Episode generated"
                        : "Waiting for episode"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {result && (
        <section className="card result">
          <div className="resultHeader">
            <div>
              <div className="badge">EPISODE BLUEPRINT</div>
              <h2>{result.episode?.title}</h2>
              <p className="muted">{result.episode?.logline}</p>
            </div>
            {result.mode && <div className="modePill">{result.mode}</div>}
          </div>

          {result.notice && <div className="notice">{result.notice}</div>}

          <h3>Scenes</h3>
          {(result.episode?.scenes || []).map((s: any) => (
            <div className="scene" key={s.number}>
              <b>{s.number}. {s.title}</b>
              <div className="muted">{s.prompt}</div>
              {s.dialogue && <p>{s.dialogue}</p>}
            </div>
          ))}
        </section>
      )}

      {storyboard.length > 0 && (
        <section className="card storyboard">
          <div className="resultHeader">
            <div>
              <div className="badge">VISUAL STORYBOARD</div>
              <h2>{result?.episode?.title || "Episode storyboard"}</h2>
              <p className="muted">One cinematic frame per generated scene. These frames are the visual base for the next motion/editing stage.</p>
            </div>
            <div className="modePill">{storyboard.length} frames</div>
          </div>

          <div className="storyboardGrid">
            {storyboard.map((frame: any) => (
              <article className="frameCard" key={frame.number}>
                <div className="frameImageWrap">
                  <img src={frame.imageUrl} alt={`Storyboard frame ${frame.number}: ${frame.title}`} className="frameImage" loading="lazy" />
                  <span className="frameNumber">{String(frame.number).padStart(2, "0")}</span>
                </div>
                <div className="frameBody">
                  <h3>{frame.title}</h3>
                  <div className="muted">{frame.duration}s • cinematic 16:9</div>
                  {frame.dialogue && <p>{frame.dialogue}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="footer">
        Rapsometeddy Anime Studio • AI-assisted creative workspace • Preview → Approve → Publish
      </footer>
    </main>
  );
}
