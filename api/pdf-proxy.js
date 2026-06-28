const ALLOWED_HOSTS = [
  'simbrief.com',
  'navigraph.com',
  'vamsys.io',
  'vamsys.xyz',
  'cloudfront.net'
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    let url = parseAllowedUrl(req.query.url);
    let upstream;

    for (let redirects = 0; redirects < 4; redirects += 1) {
      upstream = await fetch(url, {
        redirect: 'manual',
        headers: {
          Accept: 'application/pdf,*/*;q=0.8',
          'User-Agent': 'HISPAFLY-EFB/1.0'
        }
      });
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get('location');
      if (!location) throw httpError(502, 'invalid_redirect', 'The PDF provider returned an empty redirect.');
      url = parseAllowedUrl(new URL(location, url).toString());
    }

    if (!upstream?.ok) {
      throw httpError(502, 'pdf_unavailable', `The PDF provider returned HTTP ${upstream?.status || 502}.`);
    }

    const declaredLength = Number(upstream.headers.get('content-length') || 0);
    if (declaredLength > 25 * 1024 * 1024) {
      throw httpError(413, 'pdf_too_large', 'The OFP PDF exceeds the 25 MB viewer limit.');
    }

    const data = Buffer.from(await upstream.arrayBuffer());
    if (data.length > 25 * 1024 * 1024) {
      throw httpError(413, 'pdf_too_large', 'The OFP PDF exceeds the 25 MB viewer limit.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="simbrief-ofp.pdf"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(data);
  } catch (err) {
    return res.status(Number(err.status) || 500).json({
      error: err.code || 'pdf_proxy_failed',
      message: err.message || 'Unable to load the OFP PDF.'
    });
  }
}

function parseAllowedUrl(value) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    throw httpError(400, 'invalid_pdf_url', 'A valid OFP PDF URL is required.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || !isAllowedHost(url.hostname)) {
    throw httpError(403, 'pdf_host_not_allowed', 'This PDF host is not approved for the OFP viewer.');
  }
  return url;
}

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}
