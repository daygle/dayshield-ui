import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Interfaces from './pages/Interfaces';
import Gateways from './pages/Gateways';
import Firewall from './pages/Firewall';
import NAT from './pages/NAT';
import QoS from './pages/QoS';
import VPN from './pages/VPN';
import DNS from './pages/DNS';
import DynamicDNS from './pages/DynamicDNS';
import DHCP from './pages/DHCP';
import CaptivePortal from './pages/CaptivePortal';
import Suricata from './pages/Suricata';
import SuricataRulesetsPage from './pages/Suricata/RulesetsPage';
import CrowdSec from './pages/CrowdSec';
import AIThreatEngine from './pages/AIThreatEngine';
import Security from './pages/Security';
import ACME from './pages/ACME';
import System from './pages/System';
import Logs from './pages/Logs';
import Backup from './pages/Backup';
import ConfigHistory from './pages/ConfigHistory';
import Notifications from './pages/Notifications';
import NTP from './pages/NTP';
import Cloudflared from './pages/Cloudflared';
import Tools from './pages/Tools';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AdminSecurity from './pages/AdminSecurity';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
        handle: { title: 'Dashboard' },
      },
      {
        path: 'metrics',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'interfaces',
        element: <Interfaces />,
        handle: { title: 'Network Interfaces' },
      },
      {
        path: 'gateways',
        element: <Gateways />,
        handle: { title: 'Gateways' },
      },
      {
        path: 'firewall',
        element: <Firewall />,
        handle: { title: 'Firewall' },
      },
      {
        path: 'nat',
        element: <NAT />,
        handle: { title: 'NAT' },
      },
      {
        path: 'qos',
        element: <QoS />,
        handle: { title: 'QoS' },
      },
      {
        path: 'vpn',
        element: <VPN />,
        handle: { title: 'VPN' },
      },
      {
        path: 'dns',
        element: <DNS />,
        handle: { title: 'DNS' },
      },
      {
        path: 'dynamic-dns',
        element: <DynamicDNS />,
        handle: { title: 'Dynamic DNS' },
      },
      {
        path: 'dhcp',
        element: <DHCP />,
        handle: { title: 'DHCP' },
      },
      {
        path: 'captive-portal',
        element: <CaptivePortal />,
        handle: { title: 'Captive Portal' },
      },
      {
        path: 'suricata',
        element: <Suricata />,
        handle: { title: 'Suricata' },
      },
      {
        path: 'suricata/rulesets',
        element: <SuricataRulesetsPage />,
        handle: { title: 'Suricata Rulesets' },
      },
      {
        path: 'crowdsec',
        element: <CrowdSec />,
        handle: { title: 'CrowdSec' },
      },
      {
        path: 'ai-threat-engine',
        element: <AIThreatEngine />,
        handle: { title: 'AI Threat Engine' },
      },
      {
        path: 'security',
        element: <Security />,
        handle: { title: 'Security' },
      },
      {
        path: 'acme',
        element: <ACME />,
        handle: { title: 'ACME' },
      },
      {
        path: 'system',
        element: <System />,
        handle: { title: 'System' },
      },
      {
        path: 'logs',
        element: <Logs />,
        handle: { title: 'Logs' },
      },
      {
        path: 'live-logs',
        element: <Navigate to="/logs?tab=live" replace />,
      },
      {
        path: 'backup',
        element: <Backup />,
        handle: { title: 'Backup' },
      },
      {
        path: 'config-history',
        element: <ConfigHistory />,
        handle: { title: 'Config History' },
      },
      {
        path: 'notifications',
        element: <Notifications />,
        handle: { title: 'Notifications' },
      },
      {
        path: 'ntp',
        element: <NTP />,
        handle: { title: 'NTP' },
      },
      {
        path: 'cloudflared',
        element: <Cloudflared />,
        handle: { title: 'Cloudflared' },
      },
      {
        path: 'tools',
        element: <Tools />,
        handle: { title: 'Tools' },
      },
      {
        path: 'change-password',
        element: <ChangePasswordPage />,
        handle: { title: 'Change Password' },
      },
      {
        path: 'admin-security',
        element: <AdminSecurity />,
        handle: { title: 'Admin Security' },
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
