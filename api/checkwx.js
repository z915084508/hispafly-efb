const CHECKWX_API_KEY = process.env.CHECKWX_API_KEY || "1dfdab6853b147e09af9f4fe75";
const CHECKWX_ROOT = "https://api.checkwx.com/v2";

async function requestCheckwx(path) {
    const upstream = await fetch(`${CHECKWX_ROOT}${path}`, {
        headers: {
            "Accept": "application/json",
            "X-API-Key": CHECKWX_API_KEY
        }
    });
    const text = await upstream.text();
    let body;
    try {
        body = text ? JSON.parse(text) : null;
    } catch (err) {
        body = { error: "invalid_checkwx_response", message: text || err.message };
    }

    if (!upstream.ok) {
        const message = body?.message || body?.error || `CheckWX HTTP ${upstream.status}`;
        throw new Error(message);
    }

    return body;
}

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
        const encodedIcao = encodeURIComponent(icao);
        const [metarResult, tafResult] = await Promise.allSettled([
            requestCheckwx(`/metar/${encodedIcao}/decoded`),
            requestCheckwx(`/taf/${encodedIcao}/decoded`)
        ]);

        if (metarResult.status === "rejected" && tafResult.status === "rejected") {
            throw new Error(metarResult.reason?.message || tafResult.reason?.message || "Unable to reach CheckWX.");
        }

        return res.status(200).json({
            metar: metarResult.status === "fulfilled"
                ? metarResult.value
                : { error: "metar_unavailable", message: metarResult.reason?.message || "No METAR returned." },
            taf: tafResult.status === "fulfilled"
                ? tafResult.value
                : { error: "taf_unavailable", message: tafResult.reason?.message || "No TAFOR returned." }
        });
    } catch (err) {
        return res.status(502).json({
            error: "checkwx_unavailable",
            message: err.message || "Unable to reach CheckWX."
        });
    }
}
