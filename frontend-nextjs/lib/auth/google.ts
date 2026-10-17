import 'server-only'
import { createRemoteJWKSet, jwtVerify } from 'jose'

// Google sign-in with the OAuth 2.0 authorization code flow and PKCE. The ID token is verified
// here (signature against Google's keys, issuer, audience, expiry, nonce); the Java backend then
// receives only the verified identity, with AUTH_SERVICE_KEY.

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
export const OAUTH_COOKIE = 'dalatcafe_oauth'

export type GoogleConfig = { clientId: string; clientSecret: string; serviceKey: string }

/** Null when Google sign-in is not configured; the login page then explains what to set. */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const serviceKey = process.env.AUTH_SERVICE_KEY
  if (!clientId || !clientSecret || !serviceKey) return null
  return { clientId, clientSecret, serviceKey }
}

export function redirectUri(origin: string) {
  return `${(process.env.APP_URL ?? origin).replace(/\/+$/, '')}/api/auth/google/callback`
}

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64url')
}

export function randomToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function authorizeUrl(config: GoogleConfig, params: { redirectUri: string; state: string; nonce: string; challenge: string }) {
  const url = new URL(AUTHORIZE_URL)
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return url.toString()
}

export type GoogleIdentity = { googleSubject: string; email: string; name: string; emailVerified: boolean }

export async function exchangeCode(
  config: GoogleConfig,
  params: { code: string; redirectUri: string; verifier: string; nonce: string },
): Promise<GoogleIdentity> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: params.verifier,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  const tokens = (await response.json().catch(() => ({}))) as { id_token?: string; error?: string }
  if (!response.ok || !tokens.id_token) throw new Error(tokens.error ?? `Google answered ${response.status}`)

  const { payload } = await jwtVerify(tokens.id_token, GOOGLE_KEYS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: config.clientId,
  })
  if (payload.nonce !== params.nonce) throw new Error('Google sign-in nonce mismatch')
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new Error('Google did not return an email')
  return {
    googleSubject: payload.sub,
    email: payload.email,
    name: typeof payload.name === 'string' && payload.name ? payload.name : payload.email.split('@')[0],
    emailVerified: payload.email_verified === true,
  }
}
