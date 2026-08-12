const DEFAULT_AOC_ORIGIN = "https://aoc.hispafly.es";
const PDF_REDIRECT_HOSTS = ["simbrief.com", "navigraph.com", "cloudfront.net"];
const AOC_ROUTE_RULES = [
  { pattern: /^\/api\/auth\/local\/(?:login|logout)$/, methods: new Set(["POST"]) },
  { pattern: /^\/api\/auth\/local\/me$/, methods: new Set(["GET"]) },
  { pattern: /^\/api\/efb\/[a-z0-9/_-]+$/i, methods: new Set(["GET", "POST", "PUT", "DELETE", "OPTIONS"]) },
  { pattern: /^\/api\/pilot\/live-flights(?:\/[a-z0-9_-]+\/track)?$/i, methods: new Set(["GET"]) },
  { pattern: /^\/api\/ofp\/[a-z0-9_-]+\/pdf$/i, methods: new Set(["GET"]) },
];

export function isAllowedAocPath(path, method = "GET") {
  if (typeof path !== "string" || !path.startsWith("/")) return false;
  let decodedPath = "";
  try { decodedPath = decodeURIComponent(path); } catch { return false; }
  if (decodedPath.includes("..") || decodedPath.includes("\\")) return false;
  try {
    const pathname = new URL(path, "https://aoc.invalid").pathname;
    return AOC_ROUTE_RULES.some((rule) => rule.pattern.test(pathname) && rule.methods.has(String(method).toUpperCase()));
  }
  catch { return false; }
}

export function isAllowedPdfRedirect(url, origin = aocOrigin()) {
  let target;
  try { target = new URL(url); } catch { return false; }
  if (target.protocol !== "https:" || target.username || target.password) return false;
  if (target.origin === origin) return isAllowedAocPath(`${target.pathname}${target.search}`, "GET");
  const host = target.hostname.toLowerCase();
  return PDF_REDIRECT_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function aocOrigin() {
  const value = process.env.HISPAFLY_AOC_API_BASE_URL || DEFAULT_AOC_ORIGIN;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Invalid AOC origin");
  return url.origin;
}

export default async function handler(req, res) {
  const path = typeof req.query.path === "string" ? req.query.path : "";
  if (!isAllowedAocPath(path, req.method)) {
    return res.status(400).json({ error: "invalid_aoc_path", message: "This AOC endpoint is not available to EFB." });
  }
  try {
    const target = new URL(path, aocOrigin());
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== "path" && typeof value === "string") target.searchParams.set(key, value);
    }
    const isPdfRequest = /^\/api\/ofp\/[a-z0-9_-]+\/pdf$/i.test(target.pathname) && req.method === "GET";
    const headers = { Accept: isPdfRequest ? "application/pdf,*/*;q=0.8" : "application/json", "User-Agent": req.headers["user-agent"] || "HISPAFLY-EFB" };
    if (req.headers.cookie) headers.Cookie = req.headers.cookie;
    if (req.body && req.method !== "GET" && req.method !== "HEAD") headers["Content-Type"] = "application/json";
    let upstream;
    let currentTarget = target;
    for (let redirects = 0; redirects <= (isPdfRequest ? 4 : 0); redirects += 1) {
      upstream = await fetch(currentTarget, {
        method: req.method,
        headers,
        body: req.body && req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
        redirect: "manual",
      });
      if (!isPdfRequest || ![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get("location");
      if (!location) throw new Error("The AOC PDF endpoint returned an empty redirect.");
      const nextTarget = new URL(location, currentTarget);
      if (!isAllowedPdfRedirect(nextTarget.toString())) throw new Error("The AOC PDF endpoint redirected to an unapproved host.");
      if (nextTarget.origin !== aocOrigin()) delete headers.Cookie;
      currentTarget = nextTarget;
    }
    if (!upstream) throw new Error("The AOC request did not return a response.");
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) res.setHeader("Set-Cookie", setCookie.replace(/;\s*Domain=[^;]+/gi, ""));
    res.status(upstream.status);
    const type = upstream.headers.get("content-type") || "application/json; charset=utf-8";
    res.setHeader("Content-Type", type);
    if (isPdfRequest && type.toLowerCase().includes("application/pdf")) {
      res.setHeader("Content-Disposition", "inline; filename=\"simbrief-ofp.pdf\"");
      res.setHeader("Cache-Control", "private, max-age=300");
    }
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error("[AOC proxy]", error);
    return res.status(502).json({ error: "aoc_unavailable", message: "HISPAFLY AOC is temporarily unavailable." });
  }
}
