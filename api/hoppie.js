const HOPPIE_ENDPOINT = "https://www.hoppie.nl/acars/system/connect.html";
const VALID_TYPES = new Set(["telex", "poll", "peek", "ping", "cpdlc", "acars", "progress"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const payload = buildHoppiePayload(body);

    const upstreamRes = await fetch(HOPPIE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/plain, */*"
      },
      body: new URLSearchParams(payload).toString()
    });

    const text = await upstreamRes.text();
    return res.status(upstreamRes.ok ? 200 : upstreamRes.status).json({
      ok: upstreamRes.ok,
      status: upstreamRes.status,
      type: payload.type,
      callsign: payload.from,
      raw: text,
      messages: parseHoppieResponse(text)
    });
  } catch (err) {
    return res.status(400).json({
      error: "Hoppie proxy failed",
      message: err?.message || String(err)
    });
  }
}

function buildHoppiePayload(body) {
  const action = clean(body.action || "send").toLowerCase();
  const logon = clean(body.logon || body.logonCode);
  const from = clean(body.from || body.callsign).toUpperCase();
  const to = clean(body.to || "SERVER").toUpperCase();
  const packet = clean(body.packet || body.message);
  let type = clean(body.type).toLowerCase();

  if (!type) {
    if (action === "poll") type = "poll";
    else if (action === "peek") type = "peek";
    else if (action === "logon") type = "ping";
    else type = "telex";
  }

  if (!logon) throw new Error("Missing Hoppie logon code.");
  if (!from) throw new Error("Missing callsign.");
  if (!VALID_TYPES.has(type)) throw new Error(`Unsupported Hoppie message type: ${type}`);
  if (type !== "poll" && type !== "peek" && type !== "ping" && !packet) {
    throw new Error("Missing message packet.");
  }

  return {
    logon,
    from,
    to,
    type,
    packet
  };
}

function parseHoppieResponse(text) {
  const cleanText = clean(text);
  if (!cleanText || cleanText.toUpperCase() === "OK") return [];

  return cleanText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
      if (!match) return { raw: line };
      return {
        id: match[1],
        from: match[2],
        type: match[3],
        packet: match[4],
        raw: line
      };
    });
}

function clean(value) {
  return String(value ?? "").trim();
}
