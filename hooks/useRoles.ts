import { useQuery } from '@tanstack/react-query';
import { getRoles } from '../services/api';

export const ROLES_QUERY_KEY = ['roles'] as const;

export function useRolesQuery(enabled = true) {
  return useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: getRoles,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min - roles rarely change
    gcTime: 10 * 60 * 1000,
  });
}
