import { Books, ChevronRight, Clock, Magnifier } from '@gravity-ui/icons'
import { Button, Chip, Kbd, Spinner, type Key } from '@heroui/react'
import { Command } from '@heroui-pro/react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { searchCourses } from '../api/courses'
import type { Course } from '../types/course'

const SEARCH_DEBOUNCE_MS = 220
const SUGGESTED_KEYWORDS = ['大学物理', '高等数学', '概率统计', '数据结构']

function formatLatestUpload(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '暂无更新'

  const dayMs = 1000 * 60 * 60 * 24
  const diffMs = Date.now() - date.getTime()

  if (diffMs < dayMs) return '今天更新'
  if (diffMs < 2 * dayMs) return '昨天更新'
  if (diffMs < 7 * dayMs) return `${Math.floor(diffMs / dayMs)} 天前更新`

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  })
}

function getShortcutLabel(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
    return '⌘ K'
  }
  return 'Ctrl K'
}

function getCourseCode(course: Course): string | null {
  if (course.is_deprecated && course.latest_course?.code) return course.latest_course.code
  return course.code || null
}

function CourseMonogram({ course }: { course: Course }) {
  const seed = course.code || course.name || String(course.id)
  const letters = seed
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent-soft-hover bg-accent/10 text-[11px] font-semibold text-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]">
      {letters || <Books className="size-4" />}
    </div>
  )
}

function CommandEmptyState({
  error,
  inputValue,
  isSearching,
}: {
  error: string | null
  inputValue: string
  isSearching: boolean
}) {
  if (isSearching) {
    return (
      <div className="flex h-28 items-center justify-center gap-2 text-sm text-muted">
        <Spinner size="sm" />
        正在检索课程
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-28 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-sm font-medium text-danger">搜索失败</p>
        <p className="text-xs text-muted">{error}</p>
      </div>
    )
  }

  if (inputValue.trim()) {
    return (
      <div className="flex h-28 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-sm font-medium text-foreground">没有匹配的课程</p>
        <p className="text-xs text-muted">换一个课程名、教师常用简称或课程代码试试</p>
      </div>
    )
  }

  return (
    <div className="flex h-28 flex-col items-center justify-center gap-1 px-6 text-center">
      <p className="text-sm font-medium text-foreground">输入课程名或课号</p>
      <p className="text-xs text-muted">从标题栏直接进入课程资料页</p>
    </div>
  )
}

function CourseCommandItem({ course }: { course: Course }) {
  const code = getCourseCode(course)
  const organization = course.organization?.name ?? '暂无开课院系'
  const latest = course.latest_material_uploaded_at
    ? formatLatestUpload(course.latest_material_uploaded_at)
    : '暂无更新'

  return (
    <Command.Item
      className="h-auto! items-start! gap-3! rounded-xl! px-3! py-2.5! data-[focused=true]:bg-accent/10!"
      id={`course:${course.id}`}
      textValue={[
        course.name,
        course.english_name,
        course.code,
        course.latest_course?.code,
        organization,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CourseMonogram course={course} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold leading-5 text-foreground">
            {course.name}
          </span>
          {code ? (
            <Chip className="shrink-0" size="sm" variant="soft">
              <Chip.Label className="tabular-nums">{code}</Chip.Label>
            </Chip>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="min-w-0 truncate">{organization}</span>
          {course.english_name ? (
            <>
              <span aria-hidden className="text-muted/50">
                /
              </span>
              <span className="min-w-0 truncate">{course.english_name}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>
            <span className="tabular-nums text-foreground">{course.material_count}</span> 份资料
          </span>
          <span aria-hidden className="text-muted/50">
            ·
          </span>
          <Clock className="size-3.5" />
          <span>{latest}</span>
        </div>
      </div>
      <ChevronRight className="mt-2 size-4 shrink-0 text-muted" />
    </Command.Item>
  )
}

export default function CourseCommand({ token }: { token: string }) {
  const navigate = useNavigate()
  const [shortcutLabel] = useState(getShortcutLabel)
  const [isOpen, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [isSearching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetSearch = useCallback(() => {
    setInputValue('')
    setCourses([])
    setSearching(false)
    setError(null)
  }, [])

  const closeCommand = useCallback(() => {
    setOpen(false)
    resetSearch()
  }, [resetSearch])

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
    setError(null)
    setCourses([])
    setSearching(Boolean(value.trim()))
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey) || event.altKey) {
        return
      }

      event.preventDefault()
      setOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const keyword = inputValue.trim()

    if (!keyword) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      searchCourses({ keyword, token, signal: controller.signal })
        .then((next) => {
          if (controller.signal.aborted) return
          setCourses(next)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setCourses([])
          setError(err instanceof Error ? err.message : '搜索课程失败')
        })
        .finally(() => {
          if (controller.signal.aborted) return
          setSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [inputValue, isOpen, token])

  const handleOpenChange = (open: boolean) => {
    setOpen(open)
    if (!open) resetSearch()
  }

  const handleAction = (key: Key) => {
    const action = String(key)

    if (action.startsWith('keyword:')) {
      handleInputChange(action.slice('keyword:'.length))
      return
    }

    if (action.startsWith('course:')) {
      closeCommand()
      navigate(`/course/${action.slice('course:'.length)}`)
    }
  }

  const trimmedInput = inputValue.trim()
  const showSuggestions = !trimmedInput
  const showResults = trimmedInput && !error && courses.length > 0

  return (
    <>
      <div className="flex min-w-0 justify-end">
        <Button
          aria-label="快速搜索课程"
          className="hidden h-10 min-w-0 max-w-[16rem] flex-1 justify-start rounded-full border border-border/80 bg-surface/70 px-3 text-muted shadow-none transition hover:border-accent/30 hover:bg-surface-secondary hover:text-foreground dark:border-white/6 dark:bg-white/2.5 dark:text-white/45 dark:hover:border-white/10 dark:hover:bg-white/5.5 dark:hover:text-white/70 sm:flex md:w-64"
          variant="ghost"
          onPress={() => setOpen(true)}
        >
          <Magnifier className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left text-sm">搜索课程 / 课号</span>
          <Kbd aria-hidden className="ml-auto hidden h-5 border-border/60 bg-default/70 px-1.5 text-[11px] text-muted dark:border-white/4 dark:bg-white/5.5 dark:text-white/40 lg:inline-flex">
            <Kbd.Content>{shortcutLabel}</Kbd.Content>
          </Kbd>
        </Button>
        <Button
          isIconOnly
          aria-label="快速搜索课程"
          className="sm:hidden"
          variant="ghost"
          onPress={() => setOpen(true)}
        >
          <Magnifier className="size-5" />
        </Button>
      </div>

      <Command>
        <Command.Backdrop isOpen={isOpen} variant="blur" onOpenChange={handleOpenChange}>
          <Command.Container size="lg">
            <Command.Dialog
              filter={() => true}
              inputValue={inputValue}
              onInputChange={handleInputChange}
            >
              <Command.Header className="flex items-center justify-between px-4 pb-1 pt-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-accent-soft-hover bg-accent/10 px-2 text-xs font-semibold text-accent">
                    课程索引
                  </span>
                  <span className="truncate text-xs text-muted">可通过课程名、课号搜索</span>
                </div>
                <Kbd className="hidden h-5 text-xs sm:inline-flex">
                  <Kbd.Content>Esc</Kbd.Content>
                </Kbd>
              </Command.Header>
              <Command.InputGroup>
                <Command.InputGroup.Prefix>
                  <Magnifier />
                </Command.InputGroup.Prefix>
                <Command.InputGroup.Input placeholder="输入课程名或课号" />
                <Command.InputGroup.ClearButton />
              </Command.InputGroup>
              <Command.List
                renderEmptyState={() => (
                  <CommandEmptyState
                    error={error}
                    inputValue={inputValue}
                    isSearching={isSearching}
                  />
                )}
                onAction={handleAction}
              >
                {showSuggestions ? (
                  <Command.Group heading="常用搜索">
                    {SUGGESTED_KEYWORDS.map((keyword) => (
                      <Command.Item
                        key={keyword}
                        className="rounded-xl!"
                        id={`keyword:${keyword}`}
                        textValue={keyword}
                      >
                        <Magnifier className="size-4" />
                        <span>{keyword}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                {showResults ? (
                  <Command.Group heading={`匹配课程 · ${courses.length}`}>
                    {courses.map((course) => (
                      <CourseCommandItem key={course.id} course={course} />
                    ))}
                  </Command.Group>
                ) : null}
              </Command.List>
              <Command.Footer className="hidden h-10 justify-between sm:flex [&_kbd]:h-5 [&_kbd]:text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <Kbd>
                      <Kbd.Abbr keyValue="up" />
                    </Kbd>
                    <Kbd>
                      <Kbd.Abbr keyValue="down" />
                    </Kbd>
                    移动
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Kbd>
                      <Kbd.Abbr keyValue="enter" />
                    </Kbd>
                    进入课程
                  </span>
                </div>
              </Command.Footer>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
    </>
  )
}
