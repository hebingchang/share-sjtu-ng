import { constants } from '../env'
import type { OAuthConfig } from '../types/auth'
import type { LessonSyncStart, LessonSyncTaskStatus } from '../types/lesson-sync'
import type { PaginatedMaterials, PaginatedPurchases } from '../types/material'
import type { Response as RpcResponse } from '../types/rpc'
import type { PaginatedPointLogs, Profile } from '../types/user'
import type { UserCourse, UserCourseTerm } from '../types/user-course'

export type PointLogSortBy = 'date' | 'delta'
export type PointLogSortOrder = 'asc' | 'desc'

async function readPayload<T>(
  response: globalThis.Response,
  fallbackMessage: string,
): Promise<T> {
  const payload = (await response.json()) as RpcResponse<T>

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || fallbackMessage)
  }

  return payload.data
}

function lessonSyncErrorMessage(status: number, message: string): string {
  if (status === 401) return '请先登录后再同步课程'
  if (status === 403 || message.includes('mismatch')) {
    return '授权账号与当前登录账号不一致，请使用当前账号重新授权'
  }
  if (status === 400) return '请重新登录后再同步课程'
  return message || '同步任务创建失败，请稍后重试'
}

export async function updateUserProfile({
  avatar,
  nickname,
  signal,
  token,
}: {
  avatar?: Blob
  nickname: string
  signal?: AbortSignal
  token: string
}): Promise<Profile> {
  const body = avatar ? new FormData() : JSON.stringify({ nickname })
  const headers: Record<string, string> = {
    Auth: token,
  }

  if (avatar && body instanceof FormData) {
    body.append('nickname', nickname)
    body.append('avatar', avatar, 'avatar.png')
  } else {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${constants.API_URL}/api/v1/user/profile`, {
    method: 'PUT',
    headers,
    body,
    signal,
  })
  const payload = (await response.json()) as RpcResponse<Profile>

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '更新昵称失败')
  }

  return payload.data
}

export async function restoreUserAvatar({
  signal,
  token,
}: {
  signal?: AbortSignal
  token: string
}): Promise<Profile> {
  const response = await fetch(`${constants.API_URL}/api/v1/user/profile`, {
    method: 'PUT',
    headers: {
      Auth: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ delete_avatar: true }),
    signal,
  })

  return readPayload<Profile>(response, '恢复默认头像失败')
}

export async function getLessonSyncOAuthConfig({
  redirectUri,
  signal,
}: {
  redirectUri: string
  signal?: AbortSignal
}): Promise<OAuthConfig> {
  const response = await fetch(
    `${constants.API_URL}/auth/jaccount/lesson-sync/config?` +
      new URLSearchParams({ redirect_uri: redirectUri }),
    {
      credentials: 'include',
      method: 'GET',
      signal,
    },
  )

  return readPayload<OAuthConfig>(response, '无法获取课程同步授权配置')
}

export async function startLessonSync({
  code,
  redirectUri,
  signal,
  token,
}: {
  code: string
  redirectUri: string
  signal?: AbortSignal
  token: string
}): Promise<LessonSyncStart> {
  const response = await fetch(`${constants.API_URL}/api/v1/user/lesson-sync`, {
    method: 'POST',
    headers: {
      Auth: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirect_uri: redirectUri,
    }),
    signal,
  })
  const payload = (await response.json()) as RpcResponse<LessonSyncStart>

  if (!response.ok || !payload.success) {
    throw new Error(lessonSyncErrorMessage(response.status, payload.message))
  }

  return payload.data
}

export async function getLessonSyncTask({
  signal,
  taskId,
  token,
}: {
  signal?: AbortSignal
  taskId: string
  token: string
}): Promise<LessonSyncTaskStatus> {
  const response = await fetch(`${constants.API_URL}/api/v1/user/lesson-sync/${taskId}`, {
    headers: { Auth: token },
    signal,
  })

  return readPayload<LessonSyncTaskStatus>(response, '无法获取课程同步进度')
}

export async function getUserCourseTerms({
  signal,
  token,
}: {
  signal?: AbortSignal
  token: string
}): Promise<UserCourseTerm[]> {
  const response = await fetch(`${constants.API_URL}/api/v1/user/courses/terms`, {
    headers: { Auth: token },
    signal,
  })

  return readPayload<UserCourseTerm[]>(response, '获取我的课程学期失败')
}

export async function getUserCoursesByTerm({
  semester,
  signal,
  token,
  year,
}: {
  semester: number
  signal?: AbortSignal
  token: string
  year: number
}): Promise<UserCourse[]> {
  const params = new URLSearchParams({
    semester: String(semester),
    year: String(year),
  })
  const response = await fetch(`${constants.API_URL}/api/v1/user/courses?${params}`, {
    headers: { Auth: token },
    signal,
  })

  return readPayload<UserCourse[]>(response, '获取我的课程失败')
}

export async function getUserPurchaseMaterials({
  page = 1,
  signal,
  token,
}: {
  page?: number
  signal?: AbortSignal
  token: string
}): Promise<PaginatedPurchases> {
  const params = new URLSearchParams({ page: String(page) })
  const response = await fetch(`${constants.API_URL}/api/v1/user/materials/purchase?${params}`, {
    headers: { Auth: token },
    signal,
  })

  return readPayload<PaginatedPurchases>(response, '获取最近购买失败')
}

export async function getUserUploadMaterials({
  page = 1,
  signal,
  token,
}: {
  page?: number
  signal?: AbortSignal
  token: string
}): Promise<PaginatedMaterials> {
  const params = new URLSearchParams({ page: String(page) })
  const response = await fetch(`${constants.API_URL}/api/v1/user/materials/upload?${params}`, {
    headers: { Auth: token },
    signal,
  })

  return readPayload<PaginatedMaterials>(response, '获取上传资料失败')
}

export async function getUserPointLogs({
  page = 1,
  pageSize,
  signal,
  sortBy,
  sortOrder,
  token,
}: {
  page?: number
  pageSize?: number
  signal?: AbortSignal
  sortBy?: PointLogSortBy
  sortOrder?: PointLogSortOrder
  token: string
}): Promise<PaginatedPointLogs> {
  const params = new URLSearchParams({ page: String(page) })
  if (pageSize) params.set('page_size', String(pageSize))
  if (sortBy) {
    params.set('sort_by', sortBy)
    if (sortOrder) params.set('order', sortOrder)
  }
  const response = await fetch(`${constants.API_URL}/api/v1/user/log/points?${params}`, {
    headers: { Auth: token },
    signal,
  })

  return readPayload<PaginatedPointLogs>(response, '获取积分日志失败')
}
