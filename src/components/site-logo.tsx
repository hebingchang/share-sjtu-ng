import { Link as RouterLink } from 'react-router'

export default function SiteLogo() {
  return (
    <RouterLink
      aria-label="返回首页"
      className="relative flex h-[2.125rem] min-w-0 flex-col rounded-md text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      to="/"
    >
      <span className="whitespace-nowrap text-lg font-semibold leading-5 tracking-tight">
        传承·交大
      </span>
      <span className="absolute inset-x-0 top-[1.375rem] whitespace-nowrap text-[0.625rem] font-medium uppercase leading-3 text-muted [text-align-last:justify] [text-justify:inter-character]">
        Share SJTU
      </span>
    </RouterLink>
  )
}
