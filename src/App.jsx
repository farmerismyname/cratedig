import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase config ───────────────────────────────────────────────────────────
// Replace these with your own Supabase project URL + anon key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });

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
const GENRE_TREE = {
  "House": ["Bass House", "Tech", "Progressive", "Deep", "Afro", "Electro", "Speed", "French", "Chicago"],
  "Dubstep": ["Brostep", "Riddim", "Wubz", "Deep", "Melodic", "Tearout", "Deathstep"],
  "Drum n Bass": ["Dancefloor", "Liquid", "Jump-Up", "Neurofunk", "Minimal", "Jungle", "Breakbeat"],
  "Techno": ["Hard Techno", "Rolling", "Acid", "Melodic", "Minimal", "Hardcore"],
  "Trap": [],
  "Trance": ["Psytrance", "Uplifting", "Progressive", "Hard"],
  "Pop": ["60s-90s", "Y2K", "Singalong"],
};
const GENRES = ["All", ...Object.keys(GENRE_TREE)];

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
    genre: "Pop",
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
    genre: "Drum n Bass",
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

const SORTS = [["recent", "Recent"], ["likes", "Most liked"]];

function sortList(list, sort) {
  const byDate = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  return [...list].sort((a, b) =>
    sort === "likes" ? (b.like_count || 0) - (a.like_count || 0) || byDate(a, b) : byDate(a, b)
  );
}

function PairingCard({ pairing, liked, onLike, canDelete, onDelete }) {
  return (
    <article className="pairing-card">
      <div className="card-pills">
        <div className="card-genre-pill">{pairing.genre}</div>
        {pairing.subgenre && <div className="card-genre-pill card-sub-pill">{pairing.subgenre}</div>}
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

      {pairing.note && <p className="card-note">"{pairing.note}"</p>}

      <div className="card-footer">
        <span className="card-time">{timeAgo(pairing.created_at)}</span>
        <div className="card-actions">
          {canDelete && <button className="delete-btn" onClick={() => onDelete(pairing.id)}>Delete</button>}
          <button className={`upvote-btn ${liked ? "voted" : ""}`} onClick={() => onLike(pairing.id)} aria-label="Like">
            <span className="upvote-arrow">{liked ? "♥" : "♡"}</span>
            <span className="upvote-count">{pairing.like_count || 0}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function SortSelect({ value, onChange }) {
  return (
    <select className="select-input sort-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function AccountMenu({ user, onNav, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const meta = user.user_metadata || {};
  const name = meta.full_name || meta.name || user.email || "Account";
  const go = (v) => { setOpen(false); onNav(v); };
  return (
    <div className="account" ref={ref}>
      <button className="avatar-btn" onClick={() => setOpen(!open)} aria-label="Account menu">
        {meta.avatar_url ? <img src={meta.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span>{name[0]?.toUpperCase()}</span>}
      </button>
      {open && (
        <div className="account-menu">
          <div className="account-name">{name}</div>
          <button onClick={() => go("posts")}>My Posts</button>
          <button onClick={() => go("likes")}>My Likes</button>
          <button onClick={() => { setOpen(false); onSignOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function ProfilePage({ tab, setTab, pairings, user, likedIds, onLike, onDelete, onBack }) {
  const [genre, setGenre] = useState("All");
  const [sub, setSub] = useState("");
  const [sort, setSort] = useState("recent");
  let list = tab === "posts" ? pairings.filter((p) => p.user_id === user?.id || p.local) : pairings.filter((p) => likedIds.has(p.id));
  if (genre !== "All") list = list.filter((p) => p.genre === genre);
  if (sub) list = list.filter((p) => p.subgenre === sub);
  list = sortList(list, sort);
  return (
    <main className="feed">
      <button className="clear-search" onClick={onBack}>← Back to feed</button>
      <div className="profile-tabs">
        <button className={tab === "posts" ? "active" : ""} onClick={() => setTab("posts")}>My Posts</button>
        <button className={tab === "likes" ? "active" : ""} onClick={() => setTab("likes")}>My Likes</button>
      </div>
      <div className="profile-filters">
        <select className="select-input" value={genre} onChange={(e) => { setGenre(e.target.value); setSub(""); }}>
          {GENRES.map((g) => <option key={g} value={g}>{g === "All" ? "All genres" : g}</option>)}
        </select>
        {genre !== "All" && (
          <select className="select-input" value={sub} onChange={(e) => setSub(e.target.value)}>
            <option value="">All {genre}</option>
            {(GENRE_TREE[genre] || []).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        )}
        <SortSelect value={sort} onChange={setSort} />
      </div>
      {list.length === 0 ? (
        <div className="empty-state"><span className="empty-icon">◈</span><p>{tab === "posts" ? "You haven't posted any mixes yet." : "You haven't liked anything yet."}</p></div>
      ) : (
        <div className="feed-grid">
          {list.map((p) => (
            <PairingCard key={p.id} pairing={p} liked={likedIds.has(p.id)} onLike={onLike}
              canDelete={tab === "posts"} onDelete={onDelete} />
          ))}
        </div>
      )}
    </main>
  );
}

function SubmitForm({ onSubmit, onClose }) {
  const [songA, setSongA] = useState(null);
  const [songB, setSongB] = useState(null);
  const [tsA, setTsA] = useState("");
  const [tsB, setTsB] = useState("");
  const [type, setType] = useState("");
  const [genre, setGenre] = useState("House");
  const [subgenre, setSubgenre] = useState("");
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
      songA, songB, tsA: a, tsB: b, genre, subgenre,
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
            <label className="ts-label-text">Trans out/start song 2 at:</label>
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

        <div className="form-grid-3">
          <div className="ts-field">
            <label className="ts-label-text">Genre</label>
            <select className="select-input" value={genre} onChange={(e) => { setGenre(e.target.value); setSubgenre(""); }}>
              {GENRES.filter((g) => g !== "All").map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="ts-field">
            <label className="ts-label-text">Subgenre <span className="optional">(optional)</span></label>
            <select className="select-input" value={subgenre} onChange={(e) => setSubgenre(e.target.value)}>
              <option value="">None</option>
              {(GENRE_TREE[genre] || []).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <label className="private-toggle" title="Only you can see private posts">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            <span>🔒 Private post</span>
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
  const [user, setUser] = useState(null);
  const [pairings, setPairings] = useState([]);
  const [likedIds, setLikedIds] = useState(new Set());
  const [activeGenre, setActiveGenre] = useState("All");
  const [activeSub, setActiveSub] = useState("");
  const [sort, setSort] = useState("recent");
  const [searchSong, setSearchSong] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [view, setView] = useState("feed");
  const [profileTab, setProfileTab] = useState("posts");

  // ── auth ──
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn() {
    if (!supabase) return alert("Sign-in needs Supabase to be connected.");
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setView("feed");
  }

  // ── data ──
  useEffect(() => { fetchPairings(); loadLikes(); }, [user?.id]);

  async function fetchPairings() {
    setLoading(true);
    try {
      if (!supabase) throw new Error("demo");
      const { data, error } = await supabase
        .from("pairings").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      setPairings(data || []);
      setIsDemo(false);
    } catch {
      setPairings(DEMO_PAIRINGS.map((p) => ({ ...p, like_count: p.upvotes })));
      setIsDemo(true);
    }
    setLoading(false);
  }

  async function loadLikes() {
    if (!supabase || !user) return setLikedIds(new Set());
    const { data } = await supabase.from("likes").select("pairing_id");
    setLikedIds(new Set((data || []).map((r) => r.pairing_id)));
  }

  function requireSignIn() {
    if (supabase && !user) { signIn(); return false; }
    return true;
  }

  function openSubmit() { if (requireSignIn()) setShowForm(true); }

  async function handleSubmit({ songA, songB, tsA, tsB, genre, subgenre, note, transitionType, isPrivate }) {
    const row = {
      song_a_title: songA.title, song_a_artist: songA.artist, song_a_mb_id: songA.id,
      song_b_title: songB.title, song_b_artist: songB.artist, song_b_mb_id: songB.id,
      timestamp_a: tsA, timestamp_b: tsB, genre, subgenre: subgenre || null, note,
      transition_type: transitionType, is_private: isPrivate,
    };
    if (!isDemo) {
      const { data, error } = await supabase.from("pairings").insert([row]).select();
      if (error) return alert("Couldn't post: " + error.message);
      setPairings((prev) => [data[0], ...prev]);
    } else {
      setPairings((prev) => [{ ...row, id: `local-${Date.now()}`, like_count: 0, local: true, created_at: new Date().toISOString() }, ...prev]);
    }
    setShowForm(false);
  }

  async function toggleLike(id) {
    if (!requireSignIn()) return;
    const liked = likedIds.has(id);
    const apply = (d) => {
      setLikedIds((prev) => { const n = new Set(prev); d > 0 ? n.add(id) : n.delete(id); return n; });
      setPairings((prev) => prev.map((p) => p.id === id ? { ...p, like_count: Math.max(0, (p.like_count || 0) + d) } : p));
    };
    apply(liked ? -1 : 1);
    if (isDemo) return;
    const { error } = liked
      ? await supabase.from("likes").delete().eq("pairing_id", id).eq("user_id", user.id)
      : await supabase.from("likes").insert({ pairing_id: id });
    if (error) apply(liked ? 1 : -1);
  }

  async function deletePost(id) {
    if (!window.confirm("Delete this post?")) return;
    if (!isDemo) {
      const { error } = await supabase.from("pairings").delete().eq("id", id);
      if (error) return alert("Couldn't delete: " + error.message);
    }
    setPairings((prev) => prev.filter((p) => p.id !== id));
  }

  // ── main feed filtering ──
  let feed = pairings;
  if (activeGenre !== "All") feed = feed.filter((p) => p.genre === activeGenre);
  if (activeSub) feed = feed.filter((p) => p.subgenre === activeSub);
  if (searchSong) {
    const q = searchSong.title.toLowerCase();
    feed = feed.filter((p) =>
      [p.song_a_title, p.song_b_title, p.song_a_artist, p.song_b_artist].some((x) => x.toLowerCase().includes(q)));
  }
  feed = sortList(feed, sort);

  const nav = (v) => { setProfileTab(v); setView("profile"); };

  return (
    <div className="app">
      <div className="bg-noise" />

      <header className="header">
        <div className="header-inner">
          <div className="logo" onClick={() => setView("feed")} style={{ cursor: "pointer" }}>
            <span className="logo-icon">◈</span>
            <span className="logo-text">CrateDig</span>
          </div>
          <p className="logo-tagline">Community transitions for DJs</p>
          <button className="add-btn" onClick={openSubmit}><span>+ Submit Mix</span></button>
          {user
            ? <AccountMenu user={user} onNav={nav} onSignOut={signOut} />
            : supabase && <button className="signin-btn" onClick={signIn}>Sign in with Google</button>}
        </div>
      </header>

      {isDemo && (
        <div className="demo-banner">
          ⚡ Running in demo mode — connect Supabase to save mixes permanently. See <code>README.md</code> for setup.
        </div>
      )}

      {view === "profile" && user ? (
        <ProfilePage tab={profileTab} setTab={setProfileTab} pairings={pairings} user={user}
          likedIds={likedIds} onLike={toggleLike} onDelete={deletePost} onBack={() => setView("feed")} />
      ) : (
        <>
          <section className="hero">
            <h1 className="hero-title">Find your next transition.</h1>
            <p className="hero-sub">Search any track — see what DJs are mixing with it.</p>
            <div className="hero-search">
              <SongSearch value={searchSong} onChange={setSearchSong} placeholder="Search any track to see compatible mixes…" />
              {searchSong && <button className="clear-search" onClick={() => setSearchSong(null)}>Clear search ✕</button>}
            </div>
          </section>

          <div className="filters">
            <div className="genre-bar">
              {GENRES.map((g) => (
                <button key={g} className={`genre-pill ${activeGenre === g ? "active" : ""}`}
                  onClick={() => { setActiveGenre(g); setActiveSub(""); }}>{g}</button>
              ))}
            </div>
            <div className="filter-row2">
              <SortSelect value={sort} onChange={setSort} />
              {activeGenre !== "All" && (GENRE_TREE[activeGenre] || []).length > 0 && (
                <div className="sub-pills">
                  <button className={`sub-pill ${!activeSub ? "active" : ""}`} onClick={() => setActiveSub("")}>All {activeGenre}</button>
                  {GENRE_TREE[activeGenre].map((sg) => (
                    <button key={sg} className={`sub-pill ${activeSub === sg ? "active" : ""}`} onClick={() => setActiveSub(sg)}>{sg}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <main className="feed">
            {loading ? (
              <div className="loading-state"><span className="loading-spinner">◌</span><p>Loading mixes…</p></div>
            ) : feed.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">◈</span>
                <p>No mixes found{searchSong ? ` for "${searchSong.title}"` : ""}.</p>
                <button className="add-btn" onClick={openSubmit}>Be the first to submit one →</button>
              </div>
            ) : (
              <div className="feed-grid">
                {feed.map((p) => (
                  <PairingCard key={p.id} pairing={p} liked={likedIds.has(p.id)} onLike={toggleLike}
                    canDelete={!!user && p.user_id === user.id} onDelete={deletePost} />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {showForm && <SubmitForm onSubmit={handleSubmit} onClose={() => setShowForm(false)} />}
    </div>
  );
}
