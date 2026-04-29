export interface OAuthEndpoint {
  auth_url: string
}

export interface OAuthConfig {
  client_id: string
  endpoint: OAuthEndpoint
  redirect_uri?: string
  scopes: string[]
}
