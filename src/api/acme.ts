import apiClient from './client'
import type { ApiResponse, AcmeAccount, AcmeCertificate } from '../types'

// ── Account ───────────────────────────────────────────────────────────────────

export const getAcmeAccount = (): Promise<ApiResponse<AcmeAccount>> =>
  apiClient
    .get<ApiResponse<AcmeAccount>>('/acme/account')
    .then((r) => r.data)

export const updateAcmeAccount = (
  account: Partial<AcmeAccount>,
): Promise<ApiResponse<AcmeAccount>> =>
  apiClient
    .put<ApiResponse<AcmeAccount>>('/acme/account', account)
    .then((r) => r.data)

// ── Certificates ──────────────────────────────────────────────────────────────

export const getAcmeCertificates = (): Promise<ApiResponse<AcmeCertificate[]>> =>
  apiClient
    .get<ApiResponse<AcmeCertificate[]>>('/acme/certificates')
    .then((r) => r.data)

export const issueAcmeCertificate = (
  cert: Pick<AcmeCertificate, 'domain' | 'sans' | 'autoRenew'>,
): Promise<ApiResponse<AcmeCertificate>> =>
  apiClient
    .post<ApiResponse<AcmeCertificate>>('/acme/certificates', cert)
    .then((r) => r.data)

export const renewAcmeCertificate = (id: number): Promise<ApiResponse<AcmeCertificate>> =>
  apiClient
    .post<ApiResponse<AcmeCertificate>>(`/acme/certificates/${id}/renew`)
    .then((r) => r.data)

export const deleteAcmeCertificate = (id: number): Promise<ApiResponse<void>> =>
  apiClient
    .delete<ApiResponse<void>>(`/acme/certificates/${id}`)
    .then((r) => r.data)
