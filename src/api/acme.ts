import apiClient from './client'
import type { ApiResponse, AcmeAccount, AcmeCertificate } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────
// Core ACME API: GET/POST /acme/config, POST /acme/issue, GET /acme/status

export const getAcmeConfig = (): Promise<ApiResponse<AcmeAccount>> =>
  apiClient
    .get<ApiResponse<AcmeAccount>>('/acme/config')
    .then((r: { data: ApiResponse<AcmeAccount> }) => r.data)

export const updateAcmeConfig = (
  config: Partial<AcmeAccount>,
): Promise<ApiResponse<AcmeAccount>> =>
  apiClient
    .post<ApiResponse<AcmeAccount>>('/acme/config', config)
    .then((r: { data: ApiResponse<AcmeAccount> }) => r.data)

// ── Certificate operations ────────────────────────────────────────────────────

export const issueAcmeCertificates = (): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/acme/issue')
    .then((r: { data: ApiResponse<void> }) => r.data)

export const getAcmeCertStatus = (): Promise<ApiResponse<AcmeCertificate>> =>
  apiClient
    .get<ApiResponse<AcmeCertificate>>('/acme/status')
    .then((r: { data: ApiResponse<AcmeCertificate> }) => r.data)

// Legacy / compatibility wrappers for older UI pages
export const getAcmeAccount = getAcmeConfig
export const updateAcmeAccount = updateAcmeConfig
export const getAcmeCertificates = (): Promise<ApiResponse<AcmeCertificate[]>> =>
  getAcmeCertStatus().then((r) => ({ ...r, data: [r.data] }))
export const issueAcmeCertificate = (
  payload: { domain: string; sans: string[]; autoRenew: boolean },
): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/acme/issue', payload)
    .then((r: { data: ApiResponse<void> }) => r.data)

export const renewAcmeCertificate = (_id: number): Promise<ApiResponse<void>> =>
  Promise.reject(new Error('Per-certificate renew is not supported; use issueAcmeCertificates() to renew all'))
export const deleteAcmeCertificate = (_id: number): Promise<ApiResponse<void>> =>
  Promise.reject(new Error('Certificate deletion is not supported by the current backend'))
