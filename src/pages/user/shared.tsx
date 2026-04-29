import { Button, Pagination, Spinner } from '@heroui/react'
import { EmptyState } from '@heroui-pro/react'
import { motion } from 'motion/react'
import { useMemo, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { USER_CENTER_PAGE_SIZE } from './constants'
import { listContainerVariants, listItemVariants } from './animation'

export function MotionStagger({
  children,
  className,
  motionKey,
}: {
  children: ReactNode
  className?: string
  motionKey?: string | number
}) {
  return (
    <motion.div
      key={motionKey}
      animate="visible"
      className={className}
      initial="hidden"
      variants={listContainerVariants}
    >
      {children}
    </motion.div>
  )
}

export function MotionItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={listItemVariants}>
      {children}
    </motion.div>
  )
}

function getPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
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

export function UserPagination({
  label,
  page,
  pageSize = USER_CENTER_PAGE_SIZE,
  total,
  totalPages,
  onChange,
}: {
  label: string
  onChange: (page: number) => void
  page: number
  pageSize?: number
  total: number
  totalPages: number
}) {
  const pages = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages])
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <Pagination className="flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <Pagination.Summary>
        <span className="tabular-nums">
          {label} · {rangeStart}–{rangeEnd} / 共 {total} 条
        </span>
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
        {pages.map((item, index) =>
          item === 'ellipsis' ? (
            <Pagination.Item key={`ellipsis-${index}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={item}>
              <Pagination.Link isActive={item === page} onPress={() => onChange(item)}>
                {item}
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

export function LoadingState({ label }: { label: string }) {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="flex min-h-60 flex-col items-center justify-center gap-3 text-sm text-muted"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <Spinner size="sm" />
      <motion.span
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
      >
        {label}
      </motion.span>
    </motion.div>
  )
}

export function ErrorPanel({
  actionLabel,
  message,
  onAction,
}: {
  actionLabel: string
  message: string
  onAction: () => void
}) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-danger">{message}</p>
        <Button size="sm" variant="outline" onPress={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}

export function EmptyPanel({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/70">
      <EmptyState className="py-12">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <Icon className="size-5" />
          </EmptyState.Media>
          <EmptyState.Title>{title}</EmptyState.Title>
          <EmptyState.Description>{description}</EmptyState.Description>
        </EmptyState.Header>
        {action ? <EmptyState.Content>{action}</EmptyState.Content> : null}
      </EmptyState>
    </div>
  )
}
