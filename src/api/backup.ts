import apiClient from './client'
import type {
  ApiResponse,
  BackupEntry,
  CreateBackupRequest,
  RestoreBackupRequest,
  BackupSchedule,
} from '../types'

/**
 * Normalize backend backup responses to frontend BackupEntry type.
 * Backend returns size_bytes and created_at, frontend expects size and createdAt.
 */
function normalizeBackupEntry(raw: Record<string, unknown>): BackupEntry {
  const filename = (raw.filename as string) ?? ''

  const parseEncrypted = (): boolean => {
    const candidates = [raw.encrypted, raw.is_encrypted, raw.encryption_enabled]

    for (const value of candidates) {
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value !== 0
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
        if (['0', 'false', 'no', 'off'].includes(normalized)) return false
      }
    }

    // Fallback: encrypted archives typically end with .enc.
    return filename.toLowerCase().endsWith('.enc')
  }
  
  // Parse created_at from backend response or filename
  let createdAt = ''
  if (raw.created_at) {
    // If backend provides created_at as Unix timestamp (number), convert to ISO
    const timestamp = typeof raw.created_at === 'number' ? raw.created_at : parseInt(raw.created_at as string, 10)
    if (!Number.isNaN(timestamp)) {
      createdAt = new Date(timestamp * 1000).toISOString()
    }
  }
  
  // Fallback: extract timestamp from filename format: dayshield-backup-{timestamp}.tar or .tar.enc
  if (!createdAt) {
    const match = filename.match(/dayshield-backup-(\d+)\./)
    if (match) {
      const timestamp = parseInt(match[1], 10)
      if (!Number.isNaN(timestamp)) {
        createdAt = new Date(timestamp * 1000).toISOString()
      }
    }
  }

  // Normalize type to proper case if present.
  const rawType = ((raw.backup_type as string) || (raw.type as string) || '').trim()
  let type = rawType
  if (type) {
    type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
  }
  return {
    filename,
    size: (raw.size_bytes as number) ?? (raw.size as number),
    createdAt: createdAt || new Date().toISOString(),
    sha256: (raw.sha256 as string) ?? '',
    encrypted: parseEncrypted(),
    type,
    version: ((raw.version as string) ?? '').trim(),
  }
}

export const listBackups = (): Promise<ApiResponse<BackupEntry[]>> =>
  apiClient
    .get<ApiResponse<Record<string, unknown>[]>>('/backup/list')
    .then((r) => ({
      success: r.data.success,
      data: (r.data.data as Record<string, unknown>[])?.map(normalizeBackupEntry) ?? [],
      message: r.data.message,
      error: r.data.error,
    }))

export const createBackup = (
  req: CreateBackupRequest,
): Promise<ApiResponse<BackupEntry>> =>
  apiClient
    .post<ApiResponse<Record<string, unknown>>>('/backup/create', req)
    .then((r) => ({
      success: r.data.success,
      data: normalizeBackupEntry(r.data.data as Record<string, unknown>),
      message: r.data.message,
      error: r.data.error,
    }))

export const restoreBackup = (
  req: RestoreBackupRequest,
): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/backup/restore', req)
    .then((r) => r.data)

export const deleteBackup = (filename: string): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/backup/${encodeURIComponent(filename)}`)
    .then((r) => r.data)

export const downloadBackup = async (filename: string): Promise<void> => {
  const response = await apiClient.get(
    `/backup/download/${encodeURIComponent(filename)}`,
    { responseType: 'blob' },
  )
  const url = URL.createObjectURL(response.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const getBackupSchedule = (): Promise<ApiResponse<BackupSchedule>> =>
  apiClient
    .get<ApiResponse<BackupSchedule>>('/backup/scheduler')
    .then((r) => r.data)

export const updateBackupSchedule = (
  schedule: BackupSchedule,
): Promise<ApiResponse<BackupSchedule>> =>
  apiClient
    .post<ApiResponse<BackupSchedule>>('/backup/scheduler', schedule)
    .then((r) => r.data)
