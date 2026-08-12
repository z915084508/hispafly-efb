export default async function handler(req, res) {
  if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const bookingId = String(req.query.booking || '').trim();
  if (!/^[a-z0-9_-]{8,80}$/i.test(bookingId)) return res.status(400).json({ error: 'invalid_booking_id' });
  try {
    const target = new URL(`/api/efb/ofp/${encodeURIComponent(bookingId)}/signature`, process.env.HISPAFLY_AOC_API_BASE_URL || 'https://aoc.hispafly.es');
    const upstream = await fetch(target, {
      method: req.method,
      headers: { Accept: 'application/json', ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}), ...(req.method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
      body: req.method === 'PUT' ? JSON.stringify(req.body || {}) : undefined,
    });
    const cookie = upstream.headers.get('set-cookie');
    if (cookie) res.setHeader('Set-Cookie', cookie.replace(/;\s*Domain=[^;]+/gi, ''));
    res.status(upstream.status).setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(await upstream.text());
  } catch (error) {
    return res.status(502).json({ error: 'aoc_unavailable', message: error instanceof Error ? error.message : 'HISPAFLY AOC unavailable.' });
  }
}
