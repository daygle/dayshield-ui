import { useState } from 'react'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'
import type { CreateBackupRequest } from '../../types'

const SELECTIVE_COMPONENTS = [
  { id: 'firewall', label: 'Firewall rules' },
  { id: 'dns', label: 'DNS configuration' },
  { id: 'dhcp', label: 'DHCP configuration' },
  { id: 'vpn', label: 'VPN / WireGuard' },
  { id: 'certificates', label: 'Certificates (ACME)' },
  { id: 'system', label: 'System configuration' },
]

interface CreateBackupDialogProps {
  open: boolean
  loading: boolean
  onClose: () => void
  onConfirm: (req: CreateBackupRequest) => void
}

export default function CreateBackupDialog({
  open,
  loading,
  onClose,
  onConfirm,
}: CreateBackupDialogProps) {
  const [type, setType] = useState<'full' | 'selective'>('full')
  const [components, setComponents] = useState<string[]>([])
  const [encrypt, setEncrypt] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')

  const toggleComponent = (id: string) => {
    setComponents((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const handleConfirm = () => {
    if (encrypt) {
      if (!password) {
        setPwError('Password is required for encrypted backups.')
        return
      }
      if (password !== confirmPassword) {
        setPwError('Passwords do not match.')
        return
      }
    }
    setPwError('')
    const req: CreateBackupRequest = { type }
    if (type === 'selective') req.components = components
    if (encrypt && password) req.password = password
    onConfirm(req)
  }

  const handleClose = () => {
    setType('full')
    setComponents([])
    setEncrypt(false)
    setPassword('')
    setConfirmPassword('')
    setPwError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Create Backup"
      onClose={handleClose}
      onConfirm={handleConfirm}
      confirmLabel="Create Backup"
      loading={loading}
      size="lg"
    >
      <div className="space-y-4">
        {/* Backup type */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Backup type</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="backup-type"
                value="full"
                checked={type === 'full'}
                onChange={() => setType('full')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Full backup</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="backup-type"
                value="selective"
                checked={type === 'selective'}
                onChange={() => setType('selective')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Selective backup</span>
            </label>
          </div>
        </div>

        {/* Selective components */}
        {type === 'selective' && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Components to include</p>
            <div className="grid grid-cols-2 gap-2">
              {SELECTIVE_COMPONENTS.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={components.includes(c.id)}
                    onChange={() => toggleComponent(c.id)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Encryption toggle */}
        <div className="border-t border-gray-100 pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={encrypt}
              onChange={(e) => {
                setEncrypt(e.target.checked)
                setPwError('')
              }}
              className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Encrypt this backup</span>
          </label>
        </div>

        {/* Password fields */}
        {encrypt && (
          <div className="space-y-3">
            <FormField
              id="create-pw"
              label="Encryption password"
              type="password"
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwError('') }}
              autoComplete="new-password"
            />
            <FormField
              id="create-pw-confirm"
              label="Confirm password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPwError('') }}
              autoComplete="new-password"
              error={pwError}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
