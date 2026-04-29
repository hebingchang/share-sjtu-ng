import { Person } from '@gravity-ui/icons'
import { Avatar } from '@heroui/react'
import type { ComponentProps } from 'react'
import { getUserAvatarUrl } from '../utils/avatar'

export interface UserAvatarProfile {
  id?: number
  account?: string
  name?: string
  nickname?: string | null
  avatar_path?: string | null
}

interface UserAvatarProps extends Omit<ComponentProps<typeof Avatar>, 'children'> {
  profile: UserAvatarProfile | null | undefined
}

export default function UserAvatar({ profile, ...rest }: UserAvatarProps) {
  const avatarUrl = getUserAvatarUrl(profile?.avatar_path)
  const displayName = profile?.nickname?.trim() || profile?.name || profile?.account || '用户'

  return (
    <Avatar key={avatarUrl ?? 'default-avatar'} {...rest}>
      {avatarUrl ? <Avatar.Image alt={`${displayName}的头像`} src={avatarUrl} /> : null}
      <Avatar.Fallback className="bg-surface-secondary text-muted">
        <Person className="size-[55%]" />
      </Avatar.Fallback>
    </Avatar>
  )
}
