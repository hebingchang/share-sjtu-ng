import { CircleDollar, PersonPlus } from '@gravity-ui/icons'
import { EmptyPanel } from './shared'

export function PointsPlaceholderView({ kind }: { kind: 'gift' | 'redeem' }) {
  const isRedeem = kind === 'redeem'

  return (
    <EmptyPanel
      description="这个功能还在准备中，开放后会显示可操作内容。"
      icon={isRedeem ? CircleDollar : PersonPlus}
      title={isRedeem ? '积分兑换暂未开放' : '积分转账暂未开放'}
    />
  )
}
