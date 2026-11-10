import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase config ───────────────────────────────────────────────────────────
// Replace these with your own Supabase project URL + anon key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Song search (Spotify → iTunes → MusicBrainz) ──────────────────────────────
function formatMs(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

async function searchSpotify(query) {
  const res = await fetch(`/api/spotify?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.tracks || []).map((t) => ({
    ...t,
    duration: t.durationMs ? formatMs(t.durationMs) : "",
  }));
}

async function searchITunes(query) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=12`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map((r) => ({
    id: `itunes-${r.trackId}`,
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName || "",
    year: r.releaseDate ? r.releaseDate.slice(0, 4) : "",
    duration: r.trackTimeMillis ? formatMs(r.trackTimeMillis) : "",
  }));
}

async function searchMusicBrainz(query) {
  const url = `https://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&limit=8&fmt=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.recordings || []).map((r) => ({
    id: r.id,
    title: r.title,
    artist: r["artist-credit"]?.[0]?.name || "Unknown Artist",
    album: r.releases?.[0]?.title || "",
    year: r["first-release-date"]?.slice(0, 4) || "",
    duration: r.length ? formatMs(r.length) : "",
  }));
}

async function searchSongs(query) {
  try {
    const results = await searchSpotify(query);
    if (results.length) return results;
  } catch (e) {
    console.error("Spotify search failed", e);
  }
  try {
    const results = await searchITunes(query);
    if (results.length) return results;
  } catch (e) {
    console.error("iTunes search failed", e);
  }
  try {
    return await searchMusicBrainz(query);
  } catch (e) {
    console.error("MusicBrainz search failed", e);
    return [];
  }
}

// ─── Time input helpers ───────────────────────────────────────────────────────
// Typing 145 shows 1:45. Typing 45 and leaving the box gives 0:45.
function formatTimeInput(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

function normalizeTime(value) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 2) return `0:${digits.padStart(2, "0")}`;
  const mins = digits.slice(0, -2).replace(/^0+(?=\d)/, "");
  return `${mins}:${digits.slice(-2)}`;
}

// ─── Transition types ─────────────────────────────────────────────────────────
const TRANSITION_TYPES = ["Double", "Chops", "Switch", "Fade in/out", "Other"];

// ─── Private-post owner id (kept in this browser only) ────────────────────────
let memoryOwnerId = null;
function getOwnerId() {
  try {
    let id = localStorage.getItem("cratedig_owner_id");
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
      localStorage.setItem("cratedig_owner_id", id);
    }
    return id;
  } catch {
    memoryOwnerId = memoryOwnerId || String(Math.random()).slice(2) + Date.now();
    return memoryOwnerId;
  }
}

// ─── Genres ───────────────────────────────────────────────────────────────────
const GENRES = [
  "All", "House", "Techno", "Drum & Bass", "Jungle", "Garage",
  "Trance", "Ambient", "Hip-Hop", "R&B", "Afrobeats", "Disco", "Funk", "Other",
];

// ─── Demo seed data (shown when DB isn't configured) ──────────────────────────
const DEMO_PAIRINGS = [
  {
    id: "demo-1",
    song_a_title: "Blue Lines",
    song_a_artist: "Massive Attack",
    song_b_title: "Safe from Harm",
    song_b_artist: "Massive Attack",
    timestamp_a: "3:20",
    timestamp_b: "0:08",
    genre: "Ambient",
    note: "Silky low-end handoff — let the bass tail from Blue Lines carry into the intro strings.",
    upvotes: 34,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "demo-2",
    song_a_title: "Inner City Life",
    song_a_artist: "Goldie",
    song_b_title: "LK",
    song_b_artist: "DJ Barber / Carolina Carol Bela",
    timestamp_a: "6:10",
    timestamp_b: "0:00",
    genre: "Drum & Bass",
    note: "Chop the amen breakdown hard. Reese bass locks in perfectly at 138bpm.",
    upvotes: 51,
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: "demo-3",
    song_a_title: "Strings of Life",
    song_a_artist: "Rhythim Is Rhythim",
    song_b_title: "Your Love",
    song_b_artist: "Frankie Knuckles",
    timestamp_a: "5:44",
    timestamp_b: "0:30",
    genre: "House",
    note: "Classic Detroit-to-Chicago blend. Ride the piano outro and drop into the bassline.",
    upvotes: 88,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "demo-4",
    song_a_title: "Windowlicker",
    song_a_artist: "Aphex Twin",
    song_b_title: "Come to Daddy",
    song_b_artist: "Aphex Twin",
    timestamp_a: "7:05",
    timestamp_b: "1:15",
    genre: "Techno",
    note: "Use the long ambient tail. Filter out mids on A before bringing B in full.",
    upvotes: 22,
    created_at: new Date(Date.now() - 86400000 * 0.5).toISOString(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function SongSearch({ label, value, onChange, placeholder = "Search for a track…" }) {
  const [query, setQuery] = useState(value ? `${value.title} — ${value.artist}` : "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(e) {
    const v = e.target.value;
    setQuery(v);
    if (value) onChange(null);
    clearTimeout(debounceRef.current);
    if (v.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await searchSongs(v);
      setResults(r);
      setOpen(true);
      setLoading(false);
    }, 400);
  }

  function pick(song) {
    setQuery(`${song.title} — ${song.artist}`);
    setResults([]);
    setOpen(false);
    onChange(song);
  }

  return (
    <div className="song-search-wrap" ref={wrapRef}>
      {label && <span className="search-label">{label}</span>}
      <div className="search-input-row">
        <span className="search-icon">♫</span>
        <input
          className="song-input"
          value={query}
          onChange={handleInput}
          placeholder={placeholder}
          onFocus={() => results.length && setOpen(true)}
          autoComplete="off"
        />
        {loading && <span className="spin">◌</span>}
      </div>
      {open && results.length > 0 && (
        <ul className="search-dropdown">
          {results.map((r) => (
            <li key={r.id} className="search-result" onMouseDown={() => pick(r)}>
              <span className="result-title">{r.title}</span>
              <span className="result-meta">{r.artist}{r.year ? ` · ${r.year}` : ""}{r.duration ? ` · ${r.duration}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {value && (
        <div className="selected-song-badge">
          <span className="badge-dot" />
          {value.title} <span className="badge-artist">by {value.artist}</span>
          {value.duration && <span className="badge-duration">{value.duration}</span>}
        </div>
      )}
    </div>
  );
}

function PairingCard({ pairing, onUpvote }) {
  const [voted, setVoted] = useState(false);

  function handleVote() {
    if (voted) return;
    setVoted(true);
    onUpvote(pairing.id);
  }

  return (
    <article className="pairing-card">
      <div className="card-pills">
        <div className="card-genre-pill">{pairing.genre}</div>
        {pairing.transition_type && <div className="card-genre-pill card-type-pill">{pairing.transition_type}</div>}
        {pairing.is_private && <div className="card-genre-pill card-private-pill">🔒 Private</div>}
      </div>

      <div className="card-tracks">
        <div className="track track-a">
          <div className="track-label">A</div>
          <div className="track-info">
            <span className="track-title">{pairing.song_a_title}</span>
            <span className="track-artist">{pairing.song_a_artist}</span>
          </div>
          <div className="track-timestamp">
            <span className="ts-label">out at</span>
            <span className="ts-value">{pairing.timestamp_a}</span>
          </div>
        </div>

        <div className="transition-arrow">
          <svg width="40" height="16" viewBox="0 0 40 16">
            <path d="M0 8 H32 M28 2 L38 8 L28 14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="track track-b">
          <div className="track-label">B</div>
          <div className="track-info">
            <span className="track-title">{pairing.song_b_title}</span>
            <span className="track-artist">{pairing.song_b_artist}</span>
          </div>
          <div className="track-timestamp">
            <span className="ts-label">in at</span>
            <span className="ts-value">{pairing.timestamp_b}</span>
          </div>
        </div>
      </div>

      {pairing.note && (
        <p className="card-note">"{pairing.note}"</p>
      )}

      <div className="card-footer">
        <span className="card-time">{timeAgo(pairing.created_at)}</span>
        <button className={`upvote-btn ${voted ? "voted" : ""}`} onClick={handleVote}>
          <span className="upvote-arrow">▲</span>
          <span className="upvote-count">{(pairing.upvotes || 0) + (voted ? 1 : 0)}</span>
        </button>
      </div>
    </article>
  );
}

function SubmitForm({ onSubmit, onClose }) {
  const [songA, setSongA] = useState(null);
  const [songB, setSongB] = useState(null);
  const [tsA, setTsA] = useState("");
  const [tsB, setTsB] = useState("");
  const [type, setType] = useState("");
  const [genre, setGenre] = useState("House");
  const [isPrivate, setIsPrivate] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!songA || !songB) return setError("Please select both songs.");
    const a = normalizeTime(tsA);
    const b = normalizeTime(tsB);
    if (!a || !b) return setError("Please add both transition times.");
    const secondsOk = [a, b].every((t) => parseInt(t.split(":")[1], 10) <= 59);
    if (!secondsOk) return setError("Seconds must be 59 or less (type 145 for 1:45).");
    if (!type) return setError("Please select a transition type.");
    if (type === "Other" && !note.trim())
      return setError('Please describe your transition in the note when "Other" is selected.');
    setError("");
    setLoading(true);
    await onSubmit({
      songA, songB, tsA: a, tsB: b, genre,
      note: note.trim(), transitionType: type, isPrivate,
    });
    setLoading(false);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-compact">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-head">
          <h2 className="modal-title">Submit a Mix</h2>
          <p className="modal-subtitle">Share a transition that actually works.</p>
        </div>

        <div className="form-grid-2">
          <SongSearch label="Song 1 (outgoing)" value={songA} onChange={setSongA} placeholder="Search song 1…" />
          <SongSearch label="Song 2 (incoming)" value={songB} onChange={setSongB} placeholder="Search song 2…" />
        </div>

        <div className="form-grid-3">
          <div className="ts-field">
            <label className="ts-label-text">Transition out at</label>
            <input
              className="ts-input"
              inputMode="numeric"
              placeholder="e.g. 320"
              value={tsA}
              onChange={(e) => setTsA(formatTimeInput(e.target.value))}
              onBlur={() => setTsA(normalizeTime(tsA))}
            />
          </div>
          <div className="ts-field">
            <label className="ts-label-text">Transition in at</label>
            <input
              className="ts-input"
              inputMode="numeric"
              placeholder="e.g. 045"
              value={tsB}
              onChange={(e) => setTsB(formatTimeInput(e.target.value))}
              onBlur={() => setTsB(normalizeTime(tsB))}
            />
          </div>
          <div className="ts-field">
            <label className="ts-label-text">Transition Type:</label>
            <select className="select-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="" disabled>Select…</option>
              {TRANSITION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="form-grid-2">
          <div className="ts-field">
            <label className="ts-label-text">Genre</label>
            <select className="select-input" value={genre} onChange={(e) => setGenre(e.target.value)}>
              {GENRES.filter((g) => g !== "All").map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <label className="private-toggle">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            <span>🔒 Post privately <em>(only you can see it)</em></span>
          </label>
        </div>

        <div className="ts-field">
          <label className="ts-label-text">
            Note <span className="optional">{type === "Other" ? "(required for Other)" : "(optional)"}</span>
          </label>
          <textarea
            className="note-input"
            placeholder="Describe the technique, why it works, EQ tips…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "Posting…" : "Post Mix →"}
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [pairings, setPairings] = useState([]);
  const [filteredPairings, setFilteredPairings] = useState([]);
  const [activeGenre, setActiveGenre] = useState("All");
  const [searchSong, setSearchSong] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => { fetchPairings(); }, []);

  useEffect(() => {
    let list = [...pairings];
    if (activeGenre !== "All") list = list.filter(p => p.genre === activeGenre);
    if (searchSong) {
      const q = searchSong.title.toLowerCase();
      list = list.filter(p =>
        p.song_a_title.toLowerCase().includes(q) || p.song_b_title.toLowerCase().includes(q) ||
        p.song_a_artist.toLowerCase().includes(q) || p.song_b_artist.toLowerCase().includes(q)
      );
    }
    setFilteredPairings(list);
  }, [pairings, activeGenre, searchSong]);

  async function fetchPairings() {
    setLoading(true);
    try {
      if (SUPABASE_URL === "YOUR_SUPABASE_URL") throw new Error("demo");
      const { data, error } = await supabase
        .from("pairings")
        .select("*")
        .or(`is_private.eq.false,owner_id.eq.${getOwnerId()}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setPairings(data || []);
    } catch {
      setPairings(DEMO_PAIRINGS);
      setIsDemo(true);
    }
    setLoading(false);
  }

  async function handleSubmit({ songA, songB, tsA, tsB, genre, note, transitionType, isPrivate }) {
    const newPairing = {
      song_a_title: songA.title,
      song_a_artist: songA.artist,
      song_a_mb_id: songA.id,
      song_b_title: songB.title,
      song_b_artist: songB.artist,
      song_b_mb_id: songB.id,
      timestamp_a: tsA,
      timestamp_b: tsB,
      genre,
      note,
      transition_type: transitionType,
      is_private: isPrivate,
      owner_id: getOwnerId(),
      upvotes: 0,
      created_at: new Date().toISOString(),
    };

    if (!isDemo) {
      const { data, error } = await supabase.from("pairings").insert([newPairing]).select();
      if (!error && data) {
        setPairings(prev => [data[0], ...prev]);
      }
    } else {
      setPairings(prev => [{ ...newPairing, id: `local-${Date.now()}` }, ...prev]);
    }
    setShowForm(false);
  }

  async function handleUpvote(id) {
    if (!isDemo) {
      const pairing = pairings.find(p => p.id === id);
      await supabase.from("pairings").update({ upvotes: (pairing?.upvotes || 0) + 1 }).eq("id", id);
    }
    setPairings(prev => prev.map(p => p.id === id ? { ...p, upvotes: (p.upvotes || 0) + 1 } : p));
  }

  return (
    <div className="app">
      {/* Background noise texture */}
      <div className="bg-noise" />

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">CrateDig</span>
          </div>
          <p className="logo-tagline">Community transitions for DJs</p>
          <button className="add-btn" onClick={() => setShowForm(true)}>
            <span>+ Submit Mix</span>
          </button>
        </div>
      </header>

      {/* Hero search */}
      <section className="hero">
        <h1 className="hero-title">Find your next transition.</h1>
        <p className="hero-sub">Search any track — see what DJs are mixing with it.</p>
        <div className="hero-search">
          <SongSearch
            value={searchSong}
            onChange={setSearchSong}
            placeholder="Search any track to see compatible mixes…"
          />
          {searchSong && (
            <button className="clear-search" onClick={() => setSearchSong(null)}>Clear search ✕</button>
          )}
        </div>
      </section>

      {/* Genre filter bar */}
      <div className="genre-bar">
        {GENRES.map(g => (
          <button
            key={g}
            className={`genre-pill ${activeGenre === g ? "active" : ""}`}
            onClick={() => setActiveGenre(g)}
          >{g}</button>
        ))}
      </div>

      {/* Demo banner */}
      {isDemo && (
        <div className="demo-banner">
          ⚡ Running in demo mode — connect Supabase to save mixes permanently. See <code>README.md</code> for setup.
        </div>
      )}

      {/* Feed */}
      <main className="feed">
        {loading ? (
          <div className="loading-state">
            <span className="loading-spinner">◌</span>
            <p>Loading mixes…</p>
          </div>
        ) : filteredPairings.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">◈</span>
            <p>No mixes found{searchSong ? ` for "${searchSong.title}"` : ""}.</p>
            <button className="add-btn" onClick={() => setShowForm(true)}>Be the first to submit one →</button>
          </div>
        ) : (
          <div className="feed-grid">
            {filteredPairings.map(p => (
              <PairingCard key={p.id} pairing={p} onUpvote={handleUpvote} />
            ))}
          </div>
        )}
      </main>

      {/* Submit Modal */}
      {showForm && <SubmitForm onSubmit={handleSubmit} onClose={() => setShowForm(false)} />}
    </div>
  );
}
