const CHECKWX_API_KEY = process.env.CHECKWX_API_KEY || "1dfdab6853b147e09af9f4fe75";
const CHECKWX_ROOT = "https://api.checkwx.com/v2";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "method_not_allowed" });
    }

    const icao = String(req.query.icao || "")
        .toUpperCase()
        .replace(/[^A-Z0-9,]/g, "")
        .slice(0, 124);

    if (!icao) {
        return res.status(400).json({ error: "missing_icao", message: "Airport ICAO is required." });
    }

    if (!CHECKWX_API_KEY) {
        return res.status(500).json({ error: "missing_checkwx_key", message: "CheckWX API key is not configured." });
    }

    try {
        const upstream = await fetch(`${CHECKWX_ROOT}/metar/${encodeURIComponent(icao)}/decoded`, {
            headers: {
                "Accept": "application/json",
                "X-API-Key": CHECKWX_API_KEY
            }
        });
        const text = await upstream.text();
        res.status(upstream.status);
        res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
        return res.send(text);
    } catch (err) {
        return res.status(502).json({
            error: "checkwx_unavailable",
            message: err.message || "Unable to reach CheckWX."
        });
    }
}
