import type { Material } from '../../types/material'

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '时间未知'

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '时间未知'

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatFileSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getMaterialLink(material: Material | null): string | null {
  if (!material?.id) return null

  const courseId =
    material.course_id ??
    material.course?.id ??
    material.class?.course_id ??
    material.class?.course?.id
  if (!courseId) return null

  const classId = material.class_id ?? material.class?.id
  if (classId) return `/course/${courseId}/class/${classId}/material/${material.id}`
  return `/course/${courseId}/material/${material.id}`
}
