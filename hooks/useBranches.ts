import { useQuery } from '@tanstack/react-query';
import { getBranch } from '../services/api';

export const BRANCHES_QUERY_KEY = ['branches'] as const;

export function useBranchesQuery(enabled = true) {
  return useQuery({
    queryKey: BRANCHES_QUERY_KEY,
    queryFn: getBranch,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 min - branches rarely change
    gcTime: 10 * 60 * 1000,
  });
}
