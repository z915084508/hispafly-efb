export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const target = new URL('/api/pilot/live-flights', process.env.HISPAFLY_AOC_API_BASE_URL || 'https://aoc.hispafly.es');
    const upstream = await fetch(target, { headers: { Accept: 'application/json', ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}) } });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(upstream.status).json(payload);
    const flights = (payload.flights || []).map((flight) => ({ ...flight, posreps: flight.latitude == null || flight.longitude == null ? [] : [{ latitude: flight.latitude, longitude: flight.longitude, altitude: flight.altitudeFeet, ground_speed: flight.groundSpeedKnots, heading: flight.headingDegrees, created_at: flight.recordedAt }] }));
    return res.status(200).json({ data: flights, updatedAt: payload.updatedAt, source: 'HISPAFLY_AOC' });
  } catch (error) { return res.status(502).json({ error: 'aoc_unavailable', message: error instanceof Error ? error.message : 'HISPAFLY AOC unavailable.' }); }
}
