import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import Interfaces from './pages/Interfaces'
import Gateways from './pages/Gateways'
import Firewall from './pages/Firewall'
import NAT from './pages/NAT'
import VPN from './pages/VPN'
import DNS from './pages/DNS'
import DHCP from './pages/DHCP'
import Suricata from './pages/Suricata'
import CrowdSec from './pages/CrowdSec'
import AIThreats from './pages/AIThreats'
import ACME from './pages/ACME'
import System from './pages/System'
import LiveLogs from './pages/LiveLogs'
import Metrics from './pages/Metrics'
import Backup from './pages/Backup'
import Notifications from './pages/Notifications'
import NTP from './pages/NTP'
import Cloudflared from './pages/Cloudflared'
import ChangePasswordPage from './pages/ChangePasswordPage'
import AdminSecurity from './pages/AdminSecurity'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes wrapped in MainLayout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="interfaces" element={<Interfaces />} />
          <Route path="gateways" element={<Gateways />} />
          <Route path="firewall" element={<Firewall />} />
          <Route path="nat" element={<NAT />} />
          <Route path="vpn" element={<VPN />} />
          <Route path="dns" element={<DNS />} />
          <Route path="dhcp" element={<DHCP />} />
          <Route path="suricata" element={<Suricata />} />
          <Route path="crowdsec" element={<CrowdSec />} />
          <Route path="ai-threats" element={<AIThreats />} />
          <Route path="acme" element={<ACME />} />
          <Route path="system" element={<System />} />
          <Route path="live-logs" element={<LiveLogs />} />
          <Route path="backup" element={<Backup />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="ntp" element={<NTP />} />
          <Route path="cloudflared" element={<Cloudflared />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="admin-security" element={<AdminSecurity />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
