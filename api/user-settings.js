export default function handler(_req, res) {
  return res.status(410).json({ error: 'cloud_settings_retired', message: 'Settings are local until the encrypted HISPAFLY AOC vault is enabled.' });
}
