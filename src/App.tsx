import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import Interfaces from './pages/Interfaces'
import Firewall from './pages/Firewall'
import VPN from './pages/VPN'
import DNS from './pages/DNS'
import DHCP from './pages/DHCP'
import Suricata from './pages/Suricata'
import CrowdSec from './pages/CrowdSec'
import ACME from './pages/ACME'
import System from './pages/System'
import LiveLogs from './pages/LiveLogs'
import Metrics from './pages/Metrics'
import Backup from './pages/Backup'
import Notifications from './pages/Notifications'
import NTP from './pages/NTP'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="interfaces" element={<Interfaces />} />
          <Route path="firewall" element={<Firewall />} />
          <Route path="vpn" element={<VPN />} />
          <Route path="dns" element={<DNS />} />
          <Route path="dhcp" element={<DHCP />} />
          <Route path="suricata" element={<Suricata />} />
          <Route path="crowdsec" element={<CrowdSec />} />
          <Route path="acme" element={<ACME />} />
          <Route path="system" element={<System />} />
          <Route path="live-logs" element={<LiveLogs />} />
          <Route path="backup" element={<Backup />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="ntp" element={<NTP />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
