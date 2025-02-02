export interface Response<T> {
  code: number
  data: T
  message: string
  success: boolean
}
