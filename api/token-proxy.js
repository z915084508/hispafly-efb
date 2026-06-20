export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = normalizeBody(req.body);
    const upstreamRes = await fetch("https://vamsys.io/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/plain, */*"
      },
      body
    });

    const resText = await upstreamRes.text();
    res.status(upstreamRes.status);
    res.setHeader("Content-Type", upstreamRes.headers.get("content-type") || "application/json");
    return res.send(resText);
  } catch (err) {
    return res.status(500).json({
      error: "Token proxy failed",
      message: err?.message || String(err)
    });
  }
}

function normalizeBody(body) {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  return new URLSearchParams(body).toString();
}
