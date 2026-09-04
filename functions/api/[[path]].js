const API_ORIGIN = 'https://upcore-api-proxy.onrender.com';

function getSetCookies(headers) {
  const parsedCookies =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [];

  if (parsedCookies.length > 0) {
    return parsedCookies;
  }

  const rawCookieHeader = headers.get('set-cookie');

  if (!rawCookieHeader) {
    return [];
  }

  // Some runtimes combine multiple Set-Cookie headers into one string.
  return rawCookieHeader
    .split(/,(?=\s*[^;,=\s]+=[^;,]*)/)
    .map((cookie) => cookie.trim())
    .filter(Boolean);
}

function rewriteCookie(cookie) {
  return cookie
    // The cookie belongs to Cloudflare Pages, not Render.
    .replace(/;\s*Domain=[^;]+/gi, '')
    // Make the session available to /api and the dashboard.
    .replace(/;\s*Path=[^;]+/gi, '; Path=/');
}

export async function onRequest(context) {
  const incomingUrl = new URL(context.request.url);

  const upstreamUrl = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    API_ORIGIN,
  );

  const method = context.request.method.toUpperCase();

  const requestHeaders = new Headers(context.request.headers);
  requestHeaders.delete('host');
  // The Pages runtime may transparently decompress an upstream response
  // before returning it. Ask Render for an uncompressed response so the
  // browser never receives a body whose Content-Encoding no longer matches.
  requestHeaders.set('accept-encoding', 'identity');

  const upstreamResponse = await fetch(upstreamUrl, {
    method,
    headers: requestHeaders,
    body:
      method === 'GET' || method === 'HEAD'
        ? undefined
        : context.request.body,
    // The browser must receive OAuth redirects directly.
    redirect: 'manual',
  });

  const responseHeaders = new Headers(upstreamResponse.headers);

  // These hop-by-hop/body-size headers belong to the upstream connection.
  // Keeping them while returning a new Response can make browser fetch()
  // wait for bytes that the Pages runtime has already decoded or removed.
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');

  const setCookies = getSetCookies(upstreamResponse.headers);

  if (setCookies.length > 0) {
    responseHeaders.delete('set-cookie');

    for (const cookie of setCookies) {
      responseHeaders.append('set-cookie', rewriteCookie(cookie));
    }
  }

  const isAuthRequest =
    incomingUrl.pathname === '/api/auth/me' ||
    incomingUrl.pathname.startsWith('/api/auth/discord');

  if (isAuthRequest) {
    responseHeaders.set('cache-control', 'no-store');
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
