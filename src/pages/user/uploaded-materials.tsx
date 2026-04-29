import { Clock, FilePlus, FileText, ShoppingCart } from '@gravity-ui/icons'
import { Card } from '@heroui/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getUserUploadMaterials } from '../../api/user'
import { useAuth } from '../../auth/use-auth'
import type { Material } from '../../types/material'
import { USER_CENTER_PAGE_SIZE } from './constants'
import {
  EmptyPanel,
  ErrorPanel,
  LoadingState,
  MotionItem,
  PaginatedListTransition,
  UserPagination,
} from './shared'
import { formatDateTime, formatFileSize, getMaterialLink, isAbortError } from './utils'

const UPLOADED_MATERIALS_TITLE = '我上传的资料'

function getTotalPages(total: number): number {
  return Math.max(1, Math.ceil(total / USER_CENTER_PAGE_SIZE))
}

function getUploadedMaterialTitle(material: Material): string {
  return material.name || material.file_name || `资料 #${material.id}`
}

function getUploadedMaterialSubtitle(material: Material): string {
  const courseName = material.course?.name ?? material.class?.course?.name
  const teacherName = material.class?.teacher?.name

  return [courseName, teacherName].filter(Boolean).join(' · ') || '课程信息暂缺'
}

function UploadedMaterialItem({ material }: { material: Material }) {
  const link = getMaterialLink(material)
  const size = formatFileSize(material.size)
  const title = getUploadedMaterialTitle(material)

  return (
    <Card className="border border-border/70 bg-surface/80">
      <Card.Content className="gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-muted">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {link ? (
                <Link
                  className="min-w-0 truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                  to={link}
                >
                  {title}
                </Link>
              ) : (
                <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {title}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-muted">
              {getUploadedMaterialSubtitle(material)}
            </p>
          </div>
        </div>

        <div className="grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {formatDateTime(material.created_at)}
          </span>
          <span className="tabular-nums">{material.points} 积分</span>
          <span className="flex items-center gap-1.5 tabular-nums">
            <ShoppingCart className="size-3.5" />
            {material.purchase_count} 次购买
          </span>
          <span>{size ?? '大小未知'}</span>
        </div>
      </Card.Content>
    </Card>
  )
}

export function UploadedMaterialsView() {
  const { isInitializing, token } = useAuth()
  const [page, setPage] = useState(1)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loadedPage, setLoadedPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const totalPages = getTotalPages(total)
  const isPageLoading = isLoading && materials.length > 0 && page !== loadedPage

  function handlePageChange(nextPage: number) {
    if (nextPage === page) return

    setLoading(true)
    setPage(nextPage)
  }

  useEffect(() => {
    if (!token || isInitializing) return

    const authToken = token
    const controller = new AbortController()

    async function loadMaterials() {
      let shouldKeepLoading = false

      setLoading(true)
      setError(null)

      try {
        const data = await getUserUploadMaterials({
          page,
          pageSize: USER_CENTER_PAGE_SIZE,
          signal: controller.signal,
          token: authToken,
        })
        if (controller.signal.aborted) return
        const nextTotal = data.count ?? 0
        const nextTotalPages = getTotalPages(nextTotal)
        if (page > nextTotalPages) {
          shouldKeepLoading = true
          setMaterials([])
          setTotal(nextTotal)
          setPage(nextTotalPages)
          return
        }
        setMaterials(data.records ?? [])
        setTotal(nextTotal)
        setLoadedPage(page)
      } catch (err) {
        if (isAbortError(err)) return
        setMaterials([])
        setTotal(0)
        setError(err instanceof Error ? err.message : `获取${UPLOADED_MATERIALS_TITLE}失败`)
      } finally {
        if (!controller.signal.aborted && !shouldKeepLoading) setLoading(false)
      }
    }

    void loadMaterials()

    return () => controller.abort()
  }, [isInitializing, page, reloadKey, token])

  if (isLoading && materials.length === 0) {
    return <LoadingState label={`正在加载${UPLOADED_MATERIALS_TITLE}`} />
  }

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

      {materials.length > 0 ? (
        <PaginatedListTransition
          isLoading={isPageLoading}
          loadingLabel={`正在加载${UPLOADED_MATERIALS_TITLE}`}
          motionKey={`uploaded-${loadedPage}`}
        >
          {materials.map((material) => (
            <MotionItem key={material.id}>
              <UploadedMaterialItem material={material} />
            </MotionItem>
          ))}
        </PaginatedListTransition>
      ) : (
        <EmptyPanel description="还没有上传过资料。" icon={FilePlus} title="暂无上传资料" />
      )}

      {totalPages > 1 ? (
        <UserPagination
          label={UPLOADED_MATERIALS_TITLE}
          page={page}
          total={total}
          totalPages={totalPages}
          isDisabled={isLoading}
          onChange={handlePageChange}
        />
      ) : null}
    </div>
  )
}
