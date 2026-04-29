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

export type PointLogType = 'materials' | 'redeem' | 'bonus' | 'transfer'

export interface PointLog {
  id: number
  created_at: string
  updated_at: string
  user_id: number
  type: PointLogType
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

export type PointTransferDirection = 'sent' | 'received'
export type PointTransferFeeMode = 'internal' | 'external'
export type PointTransferStatus = 'pending' | 'accepted' | 'rejected' | 'expired'

export interface PointTransferAddress {
  address: string
}

export interface PointTransferMonthlyQuota {
  transferred_points: number
  pending_points: number
  reserved_points: number
  monthly_limit: number
  available_points: number
  month_start: string
  month_end: string
}

export interface PointTransferRecord {
  id: number
  direction: PointTransferDirection
  sender_address: string
  receiver_address: string
  amount: number
  received_amount: number
  fee: number
  deducted_amount: number
  fee_mode: PointTransferFeeMode
  status: PointTransferStatus
  expires_at: string | null
  accepted_at?: string | null
  completed_at?: string | null
  refunded_at?: string | null
}

export interface PaginatedPointTransfers {
  count: number
  records: PointTransferRecord[]
}
