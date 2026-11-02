let cache = { token: null, exp: 0 };

async function getToken() {
  if (cache.token && Date.now() < cache.exp) return cache.token;
  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const d = await r.json();
  cache = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return cache.token;
}

export default async function handler(req, res) {
  const q = req.query.q;
  if (!q) return res.status(400).json({ tracks: [] });
  try {
    const token = await getToken();
    const r = await fetch(
      `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const d = await r.json();
    const tracks = (d.tracks?.items || []).map((t) => ({
      id: `spotify-${t.id}`,
      title: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      album: t.album?.name || "",
      year: t.album?.release_date?.slice(0, 4) || "",
      duration: "",
      durationMs: t.duration_ms,
    }));
    res.status(200).json({ tracks });
  } catch (e) {
    res.status(500).json({ tracks: [] });
  }
}
