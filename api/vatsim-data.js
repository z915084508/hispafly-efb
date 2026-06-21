const VATSIM_DATA_URL = "https://data.vatsim.net/v3/vatsim-data.json";

let cachedData = null;
let cachedAt = 0;
const CACHE_MS = 15000;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const now = Date.now();
    if (cachedData && now - cachedAt < CACHE_MS) {
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
      return res.status(200).json(cachedData);
    }

    const upstream = await fetch(VATSIM_DATA_URL, {
      headers: { "Accept": "application/json" }
    });
    const text = await upstream.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (err) {
      return res.status(502).json({
        error: "vatsim_non_json",
        message: text.slice(0, 300)
      });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json(json);
    }

    cachedData = json;
    cachedAt = now;
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
    return res.status(200).json(json);
  } catch (err) {
    return res.status(502).json({
      error: "vatsim_unavailable",
      message: err.message || "Unable to reach VATSIM data."
    });
  }
}
