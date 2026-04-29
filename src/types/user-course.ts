import type { Course, CourseOrganization } from './course'

export interface UserCourseTerm {
  year: number
  semester: number
}

export interface UserCourseTeacher {
  id: number
  name: string
  position?: string
  organization?: CourseOrganization | null
}

export interface UserCourseClass {
  id: number
  course_id: number
  teacher_id: number
  teacher?: UserCourseTeacher | null
  material_count?: number
}

export interface UserCourse {
  id: number
  user_id: number
  course_id: number
  course: Course
  class_id?: number | null
  class?: UserCourseClass | null
  year: number
  semester: number
}
