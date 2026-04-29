import { ChartLine } from '@gravity-ui/icons'
import { Spinner } from '@heroui/react'
import { DataGrid, type DataGridColumn, type DataGridSortDescriptor } from '@heroui-pro/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getUserPointLogs, type PointLogSortBy, type PointLogSortOrder } from '../../api/user'
import { useAuth } from '../../auth/use-auth'
import type { PointLog } from '../../types/user'
import { USER_POINT_LOGS_PAGE_SIZE } from './constants'
import {
  EmptyPanel,
  ErrorPanel,
  UserPagination,
} from './shared'
import { cx, formatDateTime, getMaterialLink, isAbortError } from './utils'

interface PointLogRow extends PointLog {
  dateText: string
  hasMaterial: boolean
  materialLink: string | null
  materialName: string
}

const POINT_LOG_COLUMN_CLASSES = {
  message: 'w-[20%]',
  delta: 'w-[10%]',
  date: 'w-[24%]',
  material: 'w-[46%]',
} as const
const POINT_LOG_COLUMN_CLASS = 'overflow-hidden whitespace-nowrap'
const POINT_LOG_TEXT_CLASS = 'block min-w-0 max-w-full truncate'

function getPointLogColumnClassNames(widthClassName: string, cellClassName?: string) {
  return {
    headerClassName: cx(POINT_LOG_COLUMN_CLASS, widthClassName),
    cellClassName: cx(POINT_LOG_COLUMN_CLASS, widthClassName, cellClassName),
  }
}

function getMaterialName(log: PointLog): string | null {
  return log.material?.name || log.material?.file_name || null
}

function PointDeltaText({ delta }: { delta: number }) {
  const deltaText = `${delta > 0 ? '+' : ''}${delta}`

  return (
    <span
      className={cx(
        POINT_LOG_TEXT_CLASS,
        'font-medium tabular-nums',
        delta == 0 ? 'text-muted' : (delta > 0 ? 'text-success' : 'text-danger'),
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

function PointLogsLoadingBadge() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-surface/95 px-3 py-2 text-sm text-muted shadow-surface">
      <Spinner size="sm" />
      <span>正在读取积分日志</span>
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

function getPointLogSortOrder(
  direction: DataGridSortDescriptor['direction'],
): PointLogSortOrder {
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
  const [sortDescriptor, setSortDescriptor] = useState<DataGridSortDescriptor>({
    column: 'date',
    direction: 'descending',
  })
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
  const handlePageChange = useCallback((nextPage: number) => {
    if (nextPage === page) return

    setLoading(true)
    setPage(nextPage)
  }, [page])

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
  }, [page, reloadKey, sortBy, sortOrder, token])

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
      <p className="text-sm text-muted">
        共 <span className="font-medium tabular-nums text-foreground">{total}</span> 条记录
      </p>

      {shouldShowTable ? (
        <div className="relative">
          <DataGrid
            aria-label="积分变动日志"
            className={cx(isLoading && rows.length > 0 && '[&_.table__body]:opacity-0')}
            columns={columns}
            contentClassName="table-fixed"
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
          description="积分收支记录会显示在这里。"
          icon={ChartLine}
          title="暂无积分日志"
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
