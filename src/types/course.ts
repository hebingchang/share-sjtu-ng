export interface CourseOrganization {
  id: number
  name: string
  code: string
}

export interface CourseDescription {
  id: number
  description: string
}

export interface CourseSyllabus {
  id: number
  syllabus: string
}

export interface CourseTaxonomy {
  id: number
  name: string
}

export interface Course {
  id: number
  name: string
  english_name: string
  credits: string | number
  hours: number
  is_deprecated: boolean
  latest_course?: Course | null
  deprecated_courses?: Course[] | null
  code: string
  level?: string
  material_count: number
  latest_material_uploaded_at?: string | null
  organization?: CourseOrganization | null
  description?: CourseDescription | null
  syllabus?: CourseSyllabus | null
  course_type?: CourseTaxonomy | null
  course_category?: CourseTaxonomy | null
  course_nature?: CourseTaxonomy | null
}
