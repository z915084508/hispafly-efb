const VAMSYS_TOKEN_URL = "https://vamsys.io/oauth/token";
const VAMSYS_FLIGHT_MAP_URL = "https://vamsys.io/api/v3/operations/flight-map";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Only GET allowed" });
  }

  try {
    const includePosreps = String(req.query?.include_posreps || "false").toLowerCase() === "true";
    const token = await getOperationsToken(req.headers.authorization || "");
    const url = new URL(VAMSYS_FLIGHT_MAP_URL);
    if (includePosreps) url.searchParams.set("include_posreps", "true");

    const upstreamRes = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const text = await upstreamRes.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch (err) {
      return res.status(upstreamRes.ok ? 502 : upstreamRes.status).json({
        error: "vamsys_non_json",
        message: text.slice(0, 500)
      });
    }

    return res.status(upstreamRes.status).json(json);
  } catch (err) {
    return res.status(500).json({
      error: "flight_map_proxy_failed",
      message: err?.message || String(err)
    });
  }
}

async function getOperationsToken(authHeader) {
  const envId = process.env.VAMSYS_MAP_CLIENT_ID;
  const envSecret = process.env.VAMSYS_MAP_CLIENT_SECRET;

  if (envId && envSecret) {
    const now = Date.now();
    if (cachedToken && cachedTokenExpiresAt > now + 30000) return cachedToken;

    const tokenRes = await fetch(VAMSYS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: envId,
        client_secret: envSecret
      }).toString()
    });

    const tokenText = await tokenRes.text();
    let tokenJson;
    try {
      tokenJson = tokenText ? JSON.parse(tokenText) : {};
    } catch (err) {
      throw new Error(`VAMSYS token returned non-JSON: ${tokenText.slice(0, 300)}`);
    }

    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.message || tokenJson.error || `VAMSYS token HTTP ${tokenRes.status}`);
    }

    cachedToken = tokenJson.access_token;
    cachedTokenExpiresAt = now + Number(tokenJson.expires_in || 3600) * 1000;
    return cachedToken;
  }

  const bearer = String(authHeader || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer;
  throw new Error("Missing VAMSYS_MAP_CLIENT_ID / VAMSYS_MAP_CLIENT_SECRET environment variables.");
}
