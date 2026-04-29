import {
  ArrowDownToLine,
  ChevronDown,
  CircleDollar,
  CircleExclamation,
  CircleXmark,
  Comments,
  EllipsisVertical,
  FileText,
  Flag,
  PaperPlane,
  Person,
  ShoppingCart,
  Sparkles,
  ThumbsDown,
  ThumbsDownFill,
  ThumbsUp,
  ThumbsUpFill,
  TrashBin,
  TriangleExclamation,
  Xmark,
} from '@gravity-ui/icons'
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Dropdown,
  Label,
  ListBox,
  Modal,
  Pagination,
  Skeleton,
  Select,
  Spinner,
  Tabs,
  TextArea,
} from '@heroui/react'
import { AnimatePresence, motion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  downloadMaterial,
  deleteMaterialComment,
  getMaterial,
  getMaterialComments,
  getMaterialCommentReplies,
  getMaterialCommentReportReasons,
  getMaterialReportReasons,
  postMaterialComment,
  purchaseMaterial,
  rateMaterial,
  rateMaterialComment,
  reportMaterial,
  reportMaterialComment,
} from '../api/materials'
import { useAuth } from '../auth/use-auth'
import { useDialog } from '../dialog/use-dialog'
import { constants } from '../env'
import type {
  Material,
  MaterialComment,
  MaterialCommentReportReason,
  MaterialCommentSort,
  MaterialReportReason,
} from '../types/material'
import type { Profile } from '../types/user'

const COMMENTS_PAGE_SIZE = 10
const REPLIES_PAGE_SIZE = 5
const COMMENT_MAX_LENGTH = 1000
const COMMENT_COLLAPSED_HEIGHT = 128
const detailSurfaceBg =
  'bg-surface-secondary dark:bg-[color-mix(in_srgb,var(--surface-secondary)_35%,var(--background))]'

const SORT_OPTIONS: { id: MaterialCommentSort; label: string }[] = [
  { id: 'old', label: '最早' },
  { id: 'new', label: '最新' },
  { id: 'like', label: '最热' },
]

const easing = [0.32, 0.72, 0, 1] as const

function AnimatedToggle({
  active,
  on,
  off,
}: {
  active: boolean
  on: React.ReactNode
  off: React.ReactNode
}) {
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.span
        key={active ? 'on' : 'off'}
        initial={{ scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ duration: 0.18, ease: easing }}
        className="inline-flex"
      >
        {active ? on : off}
      </motion.span>
    </AnimatePresence>
  )
}

function AnimatedNumber({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <span
      className={`relative inline-flex h-[1em] items-center overflow-hidden align-middle leading-none tabular-nums ${
        className ?? ''
      }`}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: '70%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-70%', opacity: 0 }}
          transition={{ duration: 0.22, ease: easing }}
          className="block leading-none"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

interface MaterialDetailModalProps {
  isOpen: boolean
  materialId: string | number | null
  onClose: () => void
}

export default function MaterialDetailModal({
  isOpen,
  materialId,
  onClose,
}: MaterialDetailModalProps) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      variant="blur"
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Modal.Container
        className="px-0 py-0 sm:px-6 sm:py-4 max-lg:data-entering:slide-in-from-bottom max-lg:data-entering:fade-in-100 max-lg:data-entering:zoom-in-100 max-lg:data-entering:duration-350 max-lg:data-entering:ease-out-fluid max-lg:data-exiting:slide-out-to-bottom max-lg:data-exiting:fade-out-100 max-lg:data-exiting:zoom-out-100 max-lg:data-exiting:duration-250 max-lg:data-exiting:ease-out-fluid"
        scroll="inside"
        size="cover"
      >
        <Modal.Dialog
          className={`flex flex-col overflow-hidden rounded-none border-0 p-0 shadow-2xl shadow-black/10 sm:max-w-272 sm:rounded-[1.75rem] sm:border sm:border-border/70 ${detailSurfaceBg}`}
          aria-label="资料详情"
        >
          <Modal.CloseTrigger className="z-50 right-4 top-4 bg-background/80 shadow-sm ring-1 ring-border/70 backdrop-blur-md hover:bg-surface-secondary sm:right-7 sm:top-7" />
          {materialId != null ? (
            <MaterialDetailContent
              key={String(materialId)}
              materialId={materialId}
              onClose={onClose}
            />
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function useIsDesktop(query = '(min-width: 1024px)') {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia(query).matches
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

function MaterialDetailContent({
  materialId,
  onClose,
}: {
  materialId: string | number
  onClose: () => void
}) {
  const isDesktop = useIsDesktop()
  const { token, profile, setProfile } = useAuth()
  const [material, setMaterial] = useState<Material | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [trackedTick, setTrackedTick] = useState(refreshTick)

  if (trackedTick !== refreshTick) {
    setTrackedTick(refreshTick)
    setMaterial(null)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()

    getMaterial({ id: materialId, token, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setMaterial(data)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : '加载资料失败')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [materialId, token, refreshTick])

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), [])

  const updateMaterial = useCallback((patch: Partial<Material>) => {
    setMaterial((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const onPointsChange = useCallback(
    (delta: number) => {
      if (!profile?.points) return
      setProfile({
        ...profile,
        points: { ...profile.points, points: profile.points.points + delta },
      })
    },
    [profile, setProfile],
  )

  const stage: 'loading' | 'error' | 'ready' = isLoading
    ? 'loading'
    : error || !material
    ? 'error'
    : 'ready'

  return (
    <AnimatePresence initial={false} mode="wait">
      {stage === 'loading' ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: easing }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <MaterialDetailSkeleton />
        </motion.div>
      ) : stage === 'error' ? (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: easing }}
          className={`flex flex-col gap-4 p-6 sm:p-8 ${detailSurfaceBg}`}
        >
          <div className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-soft/70 p-4 text-sm text-danger-soft-foreground">
            <TriangleExclamation className="mt-0.5 size-5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">加载资料失败</p>
              <p className="mt-1 text-xs">{error ?? '未知错误'}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onPress={onClose}>
              关闭
            </Button>
            <Button variant="primary" onPress={refresh}>
              重试
            </Button>
          </div>
        </motion.div>
      ) : (
        <MaterialDetailReady
          key="ready"
          isDesktop={isDesktop}
          material={material!}
          materialId={materialId}
          profile={profile}
          updateMaterial={updateMaterial}
          onPointsChange={onPointsChange}
        />
      )}
    </AnimatePresence>
  )
}

function MaterialDetailReady({
  isDesktop,
  material,
  materialId,
  profile,
  updateMaterial,
  onPointsChange,
}: {
  isDesktop: boolean
  material: Material
  materialId: string | number
  profile: Profile | null
  updateMaterial: (patch: Partial<Material>) => void
  onPointsChange: (delta: number) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MaterialDetailHeader material={material} />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: easing }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Modal.Body
          className={
            isDesktop
              ? 'p-0 sm:p-0'
              : 'flex min-h-0 flex-1 flex-col overflow-hidden p-0'
          }
        >
          {isDesktop ? (
            <div className={`grid gap-6 px-5 pb-6 pt-5 sm:px-10 sm:pb-9 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-8 ${detailSurfaceBg}`}>
              <main className="flex min-w-0 flex-col gap-5">
                <MaterialOverview material={material} />
              <CommentsSection
                materialId={materialId}
                uploaderUserId={material.user_id}
                layout="desktop"
              />
              </main>
              <aside className="lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2">
                <ActionZone
                  material={material}
                  profile={profile}
                  onMaterialChange={updateMaterial}
                  onPointsChange={onPointsChange}
                />
              </aside>
            </div>
          ) : (
            <Tabs
              className={`flex min-h-0 flex-1 flex-col ${detailSurfaceBg}`}
              defaultSelectedKey="info"
            >
              <Tabs.ListContainer className="mx-4 mt-3">
                <Tabs.List
                  aria-label="资料详情视图"
                  className="w-full justify-start *:h-9 *:flex-1 *:justify-center *:text-sm *:font-medium"
                >
                  <Tabs.Tab id="info">
                    资料信息
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="comments">
                    评论
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
              <Tabs.Panel
                id="info"
                className="flex min-h-0 flex-1 flex-col p-0"
              >
                <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4 sm:px-8">
                  <MaterialOverview material={material} />
                </div>
                <div className="shrink-0 border-t border-border/60 bg-background/85 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgb(0_0_0/0.06)] backdrop-blur-xl sm:px-7">
                  <ActionZone
                    floating
                    material={material}
                    profile={profile}
                    onMaterialChange={updateMaterial}
                    onPointsChange={onPointsChange}
                  />
                </div>
              </Tabs.Panel>
              <Tabs.Panel
                id="comments"
                className="flex min-h-0 flex-1 flex-col p-0"
              >
                <CommentsSection
                  materialId={materialId}
                  uploaderUserId={material.user_id}
                  layout="mobile"
                />
              </Tabs.Panel>
            </Tabs>
          )}
        </Modal.Body>
      </motion.div>
    </div>
  )
}

function MaterialDetailHeader({ material }: { material: Material }) {
  const isFree = material.points === 0
  const author = formatAuthorName(material)
  const fileMeta = [material.file_name || '未命名文件', formatBytes(material.size)]
    .filter(Boolean)
    .join(' · ')

  return (
    <Modal.Header className="shrink-0 border-b border-border/70 bg-background px-5 pb-5 pt-6 sm:px-10 sm:pb-7 sm:pt-8">
      <div className="flex min-w-0 items-start gap-3 pr-10 sm:gap-5">
        <div
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-secondary text-muted ring-1 ring-border/60 sm:size-14"
        >
          <FileText className="size-6 sm:size-7" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {material.material_type?.name ? (
              <Chip className="border border-border/60 bg-background/75" size="sm" variant="soft">
                <Chip.Label>{material.material_type.name}</Chip.Label>
              </Chip>
            ) : null}
            {isFree ? (
              <Chip color="success" size="sm" variant="soft">
                <Sparkles className="size-3" />
                <Chip.Label>免费</Chip.Label>
              </Chip>
            ) : (
              <Chip color="warning" size="sm" variant="soft">
                <CircleDollar className="size-3" />
                <Chip.Label className="tabular-nums">
                  {material.points} 积分
                </Chip.Label>
              </Chip>
            )}
            {material.is_mine ? (
              <Chip color="accent" size="sm" variant="soft">
                <Chip.Label>我的上传</Chip.Label>
              </Chip>
            ) : material.has_purchased ? (
              <Chip color="success" size="sm" variant="soft">
                <Chip.Label>已购买</Chip.Label>
              </Chip>
            ) : null}
          </div>
          <Modal.Heading className="text-balance text-xl font-semibold leading-tight tracking-normal sm:text-[28px]">
            {material.name || material.file_name || '未命名资料'}
          </Modal.Heading>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-5 text-muted">
            <span className="min-w-0 max-w-full truncate break-all text-foreground/85">{fileMeta}</span>
            <span aria-hidden className="hidden text-muted/50 sm:inline">
              /
            </span>
            <span className="shrink-0 text-muted">
              {author} 上传于 {formatDateTime(material.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Modal.Header>
  )
}

function MaterialOverview({ material }: { material: Material }) {
  const author = formatAuthorName(material)

  return (
    <section
      aria-label="资料详情"
      className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-sm shadow-black/5"
    >
      <div className="border-b border-border/60 bg-linear-to-r from-background to-surface-secondary/70 px-4 py-4 sm:px-5">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-normal text-foreground">
              资料信息
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted">
              文件来源、上传记录与补充说明
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium text-muted shadow-sm sm:inline-flex">
            {material.purchase_count} 次购买
          </span>
        </div>
      </div>
      <dl className="grid gap-px bg-border/50 sm:grid-cols-2">
        <InfoRow label="文件">
          <span className="line-clamp-1 break-all" title={material.file_name || ''}>
            {material.file_name || '未命名'}
          </span>
        </InfoRow>
        <InfoRow label="大小">
          <span className="tabular-nums">{formatBytes(material.size)}</span>
        </InfoRow>
        <InfoRow label="上传者">
          <span>{author}</span>
        </InfoRow>
        <InfoRow label="上传时间">
          <span className="tabular-nums">{formatDateTime(material.created_at)}</span>
        </InfoRow>
        {material.description ? (
          <div className="flex min-w-0 flex-col gap-2 bg-background px-4 py-4 sm:col-span-2 sm:px-5">
            <dt className="text-xs font-medium text-muted">上传者描述</dt>
            <dd className="min-w-0 whitespace-pre-wrap rounded-2xl border border-border/60 bg-surface-secondary/60 px-4 py-3 text-sm leading-relaxed text-foreground">
              {material.description}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  )
}

function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-background px-4 py-3.5 sm:px-5">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  )
}

function ActionZone({
  material,
  profile,
  onMaterialChange,
  onPointsChange,
  floating = false,
}: {
  material: Material
  profile: Profile | null
  onMaterialChange: (patch: Partial<Material>) => void
  onPointsChange: (delta: number) => void
  floating?: boolean
}) {
  const { token } = useAuth()
  const { showDialog } = useDialog()
  const [isPurchaseConfirmOpen, setPurchaseConfirmOpen] = useState(false)
  const [isReportOpen, setReportOpen] = useState(false)
  const [isPurchasing, setPurchasing] = useState(false)
  const [isDownloading, setDownloading] = useState(false)
  const [isRating, setRating] = useState<'like' | 'hate' | null>(null)
  const isMine = material.is_mine === true
  const purchased = material.has_purchased === true
  const canRate = !isMine && purchased
  const userPoints = profile?.points?.points ?? 0
  const insufficient = !isMine && !purchased && userPoints < material.points

  const handlePurchase = async () => {
    if (!token) return
    setPurchasing(true)
    try {
      await purchaseMaterial({ id: material.id, token })
      onMaterialChange({
        has_purchased: true,
        purchase_count: material.purchase_count + 1,
      })
      onPointsChange(-material.points)
      setPurchaseConfirmOpen(false)
      showDialog({
        status: 'success',
        title: '购买成功',
        description: '您可以下载该资料了',
      })
    } catch (err) {
      setPurchaseConfirmOpen(false)
      showDialog({
        status: 'danger',
        title: '购买失败',
        description: err instanceof Error ? err.message : '请稍后再试',
      })
    } finally {
      setPurchasing(false)
    }
  }

  const handleDownload = async () => {
    if (!token) return
    setDownloading(true)
    try {
      const url = await downloadMaterial({ id: material.id, token })
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      showDialog({
        status: 'danger',
        title: '下载失败',
        description: err instanceof Error ? err.message : '请稍后再试',
      })
    } finally {
      setDownloading(false)
    }
  }

  const handleRate = async (rating: 'like' | 'hate') => {
    if (!token) return
    const currentlySet =
      rating === 'like' ? material.has_liked === true : material.has_hated === true
    const otherSet =
      rating === 'like' ? material.has_hated === true : material.has_liked === true

    setRating(rating)
    try {
      await rateMaterial({
        id: material.id,
        rating,
        set: !currentlySet,
        token,
      })

      const patch: Partial<Material> = {}
      if (rating === 'like') {
        patch.has_liked = !currentlySet
        patch.like_count = material.like_count + (currentlySet ? -1 : 1)
        if (otherSet) {
          patch.has_hated = false
          patch.hate_count = Math.max(0, material.hate_count - 1)
        }
      } else {
        patch.has_hated = !currentlySet
        patch.hate_count = material.hate_count + (currentlySet ? -1 : 1)
        if (otherSet) {
          patch.has_liked = false
          patch.like_count = Math.max(0, material.like_count - 1)
        }
      }
      onMaterialChange(patch)
    } catch (err) {
      showDialog({
        status: 'danger',
        title: '操作失败',
        description: err instanceof Error ? err.message : '请稍后再试',
      })
    } finally {
      setRating(null)
    }
  }

  const heading = isMine ? '上传者' : purchased ? '已购买' : material.points === 0 ? '免费资料' : '购买该资料'
  const description = isMine
    ? '您是该资料的上传者，可直接下载。'
    : purchased
    ? '您已拥有该资料，可直接下载。'
    : material.points === 0
    ? '该资料免费分享，兑换后即可下载。'
    : '购买后即可下载。在购买后如无特殊情况积分不予退还。'
  const ratingUnavailableTitle = isMine ? '自己的上传不可评价' : '购买后可评价'
  const statusKey = isMine
    ? 'mine'
    : purchased
    ? 'purchased'
    : material.points === 0
    ? 'free'
    : 'buy'
  const actionKey = isMine || purchased ? 'download' : 'purchase'
  const statusIcon = isMine ? (
    <Person className="size-5" />
  ) : purchased ? (
    <ArrowDownToLine className="size-5" />
  ) : material.points === 0 ? (
    <Sparkles className="size-5" />
  ) : (
    <CircleDollar className="size-5" />
  )

  const pointsInfo =
    !isMine && !purchased && material.points > 0 ? (
      <AnimatePresence initial={false}>
        <motion.div
          key="points-info"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.24, ease: easing }}
          className="overflow-hidden"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col rounded-xl bg-warning-soft px-3.5 py-2 text-warning-soft-foreground">
              <span className="text-xs font-medium opacity-80">需要积分</span>
              <span className="mt-0.5 text-lg font-semibold leading-tight tabular-nums">
                {material.points}
              </span>
            </div>
            <div className="flex flex-col items-start rounded-xl bg-surface-secondary px-3.5 py-2">
              <span className="text-xs font-medium text-muted">当前积分</span>
              <span className="mt-0.5 text-lg font-semibold leading-tight text-foreground">
                <AnimatedNumber value={userPoints} />
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    ) : null

  const actionButton = (
    <AnimatePresence initial={false} mode="wait">
      {actionKey === 'download' ? (
        <motion.div
          key="download"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: easing }}
        >
          <Button
            className="h-11 w-full justify-center text-sm font-semibold shadow-md shadow-accent/15"
            isPending={isDownloading}
            variant="primary"
            onPress={handleDownload}
          >
            <ArrowDownToLine className="size-4" />
            下载文件
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="purchase"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: easing }}
        >
          <Button
            className="h-11 w-full justify-center text-sm font-semibold shadow-md shadow-accent/15"
            isDisabled={insufficient}
            variant="primary"
            onPress={() => setPurchaseConfirmOpen(true)}
          >
            <ShoppingCart className="size-4" />
            {material.points === 0 ? '免费兑换' : `购买 · ${material.points} 积分`}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )

  const insufficientWarning = (
    <AnimatePresence initial={false}>
      {insufficient ? (
        <motion.p
          key="insufficient"
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -4 }}
          transition={{ duration: 0.22, ease: easing }}
          className="-mt-1 flex items-start gap-1.5 overflow-hidden rounded-xl bg-warning-soft/70 px-3 py-2 text-xs leading-relaxed text-warning-soft-foreground"
        >
          <CircleExclamation className="mt-0.5 size-3.5 shrink-0" />
          积分不足，还差 {material.points - userPoints} 积分。可通过分享资料或参与活动获取积分。
        </motion.p>
      ) : null}
    </AnimatePresence>
  )

  const actionRowButtons = (
    <>
      <Button
        aria-label="投诉资料"
        className="h-8 justify-center rounded-full px-3 text-xs text-muted shadow-none hover:text-foreground"
        size="sm"
        variant="ghost"
        onPress={() => setReportOpen(true)}
      >
        <Flag className="size-3.5" />
        投诉
      </Button>
      <div
        className="flex items-center gap-1.5"
        title={canRate ? undefined : ratingUnavailableTitle}
      >
        <Button
          aria-label={material.has_liked ? '取消点赞' : '点赞'}
          className="h-8 min-w-16 justify-center rounded-full px-3 text-xs text-muted shadow-none hover:text-foreground aria-disabled:text-muted/50"
          isDisabled={!canRate}
          isPending={isRating === 'like'}
          size="sm"
          variant="ghost"
          onPress={() => handleRate('like')}
        >
          <AnimatedToggle
            active={material.has_liked === true}
            on={<ThumbsUpFill className="size-3.5 text-current" />}
            off={<ThumbsUp className="size-3.5" />}
          />
          <AnimatedNumber value={material.like_count} />
        </Button>
        <Button
          aria-label={material.has_hated ? '取消点踩' : '点踩'}
          className="h-8 min-w-16 justify-center rounded-full px-3 text-xs text-muted shadow-none hover:text-foreground aria-disabled:text-muted/50"
          isDisabled={!canRate}
          isPending={isRating === 'hate'}
          size="sm"
          variant="ghost"
          onPress={() => handleRate('hate')}
        >
          <AnimatedToggle
            active={material.has_hated === true}
            on={<ThumbsDownFill className="size-3.5 text-current" />}
            off={<ThumbsDown className="size-3.5" />}
          />
          <AnimatedNumber value={material.hate_count} />
        </Button>
      </div>
    </>
  )

  const dialogs = (
    <>
      <MaterialReportDialog
        isOpen={isReportOpen}
        materialId={material.id}
        onOpenChange={setReportOpen}
      />

      <AlertDialog.Backdrop
        isOpen={isPurchaseConfirmOpen}
        onOpenChange={setPurchaseConfirmOpen}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog className="sm:max-w-105">
            <AlertDialog.Header>
              <AlertDialog.Icon status="accent" />
              <AlertDialog.Heading>
                {material.points === 0 ? '免费兑换该资料？' : '确认购买该资料？'}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm leading-6">
                {material.points === 0
                  ? '该资料无需积分，兑换后即可下载。'
                  : `本次购买将扣除 ${material.points} 积分（购买后剩余 ${
                      userPoints - material.points
                    } 积分）。`}
              </p>
              <p className="mt-2 text-xs leading-5">
                购买后您即可下载并对资料进行评价。
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="secondary">
                取消
              </Button>
              <Button
                isPending={isPurchasing}
                variant="primary"
                onPress={handlePurchase}
              >
                确认购买
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  )

  if (floating) {
    return (
      <section
        aria-label="购买与下载"
        className="mx-auto flex w-full max-w-3xl flex-col gap-2.5"
      >
        {pointsInfo}
        {actionButton}
        {insufficientWarning}
        <div className="flex w-full items-center justify-between gap-3 pt-0.5">
          {actionRowButtons}
        </div>
        {dialogs}
      </section>
    )
  }

  return (
    <Card
      aria-label="购买与下载"
      className="overflow-hidden border border-border/70 bg-background p-0 shadow-sm shadow-black/5"
      role="region"
      variant="secondary"
    >
      <Card.Header className="border-b border-border/60 bg-linear-to-br from-accent-soft/80 via-background to-surface-secondary px-5 pb-4 pt-5">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={statusKey}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: easing }}
            className="flex min-w-0 gap-3"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background text-accent shadow-sm ring-1 ring-accent/10">
              {statusIcon}
            </div>
            <div className="min-w-0">
              <Card.Title className="text-base font-semibold leading-tight tracking-normal text-foreground">
                {heading}
              </Card.Title>
              <Card.Description className="mt-1 line-clamp-3 leading-relaxed text-muted">
                {description}
              </Card.Description>
            </div>
          </motion.div>
        </AnimatePresence>
      </Card.Header>
      <Card.Content className="gap-3 bg-background px-5 py-1">
        {pointsInfo}
        {actionButton}
        {insufficientWarning}
      </Card.Content>
      <Card.Footer className="justify-between border-t border-border/60 bg-surface-secondary/55 px-3 py-2">
        {actionRowButtons}
      </Card.Footer>
      {dialogs}
    </Card>
  )
}

function MaterialReportDialog({
  materialId,
  isOpen,
  onOpenChange,
}: {
  materialId: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { token } = useAuth()
  const { showDialog } = useDialog()
  const [reasons, setReasons] = useState<MaterialReportReason[]>([])
  const [reason, setReason] = useState<string>('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setSubmitting] = useState(false)
  const [isLoadingReasons, setLoadingReasons] = useState(false)
  const [trackedOpen, setTrackedOpen] = useState(isOpen)
  if (trackedOpen !== isOpen) {
    setTrackedOpen(isOpen)
    if (isOpen && reasons.length === 0) {
      setLoadingReasons(true)
    }
  }

  useEffect(() => {
    if (!isOpen || !token || reasons.length > 0) return
    const controller = new AbortController()
    getMaterialReportReasons({ token, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setReasons(data)
        if (data.length > 0) setReason(data[0].code)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        onOpenChange(false)
        showDialog({
          status: 'danger',
          title: '加载投诉选项失败',
          description: err instanceof Error ? err.message : '请稍后再试',
        })
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoadingReasons(false)
      })
    return () => controller.abort()
  }, [isOpen, token, reasons.length, onOpenChange, showDialog])

  const handleSubmit = async () => {
    if (!token || !reason) return
    setSubmitting(true)
    try {
      await reportMaterial({
        id: materialId,
        reason,
        description,
        token,
      })
      onOpenChange(false)
      showDialog({
        status: 'success',
        title: '投诉已提交',
        description: '感谢您的反馈，我们会尽快处理。',
      })
      setDescription('')
    } catch (err) {
      onOpenChange(false)
      showDialog({
        status: 'danger',
        title: '投诉失败',
        description: err instanceof Error ? err.message : '请稍后再试',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container placement="center">
        <AlertDialog.Dialog className="sm:max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>投诉资料</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="overflow-visible">
            {isLoadingReasons ? (
              <div className="flex items-center gap-2 text-sm">
                <Spinner size="sm" /> 加载中…
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Select
                  aria-label="投诉理由"
                  fullWidth
                  placeholder="选择投诉理由"
                  value={reason || null}
                  variant="secondary"
                  onChange={(value) => setReason(value == null ? '' : String(value))}
                >
                  <Label className="text-sm font-medium">选择投诉理由</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {reasons.map((r) => (
                        <ListBox.Item key={r.code} id={r.code} textValue={r.label}>
                          {r.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-sm font-medium"
                    htmlFor="material-report-detail"
                  >
                    补充说明（可选）
                  </Label>
                  <TextArea
                    id="material-report-detail"
                    className="min-h-20 w-full"
                    maxLength={500}
                    placeholder="请提供有助于审核的更多信息"
                    rows={3}
                    value={description}
                    variant="secondary"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="secondary">
              取消
            </Button>
            <Button
              isDisabled={!reason}
              isPending={isSubmitting}
              variant="danger"
              onPress={handleSubmit}
            >
              <Flag className="size-4" />
              提交投诉
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}

interface ReplyTarget {
  rootId: number
  parentId: number
  nickname: string
}

function CommentsSection({
  materialId,
  uploaderUserId,
  layout = 'desktop',
}: {
  materialId: string | number
  uploaderUserId: number
  layout?: 'desktop' | 'mobile'
}) {
  const { token, profile } = useAuth()
  const { showDialog } = useDialog()
  const [comments, setComments] = useState<MaterialComment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<MaterialCommentSort>('old')
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [isPosting, setPosting] = useState(false)
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const commentElementsRef = useRef(new Map<number, HTMLElement>())
  const pendingScrollCommentIdRef = useRef<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / COMMENTS_PAGE_SIZE))

  const fetchKey = `${materialId}|${sort}|${page}|${refreshIndex}`
  const [trackedFetchKey, setTrackedFetchKey] = useState(fetchKey)
  if (trackedFetchKey !== fetchKey) {
    setTrackedFetchKey(fetchKey)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()

    getMaterialComments({
      id: materialId,
      page,
      pageSize: COMMENTS_PAGE_SIZE,
      sort,
      token,
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return
        setComments(data.records ?? [])
        setTotal(data.count ?? 0)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : '加载评论失败')
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [materialId, token, sort, page, refreshIndex])

  useEffect(() => {
    const commentId = pendingScrollCommentIdRef.current
    if (commentId == null) return

    const element = commentElementsRef.current.get(commentId)
    if (!element) return

    pendingScrollCommentIdRef.current = null
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [comments])

  const registerCommentElement = useCallback(
    (commentId: number, element: HTMLElement | null) => {
      if (element) {
        commentElementsRef.current.set(commentId, element)
      } else {
        commentElementsRef.current.delete(commentId)
      }
    },
    [],
  )

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const handleStartReply = useCallback(
    (target: ReplyTarget) => {
      setReplyTarget(target)
      focusInput()
    },
    [focusInput],
  )

  const cancelReply = useCallback(() => setReplyTarget(null), [])

  const handlePost = async () => {
    if (!token) return
    const trimmed = content.trim()
    if (!trimmed) return
    if (trimmed.length > COMMENT_MAX_LENGTH) {
      showDialog({
        status: 'warning',
        title: '评论过长',
        description: `最多 ${COMMENT_MAX_LENGTH} 个字符。`,
      })
      return
    }

    setPosting(true)
    try {
      const created = await postMaterialComment({
        id: materialId,
        content: trimmed,
        parentId: replyTarget?.parentId ?? null,
        token,
      })
      setContent('')
      setReplyTarget(null)
      pendingScrollCommentIdRef.current = created.id
      showDialog({ status: 'success', title: '已发布' })

      if (created.root_id == null) {
        setComments((prev) =>
          [created, ...prev.filter((c) => c.id !== created.id)].slice(
            0,
            COMMENTS_PAGE_SIZE,
          ),
        )
        setTotal((t) => t + 1)
      } else {
        setComments((prev) => prependReplyToRootComment(prev, created))
      }
    } catch (err) {
      showDialog({
        status: 'danger',
        title: '发布失败',
        description: err instanceof Error ? err.message : '请稍后再试',
      })
    } finally {
      setPosting(false)
    }
  }

  const handleCommentRatingChange = useCallback(
    (commentId: number, patch: Partial<MaterialComment>) => {
      setComments((prev) => updateCommentInTree(prev, commentId, patch))
    },
    [],
  )

  const handleRepliesLoaded = useCallback(
    (rootId: number, replies: MaterialComment[]) => {
      setComments((prev) =>
        prev.map((c) => (c.id === rootId ? { ...c, replies } : c)),
      )
    },
    [],
  )

  const handleCommentDeleted = useCallback((deleted: MaterialComment) => {
    setComments((prev) => removeDeletedComment(prev, deleted))
    if (deleted.root_id == null && deleted.reply_count <= 0) {
      setTotal((t) => Math.max(0, t - 1))
    }
    setRefreshIndex((index) => index + 1)
  }, [])

  const placeholder = replyTarget
    ? '写下回复…'
    : profile
    ? '分享您对该资料的看法…'
    : '请先登录后参与评论'

  const sortDropdown = (
    <Dropdown>
      <Button
        aria-label="评论排序"
        className="h-8 rounded-full border border-border/60 bg-background px-3 text-xs font-medium text-muted shadow-sm hover:text-foreground"
        size="sm"
        variant="ghost"
      >
        {SORT_OPTIONS.find((o) => o.id === sort)?.label ?? '排序'}
        <ChevronDown className="size-3.5" />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          selectedKeys={new Set([sort])}
          selectionMode="single"
          onSelectionChange={(keys) => {
            const next = [...(keys as Set<string>)][0] as
              | MaterialCommentSort
              | undefined
            if (next) {
              setSort(next)
              setPage(1)
            }
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <Dropdown.Item key={opt.id} id={opt.id} textValue={opt.label}>
              <Dropdown.ItemIndicator />
              <Label>{opt.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )

  const commentInput = (
    <CommentInput
      content={content}
      floating={layout === 'mobile'}
      inputRef={inputRef}
      isPosting={isPosting}
      placeholder={placeholder}
      replyTarget={replyTarget}
      onCancelReply={cancelReply}
      onChange={setContent}
      onSubmit={handlePost}
    />
  )

  const headerRow = (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-linear-to-r from-background to-surface-secondary/70 px-4 py-3 sm:px-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-normal text-foreground sm:text-base">
        <span className="flex size-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Comments className="size-4" />
        </span>
        评论区
        <span className="inline-flex h-6 items-center justify-center rounded-full border border-border/60 bg-background px-2 text-xs font-medium leading-none text-muted shadow-sm">
          <AnimatedNumber value={total} />
        </span>
      </h2>
      {sortDropdown}
    </div>
  )

  const listStage: 'error' | 'loading' | 'empty' | 'list' = error
    ? 'error'
    : isLoading
    ? 'loading'
    : comments.length === 0
    ? 'empty'
    : 'list'

  const listSection = (
    <AnimatePresence initial={false} mode="wait">
      {listStage === 'error' ? (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: easing }}
          className="flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-soft/70 p-4 text-sm text-danger-soft-foreground"
        >
          <TriangleExclamation className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </motion.div>
      ) : listStage === 'loading' ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: easing }}
        >
          <CommentsSkeleton />
        </motion.div>
      ) : listStage === 'empty' ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: easing }}
        >
          <CommentsEmpty />
        </motion.div>
      ) : (
        <motion.ul
          key="list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: easing }}
          className="flex flex-col gap-3"
        >
          <AnimatePresence initial={false}>
            {comments.map((comment) => (
              <motion.li
                key={comment.id}
                ref={(node) => registerCommentElement(comment.id, node)}
                layout="position"
                initial={{ opacity: 0, y: -6, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.24, ease: easing }}
              >
                <CommentItem
                  comment={comment}
                  materialId={materialId}
                  sort={sort}
                  uploaderUserId={uploaderUserId}
                  onCommentElement={registerCommentElement}
                  onPatch={handleCommentRatingChange}
                  onRepliesLoaded={handleRepliesLoaded}
                  onStartReply={handleStartReply}
                  onDeleted={handleCommentDeleted}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </AnimatePresence>
  )

  const pagination =
    totalPages > 1 ? (
      <Pagination className="flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <Pagination.Summary>
          <span className="tabular-nums">
            第 {page} / {totalPages} 页 · 共 {total} 条
          </span>
        </Pagination.Summary>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous
              isDisabled={page === 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Pagination.PreviousIcon />
              <span className="hidden sm:inline">上一页</span>
            </Pagination.Previous>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Next
              isDisabled={page === totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span className="hidden sm:inline">下一页</span>
              <Pagination.NextIcon />
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    ) : null

  if (layout === 'mobile') {
    return (
      <section
        aria-label="评论区"
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-normal text-foreground">
            <span className="flex size-8 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Comments className="size-4" />
            </span>
            评论
            <span className="rounded-full border border-border/60 bg-surface-secondary px-2 py-0.5 text-xs font-medium tabular-nums text-muted">
              {total}
            </span>
          </h2>
          {sortDropdown}
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3">
          {listSection}
          {pagination}
        </div>
        <div className="pointer-events-none absolute inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10">
          {commentInput}
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="评论区"
      className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-sm shadow-black/5"
    >
      {headerRow}
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {commentInput}
        {listSection}
        {pagination}
      </div>
    </section>
  )
}

function CommentInput({
  content,
  floating = false,
  inputRef,
  isPosting,
  placeholder,
  replyTarget,
  onCancelReply,
  onChange,
  onSubmit,
}: {
  content: string
  floating?: boolean
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>
  isPosting: boolean
  placeholder: string
  replyTarget: ReplyTarget | null
  onCancelReply: () => void
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  const remaining = COMMENT_MAX_LENGTH - content.length
  const overLimit = remaining < 0
  const canSubmit = content.trim().length > 0 && !overLimit && !isPosting
  const maxTextareaHeight = floating ? 112 : 176

  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const nextHeight = Math.min(textarea.scrollHeight, maxTextareaHeight)
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY =
      textarea.scrollHeight > maxTextareaHeight ? 'auto' : 'hidden'
  }, [content, floating, inputRef, maxTextareaHeight, replyTarget])

  if (floating) {
    return (
      <div className="pointer-events-auto">
        <div className="flex min-h-12 items-end gap-2 rounded-[1.35rem] border border-border/70 bg-background/90 px-3 py-2 shadow-lg shadow-black/10 backdrop-blur-xl transition-[background-color,border-color,box-shadow]">
          <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5">
            <AnimatePresence initial={false}>
              {replyTarget ? (
                <motion.div
                  key="reply-target"
                  initial={{ opacity: 0, height: 0, marginBottom: 0, y: -2 }}
                  animate={{
                    opacity: 1,
                    height: 'auto',
                    marginBottom: 4,
                    y: 0,
                  }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, y: -2 }}
                  transition={{ duration: 0.22, ease: easing }}
                  className="overflow-hidden"
                >
                  <div className="flex h-6 items-center justify-between gap-2 rounded-full bg-accent-soft px-2.5 text-xs text-accent">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Person className="size-3.5 shrink-0" />
                      <span className="truncate">回复 @{replyTarget.nickname}</span>
                    </span>
                    <button
                      aria-label="取消回复"
                      className="-mr-1 flex size-5 shrink-0 cursor-(--cursor-interactive) items-center justify-center rounded-full hover:bg-accent/10"
                      onClick={onCancelReply}
                      type="button"
                    >
                      <Xmark className="size-3.5" />
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <TextArea
              aria-label="评论输入框"
              className="max-h-28 min-h-8 w-full resize-none border-0 bg-transparent px-0 py-1 text-[15px] leading-6 shadow-none outline-none focus:ring-0 data-[focused=true]:ring-0 data-[focus-visible=true]:ring-0"
              maxLength={COMMENT_MAX_LENGTH + 50}
              placeholder={placeholder}
              ref={inputRef}
              rows={1}
              value={content}
              variant="secondary"
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
                  e.preventDefault()
                  onSubmit()
                }
              }}
            />
          </div>
          <AnimatePresence initial={false}>
            {content.length > 0 && remaining < 100 ? (
              <motion.span
                key="counter"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18, ease: easing }}
                className={`shrink-0 self-center rounded-full px-1.5 text-[10px] leading-5 tabular-nums ${
                  overLimit ? 'bg-danger-soft text-danger-soft-foreground' : 'bg-surface-secondary text-muted'
                }`}
              >
                {remaining}
              </motion.span>
            ) : null}
          </AnimatePresence>
          <Button
            isIconOnly
            aria-label="发布评论"
            className="size-9 shrink-0 self-end rounded-full"
            isDisabled={!canSubmit}
            isPending={isPosting}
            size="sm"
            variant="primary"
            onPress={onSubmit}
          >
            <PaperPlane className="size-4 -translate-x-px" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-background shadow-sm transition-[border-color,box-shadow] focus-within:border-accent/35 focus-within:shadow-md focus-within:shadow-accent/5">
      <div>
        <AnimatePresence initial={false}>
          {replyTarget ? (
            <motion.div
              key="reply-target"
              initial={{ opacity: 0, height: 0, marginBottom: 0, y: -2 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 6, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, y: -2 }}
              transition={{ duration: 0.22, ease: easing }}
              className="overflow-hidden px-4 pt-3 sm:px-5"
            >
              <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Person className="size-3.5 shrink-0" />
                  <span className="truncate">正在回复 @{replyTarget.nickname}</span>
                </span>
                <button
                  aria-label="取消回复"
                  className="-mr-1 flex size-5 shrink-0 cursor-(--cursor-interactive) items-center justify-center rounded-full hover:bg-accent/10"
                  onClick={onCancelReply}
                  type="button"
                >
                  <Xmark className="size-3.5" />
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <TextArea
          aria-label="评论输入框"
          className={`max-h-36 min-h-18 w-full resize-none border-0 bg-transparent px-4 pb-3 ${
            replyTarget ? 'pt-1' : 'pt-4'
          } text-sm leading-6 shadow-none outline-none focus:ring-0 data-[focused=true]:ring-0 data-[focus-visible=true]:ring-0 sm:px-5`}
          maxLength={COMMENT_MAX_LENGTH + 50}
          placeholder={placeholder}
          ref={inputRef}
          rows={2}
          value={content}
          variant="secondary"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
              e.preventDefault()
              onSubmit()
            }
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-surface-secondary/55 px-2 py-2 text-xs sm:pr-2 sm:pl-5 sm:py-2">
        <span
          className={`tabular-nums ${
            overLimit ? 'text-danger' : 'text-muted'
          }`}
        >
          {content.length} / {COMMENT_MAX_LENGTH}
        </span>
        <div className="flex items-center gap-2.5 text-muted">
          <span className="hidden sm:inline">
            ⌘/Ctrl + Enter 发送
          </span>
          <Button
            isDisabled={!canSubmit}
            isPending={isPosting}
            size="sm"
            variant="primary"
            onPress={onSubmit}
          >
            <PaperPlane className="size-3.5" />
            发布
          </Button>
        </div>
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  materialId,
  sort,
  uploaderUserId,
  onCommentElement,
  onPatch,
  onRepliesLoaded,
  onStartReply,
  onDeleted,
}: {
  comment: MaterialComment
  materialId: string | number
  sort: MaterialCommentSort
  uploaderUserId: number
  onCommentElement: (commentId: number, element: HTMLElement | null) => void
  onPatch: (commentId: number, patch: Partial<MaterialComment>) => void
  onRepliesLoaded: (rootId: number, replies: MaterialComment[]) => void
  onStartReply: (target: ReplyTarget) => void
  onDeleted: (comment: MaterialComment) => void
}) {
  const [isCollapsed, setCollapsed] = useState(comment.is_collapsed === true)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const [repliesPage, setRepliesPage] = useState(1)
  const [isLoadingReplies, setLoadingReplies] = useState(false)
  const { token } = useAuth()
  const { showDialog } = useDialog()

  const visibleReplies = comment.replies ?? []
  const remainingReplies = Math.max(0, comment.reply_count - visibleReplies.length)
  const hasMoreReplies = comment.reply_count > visibleReplies.length

  const loadMoreReplies = async () => {
    if (!token) return
    setLoadingReplies(true)
    try {
      // first time we expand: replace any preview reply (1 item) with full first page
      const targetPage = showAllReplies ? repliesPage + 1 : 1
      const data = await getMaterialCommentReplies({
        id: materialId,
        commentId: comment.id,
        page: targetPage,
        pageSize: REPLIES_PAGE_SIZE,
        sort,
        token,
      })
      const fetched = data.records ?? []
      if (showAllReplies) {
        const existingIds = new Set(visibleReplies.map((r) => r.id))
        const merged = [
          ...visibleReplies,
          ...fetched.filter((r) => !existingIds.has(r.id)),
        ]
        onRepliesLoaded(comment.id, merged)
      } else {
        onRepliesLoaded(comment.id, fetched)
        setShowAllReplies(true)
      }
      setRepliesPage(targetPage)
    } catch (err) {
      showDialog({
        status: 'danger',
        title: '加载回复失败',
        description: err instanceof Error ? err.message : '请稍后再试',
      })
    } finally {
      setLoadingReplies(false)
    }
  }

  if (isCollapsed) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-warning/35 bg-warning-soft/50 px-4 py-3 text-xs text-warning-soft-foreground">
        <span className="flex items-center gap-1.5 font-medium">
          <CircleExclamation className="size-3.5" />
          该评论因举报较多被折叠
        </span>
        <Button size="sm" variant="ghost" onPress={() => setCollapsed(false)}>
          仍然查看
        </Button>
      </div>
    )
  }

  return (
    <article className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-background p-3 sm:gap-3 sm:rounded-2xl sm:p-4">
      <CommentBody
        comment={comment}
        uploaderUserId={uploaderUserId}
        onPatch={onPatch}
        onStartReply={onStartReply}
        onDeleted={onDeleted}
      />

      {visibleReplies.length > 0 ? (
        <div className="ml-6 flex flex-col gap-2.5 border-l border-accent/20 pl-3 sm:ml-10 sm:gap-3 sm:border-l-2 sm:pl-4">
          <AnimatePresence initial={false}>
            {visibleReplies.map((reply) => (
              <motion.div
                key={reply.id}
                ref={(node) => onCommentElement(reply.id, node)}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18, ease: easing }}
              >
                <CommentBody
                  comment={reply}
                  isReply
                  rootId={comment.id}
                  uploaderUserId={uploaderUserId}
                  onPatch={onPatch}
                  onStartReply={onStartReply}
                  onDeleted={onDeleted}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : null}

      {hasMoreReplies ? (
        <Button
          className="ml-6 w-fit rounded-full text-muted hover:text-foreground sm:ml-10"
          isPending={isLoadingReplies}
          size="sm"
          variant="ghost"
          onPress={loadMoreReplies}
        >
          <ChevronDown className="size-3.5" />
          {showAllReplies
            ? `加载更多回复（剩余 ${remainingReplies}）`
            : `查看 ${comment.reply_count} 条回复`}
        </Button>
      ) : null}
    </article>
  )
}

function ExpandableCommentText({
  children,
  isDeleted,
}: {
  children: string
  isDeleted: boolean
}) {
  const textRef = useRef<HTMLParagraphElement | null>(null)
  const [isExpanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const [contentHeight, setContentHeight] = useState(0)
  const [trackedChildren, setTrackedChildren] = useState(children)

  if (trackedChildren !== children) {
    setTrackedChildren(children)
    if (isExpanded) setExpanded(false)
    if (canExpand) setCanExpand(false)
    if (contentHeight !== 0) setContentHeight(0)
  }

  useLayoutEffect(() => {
    const element = textRef.current
    if (!element) return

    const measure = () => {
      const nextHeight = element.scrollHeight
      const nextCanExpand = element.scrollHeight > COMMENT_COLLAPSED_HEIGHT + 1
      setContentHeight(nextHeight)
      setCanExpand(nextCanExpand)
      if (!nextCanExpand) setExpanded(false)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [children])

  return (
    <div className="flex min-w-0 flex-col items-start">
      <motion.div
        animate={{
          maxHeight:
            canExpand && !isExpanded
              ? COMMENT_COLLAPSED_HEIGHT
              : contentHeight || COMMENT_COLLAPSED_HEIGHT,
        }}
        className="relative min-w-0 max-w-full overflow-hidden"
        initial={false}
        transition={{ duration: 0.24, ease: easing }}
      >
        <p
          ref={textRef}
          className={`whitespace-pre-wrap wrap-break-word text-sm leading-5 sm:leading-6 ${
            isDeleted ? 'text-muted' : 'text-foreground/90'
          }`}
        >
          {children}
        </p>
        <AnimatePresence initial={false}>
          {canExpand && !isExpanded ? (
            <motion.div
              aria-hidden
              animate={{ opacity: 1 }}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-background"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: easing }}
            />
          ) : null}
        </AnimatePresence>
      </motion.div>
      {canExpand ? (
        <Button
          aria-expanded={isExpanded}
          className="-ml-2 mt-1 h-7 rounded-full px-2 text-xs text-muted hover:text-foreground"
          size="sm"
          variant="ghost"
          onPress={() => setExpanded((expanded) => !expanded)}
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
          {isExpanded ? '收起' : '展开'}
        </Button>
      ) : null}
    </div>
  )
}

function CommentBody({
  comment,
  isReply = false,
  rootId,
  uploaderUserId,
  onPatch,
  onStartReply,
  onDeleted,
}: {
  comment: MaterialComment
  isReply?: boolean
  rootId?: number
  uploaderUserId: number
  onPatch: (commentId: number, patch: Partial<MaterialComment>) => void
  onStartReply: (target: ReplyTarget) => void
  onDeleted: (comment: MaterialComment) => void
}) {
  const { token, profile } = useAuth()
  const { showDialog } = useDialog()
  const [isRating, setRating] = useState<'like' | 'hate' | null>(null)
  const isDeleted = comment.is_deleted === true
  const isOwnComment = profile?.id === comment.user_id
  const isUploaderComment = comment.user_id === uploaderUserId
  const hasLikeCount = comment.like_count > 0
  const hasHateCount = comment.hate_count > 0
  const shouldShowReplyTarget =
    isReply &&
    !isDeleted &&
    comment.parent_id != null &&
    comment.root_id != null &&
    comment.parent_id !== comment.root_id &&
    Boolean(comment.reply_to_user_nickname)

  const handleRate = async (rating: 'like' | 'hate') => {
    if (!token) return
    const currentlySet =
      rating === 'like' ? comment.has_liked === true : comment.has_hated === true
    const otherSet =
      rating === 'like' ? comment.has_hated === true : comment.has_liked === true
    setRating(rating)
    try {
      await rateMaterialComment({
        commentId: comment.id,
        rating,
        set: !currentlySet,
        token,
      })
      const patch: Partial<MaterialComment> = {}
      if (rating === 'like') {
        patch.has_liked = !currentlySet
        patch.like_count = comment.like_count + (currentlySet ? -1 : 1)
        if (otherSet) {
          patch.has_hated = false
          patch.hate_count = Math.max(0, comment.hate_count - 1)
        }
      } else {
        patch.has_hated = !currentlySet
        patch.hate_count = comment.hate_count + (currentlySet ? -1 : 1)
        if (otherSet) {
          patch.has_liked = false
          patch.like_count = Math.max(0, comment.like_count - 1)
        }
      }
      onPatch(comment.id, patch)
    } catch (err) {
      showDialog({
        status: 'danger',
        title: '操作失败',
        description: err instanceof Error ? err.message : '请稍后再试',
      })
    } finally {
      setRating(null)
    }
  }

  const handleStartReply = () => {
    if (isDeleted) return
    onStartReply({
      rootId: rootId ?? comment.id,
      parentId: comment.id,
      nickname: comment.author_nickname || '匿名',
    })
  }

  // Avatar URL from API constants if avatar_path begins with "/"
  const avatarUrl = comment.author_avatar_path
    ? comment.author_avatar_path.startsWith('http')
      ? comment.author_avatar_path
      : `${constants.API_URL}${comment.author_avatar_path}`
    : null

  return (
    <div className="flex gap-2.5 sm:gap-3">
      <div className="shrink-0">
        <CommentAvatar
          avatar={isDeleted ? null : avatarUrl}
          nickname={comment.author_nickname}
          size={isReply ? 24 : 32}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                {isDeleted ? '已删除' : comment.author_nickname || '匿名用户'}
              </span>
              {!isDeleted && isUploaderComment ? (
                <Chip
                  className="h-5 shrink-0 px-1.5"
                  color="accent"
                  size="sm"
                  variant="soft"
                >
                  <Chip.Label className="text-[11px]">上传者</Chip.Label>
                </Chip>
              ) : !isDeleted && comment.author_has_purchased ? (
                <Chip
                  className="h-5 shrink-0 px-1.5"
                  color="success"
                  size="sm"
                  variant="soft"
                >
                  <Chip.Label className="text-[11px]">已购买</Chip.Label>
                </Chip>
              ) : null}
            </div>
            {shouldShowReplyTarget ? (
              <span className="min-w-0 truncate text-xs text-muted">
                回复 <span className="text-accent">@{comment.reply_to_user_nickname}</span>
              </span>
            ) : null}
          </div>
          <span className="shrink-0 pt-0.5 text-[11px] leading-4 text-muted sm:text-xs">
            {formatDateTime(comment.created_at)}
          </span>
        </div>
        <ExpandableCommentText isDeleted={isDeleted}>
          {isDeleted ? '这条评论已被作者删除' : comment.content}
        </ExpandableCommentText>
        {!isDeleted ? (
          <div className="-ml-1 mt-0.5 flex items-center gap-0.5 text-xs text-muted">
            <Button
              aria-label={comment.has_liked ? '取消点赞' : '点赞'}
              className="gap-0 px-0 text-muted hover:text-foreground"
              isPending={isRating === 'like'}
              size="sm"
              variant="ghost"
              onPress={() => handleRate('like')}
            >
              <span className="flex size-9 shrink-0 items-center justify-center md:size-8">
                <AnimatedToggle
                  active={comment.has_liked === true}
                  on={<ThumbsUpFill className="size-3.5" />}
                  off={<ThumbsUp className="size-3.5" />}
                />
              </span>
              <AnimatePresence initial={false}>
                {hasLikeCount ? (
                  <motion.span
                    key="like-count"
                    initial={{ opacity: 0, width: 0, scale: 0.8 }}
                    animate={{ opacity: 1, width: 'auto', scale: 1 }}
                    exit={{ opacity: 0, width: 0, scale: 0.8 }}
                    transition={{ duration: 0.2, ease: easing }}
                    className="flex h-9 items-center overflow-hidden whitespace-nowrap leading-none text-foreground md:h-8"
                  >
                    <span className="flex h-full items-center pr-2.5 sm:pr-3">
                      <AnimatedNumber value={comment.like_count} />
                    </span>
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </Button>
            <Button
              aria-label={comment.has_hated ? '取消点踩' : '点踩'}
              className="gap-0 px-0 text-muted hover:text-foreground"
              isPending={isRating === 'hate'}
              size="sm"
              variant="ghost"
              onPress={() => handleRate('hate')}
            >
              <span className="flex size-9 shrink-0 items-center justify-center md:size-8">
                <AnimatedToggle
                  active={comment.has_hated === true}
                  on={<ThumbsDownFill className="size-3.5" />}
                  off={<ThumbsDown className="size-3.5" />}
                />
              </span>
              <AnimatePresence initial={false}>
                {hasHateCount ? (
                  <motion.span
                    key="hate-count"
                    initial={{ opacity: 0, width: 0, scale: 0.8 }}
                    animate={{ opacity: 1, width: 'auto', scale: 1 }}
                    exit={{ opacity: 0, width: 0, scale: 0.8 }}
                    transition={{ duration: 0.2, ease: easing }}
                    className="flex h-9 items-center overflow-hidden whitespace-nowrap leading-none text-foreground md:h-8"
                  >
                    <span className="flex h-full items-center pr-2.5 sm:pr-3">
                      <AnimatedNumber value={comment.hate_count} />
                    </span>
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </Button>
            <Button
              className="min-w-8 px-1.5 text-muted hover:text-foreground sm:px-2"
              size="sm"
              variant="ghost"
              onPress={handleStartReply}
            >
              <Comments className="size-3.5" />
              <span className="hidden sm:inline">回复</span>
            </Button>
            <CommentMenu
              comment={comment}
              isOwnComment={isOwnComment}
              onDeleted={onDeleted}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CommentMenu({
  comment,
  isOwnComment,
  onDeleted,
}: {
  comment: MaterialComment
  isOwnComment: boolean
  onDeleted: (comment: MaterialComment) => void
}) {
  const [isReportOpen, setReportOpen] = useState(false)
  const [isDeleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <Dropdown>
        <Button
          isIconOnly
          aria-label="更多操作"
          className="size-8"
          size="sm"
          variant="ghost"
        >
          <EllipsisVertical className="size-3.5" />
        </Button>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            onAction={(key) => {
              if (key === 'report') setReportOpen(true)
              if (key === 'delete') setDeleteOpen(true)
            }}
          >
            {isOwnComment ? (
              <Dropdown.Item id="delete" textValue="删除评论" variant="danger">
                <TrashBin className="size-4 shrink-0 text-danger" />
                <Label>删除评论</Label>
              </Dropdown.Item>
            ) : null}
            {!isOwnComment ? (
              <Dropdown.Item id="report" textValue="举报评论" variant="danger">
                <Flag className="size-4 shrink-0 text-danger" />
                <Label>举报评论</Label>
              </Dropdown.Item>
            ) : null}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {!isOwnComment ? (
        <ReportDialog
          commentId={comment.id}
          isOpen={isReportOpen}
          onOpenChange={setReportOpen}
        />
      ) : null}
      <DeleteCommentDialog
        comment={comment}
        isOpen={isDeleteOpen}
        onDeleted={onDeleted}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

function DeleteCommentDialog({
  comment,
  isOpen,
  onDeleted,
  onOpenChange,
}: {
  comment: MaterialComment
  isOpen: boolean
  onDeleted: (comment: MaterialComment) => void
  onOpenChange: (open: boolean) => void
}) {
  const { token } = useAuth()
  const { showDialog } = useDialog()
  const [isDeleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!token) return
    setDeleting(true)
    try {
      await deleteMaterialComment({ commentId: comment.id, token })
      onDeleted(comment)
      onOpenChange(false)
      showDialog({ status: 'success', title: '评论已删除' })
    } catch (err) {
      onOpenChange(false)
      showDialog({
        status: 'danger',
        title: '删除失败',
        description: err instanceof Error ? err.message : '请稍后再试',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container placement="center">
        <AlertDialog.Dialog className="sm:max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger">
              <CircleXmark className="size-5" />
            </AlertDialog.Icon>
            <AlertDialog.Heading>删除评论</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="text-sm leading-6">
              删除后无法恢复。若这条评论已有回复，评论内容会被清空并保留回复串。
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="secondary">
              取消
            </Button>
            <Button
              isPending={isDeleting}
              variant="danger"
              onPress={handleDelete}
            >
              <TrashBin className="size-4" />
              删除
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}

function ReportDialog({
  commentId,
  isOpen,
  onOpenChange,
}: {
  commentId: number
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { token } = useAuth()
  const { showDialog } = useDialog()
  const [reasons, setReasons] = useState<MaterialCommentReportReason[]>([])
  const [reason, setReason] = useState<string>('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setSubmitting] = useState(false)
  const [isLoadingReasons, setLoadingReasons] = useState(false)
  const [trackedOpen, setTrackedOpen] = useState(isOpen)
  if (trackedOpen !== isOpen) {
    setTrackedOpen(isOpen)
    if (isOpen && reasons.length === 0) {
      setLoadingReasons(true)
    }
  }

  useEffect(() => {
    if (!isOpen || !token || reasons.length > 0) return
    const controller = new AbortController()
    getMaterialCommentReportReasons({ token, signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setReasons(data)
        if (data.length > 0) setReason(data[0].code)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        onOpenChange(false)
        showDialog({
          status: 'danger',
          title: '加载举报选项失败',
          description: err instanceof Error ? err.message : '请稍后再试',
        })
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoadingReasons(false)
      })
    return () => controller.abort()
  }, [isOpen, token, reasons.length, onOpenChange, showDialog])

  const handleSubmit = async () => {
    if (!token || !reason) return
    setSubmitting(true)
    try {
      await reportMaterialComment({
        commentId,
        reason,
        description,
        token,
      })
      onOpenChange(false)
      showDialog({
        status: 'success',
        title: '举报已提交',
        description: '感谢您的反馈，我们会尽快处理。',
      })
      setDescription('')
    } catch (err) {
      onOpenChange(false)
      showDialog({
        status: 'danger',
        title: '举报失败',
        description: err instanceof Error ? err.message : '请稍后再试',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container placement="center">
        <AlertDialog.Dialog className="sm:max-w-md">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>举报评论</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="overflow-visible">
            {isLoadingReasons ? (
              <div className="flex items-center gap-2 text-sm">
                <Spinner size="sm" /> 加载中…
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <Select
                  aria-label="举报理由"
                  fullWidth
                  placeholder="选择举报理由"
                  value={reason || null}
                  variant="secondary"
                  onChange={(value) => setReason(value == null ? '' : String(value))}
                >
                  <Label className="text-sm font-medium">选择举报理由</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {reasons.map((r) => (
                        <ListBox.Item key={r.code} id={r.code} textValue={r.label}>
                          {r.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-medium" htmlFor="report-detail">
                    补充说明（可选）
                  </Label>
                  <TextArea
                    id="report-detail"
                    className="min-h-20 w-full"
                    maxLength={500}
                    placeholder="请提供有助于审核的更多信息"
                    rows={3}
                    value={description}
                    variant="secondary"
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="secondary">
              取消
            </Button>
            <Button
              isDisabled={!reason}
              isPending={isSubmitting}
              variant="danger"
              onPress={handleSubmit}
            >
              <Flag className="size-4" />
              提交举报
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}

function CommentAvatar({
  avatar,
  nickname,
  size,
}: {
  avatar: string | null
  nickname?: string | null
  size: number
}) {
  if (avatar) {
    return (
      <img
        alt={nickname ?? '用户头像'}
        className="rounded-full object-cover ring-2 ring-background"
        height={size}
        src={avatar}
        width={size}
      />
    )
  }
  return (
    <div
      aria-hidden
      className="flex items-center justify-center rounded-full bg-surface-secondary text-muted ring-2 ring-background"
      style={{ width: size, height: size }}
    >
      <Person className="size-[55%]" />
    </div>
  )
}

function CommentsEmpty() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-surface-secondary/55 px-5 py-4 text-left">
      <div
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-background text-muted shadow-sm ring-1 ring-border/60"
      >
        <Comments className="size-[1.125rem]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">暂无评论</p>
        <p className="mt-0.5 text-xs text-muted">来抢沙发，分享您的看法吧。</p>
      </div>
    </div>
  )
}

function CommentsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex gap-2.5 rounded-xl border border-border/70 bg-background p-3 sm:gap-3 sm:rounded-2xl sm:p-4"
        >
          <Skeleton className="size-8 shrink-0 rounded-full sm:size-9" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
            <Skeleton className="h-3 w-4/5 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MaterialDetailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border/70 bg-background px-5 pb-5 pt-6 sm:px-10 sm:pb-7 sm:pt-8">
        <div className="flex min-w-0 items-start gap-3 pr-10 sm:gap-5">
          <Skeleton className="size-12 shrink-0 rounded-2xl sm:size-14" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-18 rounded-full" />
            </div>
            <Skeleton className="h-7 w-4/5 rounded-xl sm:h-8 sm:w-3/5" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-4 w-40 rounded-lg" />
              <Skeleton className="h-4 w-32 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      <div className={`flex min-h-0 flex-1 flex-col ${detailSurfaceBg}`}>
        <div className="mx-4 mt-3 lg:hidden">
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-xl" />
            <Skeleton className="h-9 flex-1 rounded-xl" />
          </div>
        </div>

        <div className="grid gap-6 px-5 pb-6 pt-4 sm:px-10 sm:pb-9 sm:pt-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-8">
          <main className="flex min-w-0 flex-col gap-5">
            <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-sm shadow-black/5">
              <div className="border-b border-border/60 bg-linear-to-r from-background to-surface-secondary/70 px-4 py-4 sm:px-5">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-5 w-24 rounded-lg" />
                    <Skeleton className="mt-2 h-4 w-48 rounded-lg" />
                  </div>
                  <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
                </div>
              </div>
              <div className="grid gap-px bg-border/50 sm:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="flex min-w-0 flex-col gap-1 bg-background px-4 py-3.5 sm:px-5"
                  >
                    <Skeleton className="h-3 w-14 rounded-md" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                  </div>
                ))}
                <div className="flex min-w-0 flex-col gap-2 bg-background px-4 py-4 sm:col-span-2 sm:px-5">
                  <Skeleton className="h-3 w-18 rounded-md" />
                  <div className="rounded-2xl border border-border/60 bg-surface-secondary/60 px-4 py-3">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="mt-2 h-4 w-5/6 rounded-md" />
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-sm shadow-black/5 lg:block">
              <div className="flex items-center justify-between border-b border-border/60 bg-linear-to-r from-background to-surface-secondary/70 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-xl" />
                  <Skeleton className="h-5 w-24 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-background">
                  <div className="px-4 pb-3 pt-4 sm:px-5">
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 bg-surface-secondary/55 px-4 py-2 sm:px-5 sm:py-2.5">
                    <Skeleton className="h-4 w-16 rounded-md" />
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                </div>
                <CommentsSkeleton />
              </div>
            </div>
          </main>

          <aside className="hidden lg:block">
            <div className="overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-sm shadow-black/5">
              <div className="border-b border-border/60 bg-linear-to-br from-accent-soft/80 via-background to-surface-secondary px-5 pb-4 pt-5">
                <div className="flex min-w-0 gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-5 w-24 rounded-lg" />
                    <Skeleton className="mt-2 h-4 w-full rounded-lg" />
                    <Skeleton className="mt-2 h-4 w-4/5 rounded-lg" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 bg-background px-5 py-1">
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
                <Skeleton className="h-11 w-full rounded-full" />
              </div>
              <div className="flex justify-between border-t border-border/60 bg-surface-secondary/55 px-3 py-2">
                <Skeleton className="h-8 w-16 rounded-full" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-8 w-16 rounded-full" />
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-background/85 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgb(0_0_0/0.06)] backdrop-blur-xl sm:px-7 lg:hidden">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
            <Skeleton className="h-11 w-full rounded-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-16 rounded-full" />
              <div className="flex gap-1.5">
                <Skeleton className="h-8 w-16 rounded-full" />
                <Skeleton className="h-8 w-16 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function updateCommentInTree(
  tree: MaterialComment[],
  commentId: number,
  patch: Partial<MaterialComment>,
): MaterialComment[] {
  return tree.map((c) => {
    if (c.id === commentId) {
      return { ...c, ...patch }
    }
    if (c.replies && c.replies.length > 0) {
      return { ...c, replies: updateCommentInTree(c.replies, commentId, patch) }
    }
    return c
  })
}

function prependReplyToRootComment(
  tree: MaterialComment[],
  reply: MaterialComment,
): MaterialComment[] {
  if (reply.root_id == null) return tree

  return tree.map((c) => {
    if (c.id !== reply.root_id) return c

    const replies = c.replies ?? []
    const alreadyVisible = replies.some((r) => r.id === reply.id)

    return {
      ...c,
      replies: [reply, ...replies.filter((r) => r.id !== reply.id)],
      reply_count: alreadyVisible ? c.reply_count : c.reply_count + 1,
    }
  })
}

function removeDeletedComment(
  tree: MaterialComment[],
  deleted: MaterialComment,
): MaterialComment[] {
  if (deleted.root_id == null) {
    if (deleted.reply_count > 0) {
      return updateCommentInTree(tree, deleted.id, {
        author_avatar_path: null,
        author_nickname: '',
        content: '',
        has_hated: false,
        has_liked: false,
        hate_count: 0,
        is_collapsed: false,
        is_deleted: true,
        like_count: 0,
        report_count: 0,
      })
    }
    return tree.filter((c) => c.id !== deleted.id)
  }

  return tree.map((c) => {
    if (c.id !== deleted.root_id) return c
    return {
      ...c,
      replies: (c.replies ?? []).filter((reply) => reply.id !== deleted.id),
      reply_count: Math.max(0, c.reply_count - 1),
    }
  })
}

function formatAuthorName(material: Material): string {
  if (material.is_mine) return '您'
  if (material.author_nickname && material.author_nickname.trim()) {
    return material.author_nickname
  }
  return '匿名用户'
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 'KB'
  for (let i = 0; i < units.length; i++) {
    unit = units[i]
    if (value < 1024 || i === units.length - 1) break
    value /= 1024
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${unit}`
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const dayMs = 1000 * 60 * 60 * 24
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60_000) return '刚刚'
  if (diffMs < 60 * 60_000) return `${Math.floor(diffMs / 60_000)} 分钟前`
  if (diffMs < dayMs) return `${Math.floor(diffMs / (60 * 60_000))} 小时前`
  if (diffMs < 7 * dayMs) return `${Math.floor(diffMs / dayMs)} 天前`
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
