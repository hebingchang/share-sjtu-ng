import { constants } from '../env'
import type {
  Material,
  MaterialComment,
  MaterialCommentReportReason,
  MaterialCommentSort,
  MaterialReportReason,
  MaterialType,
  PaginatedComments,
} from '../types/material'
import type { Response } from '../types/rpc'

interface RequestOptions {
  signal?: AbortSignal
  token: string
}

async function request<T>(
  path: string,
  {
    token,
    signal,
    method = 'GET',
    body,
  }: RequestOptions & {
    method?: string
    body?: unknown
  },
  fallbackError = '请求失败',
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      Auth: token,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    signal,
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }

  const response = await fetch(`${constants.API_URL}${path}`, init)
  const payload = (await response.json()) as Response<T>

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || fallbackError)
  }
  return payload.data
}

export interface MaterialUploadTicket {
  url: string
  path: string
}

export interface CreateMaterialPayload {
  anonymous: boolean
  class_id: number
  course_id: number
  description: string
  material_type_id: number
  name: string
  path: string
  points: number
}

export interface UpdateMaterialPayload {
  anonymous: boolean
  description: string
  material_type_id: number
  name: string
  points: number
}

export async function getMaterialTypes({ token, signal }: RequestOptions): Promise<MaterialType[]> {
  return request<MaterialType[]>('/api/v1/material-type', { token, signal }, '获取资料类型失败')
}

export async function requestMaterialUpload({
  fileName,
  fileSize,
  token,
  signal,
}: {
  fileName: string
  fileSize: number
} & RequestOptions): Promise<MaterialUploadTicket> {
  return request<MaterialUploadTicket>(
    '/api/v1/material/contribute/upload',
    {
      token,
      signal,
      method: 'POST',
      body: {
        file_name: fileName,
        file_size: fileSize,
      },
    },
    '获取上传地址失败',
  )
}

export async function createMaterial({
  data,
  token,
  signal,
}: {
  data: CreateMaterialPayload
} & RequestOptions): Promise<Material> {
  return request<Material>(
    '/api/v1/material',
    {
      token,
      signal,
      method: 'PUT',
      body: data,
    },
    '提交资料失败',
  )
}

export async function updateMaterial({
  data,
  id,
  token,
  signal,
}: {
  data: UpdateMaterialPayload
  id: string | number
} & RequestOptions): Promise<Material> {
  return request<Material>(
    `/api/v1/material/edit/${encodeURIComponent(String(id))}`,
    {
      token,
      signal,
      method: 'PUT',
      body: data,
    },
    '更新资料失败',
  )
}

export async function deleteMaterial({
  id,
  token,
  signal,
}: { id: string | number } & RequestOptions): Promise<void> {
  await request<unknown>(
    `/api/v1/material/delete/${encodeURIComponent(String(id))}`,
    { token, signal, method: 'DELETE' },
    '删除资料失败',
  )
}

export async function getMaterial({
  id,
  token,
  signal,
}: { id: string | number } & RequestOptions): Promise<Material> {
  return request<Material>(
    `/api/v1/material/get/${encodeURIComponent(String(id))}`,
    { token, signal },
    '获取资料详情失败',
  )
}

export async function purchaseMaterial({
  id,
  token,
  signal,
}: { id: string | number } & RequestOptions): Promise<string> {
  return request<string>(
    `/api/v1/material/purchase/${encodeURIComponent(String(id))}`,
    { token, signal },
    '兑换失败',
  )
}

export async function downloadMaterial({
  id,
  token,
  signal,
}: { id: string | number } & RequestOptions): Promise<string> {
  return request<string>(
    `/api/v1/material/download/${encodeURIComponent(String(id))}`,
    { token, signal },
    '获取下载链接失败',
  )
}

export async function rateMaterial({
  id,
  rating,
  set,
  token,
  signal,
}: {
  id: string | number
  rating: 'like' | 'hate'
  set: boolean
} & RequestOptions): Promise<void> {
  await request<unknown>(
    `/api/v1/material/${rating}/${encodeURIComponent(String(id))}`,
    { token, signal, method: set ? 'PUT' : 'DELETE' },
    set ? '评价失败' : '取消评价失败',
  )
}

export async function getMaterialReportReasons({
  id,
  token,
  signal,
}: {
  id: string | number
} & RequestOptions): Promise<MaterialReportReason[]> {
  return request<MaterialReportReason[]>(
    `/api/v1/material/report-reasons/${encodeURIComponent(String(id))}`,
    { token, signal },
    '获取投诉原因失败',
  )
}

export async function reportMaterial({
  id,
  reason,
  description,
  token,
  signal,
}: {
  id: string | number
  reason: string
  description?: string
} & RequestOptions): Promise<void> {
  await request<unknown>(
    `/api/v1/material/report/${encodeURIComponent(String(id))}`,
    {
      token,
      signal,
      method: 'POST',
      body: { reason, description: description ?? '' },
    },
    '投诉失败',
  )
}

export async function getMaterialComments({
  id,
  page = 1,
  pageSize = 10,
  sort = 'old',
  token,
  signal,
}: {
  id: string | number
  page?: number
  pageSize?: number
  sort?: MaterialCommentSort
} & RequestOptions): Promise<PaginatedComments> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort,
  })
  return request<PaginatedComments>(
    `/api/v1/material/get/${encodeURIComponent(String(id))}/comments?${params.toString()}`,
    { token, signal },
    '获取评论失败',
  )
}

export async function getMaterialCommentReplies({
  id,
  commentId,
  page = 1,
  pageSize = 10,
  sort = 'old',
  token,
  signal,
}: {
  id: string | number
  commentId: string | number
  page?: number
  pageSize?: number
  sort?: MaterialCommentSort
} & RequestOptions): Promise<PaginatedComments> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort,
  })
  return request<PaginatedComments>(
    `/api/v1/material/get/${encodeURIComponent(String(id))}/comments/${encodeURIComponent(
      String(commentId),
    )}/replies?${params.toString()}`,
    { token, signal },
    '获取回复失败',
  )
}

export async function postMaterialComment({
  id,
  content,
  parentId,
  token,
  signal,
}: {
  id: string | number
  content: string
  parentId?: number | null
} & RequestOptions): Promise<MaterialComment> {
  return request<MaterialComment>(
    `/api/v1/material/get/${encodeURIComponent(String(id))}/comments`,
    {
      token,
      signal,
      method: 'POST',
      body: { content, parent_id: parentId ?? null },
    },
    '发表评论失败',
  )
}

export async function rateMaterialComment({
  commentId,
  rating,
  set,
  token,
  signal,
}: {
  commentId: string | number
  rating: 'like' | 'hate'
  set: boolean
} & RequestOptions): Promise<void> {
  await request<unknown>(
    `/api/v1/material/comment/${rating}/${encodeURIComponent(String(commentId))}`,
    { token, signal, method: set ? 'PUT' : 'DELETE' },
    set ? '评价失败' : '取消评价失败',
  )
}

export async function deleteMaterialComment({
  commentId,
  token,
  signal,
}: {
  commentId: string | number
} & RequestOptions): Promise<void> {
  await request<unknown>(
    `/api/v1/material/comment/${encodeURIComponent(String(commentId))}`,
    { token, signal, method: 'DELETE' },
    '删除评论失败',
  )
}

export async function getMaterialCommentReportReasons({
  token,
  signal,
}: RequestOptions): Promise<MaterialCommentReportReason[]> {
  return request<MaterialCommentReportReason[]>(
    `/api/v1/material/comment/report-reasons`,
    { token, signal },
    '获取举报原因失败',
  )
}

export async function reportMaterialComment({
  commentId,
  reason,
  description,
  token,
  signal,
}: {
  commentId: string | number
  reason: string
  description?: string
} & RequestOptions): Promise<void> {
  await request<unknown>(
    `/api/v1/material/comment/report/${encodeURIComponent(String(commentId))}`,
    {
      token,
      signal,
      method: 'POST',
      body: { reason, description: description ?? '' },
    },
    '举报失败',
  )
}
