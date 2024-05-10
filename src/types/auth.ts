export interface OAuthConfig {
  client_id: string
  endpoint: Endpoint
  scopes: string[]
}

export interface Endpoint {
  auth_url: string
}
