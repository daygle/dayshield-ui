import apiClient from './client'
import type { ApiResponse, AcmeAccount, AcmeCertificate } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────
// Core ACME API: GET/POST /acme/config, POST /acme/issue, GET /acme/status

export const getAcmeConfig = (): Promise<ApiResponse<AcmeAccount>> =>
  apiClient
    .get<ApiResponse<AcmeAccount>>('/acme/config')
    .then((r) => r.data)

export const updateAcmeConfig = (
  config: Partial<AcmeAccount>,
): Promise<ApiResponse<AcmeAccount>> =>
  apiClient
    .post<ApiResponse<AcmeAccount>>('/acme/config', config)
    .then((r) => r.data)

// ── Certificate operations ────────────────────────────────────────────────────

export const issueAcmeCertificates = (): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/acme/issue')
    .then((r) => r.data)

export const getAcmeCertStatus = (): Promise<ApiResponse<AcmeCertificate>> =>
  apiClient
    .get<ApiResponse<AcmeCertificate>>('/acme/status')
    .then((r) => r.data)
