import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AlertDialog, Button } from '@heroui/react'
import {
  DialogContext,
  type DialogContextValue,
  type DialogOptions,
} from './context'

export function DialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogOptions | null>(null)

  const showDialog = useCallback((options: DialogOptions) => {
    setDialog({ status: 'default', ...options })
    setOpen(true)
  }, [])

  const value = useMemo<DialogContextValue>(() => ({ showDialog }), [showDialog])
  const status = dialog?.status ?? 'default'

  return (
    <DialogContext.Provider value={value}>
      {children}
      <AlertDialog.Backdrop
        isOpen={isOpen}
        onOpenChange={setOpen}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog className="sm:max-w-[420px]">
            <AlertDialog.Header>
              <AlertDialog.Icon status={status} />
              <AlertDialog.Heading>{dialog?.title}</AlertDialog.Heading>
            </AlertDialog.Header>
            {dialog?.description ? (
              <AlertDialog.Body>
                <p className="text-sm leading-6 text-muted">{dialog.description}</p>
              </AlertDialog.Body>
            ) : null}
            <AlertDialog.Footer>
              <Button
                slot="close"
                variant={status === 'danger' ? 'danger' : 'primary'}
              >
                知道了
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </DialogContext.Provider>
  )
}
