export type RedeemSource = 'shuiyuan' | 'course_sjtu_plus' | 'sjtu_wiki'

export interface RedeemQuota {
  account: string
  all: number
  available: number
}

export interface RedeemRecord {
  id: number
  created_at: string
  updated_at: string
  user_id: number
  amount: number
  source: RedeemSource | string
}
