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
    redirect: 'follow',
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('set-cookie');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
