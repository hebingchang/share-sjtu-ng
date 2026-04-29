import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

const WORDMARK = ['传', '承', '·', '交', '大']

export default function InitialLoader({ isVisible }: { isVisible: boolean }) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="initial-loader"
          aria-busy="true"
          aria-live="polite"
          role="status"
          className="fixed inset-0 z-[100] overflow-hidden bg-background"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(60rem 36rem at 50% 38%, color-mix(in oklab, var(--accent) 9%, transparent) 0%, transparent 70%)',
            }}
          />

          <div className="relative flex h-full flex-col items-center justify-center gap-8 px-6">
            <div className="flex flex-col items-center gap-3">
              <h1 className="flex items-baseline gap-1 text-3xl font-semibold leading-none tracking-tight text-foreground sm:text-4xl">
                {WORDMARK.map((c, i) => (
                  <motion.span
                    key={`${c}-${i}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: reduceMotion ? 0 : 0.05 + i * 0.04,
                      ease: [0.32, 0.72, 0, 1],
                    }}
                  >
                    {c}
                  </motion.span>
                ))}
              </h1>
              <motion.span
                className="text-[0.625rem] font-medium uppercase leading-3 tracking-[0.32em] text-muted"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.3 }}
              >
                Share SJTU
              </motion.span>
            </div>

            <motion.div
              aria-hidden
              className="relative h-[2px] overflow-hidden rounded-full bg-border/60"
              initial={{ opacity: 0, width: 96 }}
              animate={{ opacity: 1, width: 168 }}
              transition={{
                duration: 0.6,
                delay: reduceMotion ? 0 : 0.4,
                ease: [0.32, 0.72, 0, 1],
              }}
            >
              {reduceMotion ? (
                <motion.div
                  className="absolute inset-0 rounded-full bg-accent/70"
                  animate={{ opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : (
                <motion.div
                  className="absolute inset-y-0 w-1/3 rounded-full"
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)',
                  }}
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </motion.div>

            <motion.p
              className="text-xs leading-5 text-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.55 }}
            >
              正在加载…
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
