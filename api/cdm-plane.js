const CDM_PLANE_ENDPOINT = "https://viff-system.network/plane/cidCheck";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const callsign = String(req.query.callsign || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

  if (!callsign) {
    return res.status(400).json({ error: "invalid_callsign", message: "A callsign is required." });
  }

  try {
    const upstream = await fetch(`${CDM_PLANE_ENDPOINT}?callsign=${encodeURIComponent(callsign)}`, {
      headers: { "Accept": "application/json" }
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: "cdm_plane_unavailable",
      message: err.message || "Unable to reach VIFF CDM plane lookup."
    });
  }
}
