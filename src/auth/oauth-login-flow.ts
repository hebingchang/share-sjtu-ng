const LOGIN_OAUTH_FLOW_KEY = 'login_oauth_flow'

export type LoginOAuthFlowMode = 'popup' | 'redirect'

export interface LoginOAuthFlow {
  createdAt: number
  mode: LoginOAuthFlowMode
  returnTo: string
  state: string
}

export function createLoginOAuthState(): string {
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function getLoginReturnTo(): string {
  const { hash, pathname, search } = window.location

  if (pathname.startsWith('/auth/')) return '/'

  return `${pathname}${search}${hash}`
}

export function buildLoginOAuthUrl({
  authUrl,
  clientId,
  redirectUri,
  scopes,
  state,
}: {
  authUrl: string
  clientId: string
  redirectUri: string
  scopes: string[]
  state: string
}): string {
  return `${authUrl}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
  })}`
}

export function storeLoginOAuthFlow(flow: LoginOAuthFlow) {
  sessionStorage.setItem(LOGIN_OAUTH_FLOW_KEY, JSON.stringify(flow))
}

export function readLoginOAuthFlow(): LoginOAuthFlow | null {
  const stored = sessionStorage.getItem(LOGIN_OAUTH_FLOW_KEY)
  if (!stored) return null

  try {
    const parsed = JSON.parse(stored) as Partial<LoginOAuthFlow>

    if (
      typeof parsed.createdAt === 'number' &&
      (parsed.mode === 'popup' || parsed.mode === 'redirect') &&
      typeof parsed.returnTo === 'string' &&
      typeof parsed.state === 'string'
    ) {
      return parsed as LoginOAuthFlow
    }
  } catch {
    // Ignore invalid state from a previous app version or interrupted flow.
  }

  return null
}

export function clearLoginOAuthFlow() {
  sessionStorage.removeItem(LOGIN_OAUTH_FLOW_KEY)
}

export function sanitizeLoginReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return '/'
  if (returnTo.startsWith('/auth/')) return '/'

  return returnTo
}

export function shouldUseCurrentPageOAuth(): boolean {
  const ua = window.navigator.userAgent
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  const isTouchMac = /Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1
  const isCoarsePointer =
    window.matchMedia('(hover: none)').matches && window.matchMedia('(pointer: coarse)').matches

  return isMobileUa || isTouchMac || isCoarsePointer
}
