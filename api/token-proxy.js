export default function handler(_req, res) {
  return res.status(410).json({ error: 'legacy_oauth_retired', message: 'Use HISPAFLY AOC login.' });
}
