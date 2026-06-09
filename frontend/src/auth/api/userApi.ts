import { api } from '../../api/questApi';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  slackMemberId: string;
  role: string;
  createdAt: string;
}

export interface AuditLogRow {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
}

export interface TransferResult {
  self: ManagedUser;
  target: ManagedUser;
}

export const userApi = {
  list: async (): Promise<ManagedUser[]> => {
    const { data } = await api.get<ManagedUser[]>('/users');
    return data;
  },

  updateRole: async (
    id: string,
    role: 'admin' | 'employee',
  ): Promise<ManagedUser> => {
    const { data } = await api.patch<ManagedUser>(`/users/${id}/role`, { role });
    return data;
  },

  transferOwnership: async (id: string): Promise<TransferResult> => {
    const { data } = await api.post<TransferResult>(`/users/${id}/transfer-ownership`);
    return data;
  },

  auditLogs: async (limit = 100): Promise<AuditLogRow[]> => {
    const { data } = await api.get<AuditLogRow[]>('/users/audit-logs', {
      params: { limit },
    });
    return data;
  },
};
