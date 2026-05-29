import apiClient from './client';
import type { ApiResponse, QosActionResponse, QosConfig, QosInterfaceStatus } from '../types';

export const getQosConfig = (): Promise<ApiResponse<QosConfig>> =>
  apiClient.get<ApiResponse<QosConfig>>('/qos/config').then((r) => r.data);

export const updateQosConfig = (config: QosConfig): Promise<ApiResponse<QosConfig>> =>
  apiClient.put<ApiResponse<QosConfig>>('/qos/config', config).then((r) => r.data);

export const getQosStatus = (): Promise<ApiResponse<QosInterfaceStatus[]>> =>
  apiClient.get<ApiResponse<QosInterfaceStatus[]>>('/qos/status').then((r) => r.data);

export const applyQosConfig = (): Promise<ApiResponse<QosActionResponse>> =>
  apiClient.post<ApiResponse<QosActionResponse>>('/qos/apply').then((r) => r.data);