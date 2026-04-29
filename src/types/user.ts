import type { Material } from './material'

export interface Organization {
  id: number
  created_at: string
  updated_at: string
  name: string
  code: string
}

export interface Points {
  id: number
  created_at: string
  updated_at: string
  user_id: number
  points: number
}

export interface Profile {
  id: number
  created_at: string
  updated_at: string
  name: string
  nickname: string | null
  nickname_updated_at: string | null
  avatar_path: string | null
  code: string
  account: string
  points: Points
  type: string
  organization: Organization
  role: number
  level: string
}

export interface PointLog {
  id: number
  created_at: string
  updated_at: string
  user_id: number
  delta: number
  message: string
  date: string
  material_id?: number | null
  material?: Material | null
}

export interface PaginatedPointLogs {
  count: number
  records: PointLog[]
}
