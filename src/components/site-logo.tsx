import { Link as RouterLink } from 'react-router'

export default function SiteLogo() {
  return (
    <RouterLink
      aria-label="返回首页"
      className="flex min-w-0 flex-col rounded-md text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      to="/"
    >
      <span className="whitespace-nowrap text-lg font-semibold leading-5 tracking-tight">
        传承·交大
      </span>
      <span className="mt-0.5 whitespace-nowrap text-[0.625rem] font-medium uppercase leading-3 tracking-[0.129em] text-muted [margin-right:-0.129em]">
        Share SJTU
      </span>
    </RouterLink>
  )
}
