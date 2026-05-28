import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ResetPassword from './pages/ResetPassword'
import DashboardShell from './components/layout/DashboardShell'
import SuperAdminDashboard from './pages/dashboard/SuperAdminDashboard'
import BankerDashboard from './pages/dashboard/BankerDashboard'
import {
  CustomerDashboard,
  UnderwriterDashboard,
  ComplianceDashboard,
  OpsAdminDashboard,
} from './pages/dashboard/OtherDashboards'

const ROLE_HOME = {
  SUPER_ADMIN: '/dashboard/admin',
  BANKER: '/dashboard/banker',
  CUSTOMER: '/dashboard/customer',
  UNDERWRITER: '/dashboard/underwriter',
  COMPLIANCE: '/dashboard/compliance',
  OPS_ADMIN: '/dashboard/ops',
}

function Guard({ children }) {
  const { token } = useSelector(s => s.auth)
  return token ? children : <Navigate to="/login" replace />
}

function RoleRedirect() {
  const { user } = useSelector(s => s.auth)
  return <Navigate to={ROLE_HOME[user?.role] || '/login'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<Guard><ResetPassword /></Guard>} />

        {/* Protected */}
        <Route path="/dashboard" element={<Guard><DashboardShell /></Guard>}>
          <Route index element={<RoleRedirect />} />

          {/* Super Admin — /dashboard/admin/* */}
          <Route path="admin/*" element={<SuperAdminDashboard />} />

          {/* Banker — /dashboard/banker/* */}
          <Route path="banker/*" element={<BankerDashboard />} />

          {/* Customer — /dashboard/customer/* */}
          <Route path="customer/*" element={<CustomerDashboard />} />

          {/* Underwriter — /dashboard/underwriter/* */}
          <Route path="underwriter/*" element={<UnderwriterDashboard />} />

          {/* Compliance — /dashboard/compliance/* */}
          <Route path="compliance/*" element={<ComplianceDashboard />} />

          {/* Ops Admin — /dashboard/ops/* */}
          <Route path="ops/*" element={<OpsAdminDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
