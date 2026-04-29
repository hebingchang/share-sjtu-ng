import { ArrowRightFromSquare, FilePlus, Moon, PersonGear, Sun } from '@gravity-ui/icons'
import {
  Button,
  Chip,
  Dropdown,
  type Key,
  Label,
  Link,
  Separator,
} from '@heroui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/use-auth'
import { DialogProvider } from '../dialog/provider'
import { useTheme } from '../theme/use-theme'
import CourseCommand from './course-command'
import LoginModal from './login-modal'
import MaterialUploadModal from './material-upload-modal'
import NicknameSetupModal from './nickname-setup-modal'
import SiteLogo from './site-logo'
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
const FOOTER_LINK_CLASS =
  '!text-xs !text-muted font-medium underline-offset-4 decoration-muted/50 transition-colors hover:!text-foreground hover:underline hover:decoration-foreground/60'

export default function Layout({ children }: { children: ReactNode }) {
  const { token, profile, logout } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [isUploadModalOpen, setUploadModalOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(
    typeof window !== 'undefined' && window.scrollY > SCROLL_THRESHOLD,
  )
  const isScrolledRef = useRef(isScrolled)
  const currentYear = new Date().getFullYear()
  const userTypeLabel = profile?.type ? (USER_TYPE_LABELS[profile.type] ?? profile.type) : null
  const displayName = profile?.nickname?.trim() || profile?.name

  useEffect(() => {
    let ticking = false
    const update = () => {
      const nextIsScrolled = window.scrollY > SCROLL_THRESHOLD
      if (isScrolledRef.current !== nextIsScrolled) {
        isScrolledRef.current = nextIsScrolled
        setIsScrolled(nextIsScrolled)
      }
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

  const handleUserMenuAction = (key: Key) => {
    if (key === 'upload') {
      setUploadModalOpen(true)
      return
    }

    if (key === 'logout') {
      logout()
      return
    }

    if (key === 'settings') {
      navigate('/user/basic')
    }
  }

  return (
    <DialogProvider>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 flex h-24 shrink-0 items-start justify-center px-6 py-4 max-md:px-4">
          <div
            className={`flex w-full items-center justify-between gap-4 transition-all duration-300 ease-out ${
              isScrolled
                ? 'max-w-3xl rounded-full bg-surface-secondary/80 px-6 py-3 pr-4 shadow-[inset_0_0_0_1px_var(--border)] backdrop-blur-lg'
                : 'max-w-5xl px-0 py-0'
            }`}
          >
            <SiteLogo />

            <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
              {token ? <CourseCommand token={token} /> : null}

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
                    <Dropdown.Menu onAction={handleUserMenuAction}>
                      <Dropdown.Item id="upload" textValue="上传资料">
                        <FilePlus className="size-4 shrink-0 text-muted" />
                        <Label>上传资料</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="settings" textValue="用户中心">
                        <PersonGear className="size-4 shrink-0 text-muted" />
                        <Label>用户中心</Label>
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

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-2 sm:px-6 lg:px-8">
          {token ? children : null}
        </main>

        {token ? (
          <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-center text-xs leading-6 text-muted sm:px-6 lg:px-8">
            <p>
              ©{currentYear}{' '}
              <Link
                className={FOOTER_LINK_CLASS}
                href="https://github.com/dyweb"
                rel="noreferrer"
                target="_blank"
              >
                东岳网络工作室
              </Link>
              <span aria-hidden className="px-1 text-muted/60">
                ·
              </span>
              <Link
                className={FOOTER_LINK_CLASS}
                href="https://geek.sjtu.edu.cn/"
                rel="noreferrer"
                target="_blank"
              >
                思源极客协会
              </Link>
            </p>
            <p>
              <Link className={FOOTER_LINK_CLASS} href="mailto:share@sjtu.plus">
                联系我们
              </Link>
              <span aria-hidden className="px-1 text-muted/60">
                ·
              </span>
              <Link
                className={FOOTER_LINK_CLASS}
                href="https://beian.miit.gov.cn/"
                rel="noreferrer"
                target="_blank"
              >
                沪ICP备05052060号-7
              </Link>
            </p>
          </footer>
        ) : null}

        <LoginModal isOpen={!token} />
        {token ? (
          <MaterialUploadModal
            isOpen={isUploadModalOpen}
            token={token}
            onClose={() => setUploadModalOpen(false)}
          />
        ) : null}
        <NicknameSetupModal isOpen={!!token && !!profile && !profile.nickname?.trim()} />
      </div>
    </DialogProvider>
  )
}
