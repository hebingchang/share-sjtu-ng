export interface LessonSyncStart {
  task_id: string
  status: string
}

export interface LessonSyncTaskStatus {
  id: string
  user_id: number
  status: string
  message: string
  synced_count: number
  updated_at: string
}
