import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '../../auth/use-auth'
import { BasicInfoView } from './basic'
import { UserCenterLayout } from './layout'
import { PointsPlaceholderView } from './placeholder'
import { PointLogsView } from './point-logs'
import { PointTransferView } from './point-transfer'
import { PurchasedMaterialsView } from './purchased-materials'
import { UploadedMaterialsView } from './uploaded-materials'

export default function UserPage() {
  const { token } = useAuth()

  if (!token) return null

  return (
    <Routes>
      <Route element={<UserCenterLayout />}>
        <Route index element={<Navigate replace to="basic" />} />
        <Route path="basic" element={<BasicInfoView />} />
        <Route path="materials/upload" element={<UploadedMaterialsView />} />
        <Route path="materials/purchase" element={<PurchasedMaterialsView />} />
        <Route path="point_logs" element={<Navigate replace to="/user/points/logs" />} />
        <Route path="points/logs" element={<PointLogsView />} />
        <Route path="points/redeem" element={<PointsPlaceholderView kind="redeem" />} />
        <Route path="points/gift" element={<PointTransferView />} />
        <Route path="*" element={<Navigate replace to="/user/basic" />} />
      </Route>
    </Routes>
  )
}
