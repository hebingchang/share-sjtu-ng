import {
  ArrowRightArrowLeft,
  ArrowRotateRight,
  Check,
  CircleDollar,
  Clock,
  Copy,
  Funnel,
  PersonPlus,
  Xmark,
} from '@gravity-ui/icons'
import {
  Alert,
  AlertDialog,
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  NumberField,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  TextField,
  type Key,
} from '@heroui/react'
import { DataGrid, type DataGridColumn } from '@heroui-pro/react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  acceptPointTransfer,
  createPointTransfer,
  getPendingPointTransfers,
  getPointTransferAddress,
  getPointTransferMonthlyQuota,
  getPointTransferRecords,
  getUserProfile,
  rejectPointTransfer,
} from '../../api/user'
import { useAuth } from '../../auth/use-auth'
import { useDialog } from '../../dialog/use-dialog'
import type {
  PointTransferDirection,
  PointTransferFeeMode,
  PointTransferMonthlyQuota,
  PointTransferRecord,
  PointTransferStatus,
} from '../../types/user'
import { ErrorPanel, LoadingState, MotionItem, MotionStagger, UserPagination } from './shared'
import { cx, formatDateTime, isAbortError } from './utils'

const MIN_TRANSFER_AMOUNT = 2
const MAX_TRANSFER_AMOUNT = 20
const POINT_TRANSFER_RECORDS_PAGE_SIZE = 10
const POINT_TRANSFER_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{16}$/
const FILTER_ALL = 'all'

type PointTransferDirectionFilter = PointTransferDirection | typeof FILTER_ALL
type PointTransferStatusFilter = PointTransferStatus | typeof FILTER_ALL

interface TransferPreview {
  deductedAmount: number
  fee: number
  receivedAmount: number
}

interface TransferRecordRow extends PointTransferRecord {
  amountText: string
  counterpartyAddress: string
  directionText: string
  feeModeText: string
  feeText: string
  receivedText: string
  statusText: string
  timeText: string
}

const POINT_TRANSFER_DIRECTION_LABELS: Record<PointTransferDirection, string> = {
  received: '我收到的',
  sent: '我发起的',
}

const POINT_TRANSFER_STATUS_META: Record<
  PointTransferStatus,
  {
    color: 'default' | 'accent' | 'success' | 'warning' | 'danger'
    label: string
  }
> = {
  accepted: { color: 'success', label: '已完成' },
  expired: { color: 'default', label: '已过期' },
  pending: { color: 'warning', label: '待接受' },
  rejected: { color: 'danger', label: '已拒绝' },
}

const POINT_TRANSFER_FEE_MODE_LABELS: Record<PointTransferFeeMode, string> = {
  external: '外扣',
  internal: '内扣',
}

const FEE_MODE_OPTIONS: {
  description: string
  id: PointTransferFeeMode
  title: string
}[] = [
  {
    description: '本人额外支付手续费，对方收到完整转账金额。',
    id: 'external',
    title: '外扣手续费',
  },
  {
    description: '手续费从转账金额中扣除，对方收到扣费后的金额。',
    id: 'internal',
    title: '内扣手续费',
  },
]

const DIRECTION_FILTER_OPTIONS: { id: PointTransferDirectionFilter; label: string }[] = [
  { id: FILTER_ALL, label: '全部方向' },
  { id: 'sent', label: POINT_TRANSFER_DIRECTION_LABELS.sent },
  { id: 'received', label: POINT_TRANSFER_DIRECTION_LABELS.received },
]

const STATUS_FILTER_OPTIONS: { id: PointTransferStatusFilter; label: string }[] = [
  { id: FILTER_ALL, label: '全部状态' },
  { id: 'pending', label: POINT_TRANSFER_STATUS_META.pending.label },
  { id: 'accepted', label: POINT_TRANSFER_STATUS_META.accepted.label },
  { id: 'rejected', label: POINT_TRANSFER_STATUS_META.rejected.label },
  { id: 'expired', label: POINT_TRANSFER_STATUS_META.expired.label },
]

const RECORD_COLUMN_CLASSES = {
  amount: 'w-[14%]',
  counterparty: 'w-[27%]',
  direction: 'w-[12%]',
  fee: 'w-[13%]',
  status: 'w-[12%]',
  time: 'w-[22%]',
} as const
const RECORD_COLUMN_CLASS = 'overflow-hidden whitespace-nowrap'
const RECORD_TEXT_CLASS = 'block min-w-0 max-w-full truncate'

function getTotalPages(total: number): number {
  return Math.max(1, Math.ceil(total / POINT_TRANSFER_RECORDS_PAGE_SIZE))
}

function getTransferPreview(amount: number, feeMode: PointTransferFeeMode): TransferPreview {
  const fee = Math.ceil(amount / 10)
  const receivedAmount = feeMode === 'internal' ? amount - fee : amount
  const deductedAmount = feeMode === 'internal' ? amount : amount + fee

  return { deductedAmount, fee, receivedAmount }
}

function formatPoints(value: number): string {
  return `${value} 积分`
}

function normalizeAddress(address: string): string {
  return address.trim()
}

function getReceiverAddressError(
  receiverAddress: string,
  ownAddress: string | null,
): string | null {
  const address = normalizeAddress(receiverAddress)

  if (!address) return '请输入对方地址'
  if (!POINT_TRANSFER_ADDRESS_PATTERN.test(address)) return '地址格式应为 0x 加 16 位十六进制'
  if (ownAddress && address.toLowerCase() === ownAddress.toLowerCase()) {
    return '不能向自己的地址转账'
  }

  return null
}

function isPointTransferDirection(value: unknown): value is PointTransferDirection {
  return value === 'sent' || value === 'received'
}

function isPointTransferStatus(value: unknown): value is PointTransferStatus {
  return value === 'pending' || value === 'accepted' || value === 'rejected' || value === 'expired'
}

function isPointTransferFeeMode(value: string): value is PointTransferFeeMode {
  return value === 'internal' || value === 'external'
}

function getDirectionFilter(value: Key | null): PointTransferDirectionFilter {
  const nextValue = String(value ?? FILTER_ALL)

  return isPointTransferDirection(nextValue) ? nextValue : FILTER_ALL
}

function getStatusFilter(value: Key | null): PointTransferStatusFilter {
  const nextValue = String(value ?? FILTER_ALL)

  return isPointTransferStatus(nextValue) ? nextValue : FILTER_ALL
}

function getRecordCounterparty(record: PointTransferRecord): string {
  return record.direction === 'sent' ? record.receiver_address : record.sender_address
}

function getRecordTimeText(record: PointTransferRecord): string {
  if (record.status === 'pending') return `过期 ${formatDateTime(record.expires_at)}`
  if (record.status === 'accepted') {
    return `完成 ${formatDateTime(record.completed_at ?? record.accepted_at)}`
  }
  if (record.status === 'rejected') return `退回 ${formatDateTime(record.refunded_at)}`

  return `退回 ${formatDateTime(record.refunded_at ?? record.completed_at)}`
}

function getRecordColumnClassNames(widthClassName: string, cellClassName?: string) {
  return {
    cellClassName: cx(RECORD_COLUMN_CLASS, widthClassName, cellClassName),
    headerClassName: cx(RECORD_COLUMN_CLASS, widthClassName),
  }
}

function MetricTile({
  label,
  tone = 'default',
  value,
}: {
  label: string
  tone?: 'default' | 'accent' | 'danger' | 'success' | 'warning'
  value: string | number
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cx(
          'mt-1 truncate text-sm font-semibold tabular-nums',
          tone === 'accent' && 'text-accent',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'default' && 'text-foreground',
        )}
        title={String(value)}
      >
        {value}
      </p>
    </div>
  )
}

function TransferLoadingBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-surface/95 px-3 py-2 text-sm text-muted shadow-surface">
      <Spinner size="sm" />
      <span>{label}</span>
    </div>
  )
}

function RecordsTableLoadingState() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <TransferLoadingBadge label="正在加载转账记录" />
    </div>
  )
}

function StatusChip({ status }: { status: PointTransferStatus }) {
  const meta = POINT_TRANSFER_STATUS_META[status]

  return (
    <Chip color={meta.color} size="sm" variant="soft">
      {meta.label}
    </Chip>
  )
}

function AddressPanel({
  address,
  isLoading,
  onCopy,
}: {
  address: string | null
  isLoading: boolean
  onCopy: () => void
}) {
  return (
    <Card className="min-w-0">
      <Card.Header>
        <Card.Title>我的地址</Card.Title>
        <Card.Description>用于接收其他用户发来的积分转账。</Card.Description>
      </Card.Header>
      <Card.Content className="gap-4">
        <div className="min-w-0 rounded-2xl border border-border/70 bg-surface px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">转账地址</p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate font-address text-base text-foreground">
                {address ?? (isLoading ? '正在加载' : '地址暂不可用')}
              </p>
              <Button
                isIconOnly
                aria-label="复制转账地址"
                className="size-7 shrink-0 text-muted hover:text-foreground"
                isDisabled={!address}
                size="sm"
                type="button"
                variant="ghost"
                onPress={onCopy}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  )
}

function MonthlyQuotaPanel({
  monthly,
  isLoading,
}: {
  isLoading: boolean
  monthly: PointTransferMonthlyQuota | null
}) {
  const reserved = monthly?.reserved_points ?? 0
  const limit = monthly?.monthly_limit ?? 30
  const quotaPercent = limit > 0 ? Math.min(100, Math.max(0, (reserved / limit) * 100)) : 0

  return (
    <Card className="min-w-0">
      <Card.Header>
        <Card.Title>当月额度</Card.Title>
        <Card.Description>
          {monthly
            ? `${formatDateTime(monthly.month_start)} 至 ${formatDateTime(monthly.month_end)}`
            : isLoading
              ? '正在加载额度'
              : '额度暂不可用'}
        </Card.Description>
      </Card.Header>
      <Card.Content className="gap-4 my-3">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">已使用额度</span>
            <span className="font-medium tabular-nums text-foreground">
              {reserved} / {limit}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-secondary">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        </div>
      </Card.Content>
    </Card>
  )
}

function TransferPreviewPanel({
  balance,
  isBalanceInsufficient,
  isQuotaExceeded,
  preview,
}: {
  balance: number | null
  isBalanceInsufficient: boolean
  isQuotaExceeded: boolean
  preview: TransferPreview
}) {
  const balanceAfterTransfer = balance === null ? null : balance - preview.deductedAmount

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="手续费" tone="warning" value={formatPoints(preview.fee)} />
        <MetricTile label="对方到账" tone="success" value={formatPoints(preview.receivedAmount)} />
        <MetricTile
          label="当前账户扣除"
          tone="danger"
          value={formatPoints(preview.deductedAmount)}
        />
        <MetricTile
          label="发起后余额"
          tone={isBalanceInsufficient ? 'danger' : 'accent'}
          value={balanceAfterTransfer === null ? '待计算' : formatPoints(balanceAfterTransfer)}
        />
      </div>

      {isQuotaExceeded ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>本月额度不足</Alert.Title>
            <Alert.Description>这笔转账预计到账积分超过当前可用额度。</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {isBalanceInsufficient ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>积分余额不足</Alert.Title>
            <Alert.Description>请降低金额或调整手续费模式后再发起。</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </div>
  )
}

function PendingTransferItem({
  isBusy,
  transfer,
  onAccept,
  onReject,
}: {
  isBusy: boolean
  onAccept: () => void
  onReject: () => void
  transfer: PointTransferRecord
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <PersonPlus className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {transfer.sender_address}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {POINT_TRANSFER_FEE_MODE_LABELS[transfer.fee_mode]} · 过期{' '}
                {formatDateTime(transfer.expires_at)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
            <span className="tabular-nums">转账 {formatPoints(transfer.amount)}</span>
            <span className="tabular-nums">到账 {formatPoints(transfer.received_amount)}</span>
            <span className="tabular-nums">手续费 {formatPoints(transfer.fee)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button
            isDisabled={isBusy}
            isPending={isBusy}
            size="sm"
            type="button"
            variant="primary"
            onPress={onAccept}
          >
            <Check className="size-4 shrink-0" />
            接受
          </Button>
          <Button isDisabled={isBusy} size="sm" type="button" variant="outline" onPress={onReject}>
            <Xmark className="size-4 shrink-0" />
            拒绝
          </Button>
        </div>
      </div>
    </div>
  )
}

function PointTransferStatusCell({ record }: { record: TransferRecordRow }) {
  return <StatusChip status={record.status} />
}

function PointTransferTextCell({
  className,
  title,
  value,
}: {
  className?: string
  title?: string
  value: string
}) {
  return (
    <span className={cx(RECORD_TEXT_CLASS, className)} title={title ?? value}>
      {value}
    </span>
  )
}

export function PointTransferView() {
  const { isInitializing, profile, setProfile, token } = useAuth()
  const { showDialog } = useDialog()
  const [address, setAddress] = useState<string | null>(null)
  const [monthly, setMonthly] = useState<PointTransferMonthlyQuota | null>(null)
  const [pendingTransfers, setPendingTransfers] = useState<PointTransferRecord[]>([])
  const [isOverviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [overviewReloadKey, setOverviewReloadKey] = useState(0)

  const [receiverAddress, setReceiverAddress] = useState('')
  const [isAddressTouched, setAddressTouched] = useState(false)
  const [amount, setAmount] = useState(10)
  const [feeMode, setFeeMode] = useState<PointTransferFeeMode>('external')
  const [isTransferConfirmOpen, setTransferConfirmOpen] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [pendingActionId, setPendingActionId] = useState<number | null>(null)

  const [records, setRecords] = useState<PointTransferRecord[]>([])
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [isRecordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [recordsReloadKey, setRecordsReloadKey] = useState(0)
  const [directionFilter, setDirectionFilter] = useState<PointTransferDirectionFilter>(FILTER_ALL)
  const [statusFilter, setStatusFilter] = useState<PointTransferStatusFilter>(FILTER_ALL)

  const preview = useMemo(() => getTransferPreview(amount, feeMode), [amount, feeMode])
  const balance = profile?.points?.points ?? null
  const addressError = useMemo(
    () => getReceiverAddressError(receiverAddress, address),
    [address, receiverAddress],
  )
  const visibleAddressError = isAddressTouched ? addressError : null
  const isQuotaExceeded = monthly !== null && monthly.available_points - preview.receivedAmount < 0
  const isBalanceInsufficient = balance !== null && balance < preview.deductedAmount
  const canSubmit =
    !!token &&
    !!monthly &&
    !isSubmitting &&
    !isOverviewLoading &&
    !addressError &&
    !isQuotaExceeded &&
    !isBalanceInsufficient
  const hasDirectionFilter = directionFilter !== FILTER_ALL
  const hasStatusFilter = statusFilter !== FILTER_ALL
  const recordsTotalPages = getTotalPages(recordsTotal)
  const shouldShowRecordsTable = isRecordsLoading || records.length > 0
  const rows = useMemo<TransferRecordRow[]>(
    () =>
      records.map((record) => ({
        ...record,
        amountText: formatPoints(record.amount),
        counterpartyAddress: getRecordCounterparty(record),
        directionText: POINT_TRANSFER_DIRECTION_LABELS[record.direction],
        feeModeText: POINT_TRANSFER_FEE_MODE_LABELS[record.fee_mode],
        feeText: formatPoints(record.fee),
        receivedText: formatPoints(record.received_amount),
        statusText: POINT_TRANSFER_STATUS_META[record.status].label,
        timeText: getRecordTimeText(record),
      })),
    [records],
  )
  const columns = useMemo<DataGridColumn<TransferRecordRow>[]>(
    () => [
      {
        accessorKey: 'directionText',
        cell: (record) => (
          <PointTransferTextCell
            className="font-medium text-foreground"
            value={record.directionText}
          />
        ),
        header: '方向',
        id: 'direction',
        isRowHeader: true,
        ...getRecordColumnClassNames(RECORD_COLUMN_CLASSES.direction),
      },
      {
        accessorKey: 'counterpartyAddress',
        cell: (record) => (
          <PointTransferTextCell
            className="font-address text-foreground"
            value={record.counterpartyAddress}
          />
        ),
        header: '对方地址',
        id: 'counterparty',
        ...getRecordColumnClassNames(RECORD_COLUMN_CLASSES.counterparty),
      },
      {
        accessorKey: 'receivedText',
        cell: (record) => (
          <PointTransferTextCell
            className="font-medium tabular-nums text-success"
            title={`转账 ${record.amountText}，对方到账 ${record.receivedText}`}
            value={record.receivedText}
          />
        ),
        header: '到账积分',
        id: 'amount',
        ...getRecordColumnClassNames(RECORD_COLUMN_CLASSES.amount),
      },
      {
        accessorKey: 'feeText',
        cell: (record) => (
          <PointTransferTextCell
            className="tabular-nums text-muted"
            title={`${record.feeModeText}，手续费 ${record.feeText}`}
            value={record.feeText}
          />
        ),
        header: '手续费',
        id: 'fee',
        ...getRecordColumnClassNames(RECORD_COLUMN_CLASSES.fee),
      },
      {
        accessorKey: 'statusText',
        cell: (record) => <PointTransferStatusCell record={record} />,
        header: '状态',
        id: 'status',
        ...getRecordColumnClassNames(RECORD_COLUMN_CLASSES.status),
      },
      {
        accessorKey: 'timeText',
        cell: (record) => (
          <PointTransferTextCell className="text-muted tabular-nums" value={record.timeText} />
        ),
        header: '时间',
        id: 'time',
        ...getRecordColumnClassNames(RECORD_COLUMN_CLASSES.time),
      },
    ],
    [],
  )

  const refreshTransfers = useCallback(() => {
    setOverviewReloadKey((key) => key + 1)
    setRecordsReloadKey((key) => key + 1)
  }, [])

  const refreshProfile = useCallback(
    async (authToken: string) => {
      try {
        const nextProfile = await getUserProfile({ token: authToken })
        setProfile(nextProfile)
      } catch {
        // The transfer has already succeeded; stale points will be corrected on the next profile load.
      }
    },
    [setProfile],
  )

  useEffect(() => {
    if (!token || isInitializing) return

    const authToken = token
    const controller = new AbortController()

    async function loadOverview() {
      setOverviewLoading(true)
      setOverviewError(null)

      try {
        const [nextAddress, nextMonthly, nextPendingTransfers] = await Promise.all([
          getPointTransferAddress({ signal: controller.signal, token: authToken }),
          getPointTransferMonthlyQuota({ signal: controller.signal, token: authToken }),
          getPendingPointTransfers({ signal: controller.signal, token: authToken }),
        ])
        if (controller.signal.aborted) return
        setAddress(nextAddress)
        setMonthly(nextMonthly)
        setPendingTransfers(nextPendingTransfers ?? [])
      } catch (err) {
        if (isAbortError(err)) return
        setOverviewError(err instanceof Error ? err.message : '加载积分转账信息失败')
      } finally {
        if (!controller.signal.aborted) setOverviewLoading(false)
      }
    }

    void loadOverview()

    return () => controller.abort()
  }, [isInitializing, overviewReloadKey, token])

  useEffect(() => {
    if (!token || isInitializing) return

    const authToken = token
    const controller = new AbortController()

    async function loadRecords() {
      let shouldKeepLoading = false

      setRecordsLoading(true)
      setRecordsError(null)

      try {
        const data = await getPointTransferRecords({
          direction: hasDirectionFilter ? directionFilter : undefined,
          page: recordsPage,
          pageSize: POINT_TRANSFER_RECORDS_PAGE_SIZE,
          signal: controller.signal,
          status: hasStatusFilter ? statusFilter : undefined,
          token: authToken,
        })
        if (controller.signal.aborted) return
        const nextTotal = data.count ?? 0
        const nextTotalPages = getTotalPages(nextTotal)
        if (recordsPage > nextTotalPages) {
          shouldKeepLoading = true
          setRecords([])
          setRecordsTotal(nextTotal)
          setRecordsPage(nextTotalPages)
          return
        }
        setRecords(data.records ?? [])
        setRecordsTotal(nextTotal)
      } catch (err) {
        if (isAbortError(err)) return
        setRecords([])
        setRecordsTotal(0)
        setRecordsError(err instanceof Error ? err.message : '获取积分转账记录失败')
      } finally {
        if (!controller.signal.aborted && !shouldKeepLoading) setRecordsLoading(false)
      }
    }

    void loadRecords()

    return () => controller.abort()
  }, [
    directionFilter,
    hasDirectionFilter,
    hasStatusFilter,
    isInitializing,
    recordsPage,
    recordsReloadKey,
    statusFilter,
    token,
  ])

  async function copyAddress() {
    if (!address) return

    try {
      await navigator.clipboard.writeText(address)
      showDialog({ status: 'success', title: '地址已复制' })
    } catch {
      showDialog({
        description: address,
        status: 'warning',
        title: '复制失败，请手动复制',
      })
    }
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAddressTouched(true)
    if (!token || !canSubmit) return

    setTransferConfirmOpen(true)
  }

  async function confirmTransfer() {
    if (!token || !canSubmit) return

    const authToken = token
    const targetAddress = normalizeAddress(receiverAddress)

    setSubmitting(true)
    try {
      const transfer = await createPointTransfer({
        address: targetAddress,
        amount,
        feeMode,
        token: authToken,
      })
      showDialog({
        description: `已扣除 ${transfer.deducted_amount} 积分，等待对方在 ${formatDateTime(
          transfer.expires_at,
        )} 前接受。`,
        status: 'success',
        title: '转账已发起',
      })
      setTransferConfirmOpen(false)
      setReceiverAddress('')
      setAddressTouched(false)
      setRecordsPage(1)
      await refreshProfile(authToken)
      refreshTransfers()
    } catch (err) {
      showDialog({
        description: err instanceof Error ? err.message : '请稍后再试',
        status: 'danger',
        title: '发起转账失败',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePendingAction(transfer: PointTransferRecord, action: 'accept' | 'reject') {
    if (!token || pendingActionId !== null) return

    const authToken = token
    setPendingActionId(transfer.id)
    try {
      const nextTransfer =
        action === 'accept'
          ? await acceptPointTransfer({ id: transfer.id, token: authToken })
          : await rejectPointTransfer({ id: transfer.id, token: authToken })

      showDialog({
        description:
          action === 'accept'
            ? `已到账 ${nextTransfer.received_amount} 积分。`
            : '这笔转账已拒绝，积分会退回给发起方。',
        status: action === 'accept' ? 'success' : 'default',
        title: action === 'accept' ? '已接受转账' : '已拒绝转账',
      })
      setRecordsPage(1)
      await refreshProfile(authToken)
      refreshTransfers()
    } catch (err) {
      showDialog({
        description: err instanceof Error ? err.message : '请稍后再试',
        status: 'danger',
        title: action === 'accept' ? '接受转账失败' : '拒绝转账失败',
      })
      refreshTransfers()
    } finally {
      setPendingActionId(null)
    }
  }

  const handleDirectionFilterChange = useCallback(
    (nextValue: Key | null) => {
      const nextDirectionFilter = getDirectionFilter(nextValue)
      if (nextDirectionFilter === directionFilter && recordsPage === 1) return

      setRecordsLoading(true)
      setDirectionFilter(nextDirectionFilter)
      setRecordsPage(1)
    },
    [directionFilter, recordsPage],
  )

  const handleStatusFilterChange = useCallback(
    (nextValue: Key | null) => {
      const nextStatusFilter = getStatusFilter(nextValue)
      if (nextStatusFilter === statusFilter && recordsPage === 1) return

      setRecordsLoading(true)
      setStatusFilter(nextStatusFilter)
      setRecordsPage(1)
    },
    [recordsPage, statusFilter],
  )

  const handleRecordsPageChange = useCallback(
    (nextPage: number) => {
      if (nextPage === recordsPage) return

      setRecordsLoading(true)
      setRecordsPage(nextPage)
    },
    [recordsPage],
  )

  if (isOverviewLoading && !address && !monthly) {
    return <LoadingState label="正在加载积分转账" />
  }

  if (overviewError && !address && !monthly) {
    return (
      <ErrorPanel
        actionLabel="重试"
        message={overviewError}
        onAction={() => setOverviewReloadKey((key) => key + 1)}
      />
    )
  }

  return (
    <>
      <MotionStagger className="flex flex-col gap-5">
        {overviewError ? (
          <MotionItem>
            <ErrorPanel
              actionLabel="重试"
              message={overviewError}
              onAction={() => setOverviewReloadKey((key) => key + 1)}
            />
          </MotionItem>
        ) : null}

        <MotionItem>
          <div className="grid gap-4 lg:grid-cols-2">
            <AddressPanel
              address={address}
              isLoading={isOverviewLoading}
              onCopy={() => void copyAddress()}
            />
            <MonthlyQuotaPanel monthly={monthly} isLoading={isOverviewLoading} />
          </div>
        </MotionItem>

        <MotionItem>
          <Card className="min-w-0">
            <Card.Header>
              <Card.Title>发起转账</Card.Title>
              <Card.Description>单笔 2 到 20 积分，发起后等待对方接受。</Card.Description>
            </Card.Header>
            <Card.Content>
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => void submitTransfer(event)}
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)]">
                  <TextField
                    fullWidth
                    className="w-full"
                    isInvalid={!!visibleAddressError}
                    validationBehavior="aria"
                    value={receiverAddress}
                    onBlur={() => setAddressTouched(true)}
                    onChange={setReceiverAddress}
                  >
                    <Label>对方地址</Label>
                    <Input className="font-address" placeholder="0x0123456789abcdef" />
                    <Description>固定 0x 加 16 位十六进制</Description>
                    <FieldError>{visibleAddressError}</FieldError>
                  </TextField>

                  <NumberField
                    fullWidth
                    className="w-full"
                    formatOptions={{ maximumFractionDigits: 0 }}
                    maxValue={MAX_TRANSFER_AMOUNT}
                    minValue={MIN_TRANSFER_AMOUNT}
                    step={1}
                    value={amount}
                    onChange={(value) => {
                      const nextAmount = Math.round(value ?? MIN_TRANSFER_AMOUNT)
                      setAmount(
                        Math.min(MAX_TRANSFER_AMOUNT, Math.max(MIN_TRANSFER_AMOUNT, nextAmount)),
                      )
                    }}
                  >
                    <Label>转账金额</Label>
                    <NumberField.Group className="w-full">
                      <NumberField.DecrementButton />
                      <NumberField.Input className="w-full text-center tabular-nums" />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                    <Description>
                      单笔 {MIN_TRANSFER_AMOUNT} 到 {MAX_TRANSFER_AMOUNT} 积分
                    </Description>
                  </NumberField>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-foreground">手续费模式</p>
                  <RadioGroup
                    aria-label="手续费模式"
                    className="grid !mt-0 !gap-2 sm:grid-cols-2 [&_.radio]:!m-0"
                    value={feeMode}
                    onChange={(value) => {
                      if (isPointTransferFeeMode(value)) setFeeMode(value)
                    }}
                  >
                    {FEE_MODE_OPTIONS.map((option) => (
                      <Radio
                        key={option.id}
                        className="group w-full cursor-pointer rounded-lg border border-border/70 bg-surface px-3 py-2 data-[selected=true]:border-accent-soft-hover data-[selected=true]:bg-accent-soft/70"
                        value={option.id}
                      >
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <Radio.Content>
                          <Label className="text-sm font-medium">{option.title}</Label>
                          <Description className="text-xs">{option.description}</Description>
                        </Radio.Content>
                      </Radio>
                    ))}
                  </RadioGroup>
                </div>

                <TransferPreviewPanel
                  balance={balance}
                  isBalanceInsufficient={isBalanceInsufficient}
                  isQuotaExceeded={isQuotaExceeded}
                  preview={preview}
                />

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    isDisabled={!canSubmit}
                    isPending={isSubmitting}
                    type="submit"
                    variant="primary"
                  >
                    <ArrowRightArrowLeft className="size-4 shrink-0" />
                    发起转账
                  </Button>
                </div>
              </form>
            </Card.Content>
          </Card>
        </MotionItem>

        <MotionItem>
          <Card className="min-w-0">
            <Card.Header className="flex-row items-center justify-between gap-3">
              <div>
                <Card.Title>待我处理</Card.Title>
                <Card.Description>当前作为接收方等待确认的积分转账。</Card.Description>
              </div>
              <Button
                isIconOnly
                aria-label="刷新待处理转账"
                className="shrink-0"
                isDisabled={isOverviewLoading}
                size="sm"
                type="button"
                variant="ghost"
                onPress={refreshTransfers}
              >
                <ArrowRotateRight className="size-4" />
              </Button>
            </Card.Header>
            <Card.Content>
              {isOverviewLoading && pendingTransfers.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center">
                  <TransferLoadingBadge label="正在加载待处理转账" />
                </div>
              ) : pendingTransfers.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {pendingTransfers.map((transfer) => (
                    <PendingTransferItem
                      key={transfer.id}
                      isBusy={pendingActionId === transfer.id}
                      transfer={transfer}
                      onAccept={() => void handlePendingAction(transfer, 'accept')}
                      onReject={() => void handlePendingAction(transfer, 'reject')}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
                  <Clock className="size-5 text-muted" />
                  <p className="text-sm font-medium text-foreground">暂无待处理转账</p>
                  <p className="text-xs text-muted">收到的待接受转账会显示在这里。</p>
                </div>
              )}
            </Card.Content>
          </Card>
        </MotionItem>

        <MotionItem>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                共 <span className="font-medium tabular-nums text-foreground">{recordsTotal}</span>{' '}
                条转账记录
              </p>

              <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                <Select
                  aria-label="按转账方向筛选"
                  className="w-full sm:w-40"
                  value={directionFilter}
                  variant="secondary"
                  onChange={handleDirectionFilterChange}
                >
                  <Label className="sr-only">转账方向</Label>
                  <Select.Trigger className="h-9 items-center gap-1.5 rounded-full pl-3 text-sm">
                    <Funnel
                      aria-hidden
                      className={cx(
                        'size-3.5 shrink-0 self-center',
                        hasDirectionFilter ? 'text-accent' : 'text-muted',
                      )}
                    />
                    <Select.Value className="text-sm">
                      {({ defaultChildren }) => (
                        <span className="flex min-w-0 items-center gap-1 text-sm">
                          <span className="shrink-0 text-muted">方向：</span>
                          <span className="min-w-0 truncate">{defaultChildren}</span>
                        </span>
                      )}
                    </Select.Value>
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {DIRECTION_FILTER_OPTIONS.map((option) => (
                        <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                          {option.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Select
                  aria-label="按转账状态筛选"
                  className="w-full sm:w-40"
                  value={statusFilter}
                  variant="secondary"
                  onChange={handleStatusFilterChange}
                >
                  <Label className="sr-only">转账状态</Label>
                  <Select.Trigger className="h-9 items-center gap-1.5 rounded-full pl-3 text-sm">
                    <Funnel
                      aria-hidden
                      className={cx(
                        'size-3.5 shrink-0 self-center',
                        hasStatusFilter ? 'text-accent' : 'text-muted',
                      )}
                    />
                    <Select.Value className="text-sm">
                      {({ defaultChildren }) => (
                        <span className="flex min-w-0 items-center gap-1 text-sm">
                          <span className="shrink-0 text-muted">状态：</span>
                          <span className="min-w-0 truncate">{defaultChildren}</span>
                        </span>
                      )}
                    </Select.Value>
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {STATUS_FILTER_OPTIONS.map((option) => (
                        <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                          {option.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>

            {recordsError ? (
              <ErrorPanel
                actionLabel="重试"
                message={recordsError}
                onAction={() => setRecordsReloadKey((key) => key + 1)}
              />
            ) : shouldShowRecordsTable ? (
              <div className="relative">
                <DataGrid
                  aria-label="积分转账记录"
                  className={cx(
                    isRecordsLoading && rows.length > 0 && '[&_.table__body]:opacity-0',
                  )}
                  columns={columns}
                  contentClassName="min-w-[760px] table-fixed"
                  data={rows}
                  getRowId={(record) => record.id}
                  renderEmptyState={() => <RecordsTableLoadingState />}
                  variant="primary"
                />
                {isRecordsLoading && rows.length > 0 ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <TransferLoadingBadge label="正在加载转账记录" />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/70">
                <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
                  <CircleDollar className="size-5 text-muted" />
                  <p className="text-sm font-medium text-foreground">暂无转账记录</p>
                  <p className="text-xs text-muted">符合当前筛选条件的记录会显示在这里。</p>
                </div>
              </div>
            )}

            {recordsTotalPages > 1 ? (
              <UserPagination
                isDisabled={isRecordsLoading}
                label="积分转账"
                page={recordsPage}
                pageSize={POINT_TRANSFER_RECORDS_PAGE_SIZE}
                total={recordsTotal}
                totalPages={recordsTotalPages}
                onChange={handleRecordsPageChange}
              />
            ) : null}
          </div>
        </MotionItem>
      </MotionStagger>

      <AlertDialog.Backdrop
        isOpen={isTransferConfirmOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setTransferConfirmOpen(open)
        }}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog className="sm:max-w-110">
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>确认发起转账</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <div className="flex flex-col gap-3 text-sm leading-6 text-muted">
                <p>接收方接受转账后，积分将无法退回。请确认对方地址和积分数量无误。</p>
                <div className="grid gap-2 rounded-lg bg-surface-secondary px-3 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="shrink-0 text-muted">对方地址</span>
                    <span className="font-address min-w-0 truncate font-medium text-foreground">
                      {normalizeAddress(receiverAddress)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">对方到账</span>
                    <span className="font-medium tabular-nums text-success">
                      {formatPoints(preview.receivedAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">当前账户扣除</span>
                    <span className="font-medium tabular-nums text-danger">
                      {formatPoints(preview.deductedAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" isDisabled={isSubmitting} variant="tertiary">
                取消
              </Button>
              <Button
                isPending={isSubmitting}
                variant="primary"
                onPress={() => void confirmTransfer()}
              >
                <ArrowRightArrowLeft className="size-4 shrink-0" />
                确认发起
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  )
}
