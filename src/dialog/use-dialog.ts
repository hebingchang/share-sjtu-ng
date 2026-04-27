import { useContext } from 'react'
import { DialogContext, type DialogContextValue } from './context'

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error('useDialog must be used inside <DialogProvider>')
  }
  return ctx
}
