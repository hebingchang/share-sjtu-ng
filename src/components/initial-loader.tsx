import { Spinner } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'

export default function InitialLoader({ isVisible }: { isVisible: boolean }) {
  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="initial-loader"
          aria-busy="true"
          aria-live="polite"
          role="status"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        >
          <span className="flex items-baseline gap-1 text-2xl font-semibold tracking-tight">
            <span>传承</span>
            <span>·</span>
            <span>交大</span>
          </span>
          <Spinner />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
