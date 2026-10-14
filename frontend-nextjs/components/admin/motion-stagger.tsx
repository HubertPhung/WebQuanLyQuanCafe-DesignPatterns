'use client'

import { motion, type HTMLMotionProps, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
}

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 24,
      mass: 0.8,
    },
  },
}

export function StaggerContainer({
  children,
  className,
  delay = 0.04,
  stagger = 0.08,
  ...props
}: {
  children: ReactNode
  className?: string
  delay?: number
  stagger?: number
} & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: stagger,
            delayChildren: delay,
          },
        },
      }}
      initial="hidden"
      animate="show"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  ...props
}: {
  children: ReactNode
  className?: string
} & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      variants={staggerItemVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function FadeInUp({
  children,
  className,
  delay = 0.15,
  ...props
}: {
  children: ReactNode
  className?: string
  delay?: number
} & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

