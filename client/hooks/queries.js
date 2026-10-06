'use client';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/components/contexts';

const opts = (extra = {}) => ({ placeholderData: keepPreviousData, ...extra });

export const useUsers = () =>
  useQuery({ queryKey: ['users'], queryFn: () => api('/users').then((d) => d.users), staleTime: 30_000 });

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api('/dashboard'), refetchInterval: 30_000 });

export const useTasks = ({ mine = false, params = {} } = {}) =>
  useQuery({
    queryKey: ['tasks', mine ? 'my' : 'team', params],
    queryFn: () => api(mine ? '/tasks/my' : '/tasks', { params }),
    refetchInterval: 30_000,
    ...opts(),
  });

export const useTask = (id) =>
  useQuery({ queryKey: ['task', id], queryFn: () => api(`/tasks/${id}`).then((d) => d.task), enabled: !!id, refetchInterval: 15_000 });

export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: () => api('/notifications', { params: { limit: 30 } }), refetchInterval: 20_000 });

export const useAttendanceToday = () =>
  useQuery({ queryKey: ['attendance', 'today'], queryFn: () => api('/attendance/today'), refetchInterval: 60_000 });

export const useAttendanceHistory = (month, userId) =>
  useQuery({ queryKey: ['attendance', 'history', month, userId], queryFn: () => api('/attendance/history', { params: { month, userId } }), ...opts() });

export const useAttendanceTeam = () =>
  useQuery({ queryKey: ['attendance', 'team'], queryFn: () => api('/attendance/team'), refetchInterval: 60_000 });

export const useAttendanceDay = (date) =>
  useQuery({ queryKey: ['attendance', 'day', date], queryFn: () => api(`/attendance/day/${date}`), enabled: !!date });

export const useLeaves = (scope) =>
  useQuery({ queryKey: ['leave', scope], queryFn: () => api('/leave', { params: { scope } }).then((d) => d.leaves), refetchInterval: 45_000 });

export const useLeaderboard = (period) =>
  useQuery({ queryKey: ['leaderboard', period], queryFn: () => api('/leaderboard', { params: { period } }), refetchInterval: 60_000, ...opts() });

export const useActivity = (params) =>
  useQuery({ queryKey: ['activity', params], queryFn: () => api('/activity', { params }), refetchInterval: 45_000, ...opts() });

export const useProfile = (id) =>
  useQuery({ queryKey: ['profile', id], queryFn: () => api(`/users/${id}`), enabled: !!id });

export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: () => api('/settings').then((d) => d.settings), staleTime: 60_000 });

// Generic mutation: toasts on success/error and refreshes everything (tiny app, tiny cost).
export function useAction(fn, { success, onSuccess, silentError } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      await qc.invalidateQueries();
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (err) => { if (!silentError) toast.error(err.message || 'Something went wrong. Please try again.'); },
  });
}
