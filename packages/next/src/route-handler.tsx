import {
  APIRouteConfig,
  makeGenericAPIRouteHandler,
} from '@keystatic/core/api/generic';

export function makeRouteHandler(_config: APIRouteConfig) {
  const handler = makeGenericAPIRouteHandler(_config, {
    slugEnvName: 'NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG',
  });
  async function wrappedHandler(request: Request) {
    const { body, headers, status } = await handler(request);
    return new Response(body, {
      status,
      headers,
    });
  }
  return { GET: wrappedHandler, POST: wrappedHandler };
}
