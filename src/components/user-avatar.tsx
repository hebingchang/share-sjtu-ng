import { Person } from '@gravity-ui/icons'
import { Avatar } from '@heroui/react'
import type { ComponentProps } from 'react'

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

export default function UserAvatar({ profile: _profile, ...rest }: UserAvatarProps) {
  return (
    <Avatar {...rest}>
      <Avatar.Fallback className="bg-surface-secondary text-muted">
        <Person className="size-[55%]" />
      </Avatar.Fallback>
    </Avatar>
  )
}
