export interface Course {
  id: number
  created_at: string
  updated_at: string
  organization: Organization
  description: Description
  syllabus: Syllabus
  name: string
  english_name: string
  credits: number
  hours: number
  course_type: CourseType
  course_category: CourseCategory
  is_deprecated: boolean
  latest_course_id: number
  deprecated_courses: Course[]
  code: string
  material_count: number
}

export interface Organization {
  id: number
  created_at: string
  updated_at: string
  name: string
  code: string
}

export interface Description {
  id: number
  created_at: string
  updated_at: string
  course_id: number
  description: string
}

export interface Syllabus {
  id: number
  created_at: string
  updated_at: string
  course_id: number
  syllabus: string
}

export interface CourseType {
  id: number
  created_at: string
  updated_at: string
  code: string
  name: string
  enabled: boolean
}

export interface CourseCategory {
  id: number
  created_at: string
  updated_at: string
  code: string
  name: string
  enabled: boolean
  course_type_id: number
}
