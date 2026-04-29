import { CircleDollar, PersonPlus } from '@gravity-ui/icons'
import { EmptyPanel } from './shared'

export function PointsPlaceholderView({ kind }: { kind: 'gift' | 'redeem' }) {
  const isRedeem = kind === 'redeem'

  return (
    <EmptyPanel
      description={isRedeem ? '此功能还在准备中，用于从外部合作网站兑换传承·交大积分。' : '此功能还在准备中，用于向其他用户转移积分。'}
      icon={isRedeem ? CircleDollar : PersonPlus}
      title={isRedeem ? '积分兑换暂未开放' : '积分转账暂未开放'}
    />
  )
}
