import apiClient from './client'
import type { AdminSecuritySettings } from '../types'

export const getAdminSecurity = (): Promise<AdminSecuritySettings> =>
  apiClient
    .get<AdminSecuritySettings>('/admin/security')
    .then((r) => r.data)

export const updateAdminSecurity = (
  settings: AdminSecuritySettings,
): Promise<{ message: string }> =>
  apiClient
    .put<{ message: string }>('/admin/security', settings)
    .then((r) => r.data)
