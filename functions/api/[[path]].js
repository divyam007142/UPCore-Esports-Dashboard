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
