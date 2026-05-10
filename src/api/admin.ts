import apiClient from './client'
import type { AdminSecuritySettings } from '../types'

const DEFAULT_ADMIN_SECURITY: AdminSecuritySettings = {
  session_timeout_minutes: 480,
  max_login_attempts: 5,
  lockout_duration_minutes: 15,
  min_password_length: 8,
  require_uppercase: false,
  require_number: false,
  require_special: false,
}

function normalizeAdminSecurity(raw: unknown): AdminSecuritySettings {
  const value = (raw ?? {}) as Partial<AdminSecuritySettings>
  return {
    session_timeout_minutes:
      typeof value.session_timeout_minutes === 'number' && value.session_timeout_minutes > 0
        ? value.session_timeout_minutes
        : DEFAULT_ADMIN_SECURITY.session_timeout_minutes,
    max_login_attempts:
      typeof value.max_login_attempts === 'number' && value.max_login_attempts >= 0
        ? value.max_login_attempts
        : DEFAULT_ADMIN_SECURITY.max_login_attempts,
    lockout_duration_minutes:
      typeof value.lockout_duration_minutes === 'number' && value.lockout_duration_minutes > 0
        ? value.lockout_duration_minutes
        : DEFAULT_ADMIN_SECURITY.lockout_duration_minutes,
    min_password_length:
      typeof value.min_password_length === 'number' && value.min_password_length >= 4
        ? value.min_password_length
        : DEFAULT_ADMIN_SECURITY.min_password_length,
    require_uppercase: Boolean(value.require_uppercase),
    require_number: Boolean(value.require_number),
    require_special: Boolean(value.require_special),
  }
}

export const getAdminSecurity = (): Promise<AdminSecuritySettings> =>
  apiClient
    .get('/admin/security')
    .then((r) => normalizeAdminSecurity((r.data as { data?: unknown })?.data))

export const updateAdminSecurity = (
  settings: AdminSecuritySettings,
): Promise<{ message: string }> =>
  apiClient
    .put('/admin/security', settings)
    .then((r) => {
      const payload = (r.data as { data?: { message?: string }; message?: string })
      return {
        message: payload.data?.message ?? payload.message ?? 'admin security settings updated',
      }
    })
