export interface Profile {
  id: number
  created_at: string
  updated_at: string
  name: string
  code: string
  account: string
  points: Points
  type: string
  organization: Organization
  role: number
  level: string
}

export interface Points {
  id: number
  created_at: string
  updated_at: string
  user_id: number
  points: number
}

export interface Organization {
  id: number
  created_at: string
  updated_at: string
  name: string
  code: string
}
