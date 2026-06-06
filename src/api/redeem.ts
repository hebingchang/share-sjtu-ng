import { constants } from '../env'
import type { RedeemQuota, RedeemRecord } from '../types/redeem'
import type { Response as RpcResponse } from '../types/rpc'

export type RedeemPath = 'shuiyuan' | 'sjtuplus' | 'sjtuwiki'

interface RedeemRequestOptions {
  path: RedeemPath
  signal?: AbortSignal
  token: string
}

async function readPayload<T>(response: globalThis.Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json()) as RpcResponse<T>

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || fallbackMessage)
  }

  return payload.data
}

export async function getRedeemQuota({
  path,
  signal,
  token,
}: RedeemRequestOptions): Promise<RedeemQuota> {
  const response = await fetch(`${constants.API_URL}/api/v1/user/redeem/${path}`, {
    headers: { Auth: token },
    signal,
  })

  return readPayload<RedeemQuota>(response, '获取可兑换积分失败')
}

export async function getRedeemRecords({
  path,
  signal,
  token,
}: RedeemRequestOptions): Promise<RedeemRecord[]> {
  const response = await fetch(`${constants.API_URL}/api/v1/user/redeem/${path}/records`, {
    headers: { Auth: token },
    signal,
  })

  return readPayload<RedeemRecord[]>(response, '获取兑换记录失败')
}

export async function postRedeem({
  amount,
  path,
  signal,
  token,
}: RedeemRequestOptions & { amount: number }): Promise<RedeemQuota> {
  const response = await fetch(`${constants.API_URL}/api/v1/user/redeem/${path}`, {
    method: 'POST',
    headers: {
      Auth: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount }),
    signal,
  })

  return readPayload<RedeemQuota>(response, '兑换积分失败')
}
