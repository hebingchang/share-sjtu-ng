import { constants } from '../env'
import type { Response } from '../types/rpc'
import type { Profile } from '../types/user'

export async function updateUserProfile({
  nickname,
  signal,
  token,
}: {
  nickname: string
  signal?: AbortSignal
  token: string
}): Promise<Profile> {
  const response = await fetch(`${constants.API_URL}/api/v1/user/profile`, {
    method: 'PUT',
    headers: {
      Auth: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nickname }),
    signal,
  })
  const payload = (await response.json()) as Response<Profile>

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '更新昵称失败')
  }

  return payload.data
}
