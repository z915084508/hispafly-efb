export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Only POST allowed", { status: 405 });
  }
  const body = await req.text();
  const upstreamRes = await fetch("https://vamsys.io/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body
  });
  const resText = await upstreamRes.text();
  return new Response(resText, {
    status: upstreamRes.status,
    headers: { "Content-Type": "application/json" }
  });
}
