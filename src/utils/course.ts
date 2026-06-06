import type { Course } from '../types/course'

function getSearchDisplayCourses(course: Course): Course[] {
  const courses: Course[] = []
  const seenIds = new Set<number>()

  const pushCourse = (next: Course | null | undefined) => {
    if (!next || seenIds.has(next.id)) return
    seenIds.add(next.id)
    courses.push(next)
  }

  if (course.is_deprecated && course.latest_course) {
    pushCourse(course.latest_course)
    pushCourse(course)
    course.latest_course.deprecated_courses?.forEach(pushCourse)
  } else {
    pushCourse(course)
    course.deprecated_courses?.forEach(pushCourse)
  }

  return courses
}

export function getSearchDisplayCourseCodes(course: Course): string[] {
  const codes: string[] = []
  const seenCodes = new Set<string>()

  for (const relatedCourse of getSearchDisplayCourses(course)) {
    const code = relatedCourse.code.trim()
    if (!code || seenCodes.has(code)) continue
    seenCodes.add(code)
    codes.push(code)
  }

  return codes
}

export function getSearchDisplayMaterialCount(course: Course): number {
  return getSearchDisplayCourses(course).reduce((sum, relatedCourse) => {
    const count = Number(relatedCourse.material_count)
    return sum + (Number.isFinite(count) ? count : 0)
  }, 0)
}

export function getSearchDisplayLatestMaterialUploadedAt(course: Course): string | null {
  let latest: { time: number; value: string } | null = null

  for (const relatedCourse of getSearchDisplayCourses(course)) {
    const value = relatedCourse.latest_material_uploaded_at
    if (!value) continue

    const time = new Date(value).getTime()
    if (Number.isNaN(time)) continue
    if (!latest || time > latest.time) latest = { time, value }
  }

  return latest?.value ?? null
}
