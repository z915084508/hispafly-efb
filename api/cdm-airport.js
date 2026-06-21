const CDM_ENDPOINT = "https://viff-system.network/ifps/cdmAirport";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const airport = String(req.query.airport || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);

  if (!airport || airport.length !== 4) {
    return res.status(400).json({ error: "invalid_airport", message: "A 4-letter airport ICAO is required." });
  }

  try {
    const upstream = await fetch(`${CDM_ENDPOINT}?airport=${encodeURIComponent(airport)}`, {
      headers: { "Accept": "application/json" }
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: "cdm_unavailable",
      message: err.message || "Unable to reach VIFF CDM."
    });
  }
}
