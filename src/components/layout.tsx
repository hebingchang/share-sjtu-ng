import { ArrowRightFromSquare, Moon, PersonGear, Sun } from '@gravity-ui/icons'
import {
  Button,
  Chip,
  Dropdown,
  Label,
  Separator,
} from '@heroui/react'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/context'
import { DialogProvider } from '../dialog/provider'
import { useTheme } from '../theme/context'
import LoginModal from './login-modal'
import NicknameSetupModal from './nickname-setup-modal'
import UserAvatar from './user-avatar'

const USER_TYPE_LABELS: Record<string, string> = {
  alumni: '校友',
  external_teacher: '外聘教师',
  faculty: '教职工',
  freshman: '新生',
  fs: '附属单位职工',
  fszxjs: '附属中学教师',
  green: '绿色通道',
  outside: '合作交流',
  postphd: '博士后',
  student: '学生',
  summer: '暑期生',
  vip: 'vip',
  yxy: '医学院教职工',
}

const SCROLL_THRESHOLD = 20

export default function Layout({ children }: { children: ReactNode }) {
  const { token, profile, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const [isScrolled, setIsScrolled] = useState(
    typeof window !== 'undefined' && window.scrollY > SCROLL_THRESHOLD,
  )
  const userTypeLabel = profile?.type ? (USER_TYPE_LABELS[profile.type] ?? profile.type) : null
  const displayName = profile?.nickname?.trim() || profile?.name

  useEffect(() => {
    let ticking = false
    const update = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD)
      ticking = false
    }
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <DialogProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 flex w-full justify-center px-6 py-4 max-md:px-4">
          <div
            className={`flex w-full items-center justify-between gap-4 transition-all duration-300 ease-out ${
              isScrolled
                ? 'max-w-3xl rounded-full bg-surface-secondary/80 px-6 py-3 pr-4 shadow-[inset_0_0_0_1px_var(--border)] backdrop-blur-lg'
                : 'max-w-5xl px-0 py-0'
            }`}
          >
            <span className="text-lg font-semibold tracking-tight">传承·交大</span>

            <div className="flex items-center gap-1">
              <Button
                isIconOnly
                aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
                variant="ghost"
                onPress={toggleTheme}
              >
                {theme === 'dark' ? (
                  <Sun className="size-5" />
                ) : (
                  <Moon className="size-5" />
                )}
              </Button>

              {token ? (
                <Dropdown>
                  <Button isIconOnly aria-label="用户菜单" variant="ghost">
                    <UserAvatar profile={profile} size="sm" />
                  </Button>
                  <Dropdown.Popover placement="bottom end">
                    <div className="px-4 pt-4 pb-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold leading-5 text-foreground">
                            {displayName ?? '加载中…'}
                          </span>
                          {userTypeLabel ? (
                            <Chip size="sm">
                              <Chip.Label>{userTypeLabel}</Chip.Label>
                            </Chip>
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs leading-4 text-muted">
                          <span>剩余积分</span>
                          <span className="font-medium text-foreground tabular-nums">
                            {profile?.points?.points ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <Dropdown.Menu onAction={(key) => key === 'logout' && logout()}>
                      <Dropdown.Item id="settings" textValue="账号设置">
                        <PersonGear className="size-4 shrink-0 text-muted" />
                        <Label>账号设置</Label>
                      </Dropdown.Item>
                      <Separator />
                      <Dropdown.Item id="logout" textValue="退出登录" variant="danger">
                        <ArrowRightFromSquare className="size-4 shrink-0 text-danger" />
                        <Label>退出登录</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {token ? children : null}
        </main>

        <LoginModal isOpen={!token} />
        <NicknameSetupModal isOpen={!!token && !!profile && !profile.nickname?.trim()} />
      </div>
    </DialogProvider>
  )
}
