import type { AdminUserQuery, OrganizationUnitQuery } from '@ocop/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { adminUsersApi } from '../api/admin-users';
import { authApi } from '../api/auth';
import { queryKeys } from '../constants/query-key';
import { staffAccessWouldRevokeSession } from '../lib/admin-user-form';
import { getSession, setSession } from '../lib/auth';

export function useAdminUsers(query: AdminUserQuery) {
  return useQuery({
    queryKey: queryKeys.adminUsers.users.list(query),
    queryFn: () => adminUsersApi.list(query),
  });
}

export function useAdminUser(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminUsers.users.detail(id),
    queryFn: () => adminUsersApi.detail(id),
    enabled: enabled && Boolean(id),
  });
}

export function useOrganizationUnits(query: OrganizationUnitQuery) {
  return useQuery({
    queryKey: queryKeys.adminUsers.units.list(query),
    queryFn: () => adminUsersApi.units(query),
  });
}

export function useRegistrantOwners(
  query: Pick<AdminUserQuery, 'page' | 'limit' | 'q'> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.adminUsers.owners(query),
    queryFn: () => adminUsersApi.listRegistrantOwners(query),
    enabled,
  });
}

export function useAdminUserMutations() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({ mutationFn: adminUsersApi.create, retry: false, gcTime: 0 });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminUsersApi.update>[1] }) =>
      adminUsersApi.update(id, data),
    retry: false,
  });
  const access = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminUsersApi.access>[1] }) =>
      adminUsersApi.access(id, data),
    retry: false,
  });
  const status = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminUsersApi.status>[1] }) =>
      adminUsersApi.status(id, data),
    retry: false,
  });
  const resetPassword = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof adminUsersApi.resetPassword>[1];
    }) => adminUsersApi.resetPassword(id, data),
    retry: false,
    gcTime: 0,
  });
  const createUnit = useMutation({ mutationFn: adminUsersApi.createUnit, retry: false });
  const updateUnit = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof adminUsersApi.updateUnit>[1];
    }) => adminUsersApi.updateUnit(id, data),
    retry: false,
  });

  const invalidateUsers = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.users.all });
  };
  const invalidateStaffViews = () => {
    invalidateUsers();
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.judges });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.assignments });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
  };
  const finishRevokingSelf = (id: string, tokenRevoked = true) => {
    if (!tokenRevoked || getSession()?.user.id !== id) return false;
    setSession(null);
    queryClient.removeQueries({ queryKey: queryKeys.adminUsers.users.all });
    queryClient.removeQueries({ queryKey: queryKeys.adminUsers.units.all });
    queryClient.removeQueries({ queryKey: queryKeys.admin.all });
    queryClient.removeQueries({ queryKey: queryKeys.judge.all });
    void navigate({ to: '/login', replace: true });
    return true;
  };

  return {
    createUser: async (data: Parameters<typeof adminUsersApi.create>[0]) => {
      try {
        const result = await create.mutateAsync(data);
        invalidateStaffViews();
        return result;
      } finally {
        create.reset();
      }
    },
    updateProfile: async (id: string, data: Parameters<typeof adminUsersApi.update>[1]) => {
      const result = await update.mutateAsync({ id, data });
      invalidateStaffViews();
      if (getSession()?.user.id === id) {
        void authApi
          .me()
          .then(({ data: user }) => queryClient.setQueryData(queryKeys.me, user))
          .catch(() => {
            const session = getSession();
            if (session?.user.id === id) setSession({ ...session, user: result.data });
          });
      }
      return result;
    },
    updateAccess: async (id: string, data: Parameters<typeof adminUsersApi.access>[1]) => {
      const result = await access.mutateAsync({ id, data });
      const current = getSession();
      if (!finishRevokingSelf(id, staffAccessWouldRevokeSession(current?.user, data)))
        invalidateStaffViews();
      return result;
    },
    updateStatus: async (id: string, data: Parameters<typeof adminUsersApi.status>[1]) => {
      const result = await status.mutateAsync({ id, data });
      if (!finishRevokingSelf(id, !data.isActive)) invalidateStaffViews();
      return result;
    },
    resetUserPassword: async (
      id: string,
      data: Parameters<typeof adminUsersApi.resetPassword>[1],
    ) => {
      try {
        const result = await resetPassword.mutateAsync({ id, data });
        if (!finishRevokingSelf(id)) invalidateStaffViews();
        return result;
      } finally {
        resetPassword.reset();
      }
    },
    createUnit: async (data: Parameters<typeof adminUsersApi.createUnit>[0]) => {
      const result = await createUnit.mutateAsync(data);
      invalidateUsers();
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.units.all });
      return result;
    },
    updateUnit: async (id: string, data: Parameters<typeof adminUsersApi.updateUnit>[1]) => {
      const result = await updateUnit.mutateAsync({ id, data });
      invalidateUsers();
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.units.all });
      return result;
    },
  };
}
