import { Link, useMatches, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/Button';

interface TopBarProps {
  onOpenSidebar: () => void;
}

export default function TopBar({ onOpenSidebar }: TopBarProps) {
  const matches = useMatches();
  const title =
    matches
      .slice()
      .reverse()
      .map((match) => (match.handle as { title?: string } | undefined)?.title)
      .find((value): value is string => typeof value === 'string') || 'DayShield';
  const { user, signOut } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    addToast('You have been signed out.', 'info');
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex min-h-14 items-center justify-between gap-3 bg-white px-3 py-2 border-b border-gray-200 shrink-0 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-label="Open navigation"
          className="rounded-md border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 lg:hidden"
          onClick={onOpenSidebar}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <h1 className="truncate text-sm font-semibold text-gray-800 sm:text-base">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Username + change-password link */}
        {user && (
          <Link
            to="/change-password"
            className="text-xs text-gray-500 hover:text-blue-600 hidden sm:inline"
            title="Change password"
          >
            {user.username}
          </Link>
        )}

        {/* User avatar */}
        <div
          className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white"
          aria-label="User profile"
          title={user?.username ? `Signed in as ${user.username}` : 'User profile'}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0"
            />
          </svg>
        </div>

        {/* Logout button */}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
