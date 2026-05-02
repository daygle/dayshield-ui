import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import LoginForm from '../components/LoginForm'

export default function LoginPage() {
  const { signIn } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  async function handleLogin(username: string, password: string) {
    await signIn({ username, password })
    addToast('Signed in successfully.', 'success')
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <img src="/shield.svg" alt="DayShield" className="h-10 w-10" />
          <div>
            <span className="text-gray-900 font-bold text-xl leading-none">DayShield</span>
            <span className="block text-[11px] text-blue-500 mt-0.5 tracking-widest uppercase">
              Firewall
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md px-8 py-8">
          <h1 className="text-base font-semibold text-gray-800 mb-6 text-center">
            Sign in to continue
          </h1>
          <LoginForm onSubmit={handleLogin} />
        </div>
      </div>
    </div>
  )
}
