import {
  ArrowRotateRight,
  BookOpen,
  Books,
  Calendar,
  ChevronRight,
  CircleCheck,
  Clock,
  CloudArrowUpIn,
  FileText,
  Magnifier,
  Person,
  ShoppingCart,
  Xmark,
} from '@gravity-ui/icons'
import {
  Button,
  Card,
  Chip,
  Kbd,
  Label,
  Pagination,
  SearchField,
  Spinner,
} from '@heroui/react'
import { EmptyState } from '@heroui-pro/react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  getLessonSyncOAuthConfig,
  getLessonSyncTask,
  getUserCoursesByTerm,
  getUserCourseTerms,
  getUserPurchaseMaterials,
  startLessonSync,
} from '../api/user'
import { useAuth } from '../auth/use-auth'
import type { LessonSyncTaskStatus } from '../types/lesson-sync'
import type { Purchase } from '../types/material'
import type { UserCourse, UserCourseTerm } from '../types/user-course'

const SUGGESTED_KEYWORDS = ['大学物理', '概率统计', '高等数学', '线性代数']
const LESSON_SYNC_STATE_KEY = 'lesson_sync_oauth_state'
const LESSON_SYNC_REDIRECT_KEY = 'lesson_sync_oauth_redirect_uri'
const LESSON_SYNC_CONSUMED_PREFIX = 'lesson_sync_consumed:'
const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 2 * 60 * 1000
const SYNC_STATUS_AUTO_HIDE_DELAY_MS = 6000
const SYNC_STATUS_GAP_PX = 12
const COURSES_PAGE_SIZE = 5
const VISIBLE_PURCHASE_LIMIT = 6

type SyncPhase = 'idle' | 'authorizing' | 'queued' | 'running' | 'finished' | 'failed' | 'timeout'
type SyncTone = 'accent' | 'success' | 'warning' | 'danger'

interface SyncStatusView {
  description: string
  label: string
  title: string
  tone: SyncTone
}

const syncToneClasses: Record<
  SyncTone,
  { dot: string; icon: string; panel: string; text: string }
> = {
  accent: {
    dot: 'bg-accent',
    icon: 'bg-accent-soft text-accent',
    panel: 'border-accent/25 bg-accent-soft/70',
    text: 'text-accent',
  },
  danger: {
    dot: 'bg-danger',
    icon: 'bg-danger/10 text-danger',
    panel: 'border-danger/25 bg-danger/10',
    text: 'text-danger',
  },
  success: {
    dot: 'bg-success',
    icon: 'bg-success/10 text-success',
    panel: 'border-success/25 bg-success/10',
    text: 'text-success',
  },
  warning: {
    dot: 'bg-warning',
    icon: 'bg-warning/10 text-warning',
    panel: 'border-warning/25 bg-warning/10',
    text: 'text-warning',
  },
}

const easing = [0.32, 0.72, 0, 1] as const
const stateTransition = { duration: 0.22, ease: easing }

const stateMotion = {
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  initial: { opacity: 0, y: 6 },
  transition: stateTransition,
}

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.04 },
  },
  exit: { opacity: 0, transition: { duration: 0.14, ease: easing } },
}

const listItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: easing },
  },
  exit: { opacity: 0, y: -4, transition: { duration: 0.16, ease: easing } },
}

const tabItemVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: easing },
  },
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function createOauthState(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getLessonSyncRedirectUri(): string {
  return `${window.location.protocol}//${window.location.host}/auth/lesson-sync/callback`
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function shouldAutoHideSyncStatus(phase: SyncPhase): boolean {
  return phase === 'finished' || phase === 'failed' || phase === 'timeout'
}

function termKey(term: UserCourseTerm): string {
  return `${term.year}-${term.semester}`
}

function parseTermKey(key: string | null): UserCourseTerm | null {
  if (!key) return null
  const [year, semester] = key.split('-').map(Number)
  if (!year || !semester) return null
  return { year, semester }
}

function formatTerm(term: UserCourseTerm): string {
  const semesterLabel: Record<number, string> = {
    1: '秋',
    2: '春',
    3: '夏',
  }

  return `${term.year}-${term.year + 1} ${semesterLabel[term.semester] ?? `第 ${term.semester} 学期`}`
}

function getCourseLink(record: UserCourse): string {
  if (record.class_id) return `/course/${record.course.id}/class/${record.class_id}`
  return `/course/${record.course.id}`
}

function getPurchaseLink(purchase: Purchase): string | null {
  const material = purchase.material
  if (!material) return null

  const materialId = material.id ?? purchase.material_id
  const courseId =
    material.course_id ??
    material.course?.id ??
    material.class?.course_id ??
    material.class?.course?.id
  if (!courseId || !materialId) return null

  const classId = material.class_id ?? material.class?.id
  if (classId) return `/course/${courseId}/class/${classId}/material/${materialId}`
  return `/course/${courseId}/material/${materialId}`
}

function getPurchaseTitle(purchase: Purchase): string {
  const material = purchase.material
  return material?.name || material?.file_name || `资料 #${purchase.material_id}`
}

function getPurchaseSubtitle(purchase: Purchase): string {
  const material = purchase.material

  return (
    material?.course?.name ??
    material?.class?.course?.name ??
    material?.class?.teacher?.name ??
    '课程信息暂缺'
  )
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '时间未知'

  const dayMs = 1000 * 60 * 60 * 24
  const diffMs = Date.now() - date.getTime()
  if (diffMs < dayMs) return '今天'
  if (diffMs < 2 * dayMs) return '昨天'
  if (diffMs < 7 * dayMs) return `${Math.floor(diffMs / dayMs)} 天前`

  return date.toLocaleDateString('zh-CN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages: (number | 'ellipsis')[] = [1]
  if (page > 3) pages.push('ellipsis')

  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  for (let current = start; current <= end; current += 1) {
    pages.push(current)
  }

  if (page < totalPages - 2) pages.push('ellipsis')
  pages.push(totalPages)

  return pages
}

function getSyncStatusView(
  phase: SyncPhase,
  task: LessonSyncTaskStatus | null,
  message: string | null,
): SyncStatusView | null {
  if (phase === 'idle') return null
  if (phase === 'authorizing') {
    return {
      description: '请在弹出的 jAccount 窗口完成授权，授权完成后会自动回到这里。',
      label: '授权中',
      title: '等待授权',
      tone: 'accent',
    }
  }
  if (phase === 'queued') {
    return {
      description: '同步任务已提交，正在等待后端处理。',
      label: '排队中',
      title: '已创建同步任务',
      tone: 'accent',
    }
  }
  if (phase === 'running') {
    return {
      description: '正在同步教务课程并匹配站内课程，完成后列表会自动刷新。',
      label: '同步中',
      title: '正在同步课程',
      tone: 'accent',
    }
  }
  if (phase === 'finished') {
    if (task?.message === 'no undergraduate student identity') {
      return {
        description: '没有读取到本科生学籍信息，暂时没有可同步课程。',
        label: '已完成',
        title: '未找到可同步课程',
        tone: 'warning',
      }
    }
    return {
      description: `已同步 ${task?.synced_count ?? 0} 门课程，课程列表已刷新。`,
      label: '完成',
      title: '课程已更新',
      tone: 'success',
    }
  }
  if (phase === 'timeout') {
    return {
      description: '后台仍在同步，稍后刷新页面即可看到最新课程。',
      label: '处理中',
      title: '同步还在继续',
      tone: 'warning',
    }
  }

  return {
    description: message ?? '课程同步失败，请稍后重试。',
    label: '失败',
    title: '同步失败',
    tone: 'danger',
  }
}

async function pollLessonSyncTask({
  onUpdate,
  taskId,
  token,
}: {
  onUpdate: (task: LessonSyncTaskStatus) => void
  taskId: string
  token: string
}): Promise<LessonSyncTaskStatus | 'timeout'> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const task = await getLessonSyncTask({ taskId, token })
    onUpdate(task)

    if (task.status === 'finished' || task.status === 'failed') {
      return task
    }

    await delay(POLL_INTERVAL_MS)
  }

  return 'timeout'
}

function SyncStatusPanel({ status }: { status: SyncStatusView }) {
  const tone = syncToneClasses[status.tone]

  return (
    <div className={`relative overflow-hidden rounded-2xl border px-3 py-3 ${tone.panel}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${tone.icon}`}
        >
          {status.tone === 'success' ? (
            <CircleCheck className="size-4" />
          ) : status.tone === 'warning' ? (
            <Clock className="size-4" />
          ) : status.tone === 'danger' ? (
            <Xmark className="size-4" />
          ) : (
            <CloudArrowUpIn className="size-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-foreground">
              {status.title}
            </p>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface/80 px-2 py-0.5 text-[11px] font-medium ${tone.text}`}
            >
              <span className={`size-1.5 rounded-full ${tone.dot}`} />
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">{status.description}</p>
        </div>
      </div>
    </div>
  )
}

function RecentPurchasesCard({
  error,
  isLoading,
  onOpen,
  onRetry,
  purchases,
}: {
  error: string | null
  isLoading: boolean
  onOpen: (path: string) => void
  onRetry: () => void
  purchases: Purchase[]
}) {
  const visiblePurchases = purchases.slice(0, VISIBLE_PURCHASE_LIMIT)

  return (
    <Card className="h-full overflow-hidden">
      <Card.Header className="gap-3">
        <div className="flex min-w-0 gap-3">
          <ShoppingCart className="mt-0.5 size-5 shrink-0 text-muted" />
          <div className="min-w-0">
            <Card.Title>最近购买</Card.Title>
            <Card.Description>最新购买的资料。</Card.Description>
          </div>
        </div>
      </Card.Header>

      <Card.Content className="gap-3">
        <AnimatePresence initial={false} mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              {...stateMotion}
              className="flex items-center gap-2 rounded-xl border border-dashed border-default px-3 py-3 text-xs text-muted"
            >
              <Spinner size="sm" />
              正在加载购买记录
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              {...stateMotion}
              className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              <span className="min-w-0 flex-1">{error}</span>
              <Button
                className="h-7 shrink-0 px-2 text-xs"
                size="sm"
                variant="danger"
                onPress={onRetry}
              >
                重试
              </Button>
            </motion.div>
          ) : visiblePurchases.length === 0 ? (
            <motion.div key="empty" {...stateMotion}>
              <EmptyState
                className="rounded-xl border border-dashed border-default"
                size="sm"
              >
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <ShoppingCart />
                  </EmptyState.Media>
                  <EmptyState.Title>还没有购买资料</EmptyState.Title>
                  <EmptyState.Description>
                    购买后的资料会出现在这里。
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              animate="visible"
              className="flex flex-col gap-1.5"
              exit="exit"
              initial="hidden"
              variants={listContainerVariants}
            >
              {visiblePurchases.map((purchase) => {
                const path = getPurchaseLink(purchase)
                const isUnavailable = !path

                return (
                  <motion.button
                    key={purchase.id}
                    layout="position"
                    variants={listItemVariants}
                    whileHover={isUnavailable ? undefined : { x: 2 }}
                    whileTap={isUnavailable ? undefined : { scale: 0.985 }}
                    className={`group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors ${
                      isUnavailable
                        ? 'cursor-default opacity-65'
                        : 'cursor-(--cursor-interactive) hover:bg-surface-secondary'
                    }`}
                    disabled={isUnavailable}
                    type="button"
                    onClick={() => path && onOpen(path)}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-secondary text-muted">
                      <FileText className="size-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">
                          {getPurchaseTitle(purchase)}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
                        <span className="truncate">{getPurchaseSubtitle(purchase)}</span>
                        <span className="shrink-0 tabular-nums">
                          {formatRelativeDate(purchase.created_at)}
                        </span>
                      </div>
                    </div>
                    {isUnavailable ? null : (
                      <ChevronRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                    )}
                  </motion.button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </Card.Content>
    </Card>
  )
}

export default function HomePage() {
  const { profile, token } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [terms, setTerms] = useState<UserCourseTerm[]>([])
  const [selectedTermKey, setSelectedTermKey] = useState<string | null>(null)
  const [courses, setCourses] = useState<UserCourse[]>([])
  const [isTermsLoading, setTermsLoading] = useState(true)
  const [isCoursesLoading, setCoursesLoading] = useState(false)
  const [courseError, setCourseError] = useState<string | null>(null)
  const [coursePage, setCoursePage] = useState(1)
  const [coursesReloadKey, setCoursesReloadKey] = useState(0)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [isPurchasesLoading, setPurchasesLoading] = useState(true)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle')
  const [syncTask, setSyncTask] = useState<LessonSyncTaskStatus | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const handledCallbackRef = useRef<string | null>(null)

  const loadTerms = useCallback(async () => {
    if (!token) return

    setTermsLoading(true)
    setCourseError(null)

    try {
      const nextTerms = await getUserCourseTerms({ token })
      setTerms(nextTerms)
      setSelectedTermKey((current) => {
        if (current && nextTerms.some((term) => termKey(term) === current)) {
          return current
        }

        return nextTerms[0] ? termKey(nextTerms[0]) : null
      })
      if (nextTerms.length === 0) {
        setCourses([])
      }
      setCoursePage(1)
    } catch (err) {
      if (isAbortError(err)) return
      setCourseError(err instanceof Error ? err.message : '获取我的课程失败')
    } finally {
      setTermsLoading(false)
    }
  }, [token])

  const loadPurchases = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) {
        setPurchases([])
        setPurchasesLoading(false)
        return
      }

      setPurchasesLoading(true)
      setPurchaseError(null)

      try {
        const data = await getUserPurchaseMaterials({ signal, token })
        if (signal?.aborted) return
        setPurchases(data.records ?? [])
      } catch (err) {
        if (isAbortError(err)) return
        setPurchases([])
        setPurchaseError(err instanceof Error ? err.message : '获取最近购买失败')
      } finally {
        if (!signal?.aborted) {
          setPurchasesLoading(false)
        }
      }
    },
    [token],
  )

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTerms()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadTerms])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void loadPurchases(controller.signal)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [loadPurchases])

  useEffect(() => {
    if (!token || !selectedTermKey) {
      return
    }

    const selected = parseTermKey(selectedTermKey)
    if (!selected) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setCoursesLoading(true)
      setCourseError(null)

      getUserCoursesByTerm({
        semester: selected.semester,
        signal: controller.signal,
        token,
        year: selected.year,
      })
        .then((nextCourses) => {
          setCourses(nextCourses)
        })
        .catch((err) => {
          if (isAbortError(err)) return
          setCourses([])
          setCourseError(err instanceof Error ? err.message : '获取我的课程失败')
        })
        .finally(() => {
          if (controller.signal.aborted) return
          setCoursesLoading(false)
        })
    }, 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [coursesReloadKey, selectedTermKey, token])

  useEffect(() => {
    if (!shouldAutoHideSyncStatus(syncPhase)) return

    const completedPhase = syncPhase
    const timer = window.setTimeout(() => {
      setSyncPhase((currentPhase) =>
        currentPhase === completedPhase ? 'idle' : currentPhase,
      )
    }, SYNC_STATUS_AUTO_HIDE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [syncPhase])

  const submitLessonSyncCode = useCallback(
    (code: string, redirectUri: string) => {
      if (!token) return

      setSyncPhase('queued')
      setSyncMessage(null)
      setSyncTask(null)

      startLessonSync({ code, redirectUri, token })
        .then((created) => {
          setSyncPhase(created.status === 'running' ? 'running' : 'queued')
          return pollLessonSyncTask({
            onUpdate: (task) => {
              setSyncTask(task)
              if (task.status === 'running') setSyncPhase('running')
              if (task.status === 'queued') setSyncPhase('queued')
            },
            taskId: created.task_id,
            token,
          })
        })
        .then((result) => {
          if (result === 'timeout') {
            setSyncPhase('timeout')
            void loadTerms().then(() => setCoursesReloadKey((key) => key + 1))
            return
          }

          setSyncTask(result)
          if (result.status === 'finished') {
            setSyncPhase('finished')
            void loadTerms().then(() => setCoursesReloadKey((key) => key + 1))
          } else {
            setSyncPhase('failed')
            setSyncMessage(result.message || '课程同步失败，请稍后重试。')
          }
        })
        .catch((err) => {
          if (isAbortError(err)) return
          setSyncPhase('failed')
          setSyncMessage(err instanceof Error ? err.message : '课程同步失败，请稍后重试。')
        })
    },
    [loadTerms, token],
  )

  useEffect(() => {
    if (!token) return

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')
    if (!code && !state && !oauthError) return

    window.history.replaceState(window.history.state, '', window.location.pathname)

    if (oauthError) {
      sessionStorage.removeItem(LESSON_SYNC_STATE_KEY)
      sessionStorage.removeItem(LESSON_SYNC_REDIRECT_KEY)
      window.setTimeout(() => {
        setSyncPhase('failed')
        setSyncMessage('jAccount 授权没有完成，请重新同步。')
      }, 0)
      return
    }

    const expectedState = sessionStorage.getItem(LESSON_SYNC_STATE_KEY)
    const redirectUri =
      sessionStorage.getItem(LESSON_SYNC_REDIRECT_KEY) ?? getLessonSyncRedirectUri()

    sessionStorage.removeItem(LESSON_SYNC_STATE_KEY)
    sessionStorage.removeItem(LESSON_SYNC_REDIRECT_KEY)

    if (!code) {
      window.setTimeout(() => {
        setSyncPhase('failed')
        setSyncMessage('jAccount 没有返回授权码，请重新同步。')
      }, 0)
      return
    }

    if (!state || state !== expectedState) {
      window.setTimeout(() => {
        setSyncPhase('failed')
        setSyncMessage('授权状态已失效，请重新同步。')
      }, 0)
      return
    }

    const callbackKey = `${state}:${code}`
    const consumedKey = `${LESSON_SYNC_CONSUMED_PREFIX}${callbackKey}`
    if (handledCallbackRef.current === callbackKey || sessionStorage.getItem(consumedKey)) {
      return
    }
    handledCallbackRef.current = callbackKey
    sessionStorage.setItem(consumedKey, '1')

    window.setTimeout(() => {
      submitLessonSyncCode(code, redirectUri)
    }, 0)
  }, [searchParams, submitLessonSyncCode, token])

  const goToSearch = (term: string) => {
    navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  const submitSearch = () => {
    const query = keyword.trim()
    if (query) {
      goToSearch(query)
    }
  }

  const startAuthorization = useCallback(async () => {
    if (!token) return

    const redirectUri = getLessonSyncRedirectUri()
    setSyncPhase('authorizing')
    setSyncMessage(null)
    setSyncTask(null)

    try {
      const config = await getLessonSyncOAuthConfig({ redirectUri })
      const actualRedirectUri = config.redirect_uri ?? redirectUri
      const state = createOauthState()
      sessionStorage.setItem(LESSON_SYNC_STATE_KEY, state)
      sessionStorage.setItem(LESSON_SYNC_REDIRECT_KEY, actualRedirectUri)

      const params = new URLSearchParams({
        client_id: config.client_id,
        redirect_uri: actualRedirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state,
      })

      const { screenHeight, screenWidth } = {
        screenHeight: window.screen.height,
        screenWidth: window.screen.width,
      }
      const width = (screenHeight / 6) * 4
      const height = screenHeight / 2
      const authWindow = window.open(
        `${config.endpoint.auth_url}?${params}`,
        '_blank',
        `width=${width},height=${height},left=${screenWidth / 2 - width / 2},top=${screenHeight / 4}`,
      )

      if (!authWindow) {
        sessionStorage.removeItem(LESSON_SYNC_STATE_KEY)
        sessionStorage.removeItem(LESSON_SYNC_REDIRECT_KEY)
        setSyncPhase('failed')
        setSyncMessage('浏览器阻止了授权弹窗，请允许弹窗后重试。')
        return
      }

      const bc = new BroadcastChannel('oauth_lesson-sync')
      const timer = window.setInterval(() => {
        if (authWindow.closed) {
          window.clearInterval(timer)
          bc.close()
          sessionStorage.removeItem(LESSON_SYNC_STATE_KEY)
          sessionStorage.removeItem(LESSON_SYNC_REDIRECT_KEY)
          setSyncPhase((phase) => (phase === 'authorizing' ? 'idle' : phase))
        }
      }, 1000)

      bc.onmessage = (
        ev: MessageEvent<{ code?: string | null; error?: string | null; state?: string | null }>,
      ) => {
        window.clearInterval(timer)
        bc.close()
        authWindow.close()
        sessionStorage.removeItem(LESSON_SYNC_STATE_KEY)
        sessionStorage.removeItem(LESSON_SYNC_REDIRECT_KEY)

        if (ev.data?.error) {
          setSyncPhase('failed')
          setSyncMessage('jAccount 授权没有完成，请重新同步。')
          return
        }

        if (!ev.data?.code) {
          setSyncPhase('failed')
          setSyncMessage('jAccount 没有返回授权码，请重新同步。')
          return
        }

        if (ev.data.state !== state) {
          setSyncPhase('failed')
          setSyncMessage('授权状态已失效，请重新同步。')
          return
        }

        submitLessonSyncCode(ev.data.code, actualRedirectUri)
      }
    } catch (err) {
      sessionStorage.removeItem(LESSON_SYNC_STATE_KEY)
      sessionStorage.removeItem(LESSON_SYNC_REDIRECT_KEY)
      setSyncPhase('failed')
      setSyncMessage(err instanceof Error ? err.message : '无法发起课程同步授权')
    }
  }, [submitLessonSyncCode, token])

  const syncStatus = useMemo(
    () => getSyncStatusView(syncPhase, syncTask, syncMessage),
    [syncMessage, syncPhase, syncTask],
  )
  const isSyncing =
    syncPhase === 'authorizing' || syncPhase === 'queued' || syncPhase === 'running'
  const totalCoursePages = Math.max(1, Math.ceil(courses.length / COURSES_PAGE_SIZE))
  const safeCoursePage = Math.min(coursePage, totalCoursePages)
  const coursePageStart = (safeCoursePage - 1) * COURSES_PAGE_SIZE
  const coursePageEnd = Math.min(coursePageStart + COURSES_PAGE_SIZE, courses.length)
  const visibleCourses = courses.slice(coursePageStart, coursePageEnd)
  const coursePageNumbers = getPageNumbers(safeCoursePage, totalCoursePages)

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
          欢迎回来{profile?.name ? `，${profile.name}` : ''}
        </h1>
        <p className="text-sm text-muted lg:text-base">
          在这里浏览、分享交大课程资料。
        </p>
      </header>

      <section className="soft-glow-panel relative isolate overflow-hidden rounded-3xl border border-default bg-surface-secondary px-6 py-12 sm:px-10 sm:py-16">
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              今天想找哪门课？
            </h2>
            <p className="text-sm text-muted sm:text-base">
              搜索课程名或课程代码，快速进入资料列表。
            </p>
          </div>

          <div className="w-full">
            <SearchField
              className="w-full"
              name="course-search"
              value={keyword}
              onChange={setKeyword}
              onSubmit={submitSearch}
            >
              <Label className="sr-only">搜索课程</Label>
              <SearchField.Group className="h-14 w-full rounded-full pr-2 shadow-field transition data-[focus-within=true]:ring-2 data-[focus-within=true]:ring-accent/40 sm:h-16">
                <SearchField.SearchIcon className="ml-5 size-5" />
                <SearchField.Input
                  ref={inputRef}
                  className="w-full min-w-0 px-3 text-base sm:text-lg"
                  placeholder="搜索课程名或课程代码"
                />
                {keyword ? null : (
                  <Kbd aria-hidden className="mr-2 hidden sm:inline-flex">
                    <Kbd.Content>/</Kbd.Content>
                  </Kbd>
                )}
                <Button
                  isIconOnly
                  aria-label="搜索课程"
                  className="hidden size-10 shrink-0 rounded-full sm:inline-flex sm:size-12"
                  isDisabled={!keyword.trim()}
                  onPress={submitSearch}
                >
                  <Magnifier className="size-4 sm:size-5" />
                </Button>
              </SearchField.Group>
            </SearchField>

            <Button
              className="mt-3 h-12 w-full sm:hidden"
              isDisabled={!keyword.trim()}
              onPress={submitSearch}
            >
              <Magnifier className="size-4" />
              搜索
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted">热门搜索</span>
            {SUGGESTED_KEYWORDS.map((term) => (
              <button
                key={term}
                className="rounded-full border border-default bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:bg-surface-secondary hover:text-foreground"
                type="button"
                onClick={() => goToSearch(term)}
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
        <div className="min-w-0">
          <Card className="h-full overflow-hidden">
            <Card.Header className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <BookOpen className="mt-0.5 size-5 shrink-0 text-muted" />
                  <div className="min-w-0">
                    <Card.Title>我的课程</Card.Title>
                    <Card.Description>
                      同步教务课程后，可快速进入课程资料页。
                    </Card.Description>
                  </div>
                </div>
                <Button
                  className="h-8 shrink-0 px-3 text-xs"
                  isDisabled={isSyncing}
                  isPending={syncPhase === 'authorizing'}
                  size="sm"
                  variant="secondary"
                  onPress={startAuthorization}
                >
                  <ArrowRotateRight className="size-3.5" />
                  同步
                </Button>
              </div>
            </Card.Header>

            <Card.Content className="gap-0">
              <AnimatePresence initial={false}>
                {syncStatus ? (
                  <motion.div
                    key="sync-status"
                    animate={{
                      height: 'auto',
                      marginBottom: SYNC_STATUS_GAP_PX,
                      opacity: 1,
                    }}
                    exit={{ height: 0, marginBottom: 0, opacity: 0 }}
                    initial={{ height: 0, marginBottom: 0, opacity: 0 }}
                    transition={stateTransition}
                    style={{ overflow: 'hidden' }}
                  >
                    <SyncStatusPanel status={syncStatus} />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence initial={false} mode="wait">
                {isTermsLoading ? (
                  <motion.div
                    key="terms-loading"
                    {...stateMotion}
                    className="flex items-center gap-2 rounded-xl border border-dashed border-default px-3 py-3 text-xs text-muted"
                  >
                    <Spinner size="sm" />
                    正在加载课程
                  </motion.div>
                ) : courseError ? (
                  <motion.div
                    key="terms-error"
                    {...stateMotion}
                    className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
                  >
                    <span className="min-w-0 flex-1">{courseError}</span>
                    <Button
                      className="h-7 shrink-0 px-2 text-xs"
                      size="sm"
                      variant="danger"
                      onPress={loadTerms}
                    >
                      重试
                    </Button>
                  </motion.div>
                ) : terms.length === 0 ? (
                  <motion.div key="terms-empty" {...stateMotion}>
                    <EmptyState
                      className="rounded-xl border border-dashed border-default"
                      size="sm"
                    >
                      <EmptyState.Header>
                        <EmptyState.Media variant="icon">
                          <CloudArrowUpIn />
                        </EmptyState.Media>
                        <EmptyState.Title>还没有同步课程</EmptyState.Title>
                        <EmptyState.Description>
                          点击右上角“同步”从教学信息服务网同步课程信息。
                        </EmptyState.Description>
                      </EmptyState.Header>
                    </EmptyState>
                  </motion.div>
                ) : (
                  <motion.div
                    key="terms-content"
                    {...stateMotion}
                    className="flex flex-col gap-3"
                  >
                    <motion.div
                      animate="visible"
                      aria-label="选择学期"
                      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
                      initial="hidden"
                      role="tablist"
                      variants={listContainerVariants}
                    >
                      {terms.map((term) => {
                        const key = termKey(term)
                        const isSelected = key === selectedTermKey

                        return (
                          <motion.button
                            key={key}
                            aria-selected={isSelected}
                            variants={tabItemVariants}
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.96 }}
                            className="flex h-8 shrink-0 cursor-(--cursor-interactive) items-center gap-1.5 rounded-full border border-default px-3 text-xs font-medium text-muted transition-colors hover:text-foreground data-[selected=true]:border-accent/30 data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent"
                            data-selected={isSelected}
                            role="tab"
                            type="button"
                            onClick={() => {
                              setSelectedTermKey(key)
                              setCoursePage(1)
                            }}
                          >
                            <Calendar className="size-3.5" />
                            {formatTerm(term)}
                          </motion.button>
                        )
                      })}
                    </motion.div>

                    <AnimatePresence initial={false} mode="wait">
                      {isCoursesLoading ? (
                        <motion.div
                          key="courses-loading"
                          {...stateMotion}
                          className="flex items-center gap-2 rounded-xl border border-dashed border-default px-3 py-3 text-xs text-muted"
                        >
                          <Spinner size="sm" />
                          正在加载该学期课程
                        </motion.div>
                      ) : courses.length === 0 ? (
                        <motion.div
                          key="courses-empty"
                          {...stateMotion}
                          className="rounded-xl border border-dashed border-default px-3 py-3 text-xs text-muted"
                        >
                          这个学期暂时没有课程。
                        </motion.div>
                      ) : (
                        <motion.div
                          key={`courses-${selectedTermKey}-${safeCoursePage}`}
                          animate="visible"
                          className="flex flex-col gap-1.5"
                          exit="exit"
                          initial="hidden"
                          variants={listContainerVariants}
                        >
                          {visibleCourses.map((record) => (
                            <motion.button
                              key={record.id}
                              layout="position"
                              variants={listItemVariants}
                              whileHover={{ x: 2 }}
                              whileTap={{ scale: 0.985 }}
                              className="group flex w-full cursor-(--cursor-interactive) items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-secondary"
                              type="button"
                              onClick={() => navigate(getCourseLink(record))}
                            >
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  {record.course.code ? (
                                    <Chip className="shrink-0" size="sm" variant="soft">
                                      <Chip.Label className="tabular-nums">
                                        {record.course.code}
                                      </Chip.Label>
                                    </Chip>
                                  ) : null}
                                  <span className="truncate text-sm font-medium text-foreground">
                                    {record.course.name}
                                  </span>
                                </div>
                                <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
                                  {record.class?.teacher?.name ? (
                                    <span className="flex min-w-0 items-center gap-1">
                                      <Person className="size-3.5 shrink-0" />
                                      <span className="truncate">{record.class.teacher.name}</span>
                                    </span>
                                  ) : null}
                                  {record.course.organization?.name ? (
                                    <span className="flex min-w-0 items-center gap-1">
                                      <Books className="size-3.5 shrink-0" />
                                      <span className="truncate">
                                        {record.course.organization.name}
                                      </span>
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <ChevronRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {courses.length > COURSES_PAGE_SIZE ? (
                      <Pagination className="mt-1 w-full flex-wrap gap-2" size="sm">
                        <Pagination.Summary className="text-xs text-muted">
                          {coursePageStart + 1}-{coursePageEnd} / {courses.length}
                        </Pagination.Summary>
                        <Pagination.Content className="gap-1">
                          <Pagination.Item>
                            <Pagination.Previous
                              isDisabled={safeCoursePage === 1}
                              onPress={() =>
                                setCoursePage(Math.max(1, safeCoursePage - 1))
                              }
                            >
                              <Pagination.PreviousIcon />
                            </Pagination.Previous>
                          </Pagination.Item>
                          {coursePageNumbers.map((page, index) =>
                            page === 'ellipsis' ? (
                              <Pagination.Item key={`ellipsis-${index}`}>
                                <Pagination.Ellipsis />
                              </Pagination.Item>
                            ) : (
                              <Pagination.Item key={page}>
                                <Pagination.Link
                                  isActive={page === safeCoursePage}
                                  onPress={() => setCoursePage(page)}
                                >
                                  {page}
                                </Pagination.Link>
                              </Pagination.Item>
                            ),
                          )}
                          <Pagination.Item>
                            <Pagination.Next
                              isDisabled={safeCoursePage === totalCoursePages}
                              onPress={() =>
                                setCoursePage(Math.min(totalCoursePages, safeCoursePage + 1))
                              }
                            >
                              <Pagination.NextIcon />
                            </Pagination.Next>
                          </Pagination.Item>
                        </Pagination.Content>
                      </Pagination>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
          </Card.Content>
        </Card>
        </div>

        <RecentPurchasesCard
          error={purchaseError}
          isLoading={isPurchasesLoading}
          purchases={purchases}
          onOpen={navigate}
          onRetry={() => void loadPurchases()}
        />
      </section>
    </div>
  )
}
