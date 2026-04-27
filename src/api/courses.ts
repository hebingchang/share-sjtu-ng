import { constants } from '../env'
import type { Course } from '../types/course'
import type { CourseMaterials } from '../types/material'
import type { Response } from '../types/rpc'

export async function searchCourses({
  keyword,
  signal,
  token,
}: {
  keyword: string
  signal?: AbortSignal
  token: string
}): Promise<Course[]> {
  const response = await fetch(`${constants.API_URL}/api/v1/course/search`, {
    method: 'POST',
    headers: {
      Auth: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ keyword }),
    signal,
  })
  const payload = (await response.json()) as Response<Course[]>

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '搜索课程失败')
  }

  return payload.data
}

export async function getCourse({
  id,
  signal,
  token,
}: {
  id: string | number
  signal?: AbortSignal
  token: string
}): Promise<Course> {
  const response = await fetch(`${constants.API_URL}/api/v1/course/get/${id}`, {
    headers: { Auth: token },
    signal,
  })
  const payload = (await response.json()) as Response<Course>

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '获取课程失败')
  }

  return payload.data
}

export async function getCourseMaterials({
  id,
  signal,
  token,
}: {
  id: string | number
  signal?: AbortSignal
  token: string
}): Promise<CourseMaterials> {
  const response = await fetch(
    `${constants.API_URL}/api/v1/material?course_id=${encodeURIComponent(String(id))}`,
    {
      headers: { Auth: token },
      signal,
    },
  )
  const payload = (await response.json()) as Response<CourseMaterials>

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '获取课程资料失败')
  }

  return payload.data
}
