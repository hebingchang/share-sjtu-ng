import {
  ArrowRight,
  ArrowUturnCcwLeft,
  CircleDollar,
  PencilToSquare,
  PersonGear,
  Picture,
} from '@gravity-ui/icons'
import { Button, Card, Dropdown, Label, type Key } from '@heroui/react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { restoreUserAvatar } from '../../api/user'
import { useAuth } from '../../auth/use-auth'
import AvatarUploadModal from '../../components/avatar-upload-modal'
import NicknameSetupModal from '../../components/nickname-setup-modal'
import UserAvatar from '../../components/user-avatar'
import { useDialog } from '../../dialog/use-dialog'
import { USER_TYPE_LABELS } from './constants'
import { EmptyPanel, LoadingState, MotionItem, MotionStagger } from './shared'
import { formatDateTime } from './utils'

const NICKNAME_UPDATE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000

function InfoTile({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{value || '未设置'}</p>
    </div>
  )
}

function PointsSummary({
  points,
  onLogPress,
}: {
  onLogPress: () => void
  points: number
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent-soft bg-linear-to-br from-accent-soft/85 via-surface to-surface px-4 py-4 sm:col-span-2 sm:px-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 text-accent/10"
      >
        <CircleDollar className="size-36 sm:size-44" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-accent/25 to-transparent"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-block size-1.5 rounded-full bg-accent" />
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                剩余积分
              </p>
            </div>
            <div className="mt-1 flex min-w-0 items-baseline gap-2">
              <p className="font-digits truncate text-3xl font-semibold leading-none tracking-tight text-accent sm:text-4xl">
                {points}
              </p>
              <span className="text-sm font-medium text-muted">pts</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button
            className="min-w-0 justify-center whitespace-nowrap border-accent-soft-hover bg-background/70 px-3 backdrop-blur-sm"
            size="sm"
            type="button"
            variant="outline"
            onPress={onLogPress}
          >
            <span className="hidden min-w-0 truncate sm:inline">积分变动日志</span>
            <span className="min-w-0 truncate sm:hidden">积分日志</span>
            <ArrowRight className="size-4 shrink-0 text-muted" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function getNextNicknameUpdateTime(updatedAt: string | null | undefined): Date | null {
  if (!updatedAt) return null

  const lastUpdatedAt = new Date(updatedAt)
  if (Number.isNaN(lastUpdatedAt.getTime())) return null

  return new Date(lastUpdatedAt.getTime() + NICKNAME_UPDATE_INTERVAL_MS)
}

export function BasicInfoView() {
  const navigate = useNavigate()
  const { showDialog } = useDialog()
  const { isProfileLoading, profile, setProfile, token } = useAuth()
  const [isAvatarModalOpen, setAvatarModalOpen] = useState(false)
  const [isNicknameModalOpen, setNicknameModalOpen] = useState(false)
  const [nicknameModalKey, setNicknameModalKey] = useState(0)
  const [isRestoringAvatar, setRestoringAvatar] = useState(false)
  const userTypeLabel = profile?.type ? (USER_TYPE_LABELS[profile.type] ?? profile.type) : null
  const displayName = profile?.nickname?.trim() || profile?.name || '用户'
  const points = profile?.points?.points ?? 0

  const handleRestoreAvatar = useCallback(async () => {
    if (!token || isRestoringAvatar) return

    setRestoringAvatar(true)
    try {
      const nextProfile = await restoreUserAvatar({ token })
      setProfile(nextProfile)
    } catch (err) {
      showDialog({
        description: err instanceof Error ? err.message : '请稍后再试',
        status: 'danger',
        title: '恢复默认头像失败',
      })
    } finally {
      setRestoringAvatar(false)
    }
  }, [isRestoringAvatar, setProfile, showDialog, token])

  const handleAvatarAction = useCallback(
    (key: Key) => {
      if (key === 'set-avatar') {
        setAvatarModalOpen(true)
        return
      }

      void handleRestoreAvatar()
    },
    [handleRestoreAvatar],
  )

  const handleEditNickname = useCallback(() => {
    if (!profile) return

    const nextUpdateTime = getNextNicknameUpdateTime(profile.nickname_updated_at)
    if (profile.nickname !== null && nextUpdateTime && Date.now() < nextUpdateTime.getTime()) {
      showDialog({
        description: `昵称每 30 天只能修改 1 次，${formatDateTime(
          nextUpdateTime.toISOString(),
        )} 后可以再次修改。`,
        status: 'warning',
        title: '暂时无法修改昵称',
      })
      return
    }

    setNicknameModalKey((key) => key + 1)
    setNicknameModalOpen(true)
  }, [profile, showDialog])

  if (isProfileLoading && !profile) {
    return <LoadingState label="正在加载基本信息" />
  }

  if (!profile) {
    return (
      <EmptyPanel
        description="登录状态刷新后会自动显示账号信息。"
        icon={PersonGear}
        title="暂无基本信息"
      />
    )
  }

  return (
    <>
      <MotionStagger className="flex flex-col gap-5">
        <MotionItem>
          <Card className="min-w-0">
            <Card.Content className="gap-5">
              <div className="flex min-w-0 items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <Dropdown>
                    <Button
                      isIconOnly
                      aria-label="头像操作"
                      className="size-16 shrink-0 rounded-full p-0"
                      isDisabled={isRestoringAvatar}
                      type="button"
                      variant="ghost"
                    >
                      <UserAvatar className="size-16" profile={profile} />
                    </Button>
                    <Dropdown.Popover className="min-w-44">
                      <Dropdown.Menu onAction={handleAvatarAction}>
                        <Dropdown.Item
                          id="restore-avatar"
                          isDisabled={isRestoringAvatar}
                          textValue="恢复默认头像"
                        >
                          <ArrowUturnCcwLeft className="size-4 shrink-0 text-muted" />
                          <Label>恢复默认头像</Label>
                        </Dropdown.Item>
                        <Dropdown.Item id="set-avatar" textValue="设置新头像">
                          <Picture className="size-4 shrink-0 text-muted" />
                          <Label>设置新头像</Label>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-foreground">
                        {displayName}
                      </h2>
                    </div>
                    <p className="truncate text-sm text-muted">{profile.account}</p>
                  </div>
                </div>
                <Button
                  className="shrink-0"
                  size="sm"
                  variant="outline"
                  onPress={handleEditNickname}
                >
                  <PencilToSquare className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">修改昵称</span>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PointsSummary
                  points={points}
                  onLogPress={() => navigate('/user/points/logs')}
                />
                <InfoTile label="姓名" value={profile.name} />
                <InfoTile label="电子邮箱" value={`${profile.account}@sjtu.edu.cn`} />
                <InfoTile label="学号 / 工号" value={profile.code} />
                <InfoTile label="所属组织" value={profile.organization?.name} />
                <InfoTile label="账号类型" value={userTypeLabel} />
                <InfoTile label="加入时间" value={formatDateTime(profile.created_at)} />
              </div>
            </Card.Content>
          </Card>
        </MotionItem>
      </MotionStagger>
      <AvatarUploadModal
        isOpen={isAvatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
      />
      <NicknameSetupModal
        key={nicknameModalKey}
        initialNickname={profile.nickname}
        isOpen={isNicknameModalOpen}
        mode="edit"
        onOpenChange={setNicknameModalOpen}
      />
    </>
  )
}
