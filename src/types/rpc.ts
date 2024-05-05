export interface Response<T> {
  code: number
  data: T
  message: string
  success: boolean
}

export interface OAuthConfig {
  client_id: string
  endpoint: Endpoint
  scopes: string[]
}

export interface Endpoint {
  auth_url: string
}
