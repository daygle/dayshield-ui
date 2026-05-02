import apiClient from './client'
import type { ApiResponse, AuthStatus, LoginRequest, ChangePasswordRequest } from '../types'

export const login = (data: LoginRequest): Promise<ApiResponse<AuthStatus>> =>
  apiClient
    .post<ApiResponse<AuthStatus>>('/auth/login', data)
    .then((r) => r.data)

export const logout = (): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/auth/logout')
    .then((r) => r.data)

export const changePassword = (
  data: ChangePasswordRequest,
): Promise<ApiResponse<void>> =>
  apiClient
    .post<ApiResponse<void>>('/auth/change-password', data)
    .then((r) => r.data)

export const getAuthStatus = (): Promise<ApiResponse<AuthStatus>> =>
  apiClient
    .get<ApiResponse<AuthStatus>>('/auth/status')
    .then((r) => r.data)
