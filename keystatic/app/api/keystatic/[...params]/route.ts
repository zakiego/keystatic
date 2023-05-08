import localConfig from '../../../../local-config';
import { makeRouteHandler } from '@keystatic/next/route-handler';

function requiredEnv(name: string, val: string | undefined): string {
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

export const { POST, GET } = makeRouteHandler({
  secret: requiredEnv('NEXTAUTH_SECRET', process.env.NEXTAUTH_SECRET),
  clientId: requiredEnv('GITHUB_CLIENT_ID', process.env.GITHUB_CLIENT_ID),
  clientSecret: requiredEnv(
    'GITHUB_CLIENT_SECRET',
    process.env.GITHUB_CLIENT_SECRET
  ),
  url: process.env.AUTH_URL,
  config: localConfig,
});
