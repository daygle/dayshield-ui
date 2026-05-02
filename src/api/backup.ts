import apiClient from './client'
import type {
  ApiResponse,
  BackupEntry,
  CreateBackupRequest,
  RestoreBackupRequest,
  BackupSchedule,
} from '../types'

export const listBackups = (): Promise<ApiResponse<BackupEntry[]>> =>
  apiClient
    .get<ApiResponse<BackupEntry[]>>('/backup/list')
    .then((r) => r.data)

export const createBackup = (
  req: CreateBackupRequest,
): Promise<ApiResponse<BackupEntry>> =>
  apiClient
    .post<ApiResponse<BackupEntry>>('/backup/create', req)
    .then((r) => r.data)

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
