import { createContext, type ReactNode } from 'react'

export type DialogStatus = 'default' | 'accent' | 'success' | 'warning' | 'danger'

export interface DialogOptions {
  title: ReactNode
  description?: ReactNode
  status?: DialogStatus
}

export interface DialogContextValue {
  showDialog: (options: DialogOptions) => void
}

export const DialogContext = createContext<DialogContextValue | null>(null)
