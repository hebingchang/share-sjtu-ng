import { OAuthConfig } from "../types/rpc.ts";

export enum OAuthChannel {
  JACCOUNT = 0,
}

export class RPC {
  private baseUrl = 'https://api.beta.share.dyweb.sjtu.cn'

  static async getOAuthConfig(): Promise<OAuthConfig> {
  }
}