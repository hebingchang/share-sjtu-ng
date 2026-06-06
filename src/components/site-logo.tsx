import { useLayoutEffect, useRef, useState } from 'react'
import { Link as RouterLink } from 'react-router'

export default function SiteLogo() {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const [subtitleWidth, setSubtitleWidth] = useState<number>()

  useLayoutEffect(() => {
    const link = linkRef.current
    if (!link) return undefined

    const updateSubtitleWidth = () => {
      const nextWidth = link.getBoundingClientRect().width
      setSubtitleWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth))
    }

    updateSubtitleWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSubtitleWidth)
      return () => window.removeEventListener('resize', updateSubtitleWidth)
    }

    const observer = new ResizeObserver(updateSubtitleWidth)
    observer.observe(link)
    return () => observer.disconnect()
  }, [])

  return (
    <RouterLink
      ref={linkRef}
      aria-label="返回首页"
      className="relative flex h-[2.125rem] min-w-0 flex-col rounded-md text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      to="/"
    >
      <span className="whitespace-nowrap text-lg font-semibold leading-5 tracking-tight">
        传承·交大
      </span>
      <svg
        aria-hidden="true"
        className="absolute inset-x-0 top-[1.375rem] h-3 w-full overflow-visible text-muted"
        focusable="false"
      >
        <g className="fill-current text-[0.625rem] font-medium">
          <text lengthAdjust="spacing" textLength={subtitleWidth} x="0" y="9">
            SHARE SJTU
          </text>
        </g>
      </svg>
    </RouterLink>
  )
}
