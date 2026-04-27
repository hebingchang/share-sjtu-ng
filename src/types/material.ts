import type { CourseOrganization } from './course'

export interface MaterialType {
  id: number
  name: string
}

export interface Teacher {
  id: number
  name: string
  position?: string
  organization?: CourseOrganization | null
}

export interface ClassSummary {
  id: number
  course_id: number
  teacher_id: number
  teacher?: Teacher | null
  material_count: number
  materials?: Material[] | null
}

export interface MaterialClass {
  id: number
  course_id: number
  teacher_id?: number
  teacher?: Teacher | null
}

export interface Material {
  id: number
  block?: boolean | number
  blocked?: boolean | number
  class_id?: number | null
  class?: MaterialClass | null
  course_id?: number | null
  name: string
  description: string
  ext: string
  file_name: string
  size: number
  material_type_id: number
  material_type?: MaterialType | null
  purchase_count: number
  points: number
  is_blocked?: boolean | number
  user_id: number
  like_count: number
  hate_count: number
  created_at: string
  anonymous?: boolean | null
  digest?: string | null
  author_nickname?: string | null
  has_purchased?: boolean
  has_liked?: boolean
  has_hated?: boolean
  is_mine?: boolean
}

export interface CourseMaterials {
  unarchived: Material[]
  classes: ClassSummary[]
}

export interface MaterialComment {
  id: number
  material_id: number
  user_id: number
  content: string
  parent_id?: number | null
  root_id?: number | null
  reply_to_user_id?: number | null
  like_count: number
  hate_count: number
  reply_count: number
  report_count: number
  created_at: string
  updated_at?: string
  author_nickname: string
  author_avatar_path?: string | null
  author_has_purchased?: boolean
  reply_to_user_nickname?: string | null
  has_liked?: boolean
  has_hated?: boolean
  is_collapsed?: boolean
  is_deleted?: boolean
  replies?: MaterialComment[] | null
}

export interface MaterialCommentReportReason {
  code: string
  label: string
}

export interface MaterialReportReason {
  code: string
  label: string
}

export type MaterialCommentSort = 'old' | 'new' | 'like'

export interface PaginatedComments {
  count: number
  records: MaterialComment[]
}
