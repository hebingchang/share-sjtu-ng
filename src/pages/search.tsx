import { ArrowLeft, ChevronRight, Clock, Magnifier } from '@gravity-ui/icons'
import { Button, Card, Chip, Label, SearchField, Spinner } from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { searchCourses } from '../api/courses'
import { useAuth } from '../auth/context'
import type { Course } from '../types/course'

function formatLatestUpload(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const dayMs = 1000 * 60 * 60 * 24
  const diffMs = Date.now() - date.getTime()

  if (diffMs < dayMs) return '今天'
  if (diffMs < 2 * dayMs) return '昨天'
  if (diffMs < 7 * dayMs) return `${Math.floor(diffMs / dayMs)} 天前`

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function highlightKeyword(text: string, keyword: string): ReactNode {
  if (!keyword || !text) return text

  const lowerText = text.toLowerCase()
  const lowerKeyword = keyword.toLowerCase()
  const parts: ReactNode[] = []
  let cursor = 0
  let match = lowerText.indexOf(lowerKeyword, cursor)

  while (match !== -1) {
    if (match > cursor) parts.push(text.slice(cursor, match))
    parts.push(
      <mark
        key={`hl-${match}`}
        className="bg-transparent font-extrabold text-foreground"
      >
        {text.slice(match, match + keyword.length)}
      </mark>,
    )
    cursor = match + keyword.length
    match = lowerText.indexOf(lowerKeyword, cursor)
  }

  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
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
    transition: { staggerChildren: 0.035, delayChildren: 0.04 },
  },
  exit: { opacity: 0, transition: { duration: 0.14, ease: easing } },
}

const listItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: easing },
  },
}

type ContentState = 'searching' | 'error' | 'empty' | 'results'

export default function SearchPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryKeyword = useMemo(() => searchParams.get('q')?.trim() ?? '', [searchParams])
  const [keyword, setKeyword] = useState(queryKeyword)
  const [courses, setCourses] = useState<Course[]>([])
  const [isSearching, setSearching] = useState(Boolean(queryKeyword))
  const [error, setError] = useState<string | null>(null)
  const [trackedQuery, setTrackedQuery] = useState(queryKeyword)

  if (trackedQuery !== queryKeyword) {
    setTrackedQuery(queryKeyword)
    setKeyword(queryKeyword)
    setSearching(Boolean(queryKeyword))
    setError(null)
  }

  useEffect(() => {
    if (!token || !queryKeyword) return

    const controller = new AbortController()

    searchCourses({
      keyword: queryKeyword,
      signal: controller.signal,
      token,
    })
      .then((next) => {
        if (controller.signal.aborted) return
        setCourses(next)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        setCourses([])
        setError(err instanceof Error ? err.message : '搜索课程失败')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setSearching(false)
      })

    return () => controller.abort()
  }, [queryKeyword, token])

  const submitSearch = () => {
    const query = keyword.trim()
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`)
    }
  }

  const subtitle = queryKeyword
    ? `“${queryKeyword}” 的搜索结果`
    : '输入课程名或课程代码'

  let contentState: ContentState
  if (error) contentState = 'error'
  else if (isSearching) contentState = 'searching'
  else if (courses.length > 0) contentState = 'results'
  else contentState = 'empty'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Button
          className="w-fit"
          variant="ghost"
          onPress={() => navigate('/')}
        >
          <ArrowLeft className="size-4" />
          返回首页
        </Button>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
            搜索课程
          </h1>
          <div className="relative h-5 lg:h-6">
            <AnimatePresence initial={false} mode="wait">
              <motion.p
                key={subtitle}
                {...stateMotion}
                className="absolute inset-0 text-sm text-muted lg:text-base"
              >
                {subtitle}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <SearchField
        className="w-full"
        name="course-search"
        value={keyword}
        onChange={setKeyword}
        onSubmit={submitSearch}
      >
        <Label className="sr-only">搜索课程</Label>
        <SearchField.Group className="h-14 w-full rounded-full pr-2 shadow-field transition data-[focus-within=true]:ring-2 data-[focus-within=true]:ring-accent/40">
          <SearchField.SearchIcon className="ml-5 size-5" />
          <SearchField.Input
            className="w-full min-w-0 px-3 text-base"
            placeholder="课程名或课程代码"
          />
          <Button
            className="h-10 shrink-0 rounded-full px-5"
            isDisabled={!keyword.trim()}
            isPending={isSearching}
            onPress={submitSearch}
          >
            <Magnifier className="size-4" />
            搜索
          </Button>
        </SearchField.Group>
      </SearchField>

      <AnimatePresence initial={false} mode="wait">
        {contentState === 'error' ? (
          <motion.p
            key="error"
            {...stateMotion}
            className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </motion.p>
        ) : null}

        {contentState === 'searching' ? (
          <motion.div
            key="searching"
            {...stateMotion}
            className="flex items-center justify-center gap-2 py-12 text-sm text-muted"
          >
            <Spinner size="sm" />
            正在搜索课程
          </motion.div>
        ) : null}

        {contentState === 'empty' ? (
          <motion.div
            key="empty"
            {...stateMotion}
            className="rounded-lg border border-dashed border-default px-4 py-12 text-center text-sm text-muted"
          >
            {queryKeyword ? '没有找到匹配的课程' : '请输入关键词搜索课程'}
          </motion.div>
        ) : null}

        {contentState === 'results' ? (
          <motion.div
            key="results"
            animate="visible"
            className="grid gap-3"
            exit="exit"
            initial="hidden"
            variants={listContainerVariants}
          >
            {courses.map((course) => {
              const replacementCode = course.is_deprecated ? course.latest_course?.code : null
              const primaryCode = replacementCode ?? course.code
              const showOldCode = !!replacementCode && course.code && course.code !== replacementCode
              const hasChips = Boolean(primaryCode) || Boolean(showOldCode)

              return (
                <motion.div key={course.id} variants={listItemVariants}>
                  <Link
                    aria-label={`查看课程 ${course.name}`}
                    className="group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    to={`/course/${course.id}`}
                  >
                    <Card
                      className="transition-shadow duration-200 group-hover:shadow-md sm:flex-row sm:items-center sm:gap-5 sm:p-5"
                      role="article"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Card.Title className="text-lg font-semibold leading-snug text-foreground sm:text-xl">
                          {highlightKeyword(course.name, queryKeyword)}
                        </Card.Title>
                        {hasChips ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {primaryCode ? (
                              <Chip size="sm">
                                <Chip.Label className="tabular-nums">{primaryCode}</Chip.Label>
                              </Chip>
                            ) : null}
                            {showOldCode ? (
                              <Chip size="sm" variant="soft">
                                <Chip.Label className="tabular-nums">{course.code}</Chip.Label>
                              </Chip>
                            ) : null}
                          </div>
                        ) : null}
                        <Card.Description className="truncate">
                          {course.organization?.name ?? '暂无开课院系'}
                          {course.english_name ? ` · ${course.english_name}` : ''}
                        </Card.Description>

                        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted sm:hidden">
                          <span className="text-base font-semibold tabular-nums text-foreground">
                            {course.material_count}
                          </span>
                          <span>份资料</span>
                          {course.latest_material_uploaded_at ? (
                            <>
                              <span aria-hidden>·</span>
                              <Clock className="size-3.5 shrink-0" />
                              <span>
                                最新 {formatLatestUpload(course.latest_material_uploaded_at)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="hidden shrink-0 items-center gap-4 sm:flex">
                        <div aria-hidden className="h-12 w-px bg-default" />
                        <div className="flex min-w-[7.5rem] flex-col items-end gap-1 text-right">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-semibold leading-none tabular-nums text-foreground">
                              {course.material_count}
                            </span>
                            <span className="text-xs text-muted">份资料</span>
                          </div>
                          {course.latest_material_uploaded_at ? (
                            <div className="flex items-center gap-1 text-xs text-muted">
                              <Clock className="size-3 shrink-0" />
                              <span>
                                最新 {formatLatestUpload(course.latest_material_uploaded_at)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">暂无更新</span>
                          )}
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
