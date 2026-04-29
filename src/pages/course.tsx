import {
  Archive,
  BarsAscendingAlignLeftArrowDown,
  Books,
  Calendar,
  ChevronDown,
  CircleDollar,
  File,
  FilePlus,
  Funnel,
  Heart,
  Person,
  ShoppingCart,
  Xmark,
} from '@gravity-ui/icons'
import {
  Button,
  Card,
  Chip,
  type Key,
  Label,
  ListBox,
  Pagination,
  Popover,
  SearchField,
  Select,
  Separator,
  Skeleton,
  ToggleButton,
} from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getCourse, getCourseMaterials } from '../api/courses'
import { useAuth } from '../auth/use-auth'
import MaterialDetailModal from '../components/material-detail-modal'
import MaterialUploadModal, {
  type MaterialUploadInitialSelection,
} from '../components/material-upload-modal'
import type { Course } from '../types/course'
import type { Material, MaterialType } from '../types/material'

const UNARCHIVED_KEY = '__unarchived__'
const VISIBLE_CLASS_LIMIT = 5
const MATERIALS_PAGE_SIZE = 8

type SortKey = 'newest' | 'oldest' | 'most-liked' | 'most-purchased' | 'cheapest'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'newest', label: '最新上传' },
  { id: 'oldest', label: '最早上传' },
  { id: 'most-liked', label: '点赞最多' },
  { id: 'most-purchased', label: '购买最多' },
  { id: 'cheapest', label: '积分最少' },
]

const DEFAULT_SORT: SortKey = 'newest'

function sortMaterials(materials: Material[], sort: SortKey): Material[] {
  const recencyDesc = (a: Material, b: Material) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  const copy = [...materials]
  switch (sort) {
    case 'newest':
      return copy.sort(recencyDesc)
    case 'oldest':
      return copy.sort((a, b) => -recencyDesc(a, b))
    case 'most-liked':
      return copy.sort((a, b) => b.like_count - a.like_count || recencyDesc(a, b))
    case 'most-purchased':
      return copy.sort((a, b) => b.purchase_count - a.purchase_count || recencyDesc(a, b))
    case 'cheapest':
      return copy.sort((a, b) => a.points - b.points || recencyDesc(a, b))
  }
}

function isBlockedMaterial(material: Material): boolean {
  return Boolean(material.block ?? material.blocked ?? material.is_blocked)
}

function filterBlockedMaterials(materials: Material[] | null | undefined): Material[] {
  return (materials ?? []).filter((material) => !isBlockedMaterial(material))
}

const easing = [0.32, 0.72, 0, 1] as const

const stateMotion = {
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  initial: { opacity: 0, y: 6 },
  transition: { duration: 0.22, ease: easing },
}

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.02 },
  },
}

const listItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: easing } },
}

const courseHeaderChipClassName =
  'border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]'

const courseHeaderMutedChipClassName =
  'border border-border/80 bg-surface/80 text-muted shadow-[0_1px_2px_rgb(0_0_0/0.03)]'

function formatDate(iso: string): string {
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

function formatCourseLevel(level: string): string {
  const labels: Record<string, string> = {
    graduate: '研究生',
    undergraduate: '本科',
  }

  return labels[level] ?? level
}

interface ClassTab {
  key: string
  label: string
  sublabel?: string
  count: number
  materials: Material[]
  isUnarchived?: boolean
}

export default function CoursePage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const { id = '', classId, materialId } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [tabs, setTabs] = useState<ClassTab[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trackedId, setTrackedId] = useState(id)
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT)
  const [selectedTypeIds, setSelectedTypeIds] = useState<Key[]>([])
  const [freeOnly, setFreeOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadInitialSelection, setUploadInitialSelection] =
    useState<MaterialUploadInitialSelection>()

  if (trackedId !== id) {
    setTrackedId(id)
    setCourse(null)
    setTabs([])
    setLoading(true)
    setError(null)
    setSortKey(DEFAULT_SORT)
    setSelectedTypeIds([])
    setFreeOnly(false)
    setSearchQuery('')
    setUploadModalOpen(false)
    setUploadInitialSelection(undefined)
  }

  useEffect(() => {
    if (!token || !id) return

    const controller = new AbortController()

    Promise.all([
      getCourse({ id, token, signal: controller.signal }),
      getCourseMaterials({ id, token, signal: controller.signal }),
    ])
      .then(([courseData, materialsData]) => {
        if (controller.signal.aborted) return

        const classTabs: ClassTab[] = (materialsData.classes ?? []).map((cls) => {
          const materials = filterBlockedMaterials(cls.materials)

          return {
            key: String(cls.id),
            label: cls.teacher?.name ?? '未知教师',
            sublabel: cls.teacher?.organization?.name ?? undefined,
            count: cls.materials ? materials.length : cls.material_count ?? 0,
            materials,
          }
        })

        const unarchived = filterBlockedMaterials(materialsData.unarchived)
        const allTabs: ClassTab[] = []
        if (unarchived.length > 0) {
          allTabs.push({
            key: UNARCHIVED_KEY,
            label: '未归档',
            sublabel: '尚未关联教学班的资料',
            count: unarchived.length,
            materials: unarchived,
            isUnarchived: true,
          })
        }
        allTabs.push(...classTabs)

        setCourse(courseData)
        setTabs(allTabs)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : '加载课程失败')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [id, token])

  const selectedKey = useMemo(() => {
    if (tabs.length === 0) return null
    if (classId && tabs.some((t) => t.key === classId)) return classId
    if (tabs.some((t) => t.key === UNARCHIVED_KEY)) return UNARCHIVED_KEY
    return tabs[0]?.key ?? null
  }, [classId, tabs])

  const selectedTab = useMemo(
    () => tabs.find((t) => t.key === selectedKey) ?? tabs[0] ?? null,
    [selectedKey, tabs],
  )
  const classCount = useMemo(
    () => tabs.reduce((count, tab) => count + (tab.isUnarchived ? 0 : 1), 0),
    [tabs],
  )

  const handleSelect = (key: string) => {
    if (key === UNARCHIVED_KEY) {
      navigate(`/course/${id}`, { replace: true })
    } else {
      navigate(`/course/${id}/class/${key}`, { replace: true })
    }
  }

  const basePath = useMemo(() => {
    if (classId) return `/course/${id}/class/${classId}`
    return `/course/${id}`
  }, [id, classId])

  const openMaterial = useCallback(
    (mid: number) => {
      navigate(`${basePath}/material/${mid}`)
    },
    [basePath, navigate],
  )

  const closeMaterial = useCallback(() => {
    navigate(basePath, { replace: true })
  }, [basePath, navigate])

  const openUploadModal = useCallback(() => {
    if (!course) return

    setUploadInitialSelection({
      course,
      classId: selectedTab && !selectedTab.isUnarchived ? selectedTab.key : null,
      teacherName: selectedTab && !selectedTab.isUnarchived ? selectedTab.label : undefined,
    })
    setUploadModalOpen(true)
  }, [course, selectedTab])

  const closeUploadModal = useCallback(() => {
    setUploadModalOpen(false)
    setUploadInitialSelection(undefined)
  }, [])

  const replacementCode = course?.is_deprecated ? course.latest_course?.code : null
  const primaryCode = replacementCode ?? course?.code
  const showOldCode = !!replacementCode && course?.code && course.code !== replacementCode
  const taxonomy = useMemo(() => {
    if (!course) return [] as string[]
    return [...new Set([
      course.course_type?.name,
      course.course_category?.name,
      course.course_nature?.name,
    ])].filter(Boolean) as string[]
  }, [course])

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.div
            key="error"
            {...stateMotion}
            className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </motion.div>
        ) : isLoading || !course ? (
          <CourseSkeleton key="loading" />
        ) : (
          <motion.div key="loaded" {...stateMotion} className="flex flex-col gap-6">
            <CourseHeader
              course={course}
              primaryCode={primaryCode}
              showOldCode={!!showOldCode}
              taxonomy={taxonomy}
              onUploadPress={openUploadModal}
            />

            {tabs.length > 0 ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold tracking-tight sm:text-lg">
                    教学班资料
                  </h2>
                  <p className="text-xs text-muted">
                    共 <span className="tabular-nums text-foreground">{classCount}</span> 个
                  </p>
                </div>

                <ClassTabs
                  selectedKey={selectedKey}
                  tabs={tabs}
                  onSelect={handleSelect}
                />

                <div className="relative min-h-50">
                  {selectedTab ? (
                    <MaterialsPanel
                      freeOnly={freeOnly}
                      searchQuery={searchQuery}
                      selectedTypeIds={selectedTypeIds}
                      sortKey={sortKey}
                      tab={selectedTab}
                      onFreeOnlyChange={setFreeOnly}
                      onMaterialOpen={openMaterial}
                      onSearchChange={setSearchQuery}
                      onSortChange={setSortKey}
                      onTypeChange={setSelectedTypeIds}
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState
                description="该课程目前还没有教学班或资料。"
                title="暂无内容"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <MaterialDetailModal
        isOpen={!!materialId}
        materialId={materialId ?? null}
        onClose={closeMaterial}
      />
      {token ? (
        <MaterialUploadModal
          initialSelection={uploadInitialSelection}
          isOpen={isUploadModalOpen}
          token={token}
          onClose={closeUploadModal}
        />
      ) : null}
    </div>
  )
}

function CourseHeader({
  course,
  primaryCode,
  showOldCode,
  taxonomy,
  onUploadPress,
}: {
  course: Course
  onUploadPress: () => void
  primaryCode?: string
  showOldCode: boolean
  taxonomy: string[]
}) {
  return (
    <header className="soft-glow-panel relative isolate overflow-hidden rounded-3xl border border-default bg-surface-secondary px-6 py-7 sm:px-8 sm:py-8">
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {primaryCode ? (
              <Chip className={courseHeaderChipClassName}>
                <Chip.Label className="tabular-nums">{primaryCode}</Chip.Label>
              </Chip>
            ) : null}
            {showOldCode ? (
              <Chip className={courseHeaderMutedChipClassName} variant="soft">
                <Chip.Label className="tabular-nums">{course.code}</Chip.Label>
              </Chip>
            ) : null}
            {course.level ? (
              <Chip className={courseHeaderMutedChipClassName} variant="soft">
                <Chip.Label>{formatCourseLevel(course.level)}</Chip.Label>
              </Chip>
            ) : null}
          </div>

          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
            {course.name}
          </h1>

          <div className="flex flex-col gap-1 text-sm text-muted">
            {course.english_name ? (
              <span className="leading-snug">{course.english_name}</span>
            ) : null}
            {course.organization?.name ? (
              <span className="flex items-center gap-1.5">
                <Books className="size-4" />
                {course.organization.name}
              </span>
            ) : null}
          </div>

          {taxonomy.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {taxonomy.map((name) => (
                <Chip
                  key={name}
                  className={courseHeaderMutedChipClassName}
                  variant="soft"
                >
                  <Chip.Label>{name}</Chip.Label>
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 self-start max-lg:w-full">
          <Button
            className="max-lg:w-full"
            variant="primary"
            onPress={onUploadPress}
          >
            <FilePlus className="size-4" />
            上传资料
          </Button>
        </div>
      </div>
    </header>
  )
}

function ClassPill({
  tab,
  isSelected,
  onSelect,
}: {
  tab: ClassTab
  isSelected: boolean
  onSelect: (key: string) => void
}) {
  return (
    <button
      aria-controls={`class-panel-${tab.key}`}
      aria-selected={isSelected}
      className="group relative flex h-11 shrink-0 cursor-(--cursor-interactive) items-center gap-2 rounded-full border border-default px-4 text-sm font-medium text-muted transition-colors hover:text-foreground data-[selected=true]:border-transparent data-[selected=true]:text-foreground"
      data-selected={isSelected}
      role="tab"
      tabIndex={isSelected ? 0 : -1}
      type="button"
      onClick={() => onSelect(tab.key)}
    >
      {isSelected ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-surface shadow-surface"
          layoutId="course-class-pill"
          transition={{ duration: 0.28, ease: easing }}
        />
      ) : null}
      <span className="relative flex items-center gap-2">
        {tab.isUnarchived ? (
          <Archive className="size-4 shrink-0" />
        ) : (
          <Person className="size-4 shrink-0" />
        )}
        <span className="whitespace-nowrap">{tab.label}</span>
        <span
          className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums transition-colors ${
            isSelected
              ? 'bg-accent-soft text-accent'
              : 'bg-default text-muted group-hover:bg-default/80'
          }`}
        >
          {tab.count}
        </span>
      </span>
    </button>
  )
}

function ClassTabs({
  selectedKey,
  tabs,
  onSelect,
}: {
  selectedKey: string | null
  tabs: ClassTab[]
  onSelect: (key: string) => void
}) {
  const unarchivedTab = tabs.find((t) => t.isUnarchived) ?? null
  const classOnlyTabs = tabs.filter((t) => !t.isUnarchived)

  const overflow = classOnlyTabs.length > VISIBLE_CLASS_LIMIT
  const visibleClassTabs = overflow
    ? classOnlyTabs.slice(0, VISIBLE_CLASS_LIMIT)
    : classOnlyTabs
  const visibleKeys = new Set(visibleClassTabs.map((t) => t.key))
  const hiddenSelectedTab =
    overflow && selectedKey && !visibleKeys.has(selectedKey)
      ? classOnlyTabs.find((t) => t.key === selectedKey) ?? null
      : null

  return (
    <div
      aria-label="教学班选择"
      className="-mx-4 flex flex-row items-center gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]"
      role="tablist"
    >
      {unarchivedTab ? (
        <ClassPill
          key={unarchivedTab.key}
          isSelected={unarchivedTab.key === selectedKey}
          tab={unarchivedTab}
          onSelect={onSelect}
        />
      ) : null}

      {unarchivedTab && classOnlyTabs.length > 0 ? (
        <Separator
          aria-hidden
          className="mx-1 h-6 w-px shrink-0 self-center bg-default"
          orientation="vertical"
        />
      ) : null}

      {visibleClassTabs.map((tab) => (
        <ClassPill
          key={tab.key}
          isSelected={tab.key === selectedKey}
          tab={tab}
          onSelect={onSelect}
        />
      ))}

      {hiddenSelectedTab ? (
        <ClassPill
          key={hiddenSelectedTab.key}
          isSelected
          tab={hiddenSelectedTab}
          onSelect={onSelect}
        />
      ) : null}

      {overflow ? (
        <MoreClassesPopover
          classes={classOnlyTabs}
          selectedKey={selectedKey}
          visibleKeys={visibleKeys}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  )
}

function MoreClassesPopover({
  classes,
  selectedKey,
  visibleKeys,
  onSelect,
}: {
  classes: ClassTab[]
  selectedKey: string | null
  visibleKeys: Set<string>
  onSelect: (key: string) => void
}) {
  const [isOpen, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const hiddenCount = classes.filter((c) => !visibleKeys.has(c.key)).length
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return classes
    return classes.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.sublabel?.toLowerCase().includes(q) ?? false),
    )
  }, [classes, query])

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <Popover.Trigger>
        <button
          aria-label={`查看全部 ${classes.length} 个教学班`}
          className="group flex h-11 shrink-0 cursor-(--cursor-interactive) items-center gap-1.5 rounded-full border border-default px-4 text-sm font-medium text-muted transition-colors hover:border-accent/40 hover:text-foreground data-[pressed=true]:bg-surface-secondary"
          type="button"
        >
          <span className="whitespace-nowrap">更多</span>
          <span className="rounded-full bg-default px-1.5 py-0.5 text-[11px] leading-none tabular-nums text-muted">
            {hiddenCount}
          </span>
          <ChevronDown
            aria-hidden
            className="size-3.5 shrink-0 transition-transform duration-200 group-data-[pressed=true]:rotate-180"
          />
        </button>
      </Popover.Trigger>
      <Popover.Content className="w-[min(320px,calc(100vw-2rem))]">
        <Popover.Dialog className="flex flex-col gap-3 p-3">
          <SearchField
            aria-label="搜索教学班"
            autoFocus
            name="class-search"
            value={query}
            onChange={setQuery}
          >
            <Label className="sr-only">搜索教学班</Label>
            <SearchField.Group className="h-9 rounded-xl">
              <SearchField.SearchIcon className="ml-3 size-4" />
              <SearchField.Input
                className="w-full min-w-0 px-2 text-sm"
                placeholder="按教师或院系搜索"
              />
              <SearchField.ClearButton className="mr-1.5" />
            </SearchField.Group>
          </SearchField>

          <div className="-mx-1 max-h-72 overflow-y-auto px-1 [scrollbar-width:thin]">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted">
                未找到匹配的教学班
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filtered.map((tab) => {
                  const isSelected = tab.key === selectedKey
                  return (
                    <li key={tab.key}>
                      <button
                        aria-pressed={isSelected}
                        className="group flex w-full cursor-(--cursor-interactive) items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-secondary aria-pressed:bg-surface-secondary aria-pressed:shadow-surface"
                        type="button"
                        onClick={() => {
                          onSelect(tab.key)
                          setOpen(false)
                          setQuery('')
                        }}
                      >
                        <Person
                          aria-hidden
                          className={`size-4 shrink-0 ${
                            isSelected ? 'text-accent' : 'text-muted'
                          }`}
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span
                            className={`truncate text-sm leading-tight ${
                              isSelected ? 'font-semibold text-foreground' : 'text-foreground'
                            }`}
                          >
                            {tab.label}
                          </span>
                          {tab.sublabel ? (
                            <span className="truncate text-xs text-muted">
                              {tab.sublabel}
                            </span>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-default px-1.5 py-0.5 text-[11px] leading-none tabular-nums text-muted">
                          {tab.count}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}

function MaterialsPanel({
  tab,
  sortKey,
  selectedTypeIds,
  freeOnly,
  searchQuery,
  onSortChange,
  onTypeChange,
  onFreeOnlyChange,
  onSearchChange,
  onMaterialOpen,
}: {
  tab: ClassTab
  sortKey: SortKey
  selectedTypeIds: Key[]
  freeOnly: boolean
  searchQuery: string
  onSortChange: (key: SortKey) => void
  onTypeChange: (ids: Key[]) => void
  onFreeOnlyChange: (next: boolean) => void
  onSearchChange: (next: string) => void
  onMaterialOpen: (id: number) => void
}) {
  const [page, setPage] = useState(1)
  const [trackedKey, setTrackedKey] = useState(tab.key)

  if (trackedKey !== tab.key) {
    setTrackedKey(tab.key)
    setPage(1)
  }

  const availableTypes = useMemo(() => {
    const map = new Map<number, MaterialType>()
    for (const m of tab.materials) {
      if (m.material_type) map.set(m.material_type.id, m.material_type)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }, [tab.materials])

  const hasFreeMix = useMemo(() => {
    let hasFree = false
    let hasPaid = false
    for (const m of tab.materials) {
      if (m.points > 0) hasPaid = true
      else hasFree = true
      if (hasFree && hasPaid) return true
    }
    return false
  }, [tab.materials])

  const trimmedQuery = searchQuery.trim()

  const processed = useMemo(() => {
    let result = tab.materials
    if (selectedTypeIds.length > 0) {
      const ids = new Set(selectedTypeIds.map(String))
      result = result.filter(
        (m) => m.material_type && ids.has(String(m.material_type.id)),
      )
    }
    if (freeOnly) {
      result = result.filter((m) => m.points === 0)
    }
    if (trimmedQuery) {
      const q = trimmedQuery.toLowerCase()
      result = result.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.file_name?.toLowerCase().includes(q),
      )
    }
    return sortMaterials(result, sortKey)
  }, [tab.materials, selectedTypeIds, freeOnly, trimmedQuery, sortKey])

  const filterDeps = `${[...selectedTypeIds].map(String).sort().join(',')}|${freeOnly}|${trimmedQuery}|${sortKey}`
  const [trackedFilters, setTrackedFilters] = useState(filterDeps)
  if (trackedFilters !== filterDeps) {
    setTrackedFilters(filterDeps)
    setPage(1)
  }

  const hasActiveFilters = selectedTypeIds.length > 0 || freeOnly || trimmedQuery.length > 0
  const clearFilters = () => {
    onTypeChange([])
    onFreeOnlyChange(false)
    onSearchChange('')
  }

  const totalPages = Math.max(1, Math.ceil(processed.length / MATERIALS_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * MATERIALS_PAGE_SIZE
  const end = start + MATERIALS_PAGE_SIZE
  const pageMaterials = processed.slice(start, end)

  const showToolbar = availableTypes.length > 1 || hasFreeMix || tab.materials.length > 1

  return (
    <div
      aria-label={`${tab.label} 资料列表`}
      className="flex flex-col gap-4"
      id={`class-panel-${tab.key}`}
      role="tabpanel"
    >
      {showToolbar ? (
        <MaterialsToolbar
          availableTypes={availableTypes}
          freeOnly={freeOnly}
          hasActiveFilters={hasActiveFilters}
          hasFreeMix={hasFreeMix}
          searchQuery={searchQuery}
          selectedTypeIds={selectedTypeIds}
          sortKey={sortKey}
          onClearFilters={clearFilters}
          onFreeOnlyChange={onFreeOnlyChange}
          onSearchChange={onSearchChange}
          onSortChange={onSortChange}
          onTypeChange={onTypeChange}
        />
      ) : null}

      <AnimatePresence initial={false} mode="wait">
        {tab.materials.length === 0 ? (
          <motion.div
            key={`${tab.key}-empty`}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: easing }}
          >
            <EmptyState
              description={
                tab.isUnarchived
                  ? '没有未归档的资料。所有资料都已分配给具体的教学班。'
                  : '该教学班暂未上传资料，欢迎成为第一个分享者。'
              }
              title="暂无资料"
            />
          </motion.div>
        ) : processed.length === 0 ? (
          <motion.div
            key={`${tab.key}-${filterDeps}-filtered-empty`}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: easing }}
          >
            <EmptyFilterState onClear={clearFilters} />
          </motion.div>
        ) : (
          <motion.div
            key={`${tab.key}-${filterDeps}-${safePage}`}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
            exit={{ opacity: 0, y: -4, transition: { duration: 0.15, ease: easing } }}
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: easing }}
          >
            <motion.div
              animate="visible"
              className="grid gap-3 sm:grid-cols-2"
              initial="hidden"
              variants={listContainerVariants}
            >
              {pageMaterials.map((material) => (
                <motion.div key={material.id} variants={listItemVariants}>
                  <MaterialCard
                    material={material}
                    onOpen={() => onMaterialOpen(material.id)}
                  />
                </motion.div>
              ))}
            </motion.div>

            {processed.length > MATERIALS_PAGE_SIZE ? (
              <MaterialsPagination
                page={safePage}
                rangeEnd={Math.min(end, processed.length)}
                rangeStart={start + 1}
                total={processed.length}
                totalLabel={
                  hasActiveFilters && processed.length !== tab.materials.length
                    ? `共 ${processed.length} / ${tab.materials.length} 份`
                    : undefined
                }
                totalPages={totalPages}
                onChange={setPage}
              />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MaterialsToolbar({
  availableTypes,
  selectedTypeIds,
  onTypeChange,
  freeOnly,
  onFreeOnlyChange,
  hasFreeMix,
  searchQuery,
  onSearchChange,
  sortKey,
  onSortChange,
  hasActiveFilters,
  onClearFilters,
}: {
  availableTypes: MaterialType[]
  selectedTypeIds: Key[]
  onTypeChange: (ids: Key[]) => void
  freeOnly: boolean
  onFreeOnlyChange: (next: boolean) => void
  hasFreeMix: boolean
  searchQuery: string
  onSearchChange: (next: string) => void
  sortKey: SortKey
  onSortChange: (key: SortKey) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchField
        aria-label="搜索资料名称"
        className="min-w-0 basis-full sm:basis-64"
        name="material-search"
        value={searchQuery}
        onChange={onSearchChange}
      >
        <Label className="sr-only">搜索资料名称</Label>
        <SearchField.Group className="h-9 rounded-full">
          <SearchField.SearchIcon className="ml-3 size-3.5" />
          <SearchField.Input
            className="w-full min-w-0 px-2 text-sm"
            placeholder="搜索资料名称"
          />
          <SearchField.ClearButton className="mr-1.5" />
        </SearchField.Group>
      </SearchField>

      {availableTypes.length > 1 ? (
        <Select
          aria-label="按材料类型筛选"
          className="w-auto"
          placeholder="材料类型"
          selectionMode="multiple"
          value={selectedTypeIds}
          variant="secondary"
          onChange={(value) => onTypeChange(value as Key[])}
        >
          <Select.Trigger className="h-9 items-center gap-1.5 rounded-full pl-3 text-sm">
            <Funnel
              aria-hidden
              className={`size-3.5 shrink-0 self-center ${
                selectedTypeIds.length > 0 ? 'text-accent' : 'text-muted'
              }`}
            />
            <Select.Value className="text-sm">
              {({ selectedItems }) =>
                selectedItems.length > 0 ? (
                  <span className="flex items-center gap-1.5 text-sm">
                    <span>类型</span>
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] leading-none tabular-nums text-accent">
                      {selectedItems.length}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm">类型</span>
                )
              }
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox selectionMode="multiple">
              {availableTypes.map((type) => (
                <ListBox.Item
                  key={type.id}
                  id={String(type.id)}
                  textValue={type.name}
                >
                  {type.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      ) : null}

      {hasFreeMix ? (
        <ToggleButton
          aria-label="只看免费资料"
          className="h-9 rounded-full px-3 text-sm"
          isSelected={freeOnly}
          size="sm"
          onChange={onFreeOnlyChange}
        >
          仅免费
        </ToggleButton>
      ) : null}

      {hasActiveFilters ? (
        <Button
          aria-label="清除全部筛选"
          className="h-9 rounded-full px-3 text-sm"
          size="sm"
          variant="ghost"
          onPress={onClearFilters}
        >
          <Xmark className="size-3.5" />
          清除筛选
        </Button>
      ) : null}

      <Select
        aria-label="排序方式"
        className="ml-auto w-auto"
        value={sortKey}
        variant="secondary"
        onChange={(value) => onSortChange(value as SortKey)}
      >
        <Select.Trigger className="h-9 items-center gap-1.5 rounded-full pl-3 text-sm">
          <BarsAscendingAlignLeftArrowDown
            aria-hidden
            className="size-3.5 shrink-0 self-center text-muted"
          />
          <Select.Value className="text-sm">
            {({ defaultChildren }) => (
              <span className="flex items-center gap-1 text-sm">
                <span className="text-muted">排序：</span>
                {defaultChildren}
              </span>
            )}
          </Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {SORT_OPTIONS.map((opt) => (
              <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                {opt.label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  )
}

function EmptyFilterState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-default px-6 py-12 text-center">
      <div
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-surface text-muted"
      >
        <Funnel className="size-5" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-sm font-semibold text-foreground">没有匹配的资料</h3>
        <p className="max-w-sm text-xs text-muted sm:text-sm">
          调整筛选条件或排序后再试。
        </p>
      </div>
      <Button size="sm" variant="ghost" onPress={onClear}>
        <Xmark className="size-3.5" />
        清除筛选
      </Button>
    </div>
  )
}

function MaterialsPagination({
  page,
  totalPages,
  total,
  rangeStart,
  rangeEnd,
  totalLabel,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  rangeStart: number
  rangeEnd: number
  totalLabel?: string
  onChange: (page: number) => void
}) {
  const pages = useMemo(() => {
    const result: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) result.push(i)
      return result
    }
    result.push(1)
    if (page > 3) result.push('ellipsis')
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) result.push(i)
    if (page < totalPages - 2) result.push('ellipsis')
    result.push(totalPages)
    return result
  }, [page, totalPages])

  return (
    <Pagination className="flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <Pagination.Summary>
        {totalLabel ? (
          <span className="text-muted">{totalLabel} · </span>
        ) : null}
        <span className="tabular-nums">
          {rangeStart}–{rangeEnd}
        </span>
        {totalLabel ? null : (
          <>
            <span className="text-muted"> / 共 </span>
            <span className="tabular-nums">{total}</span>
            <span className="text-muted"> 份</span>
          </>
        )}
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            isDisabled={page === 1}
            onPress={() => onChange(Math.max(1, page - 1))}
          >
            <Pagination.PreviousIcon />
            <span className="hidden sm:inline">上一页</span>
          </Pagination.Previous>
        </Pagination.Item>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <Pagination.Item key={`ellipsis-${i}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={p}>
              <Pagination.Link isActive={p === page} onPress={() => onChange(p)}>
                {p}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next
            isDisabled={page === totalPages}
            onPress={() => onChange(Math.min(totalPages, page + 1))}
          >
            <span className="hidden sm:inline">下一页</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  )
}

function MaterialCard({
  material,
  onOpen,
}: {
  material: Material
  onOpen: () => void
}) {
  return (
    <Card
      aria-label={`查看 ${material.name || material.file_name || '资料'} 详情`}
      className="group h-full cursor-(--cursor-interactive) text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Card.Header className="flex-row items-start gap-3">
        <div
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-muted"
        >
          <File className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Card.Title className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
            {material.name || material.file_name || '未命名资料'}
          </Card.Title>
          <div className="flex flex-wrap items-center gap-1.5">
            {material.material_type?.name ? (
              <Chip size="sm" variant="soft">
                <Chip.Label>{material.material_type.name}</Chip.Label>
              </Chip>
            ) : null}
            {material.points > 0 ? (
              <Chip color="warning" size="sm" variant="soft">
                <CircleDollar className="size-3" />
                <Chip.Label className="tabular-nums">{material.points} 积分</Chip.Label>
              </Chip>
            ) : (
              <Chip color="success" size="sm" variant="soft">
                <Chip.Label>免费</Chip.Label>
              </Chip>
            )}
          </div>
        </div>
      </Card.Header>

      {material.description ? (
        <Card.Content>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">
            {material.description}
          </p>
        </Card.Content>
      ) : null}

      <Card.Footer className="mt-auto flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex items-center gap-3">
          <span
            aria-label={`${material.purchase_count} 次购买`}
            className="flex items-center gap-1 tabular-nums"
          >
            <ShoppingCart className="size-3.5" />
            {material.purchase_count}
          </span>
          <span aria-hidden className="text-muted/60">
            ·
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatDate(material.created_at)}
          </span>
        </div>
        {material.like_count > 0 || material.hate_count > 0 ? (
          <span
            aria-label={`${material.like_count} 个赞`}
            className="flex items-center gap-1 tabular-nums"
          >
            <Heart className="size-3.5" />
            {material.like_count}
          </span>
        ) : null}
      </Card.Footer>
    </Card>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-default px-6 py-16 text-center">
      <div
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-surface text-muted"
      >
        <File className="size-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-xs text-muted sm:text-sm">{description}</p>
    </div>
  )
}

function CourseSkeleton() {
  return (
    <motion.div
      key="skeleton"
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
      initial={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex flex-col gap-4 rounded-3xl border border-default bg-surface-secondary px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-9 w-3/5 rounded-xl" />
          <Skeleton className="h-4 w-2/5 rounded-md" />
        </div>
        <div className="mt-2 flex">
          <Skeleton className="h-14 w-full rounded-xl sm:w-36" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 w-32 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    </motion.div>
  )
}
