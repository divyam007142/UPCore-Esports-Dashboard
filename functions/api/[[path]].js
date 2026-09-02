const API_ORIGIN = 'https://upcore-api-proxy.onrender.com';

export async function onRequest(context) {
  const incomingUrl = new URL(context.request.url);
  const upstreamUrl = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    API_ORIGIN,
  );
  const method = context.request.method.toUpperCase();
  const headers = new Headers(context.request.headers);
  headers.delete('host');

  const response = await fetch(upstreamUrl, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : context.request.body,
    // Preserve OAuth redirects so the browser can visit Discord and then
    // return to the dashboard. Following this inside the Worker would hide
    // the redirect from the browser.
    redirect: 'manual',
  });

  const responseHeaders = new Headers(response.headers);
  // The API is on Render while the browser is on Pages. Strip the upstream
  // Domain attribute so the session cookie belongs to the Pages origin.
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    responseHeaders.set('set-cookie', setCookie.replace(/;\s*Domain=[^;]+/gi, ''));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
