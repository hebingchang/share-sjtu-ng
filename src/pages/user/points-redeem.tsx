import { ArrowRotateRight, ArrowUpRightFromSquare, CircleDollar } from '@gravity-ui/icons'
import {
  Alert,
  AlertDialog,
  Button,
  Card,
  Label,
  NumberField,
  Spinner,
  Tabs,
  type Key,
} from '@heroui/react'
import { DataGrid, type DataGridColumn } from '@heroui-pro/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getRedeemQuota, getRedeemRecords, postRedeem, type RedeemPath } from '../../api/redeem'
import { getUserProfile } from '../../api/user'
import { useAuth } from '../../auth/use-auth'
import { useDialog } from '../../dialog/use-dialog'
import type { RedeemQuota, RedeemRecord, RedeemSource } from '../../types/redeem'
import { LoadingState, MotionItem, MotionStagger } from './shared'
import { cx, formatDateTime, isAbortError } from './utils'
import pangu from "pangu/browser";

const MIN_TARGET_POINTS = 1

interface PartnerSiteMeta {
  accountSuffix: string
  description: string
  homepage: string
  name: string
  path: RedeemPath
  pointName: string
  source: RedeemSource
  sourcePointsPerSharePoint: number
}

const PARTNER_SITES: PartnerSiteMeta[] = [
  {
    accountSuffix: '@sjtu.edu.cn',
    description: '如果您是选课社区的用户，则您可以使用它的积分系统来兑换本站积分。',
    homepage: 'https://course.sjtu.plus',
    name: '选课社区',
    path: 'sjtuplus',
    pointName: '选课社区积分',
    source: 'course_sjtu_plus',
    sourcePointsPerSharePoint: 10,
  },
  // {
  //   accountSuffix: '',
  //   description: '如果您是 SJTU Wiki 的用户，则您可以使用它的积分系统来兑换本站积分。',
  //   homepage: 'https://sjtu-geek.github.io/SJTU-Wiki/contributing.html#%E7%A7%AF%E5%88%86%E4%BD%93%E7%B3%BB',
  //   name: 'SJTU Wiki',
  //   path: 'sjtuwiki',
  //   pointName: 'SJTU Wiki 积分',
  //   source: 'sjtu_wiki',
  //   sourcePointsPerSharePoint: 1,
  // },
]

interface RedeemRecordRow extends RedeemRecord {
  amountText: string
  pointsText: string
  timeText: string
}

interface RedeemConfirmationSnapshot {
  amount: number
  maxTargetPoints: number
  points: number
}

const RECORD_COLUMN_CLASSES = {
  amount: 'w-[28%]',
  points: 'w-[28%]',
  time: 'w-[44%]',
} as const
const RECORD_COLUMN_CLASS = 'overflow-hidden whitespace-nowrap'
const RECORD_TEXT_CLASS = 'block min-w-0 max-w-full truncate'

function getRecordColumnClassNames(widthClassName: string, cellClassName?: string) {
  return {
    cellClassName: cx(RECORD_COLUMN_CLASS, widthClassName, cellClassName),
    headerClassName: cx(RECORD_COLUMN_CLASS, widthClassName),
  }
}

function formatPartnerAccount(site: PartnerSiteMeta, account: string): string {
  if (!site.accountSuffix || account.endsWith(site.accountSuffix)) return account
  return `${account}${site.accountSuffix}`
}

function MetricTile({
  label,
  tone = 'default',
  value,
}: {
  label: string
  tone?: 'default' | 'accent' | 'success' | 'warning'
  value: string
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cx(
          'mt-1 truncate text-base font-semibold tabular-nums',
          tone === 'accent' && 'text-accent',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'default' && 'text-foreground',
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

function RedeemLoadingBadge({ label }: { label: string }) {
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
      <RedeemLoadingBadge label="正在加载兑换记录" />
    </div>
  )
}

function PartnerSiteCard({
  isBusy,
  isLoading,
  maxTargetPoints,
  onRedeem,
  onTargetPointsChange,
  quota,
  site,
  targetPoints,
}: {
  isBusy: boolean
  isLoading: boolean
  maxTargetPoints: number
  onRedeem: () => void
  onTargetPointsChange: (next: number) => void
  quota: RedeemQuota | null
  site: PartnerSiteMeta
  targetPoints: number
}) {
  const cannotRedeem = maxTargetPoints <= 0
  const consumedAmount = targetPoints * site.sourcePointsPerSharePoint
  const isInputDisabled = isLoading || isBusy || cannotRedeem

  return (
    <Card className="min-w-0">
      <Card.Header>
        <Card.Title>{pangu.spacingText(`使用${site.name}积分兑换传承积分`)}</Card.Title>
        <Card.Description>
          {quota?.account
            ? pangu.spacingText(`已关联${site.name}账号 ${formatPartnerAccount(site, quota.account)}`)
            : site.description}
        </Card.Description>
      </Card.Header>
      <Card.Content className="gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <MetricTile label={site.pointName} value={quota ? String(quota.all) : '—'} />
          <MetricTile
            label="可兑换积分"
            tone="accent"
            value={quota ? String(quota.available) : '—'}
          />
        </div>

        {!isLoading && quota && cannotRedeem ? (
          <Alert status="default">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>暂无可兑换积分</Alert.Title>
              <Alert.Description>
                您目前的{site.name}积分不足以兑换传承积分，请获取更多{site.name}积分后重试。
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {!cannotRedeem ? (
          <div className="flex flex-col gap-4 rounded-lg border border-border/70 bg-surface p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              <NumberField
                className="w-full sm:w-48"
                formatOptions={{ maximumFractionDigits: 0 }}
                isDisabled={isInputDisabled}
                maxValue={maxTargetPoints}
                minValue={MIN_TARGET_POINTS}
                step={1}
                value={targetPoints}
                onChange={(value) => {
                  if (value === null || Number.isNaN(value)) return
                  const next = Math.min(
                    maxTargetPoints,
                    Math.max(MIN_TARGET_POINTS, Math.round(value)),
                  )
                  onTargetPointsChange(next)
                }}
              >
                <Label>兑换传承积分数量</Label>
                <NumberField.Group className="w-full">
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-full text-center tabular-nums" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="font-medium tabular-nums text-foreground">
                  {consumedAmount} {site.pointName}
                </span>
                <span className="text-muted">→</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {targetPoints} 传承积分
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  className="w-full sm:w-auto"
                  isDisabled={isInputDisabled || targetPoints >= maxTargetPoints}
                  type="button"
                  variant="tertiary"
                  onPress={() => onTargetPointsChange(maxTargetPoints)}
                >
                  兑换全部
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  isDisabled={isInputDisabled || targetPoints <= 0}
                  isPending={isBusy}
                  type="button"
                  variant="primary"
                  onPress={onRedeem}
                >
                  <CircleDollar className="size-4 shrink-0" />
                  立即兑换
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted">
            * 每 {site.sourcePointsPerSharePoint} {site.pointName}可兑换 1 传承积分。
          </p>
          <p className="text-xs text-muted">
            * 如果您对合作网站积分的计算方式有任何疑问，请咨询合作网站的运营团队。
          </p>
        </div>
      </Card.Content>
    </Card>
  )
}

function PartnerSiteSection({ site }: { site: PartnerSiteMeta }) {
  const { isInitializing, setProfile, token } = useAuth()
  const { showDialog } = useDialog()

  const [quota, setQuota] = useState<RedeemQuota | null>(null)
  const [isQuotaLoading, setQuotaLoading] = useState(true)
  const [quotaError, setQuotaError] = useState<string | null>(null)
  const [quotaReloadKey, setQuotaReloadKey] = useState(0)

  const [records, setRecords] = useState<RedeemRecord[]>([])
  const [isRecordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [recordsReloadKey, setRecordsReloadKey] = useState(0)

  const [isSubmitting, setSubmitting] = useState(false)
  const [confirmSnapshot, setConfirmSnapshot] = useState<RedeemConfirmationSnapshot | null>(null)
  const [isConfirmOpen, setConfirmOpen] = useState(false)
  const [userTargetPoints, setUserTargetPoints] = useState<number | null>(null)

  const available = Math.max(0, quota?.available ?? 0)
  const maxTargetPoints = Math.floor(available / site.sourcePointsPerSharePoint)
  const targetPoints = useMemo(() => {
    if (maxTargetPoints <= 0) return 0
    if (userTargetPoints === null) return MIN_TARGET_POINTS
    return Math.min(maxTargetPoints, Math.max(MIN_TARGET_POINTS, userTargetPoints))
  }, [maxTargetPoints, userTargetPoints])
  const consumedAmount = targetPoints * site.sourcePointsPerSharePoint

  const refreshProfile = useCallback(
    async (authToken: string) => {
      try {
        const nextProfile = await getUserProfile({ token: authToken })
        setProfile(nextProfile)
      } catch {
        // The redemption already succeeded; stale balance will refresh next time.
      }
    },
    [setProfile],
  )

  useEffect(() => {
    if (!token || isInitializing) return

    const authToken = token
    const controller = new AbortController()

    async function loadQuota() {
      setQuotaLoading(true)
      setQuotaError(null)

      try {
        const data = await getRedeemQuota({
          path: site.path,
          signal: controller.signal,
          token: authToken,
        })
        if (controller.signal.aborted) return
        setQuota(data)
      } catch (err) {
        if (isAbortError(err)) return
        setQuotaError(err instanceof Error ? err.message : '获取可兑换积分失败')
      } finally {
        if (!controller.signal.aborted) setQuotaLoading(false)
      }
    }

    void loadQuota()

    return () => controller.abort()
  }, [isInitializing, quotaReloadKey, site.path, token])

  useEffect(() => {
    if (!token || isInitializing) return

    const authToken = token
    const controller = new AbortController()

    async function loadRecords() {
      setRecordsLoading(true)
      setRecordsError(null)

      try {
        const data = await getRedeemRecords({
          path: site.path,
          signal: controller.signal,
          token: authToken,
        })
        if (controller.signal.aborted) return
        setRecords(data ?? [])
      } catch (err) {
        if (isAbortError(err)) return
        setRecords([])
        setRecordsError(err instanceof Error ? err.message : '获取兑换记录失败')
      } finally {
        if (!controller.signal.aborted) setRecordsLoading(false)
      }
    }

    void loadRecords()

    return () => controller.abort()
  }, [isInitializing, recordsReloadKey, site.path, token])

  const refreshAll = useCallback(() => {
    setQuotaReloadKey((key) => key + 1)
    setRecordsReloadKey((key) => key + 1)
  }, [])

  const openConfirmDialog = useCallback(() => {
    if (targetPoints <= 0 || targetPoints > maxTargetPoints) return
    setConfirmSnapshot({
      amount: consumedAmount,
      maxTargetPoints,
      points: targetPoints,
    })
    setConfirmOpen(true)
  }, [consumedAmount, maxTargetPoints, targetPoints])

  async function confirmRedeem() {
    const snapshot = confirmSnapshot ?? {
      amount: consumedAmount,
      maxTargetPoints,
      points: targetPoints,
    }

    if (!token || snapshot.points <= 0 || snapshot.points > snapshot.maxTargetPoints) return

    const authToken = token
    const submittedAmount = snapshot.amount
    const submittedPoints = snapshot.points
    setSubmitting(true)
    try {
      const nextQuota = await postRedeem({
        amount: submittedAmount,
        path: site.path,
        token: authToken,
      })
      setQuota(nextQuota)
      setUserTargetPoints(null)
      setRecordsReloadKey((key) => key + 1)
      await refreshProfile(authToken)
      showDialog({
        description: `已使用 ${submittedAmount} ${site.pointName}，到账 ${submittedPoints} 传承积分。`,
        status: 'success',
        title: '兑换成功',
      })
      setConfirmOpen(false)
    } catch (err) {
      showDialog({
        description: err instanceof Error ? err.message : '请稍后再试',
        status: 'danger',
        title: '兑换失败',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const sortedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [records],
  )

  const rows = useMemo<RedeemRecordRow[]>(
    () =>
      sortedRecords.map((record) => ({
        ...record,
        amountText: `${record.amount} ${site.pointName}`,
        pointsText: `${Math.floor(record.amount / site.sourcePointsPerSharePoint)} 传承积分`,
        timeText: formatDateTime(record.created_at),
      })),
    [site.pointName, site.sourcePointsPerSharePoint, sortedRecords],
  )

  const columns = useMemo<DataGridColumn<RedeemRecordRow>[]>(
    () => [
      {
        accessorKey: 'amountText',
        cell: (record) => (
          <span
            className={cx(RECORD_TEXT_CLASS, 'font-medium tabular-nums text-foreground')}
            title={record.amountText}
          >
            {record.amountText}
          </span>
        ),
        header: '使用积分',
        id: 'amount',
        isRowHeader: true,
        ...getRecordColumnClassNames(RECORD_COLUMN_CLASSES.amount),
      },
      {
        accessorKey: 'pointsText',
        cell: (record) => (
          <span
            className={cx(RECORD_TEXT_CLASS, 'font-medium tabular-nums text-success')}
            title={record.pointsText}
          >
            {record.pointsText}
          </span>
        ),
        header: '到账积分',
        id: 'points',
        ...getRecordColumnClassNames(RECORD_COLUMN_CLASSES.points),
      },
      {
        accessorKey: 'timeText',
        cell: (record) => (
          <span
            className={cx(RECORD_TEXT_CLASS, 'tabular-nums text-muted')}
            title={record.timeText}
          >
            {record.timeText}
          </span>
        ),
        header: '兑换时间',
        id: 'time',
        ...getRecordColumnClassNames(RECORD_COLUMN_CLASSES.time),
      },
    ],
    [],
  )

  const shouldShowRecordsTable = isRecordsLoading || rows.length > 0

  if (isQuotaLoading && !quota && !quotaError) {
    return <LoadingState label="正在加载积分兑换" />
  }

  return (
    <>
      <MotionStagger className="flex flex-col gap-5">
        {quotaError ? (
          <MotionItem>
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>积分兑换加载失败</Alert.Title>
                <Alert.Description>{quotaError}</Alert.Description>
                <Button
                  className="mt-2 w-fit sm:hidden"
                  size="sm"
                  variant="outline"
                  onPress={() => setQuotaReloadKey((key) => key + 1)}
                >
                  重试
                </Button>
              </Alert.Content>
              <Button
                className="hidden shrink-0 sm:flex"
                size="sm"
                variant="outline"
                onPress={() => setQuotaReloadKey((key) => key + 1)}
              >
                重试
              </Button>
            </Alert>
          </MotionItem>
        ) : null}

        <MotionItem>
          <PartnerSiteCard
            isBusy={isSubmitting}
            isLoading={isQuotaLoading}
            maxTargetPoints={maxTargetPoints}
            quota={quota}
            site={site}
            targetPoints={targetPoints}
            onRedeem={openConfirmDialog}
            onTargetPointsChange={setUserTargetPoints}
          />
        </MotionItem>

        <MotionItem>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold text-foreground">兑换记录</h2>
                <p className="text-xs text-muted">
                  共 <span className="font-medium tabular-nums text-foreground">{rows.length}</span>{' '}
                  条记录
                </p>
              </div>
              <Button
                isIconOnly
                aria-label="刷新兑换记录"
                className="shrink-0"
                isDisabled={isRecordsLoading || isSubmitting}
                size="sm"
                type="button"
                variant="ghost"
                onPress={refreshAll}
              >
                <ArrowRotateRight className="size-4" />
              </Button>
            </div>

            {recordsError ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>兑换记录加载失败</Alert.Title>
                  <Alert.Description>{recordsError}</Alert.Description>
                  <Button
                    className="mt-2 w-fit sm:hidden"
                    size="sm"
                    variant="outline"
                    onPress={() => setRecordsReloadKey((key) => key + 1)}
                  >
                    重试
                  </Button>
                </Alert.Content>
                <Button
                  className="hidden shrink-0 sm:flex"
                  size="sm"
                  variant="outline"
                  onPress={() => setRecordsReloadKey((key) => key + 1)}
                >
                  重试
                </Button>
              </Alert>
            ) : shouldShowRecordsTable ? (
              <div className="relative">
                <DataGrid
                  aria-label="积分兑换记录"
                  className={cx(
                    isRecordsLoading && rows.length > 0 && '[&_.table__body]:opacity-0',
                  )}
                  columns={columns}
                  contentClassName="min-w-[560px] table-fixed"
                  data={rows}
                  getRowId={(record) => record.id}
                  renderEmptyState={() => <RecordsTableLoadingState />}
                  variant="primary"
                />
                {isRecordsLoading && rows.length > 0 ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <RedeemLoadingBadge label="正在加载兑换记录" />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/70">
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
                  <CircleDollar className="size-5 text-muted" />
                  <p className="text-sm font-medium text-foreground">暂无兑换记录</p>
                  <p className="text-xs text-muted">兑换成功后的记录会显示在这里。</p>
                </div>
              </div>
            )}
          </div>
        </MotionItem>
      </MotionStagger>

      <AlertDialog.Backdrop
        isOpen={isConfirmOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setConfirmOpen(open)
        }}
      >
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog className="sm:max-w-110">
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>确认兑换积分</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <div className="flex flex-col gap-3 text-sm leading-6 text-muted">
                <p>
                  {pangu.spacingText(`兑换后，${site.name}对应的积分将被锁定，传承积分会立即到账。 请确认下方信息无误。`)}
                </p>
                <div className="grid gap-2 rounded-lg bg-surface-secondary px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">兑换来源</span>
                    <span className="font-medium text-foreground">{site.name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">{pangu.spacingText(`使用${site.pointName}`)}</span>
                    <span className="font-medium tabular-nums">
                      {confirmSnapshot?.amount ?? consumedAmount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted">到账传承积分</span>
                    <span className="font-medium tabular-nums">
                      {confirmSnapshot?.points ?? targetPoints}
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
                isDisabled={
                  (confirmSnapshot?.points ?? targetPoints) <= 0 ||
                  (confirmSnapshot?.points ?? targetPoints) >
                    (confirmSnapshot?.maxTargetPoints ?? maxTargetPoints)
                }
                isPending={isSubmitting}
                variant="primary"
                onPress={() => void confirmRedeem()}
              >
                <CircleDollar className="size-4 shrink-0" />
                确认兑换
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  )
}

export function PointsRedeemView() {
  const [activeSite, setActiveSite] = useState<Key>(PARTNER_SITES[0].path)

  return (
    <Tabs selectedKey={activeSite} variant="secondary" onSelectionChange={setActiveSite}>
      <Tabs.ListContainer>
        <Tabs.List aria-label="积分兑换合作网站" className="w-fit!">
          {PARTNER_SITES.map((site) => (
            <Tabs.Tab key={site.path} className="whitespace-nowrap" id={site.path}>
              {site.name}
              <a
                aria-label={`访问${site.name}`}
                className="ml-1.5 inline-flex shrink-0 items-center text-muted transition-colors hover:text-accent"
                href={site.homepage}
                rel="noreferrer"
                target="_blank"
                onClick={(event) => event.stopPropagation()}
              >
                <ArrowUpRightFromSquare className="size-3.5" />
              </a>
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
      {PARTNER_SITES.map((site) => (
        <Tabs.Panel key={site.path} className="px-0 pt-4" id={site.path}>
          <PartnerSiteSection site={site} />
        </Tabs.Panel>
      ))}
    </Tabs>
  )
}
