const HOPPIE_ENDPOINT = "https://www.hoppie.nl/acars/system/connect.html";
const VALID_TYPES = new Set(["telex", "poll", "peek", "ping", "cpdlc", "acars", "progress", "ads-c", "inforeq"]);
const TYPE_CANONICAL = {
  telex: "TELEX",
  cpdlc: "CPDLC",
  acars: "ACARS",
  progress: "PROGRESS",
  "ads-c": "ADS-C",
  inforeq: "INFOREQ",
  poll: "poll",
  peek: "peek",
  ping: "ping"
};

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
    type: TYPE_CANONICAL[type] || type,
    packet
  };
}

function parseHoppieResponse(text) {
  const cleanText = clean(text);
  if (!cleanText || cleanText.toUpperCase() === "OK") return [];

  const braceMatches = [...cleanText.matchAll(/\{([^{}]+)\}/g)];
  if (braceMatches.length) {
    return braceMatches.map((match, index) => parseHoppieLine(match[1], String(index + 1)));
  }

  return cleanText
    .split(/\n+/)
    .map((line, index) => parseHoppieLine(line.trim(), String(index + 1)))
    .filter((message) => message.raw);
}

function parseHoppieLine(line, fallbackId) {
  if (!line) return { raw: "" };
  const withId = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
  if (withId) {
    return {
      id: withId[1],
      from: withId[2],
      type: withId[3],
      packet: withId[4],
      raw: line
    };
  }

  const withoutId = line.match(/^(\S+)\s+(\S+)\s+(.+)$/);
  if (withoutId) {
    return {
      id: fallbackId,
      from: withoutId[1],
      type: withoutId[2],
      packet: withoutId[3],
      raw: line
    };
  }

  return { id: fallbackId, raw: line };
}

function clean(value) {
  return String(value ?? "").trim();
}
