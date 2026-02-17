import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getMeetingPush } from '../services/api';

export const MEETING_PUSH_QUERY_KEY = ['meetingPush'] as const;

export function useMeetingPushQuery(enabled: boolean) {
  return useQuery({
    queryKey: MEETING_PUSH_QUERY_KEY,
    queryFn: getMeetingPush,
    enabled,
    staleTime: 60 * 1000, // 1 min
    gcTime: 5 * 60 * 1000,
  });
}

export function useMeetingPushInvalidate() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: MEETING_PUSH_QUERY_KEY }),
    [queryClient]
  );
}
