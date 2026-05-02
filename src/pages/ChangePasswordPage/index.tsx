import { changePassword } from '../../api/auth'
import { useToast } from '../../context/ToastContext'
import Card from '../../components/Card'
import PasswordChangeForm from '../../components/PasswordChangeForm'

export default function ChangePasswordPage() {
  const { addToast } = useToast()

  async function handleChangePassword(
    currentPassword: string,
    newPassword: string,
  ) {
    await changePassword({ currentPassword, newPassword })
    addToast('Password updated successfully.', 'success')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Change Password</h1>

      <div className="max-w-md">
        <Card title="Update your password">
          <PasswordChangeForm onSubmit={handleChangePassword} />
        </Card>
      </div>
    </div>
  )
}
