import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Person, Sparkles } from '@gravity-ui/icons'
import { AnimatePresence, motion } from 'motion/react'
import {
  Button,
  Description,
  FieldError,
  Form,
  InputGroup,
  Label,
  Modal,
  TextField,
} from '@heroui/react'
import { updateUserProfile } from '../api/user'
import { useAuth } from '../auth/context'
import type { Profile } from '../types/user'

const MAX_NICKNAME_LENGTH = 16
const SITE_LAUNCH_YEAR = 2014

type Step = 'form' | 'welcome'

export default function NicknameSetupModal({ isOpen }: { isOpen: boolean }) {
  const { token, setProfile } = useAuth()
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [pendingProfile, setPendingProfile] = useState<Profile | null>(null)
  const [welcomeName, setWelcomeName] = useState('')

  const trimmed = nickname.trim()
  const nicknameLength = [...trimmed].length
  const tooLong = nicknameLength > MAX_NICKNAME_LENGTH

  const dismissWelcome = useCallback(() => {
    if (pendingProfile) setProfile(pendingProfile)
  }, [pendingProfile, setProfile])

  // Reset internal state once the modal has fully closed (after exit animation).
  useEffect(() => {
    if (isOpen) return
    const timer = window.setTimeout(() => {
      setStep('form')
      setNickname('')
      setError(null)
      setSubmitting(false)
      setPendingProfile(null)
      setWelcomeName('')
    }, 400)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !trimmed || tooLong || isSubmitting) return

    setSubmitting(true)
    setError(null)
    try {
      const profile = await updateUserProfile({ nickname: trimmed, token })
      setWelcomeName(trimmed)
      setPendingProfile(profile)
      setStep('welcome')
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新昵称失败')
      setSubmitting(false)
    }
  }

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      isDismissable={step === 'welcome'}
      isKeyboardDismissDisabled={step === 'form'}
      variant="blur"
      onOpenChange={(open) => {
        if (!open && step === 'welcome') dismissWelcome()
      }}
    >
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog className="overflow-hidden sm:max-w-md">
          <AnimatePresence initial={false} mode="wait">
            {step === 'form' ? (
              <motion.div
                key="form"
                className="flex flex-col px-2 py-2 sm:px-6 sm:py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.97, filter: 'blur(4px)' }}
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              >
                <Modal.Header className="items-center p-0 text-center">
                  <Modal.Icon className="bg-accent-soft text-accent-soft-foreground shadow-sm shadow-accent/10">
                    <Person className="size-5" />
                  </Modal.Icon>
                  <Modal.Heading className="mt-4 text-2xl font-semibold leading-none">
                    设置你的昵称
                  </Modal.Heading>
                  <p className="mx-auto mt-3 max-w-78 text-sm leading-6 text-muted">
                    昵称会显示在资料和评论中。请谨慎选择，
                    <span className="font-medium text-foreground">每 30 天只能修改 1 次</span>。
                  </p>
                </Modal.Header>
                <Modal.Body className="mt-7 overflow-visible p-0">
                  <Form
                    id="nickname-setup-form"
                    aria-label="设置昵称"
                    className="flex min-w-0 flex-col gap-5"
                    validationBehavior="aria"
                    onSubmit={handleSubmit}
                  >
                    <TextField
                      fullWidth
                      isInvalid={tooLong || !!error}
                      isRequired
                      className="min-w-0"
                      name="nickname"
                      value={nickname}
                      onChange={(value) => {
                        setNickname(value)
                        if (error) setError(null)
                      }}
                    >
                      <Label className="text-sm font-medium">昵称</Label>
                      <InputGroup fullWidth className="min-w-0" variant="secondary">
                        <InputGroup.Input
                          autoFocus
                          autoComplete="nickname"
                          className="min-w-0"
                          maxLength={MAX_NICKNAME_LENGTH * 2}
                          placeholder="请输入昵称"
                        />
                        <InputGroup.Suffix
                          className={
                            tooLong
                              ? 'min-w-12 justify-end text-danger'
                              : 'min-w-12 justify-end text-muted'
                          }
                        >
                          <span className="text-xs tabular-nums">
                            {nicknameLength}/{MAX_NICKNAME_LENGTH}
                          </span>
                        </InputGroup.Suffix>
                      </InputGroup>
                      {tooLong ? (
                        <FieldError>昵称最多 {MAX_NICKNAME_LENGTH} 个字符。</FieldError>
                      ) : error ? (
                        <FieldError>{error}</FieldError>
                      ) : (
                        <Description>
                          最多 {MAX_NICKNAME_LENGTH} 个字符，可包含中英文及数字。
                        </Description>
                      )}
                    </TextField>
                    <Button
                      fullWidth
                      className="mt-2"
                      isDisabled={!trimmed || tooLong}
                      isPending={isSubmitting}
                      type="submit"
                      variant="primary"
                    >
                      保存昵称
                    </Button>
                  </Form>
                </Modal.Body>
              </motion.div>
            ) : (
              <WelcomeStep key="welcome" name={welcomeName} onClose={dismissWelcome} />
            )}
          </AnimatePresence>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function WelcomeStep({ name, onClose }: { name: string; onClose: () => void }) {
  const yearsRunning = new Date().getFullYear() - SITE_LAUNCH_YEAR
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className="relative flex min-h-72 flex-col items-center justify-center overflow-hidden px-6 pt-10 pb-6 text-center"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="absolute left-1/2 top-1/2 size-112 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,var(--accent-soft)_0%,transparent_60%)] opacity-70 blur-2xl" />
      </motion.div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, opacity: 0.6 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.1 }}
      >
        <div className="size-24 rounded-full bg-accent/30 blur-xl" />
      </motion.div>

      {[0, 1, 2, 3, 4].map((i) => (
        <Sparkle key={i} index={i} />
      ))}

      <motion.div
        className="relative z-10 flex size-16 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-soft text-accent-foreground shadow-lg shadow-accent/30"
        initial={{ scale: 0, rotate: -120 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
      >
        <motion.div
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.5, repeat: 1 }}
        >
          <Sparkles className="size-7" />
        </motion.div>
      </motion.div>

      <motion.h2
        className="relative z-10 mt-5 text-xl font-semibold tracking-tight"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.3 }}
      >
        欢迎，
        <motion.span
          className="bg-linear-to-r from-accent via-[oklch(0.62_0.16_245)] to-[oklch(0.55_0.18_290)] bg-clip-text text-transparent"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.45 }}
        >
          {name}
        </motion.span>
      </motion.h2>

      <motion.p
        className="relative z-10 mt-2 text-sm leading-5 text-muted"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.55 }}
      >
        欢迎来到传承·交大
      </motion.p>

      <motion.p
        className="relative z-10 mt-4 text-xs leading-5 text-muted"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.32, delay: 0.7 }}
      >
        自{' '}
        <span className="font-medium tabular-nums text-foreground">
          {SITE_LAUNCH_YEAR}
        </span>{' '}
        年起，已陪伴一届届交大人{' '}
        <span className="font-medium tabular-nums text-foreground">
          {yearsRunning}
        </span>{' '}
        年
      </motion.p>

      <motion.div
        className="relative z-10 mt-6 w-full max-w-56"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.85 }}
      >
        <Button fullWidth onPress={onClose} variant="primary">
          开始探索
        </Button>
      </motion.div>
    </motion.div>
  )
}

const SPARKLE_POSITIONS = [
  { x: -90, y: -60, size: 10, delay: 0.15, duration: 1.6 },
  { x: 80, y: -80, size: 14, delay: 0.3, duration: 1.8 },
  { x: -110, y: 40, size: 8, delay: 0.45, duration: 1.4 },
  { x: 100, y: 50, size: 12, delay: 0.25, duration: 1.7 },
  { x: 0, y: -110, size: 9, delay: 0.55, duration: 1.5 },
] as const

function Sparkle({ index }: { index: number }) {
  const { x, y, size, delay, duration } = SPARKLE_POSITIONS[index]
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 text-accent"
      initial={{ x, y, scale: 0, opacity: 0, rotate: 0 }}
      animate={{
        scale: [0, 1, 0.85, 0],
        opacity: [0, 1, 1, 0],
        rotate: [0, 180],
        x: x * 1.25,
        y: y * 1.25,
      }}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      <Sparkles style={{ width: size, height: size }} />
    </motion.div>
  )
}
