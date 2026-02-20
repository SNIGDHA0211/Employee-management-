import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { viewTasks, viewAssignedTasks } from '../services/api';
import { UserRole } from '../types';
import type { User } from '../types';

export type TasksViewMode = 'assign' | 'reporting';

export function getTasksQueryKey(viewMode: TasksViewMode, isMD: boolean) {
  return ['tasks', viewMode, isMD ? 'md' : 'user'] as const;
}

async function fetchTasksForMode(viewMode: TasksViewMode, isMD: boolean) {
  if (viewMode === 'reporting') {
    return isMD ? viewAssignedTasks() : viewTasks();
  }
  return isMD ? viewTasks() : viewAssignedTasks();
}

export function useTasksQuery(
  viewMode: TasksViewMode,
  currentUser: User | null,
  enabled: boolean
) {
  const isMD = currentUser?.role === UserRole.MD;
  const queryKey = getTasksQueryKey(viewMode, !!isMD);

  return useQuery({
    queryKey,
    queryFn: () => tasksQueryFn(viewMode, !!isMD),
    enabled: enabled && !!currentUser?.id,
    staleTime: 60 * 1000, // 1 min; invalidateTasks() on mutations keeps data fresh
    gcTime: 2 * 60 * 1000,
  });
}

export function useTasksInvalidate() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);
}

async function tasksQueryFn(viewMode: TasksViewMode, isMD: boolean) {
  const apiTasks = await fetchTasksForMode(viewMode, isMD);
  return Array.isArray(apiTasks) ? apiTasks : (apiTasks && typeof apiTasks === 'object' ? [apiTasks] : []);
}

export function usePrefetchTasks() {
  const queryClient = useQueryClient();
  return useCallback(
    (viewMode: TasksViewMode, isMD: boolean) => {
      queryClient.prefetchQuery({
        queryKey: getTasksQueryKey(viewMode, isMD),
        queryFn: () => tasksQueryFn(viewMode, isMD),
      });
    },
    [queryClient]
  );
}
