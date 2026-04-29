import type { Transition, Variants } from 'motion/react'

const EASE_OUT_EXPO: Transition['ease'] = [0.16, 1, 0.3, 1]

export const pageTransition: Transition = {
  duration: 0.32,
  ease: EASE_OUT_EXPO,
}

export const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.05,
    },
  },
}

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: EASE_OUT_EXPO },
  },
}
