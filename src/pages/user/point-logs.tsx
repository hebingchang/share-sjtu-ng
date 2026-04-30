import { ChartLine, Funnel } from '@gravity-ui/icons'
import { Label, ListBox, Select, Spinner, Tooltip, type Key } from '@heroui/react'
import { DataGrid, type DataGridColumn, type DataGridSortDescriptor } from '@heroui-pro/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getUserPointLogs, type PointLogSortBy, type PointLogSortOrder } from '../../api/user'
import { useAuth } from '../../auth/use-auth'
import type { PointLog, PointLogType } from '../../types/user'
import { USER_POINT_LOGS_PAGE_SIZE } from './constants'
import { EmptyPanel, ErrorPanel, UserPagination } from './shared'
import { cx, formatDateTime, getMaterialLink, isAbortError } from './utils'

interface PointLogRow extends PointLog {
  dateText: string
  hasMaterial: boolean
  materialLink: string | null
  materialName: string
  typeText: string
}

const POINT_LOG_COLUMN_CLASSES = {
  message: 'w-[22%]',
  type: 'w-[13%]',
  delta: 'w-[10%]',
  date: 'w-[22%]',
  material: 'w-[33%]',
} as const
const POINT_LOG_COLUMN_CLASS = 'overflow-hidden whitespace-nowrap'
const POINT_LOG_TEXT_CLASS = 'block min-w-0 max-w-full truncate'
const POINT_LOG_TYPE_FILTER_ALL = 'all'
type PointLogTypeFilter = PointLogType | typeof POINT_LOG_TYPE_FILTER_ALL

const POINT_LOG_TYPE_LABELS: Record<PointLogType, string> = {
  bonus: '奖励',
  materials: '资料',
  redeem: '兑换',
  transfer: '转账',
}
const POINT_LOG_TYPE_OPTIONS: { id: PointLogTypeFilter; label: string }[] = [
  { id: POINT_LOG_TYPE_FILTER_ALL, label: '全部类型' },
  { id: 'materials', label: POINT_LOG_TYPE_LABELS.materials },
  { id: 'redeem', label: POINT_LOG_TYPE_LABELS.redeem },
  { id: 'bonus', label: POINT_LOG_TYPE_LABELS.bonus },
  { id: 'transfer', label: POINT_LOG_TYPE_LABELS.transfer },
]

function getPointLogColumnClassNames(widthClassName: string, cellClassName?: string) {
  return {
    headerClassName: cx(POINT_LOG_COLUMN_CLASS, widthClassName),
    cellClassName: cx(POINT_LOG_COLUMN_CLASS, widthClassName, cellClassName),
  }
}

function getMaterialName(log: PointLog): string | null {
  return log.material?.name || log.material?.file_name || null
}

function isPointLogType(value: unknown): value is PointLogType {
  return typeof value === 'string' && value in POINT_LOG_TYPE_LABELS
}

function getPointLogTypeLabel(value: unknown): string {
  return isPointLogType(value) ? POINT_LOG_TYPE_LABELS[value] : '其他'
}

function getPointLogTypeFilter(value: Key | null): PointLogTypeFilter {
  const nextValue = String(value ?? POINT_LOG_TYPE_FILTER_ALL)

  return isPointLogType(nextValue) ? nextValue : POINT_LOG_TYPE_FILTER_ALL
}

function PointDeltaText({ delta }: { delta: number }) {
  const deltaText = `${delta > 0 ? '+' : ''}${delta}`

  return (
    <span
      className={cx(
        POINT_LOG_TEXT_CLASS,
        'font-medium tabular-nums',
        delta == 0 ? 'text-muted' : delta > 0 ? 'text-success' : 'text-danger',
      )}
      title={deltaText}
    >
      {deltaText}
    </span>
  )
}

function PointLogMaterialCell({ log }: { log: PointLogRow }) {
  if (!log.hasMaterial) {
    return (
      <span className={cx(POINT_LOG_TEXT_CLASS, 'text-muted')} title={log.materialName}>
        {log.materialName}
      </span>
    )
  }

  if (!log.material?.id) {
    return (
      <Tooltip delay={0}>
        <Tooltip.Trigger
          aria-label={`${log.materialName}，资料已被删除`}
          className={cx(
            POINT_LOG_TEXT_CLASS,
            'cursor-help text-foreground outline-none underline-offset-4 decoration-dotted hover:underline focus-visible:underline',
          )}
          tabIndex={0}
        >
          {log.materialName}
        </Tooltip.Trigger>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <p>资料已被删除</p>
        </Tooltip.Content>
      </Tooltip>
    )
  }

  if (!log.materialLink) {
    return (
      <span className={cx(POINT_LOG_TEXT_CLASS, 'text-foreground')} title={log.materialName}>
        {log.materialName}
      </span>
    )
  }

  return (
    <Link
      className={cx(
        POINT_LOG_TEXT_CLASS,
        'font-medium text-foreground underline-offset-4 hover:underline',
      )}
      title={log.materialName}
      to={log.materialLink}
    >
      {log.materialName}
    </Link>
  )
}

function PointLogTypeCell({ log }: { log: PointLogRow }) {
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full bg-surface-secondary px-2 py-0.5 text-xs font-medium text-muted"
      title={log.type}
    >
      <span className={POINT_LOG_TEXT_CLASS}>{log.typeText}</span>
    </span>
  )
}

function PointLogsLoadingBadge() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-surface/95 px-3 py-2 text-sm text-muted shadow-surface">
      <Spinner size="sm" />
      <span>正在加载积分日志</span>
    </div>
  )
}

function PointLogsTableLoadingState() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <PointLogsLoadingBadge />
    </div>
  )
}

function getPointLogSortBy(column: DataGridSortDescriptor['column']): PointLogSortBy {
  return column === 'delta' ? 'delta' : 'date'
}

function getPointLogSortOrder(direction: DataGridSortDescriptor['direction']): PointLogSortOrder {
  return direction === 'ascending' ? 'asc' : 'desc'
}

export function PointLogsView() {
  const { token } = useAuth()
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<PointLog[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [typeFilter, setTypeFilter] = useState<PointLogTypeFilter>(POINT_LOG_TYPE_FILTER_ALL)
  const [sortDescriptor, setSortDescriptor] = useState<DataGridSortDescriptor>({
    column: 'date',
    direction: 'descending',
  })
  const hasTypeFilter = typeFilter !== POINT_LOG_TYPE_FILTER_ALL
  const sortBy = getPointLogSortBy(sortDescriptor.column)
  const sortOrder = getPointLogSortOrder(sortDescriptor.direction)
  const totalPages = Math.max(1, Math.ceil(total / USER_POINT_LOGS_PAGE_SIZE))
  const shouldShowTable = isLoading || logs.length > 0
  const rows = useMemo<PointLogRow[]>(
    () =>
      logs.map((log) => ({
        ...log,
        dateText: formatDateTime(log.date),
        hasMaterial: !!getMaterialName(log),
        materialLink: getMaterialLink(log.material ?? null),
        materialName: getMaterialName(log) ?? '无关联资料',
        typeText: getPointLogTypeLabel(log.type),
      })),
    [logs],
  )
  const columns = useMemo<DataGridColumn<PointLogRow>[]>(
    () => [
      {
        id: 'message',
        header: '变动说明',
        accessorKey: 'message',
        isRowHeader: true,
        ...getPointLogColumnClassNames(POINT_LOG_COLUMN_CLASSES.message),
        cell: (log) => (
          <span
            className={cx(POINT_LOG_TEXT_CLASS, 'font-medium text-foreground')}
            title={log.message || '积分变动'}
          >
            {log.message || '积分变动'}
          </span>
        ),
      },
      {
        id: 'type',
        header: '类型',
        accessorKey: 'typeText',
        ...getPointLogColumnClassNames(POINT_LOG_COLUMN_CLASSES.type),
        cell: (log) => <PointLogTypeCell log={log} />,
      },
      {
        id: 'delta',
        header: '积分',
        accessorKey: 'delta',
        align: 'end',
        allowsSorting: true,
        ...getPointLogColumnClassNames(POINT_LOG_COLUMN_CLASSES.delta),
        cell: (log) => <PointDeltaText delta={log.delta} />,
      },
      {
        id: 'date',
        header: '时间',
        accessorKey: 'dateText',
        allowsSorting: true,
        ...getPointLogColumnClassNames(POINT_LOG_COLUMN_CLASSES.date),
        cell: (log) => (
          <span
            className={cx(POINT_LOG_TEXT_CLASS, 'text-muted tabular-nums')}
            title={log.dateText}
          >
            {log.dateText}
          </span>
        ),
      },
      {
        id: 'material',
        header: '关联资料',
        accessorKey: 'materialName',
        ...getPointLogColumnClassNames(POINT_LOG_COLUMN_CLASSES.material),
        cell: (log) => <PointLogMaterialCell log={log} />,
      },
    ],
    [],
  )
  const handleSortChange = useCallback(
    (nextSortDescriptor: DataGridSortDescriptor) => {
      const isSameSort =
        nextSortDescriptor.column === sortDescriptor.column &&
        nextSortDescriptor.direction === sortDescriptor.direction

      if (isSameSort && page === 1) return

      setLoading(true)
      setSortDescriptor(nextSortDescriptor)
      setPage(1)
    },
    [page, sortDescriptor.column, sortDescriptor.direction],
  )
  const handleTypeFilterChange = useCallback(
    (nextValue: Key | null) => {
      const nextTypeFilter = getPointLogTypeFilter(nextValue)
      if (nextTypeFilter === typeFilter && page === 1) return

      setLoading(true)
      setTypeFilter(nextTypeFilter)
      setPage(1)
    },
    [page, typeFilter],
  )
  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage === page) return

      setLoading(true)
      setPage(nextPage)
    },
    [page],
  )

  useEffect(() => {
    if (!token) return

    const authToken = token
    const controller = new AbortController()

    async function loadLogs() {
      let shouldKeepLoading = false

      setLoading(true)
      setError(null)

      try {
        const data = await getUserPointLogs({
          page,
          pageSize: USER_POINT_LOGS_PAGE_SIZE,
          signal: controller.signal,
          sortBy,
          sortOrder,
          token: authToken,
          type: hasTypeFilter ? typeFilter : undefined,
        })
        if (controller.signal.aborted) return
        const nextTotal = data.count ?? 0
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / USER_POINT_LOGS_PAGE_SIZE))
        if (page > nextTotalPages) {
          shouldKeepLoading = true
          setPage(nextTotalPages)
          return
        }
        setLogs(data.records ?? [])
        setTotal(nextTotal)
      } catch (err) {
        if (isAbortError(err)) return
        setLogs([])
        setTotal(0)
        setError(err instanceof Error ? err.message : '获取积分日志失败')
      } finally {
        if (!controller.signal.aborted && !shouldKeepLoading) setLoading(false)
      }
    }

    void loadLogs()

    return () => controller.abort()
  }, [hasTypeFilter, page, reloadKey, sortBy, sortOrder, token, typeFilter])

  if (error) {
    return (
      <ErrorPanel
        actionLabel="重试"
        message={error}
        onAction={() => setReloadKey((key) => key + 1)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          共 <span className="font-medium tabular-nums text-foreground">{total}</span> 条记录
        </p>

        <Select
          aria-label="按积分日志类型筛选"
          className="w-full sm:w-auto"
          value={typeFilter}
          variant="secondary"
          onChange={handleTypeFilterChange}
        >
          <Label className="sr-only">积分日志类型</Label>
          <Select.Trigger className="h-9 items-center gap-1.5 rounded-full pl-3 text-sm">
            <Funnel
              aria-hidden
              className={cx(
                'size-3.5 shrink-0 self-center',
                hasTypeFilter ? 'text-accent' : 'text-muted',
              )}
            />
            <Select.Value className="text-sm">
              {({ defaultChildren }) => (
                <span className="flex min-w-0 items-center gap-1 text-sm">
                  <span className="shrink-0 text-muted">类型：</span>
                  <span className="min-w-0 truncate">{defaultChildren}</span>
                </span>
              )}
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {POINT_LOG_TYPE_OPTIONS.map((option) => (
                <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {shouldShowTable ? (
        <div className="relative">
          <DataGrid
            aria-label="积分变动日志"
            className={cx(isLoading && rows.length > 0 && '[&_.table__body]:opacity-0')}
            columns={columns}
            contentClassName="min-w-[720px] table-fixed"
            data={rows}
            getRowId={(log) => log.id}
            renderEmptyState={() => <PointLogsTableLoadingState />}
            sortDescriptor={sortDescriptor}
            variant="primary"
            onSortChange={handleSortChange}
          />
          {isLoading && rows.length > 0 ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <PointLogsLoadingBadge />
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyPanel
          description={
            hasTypeFilter ? '当前类型下的积分收支记录会显示在这里。' : '积分收支记录会显示在这里。'
          }
          icon={ChartLine}
          title={hasTypeFilter ? '暂无该类型日志' : '暂无积分日志'}
        />
      )}

      {totalPages > 1 ? (
        <UserPagination
          label="积分日志"
          page={page}
          pageSize={USER_POINT_LOGS_PAGE_SIZE}
          total={total}
          totalPages={totalPages}
          onChange={handlePageChange}
        />
      ) : null}
    </div>
  )
}
