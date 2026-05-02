import { useState } from 'react'
import Modal from '../../components/Modal'
import FormField from '../../components/FormField'

interface EncryptionPasswordDialogProps {
  open: boolean
  loading: boolean
  filename: string
  onClose: () => void
  onConfirm: (password: string) => void
}

export default function EncryptionPasswordDialog({
  open,
  loading,
  filename,
  onClose,
  onConfirm,
}: EncryptionPasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = () => {
    if (!password) {
      setError('Password is required.')
      return
    }
    setError('')
    onConfirm(password)
  }

  const handleClose = () => {
    setPassword('')
    setError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      title="Encryption Password"
      onClose={handleClose}
      onConfirm={handleConfirm}
      confirmLabel="Continue"
      loading={loading}
      size="sm"
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          The backup <span className="font-mono text-xs font-semibold">{filename}</span> is
          encrypted. Enter the password to proceed.
        </p>
        <FormField
          id="enc-pw"
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError('')
          }}
          autoComplete="current-password"
          error={error}
        />
      </div>
    </Modal>
  )
}
