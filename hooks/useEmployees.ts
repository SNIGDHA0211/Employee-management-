import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { fromApiDateFormat } from '../services/dateUtils';
import { UserRole, User } from '../types';
import { getEmployees, getEmployeesFromAccounts } from '../services/api';

/** Convert Photo_link to absolute URL */
const convertPhotoLinkToUrl = (photoLink: string | null | undefined): string => {
  if (!photoLink || typeof photoLink !== 'string' || photoLink.trim() === '') return '';
  const s = photoLink.trim();
  if (s.startsWith('http') || s.startsWith('data:')) return s;
  if (s.includes('ui-avatars.com')) return s;
  const base = 'https://employee-management-system-tmrl.onrender.com';
  if (!s.startsWith('/media/') && !s.startsWith('media/')) {
    const clean = s.startsWith('/') ? s.slice(1) : s;
    return `${base}/media/${clean}`;
  }
  return s.startsWith('/') ? `${base}${s}` : `${base}/${s}`;
};

const mapApiRoleToUserRole = (apiRole: any): UserRole => {
  let extracted = typeof apiRole === 'string' ? apiRole : '';
  if (Array.isArray(apiRole) && apiRole[0]?.Role) extracted = apiRole[0].Role;
  else if (apiRole?.Role) extracted = apiRole.Role;
  const normalized = String(extracted || apiRole).toUpperCase().trim().replace(/\s+/g, '_');
  const compact = normalized.replace(/_/g, '');
  if (normalized === 'MD') return UserRole.MD;
  if (normalized === 'ADMIN') return UserRole.ADMIN;
  if (compact === 'TEAMLEAD' || compact === 'TEAMLEADER' || (normalized.includes('TEAM') && normalized.includes('LEAD'))) return UserRole.TEAM_LEADER;
  if (normalized === 'EMPLOYEE') return UserRole.EMPLOYEE;
  if (normalized === 'INTERN') return UserRole.INTERN;
  return UserRole.EMPLOYEE;
};

const mapEmployeeToUser = (emp: any): User => {
  const employeeId = emp['Employee_id'] != null ? String(emp['Employee_id']).trim() : (emp['Employee ID'] || emp.id || '');
  const role = emp['Role'] || emp.role || 'EMPLOYEE';
  return {
    id: employeeId,
    name: emp['Name'] || emp['Full Name'] || emp.name || 'Unknown',
    email: emp['Email_id'] || emp['Email Address'] || emp.email || '',
    role: mapApiRoleToUserRole(role),
    designation: emp['Designation'] || emp.designation || 'Employee',
    birthDate: fromApiDateFormat(emp['Date_of_birth'] || emp['Date of Birth'] || emp.birthDate || '') || '1995-01-01',
    joinDate: fromApiDateFormat(emp['Date_of_join'] || emp['Joining Date'] || emp.joinDate || '') || new Date().toISOString().split('T')[0],
    avatar: convertPhotoLinkToUrl(emp['Photo_link'] || emp['Profile Picture'] || emp.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp['Name'] || emp.name || '')}&background=random`,
    status: 'PRESENT',
    leaveBalance: 12,
    score: 0,
    branch: (emp['Branch'] || emp.branch || 'TECH') as any,
    password: emp['Initial Password'] || emp.password,
    numberOfDaysFromJoining: emp['Number_of_days_from_joining'] != null ? String(emp['Number_of_days_from_joining']).trim() : undefined,
    ...(emp['Employee_id'] != null && { Employee_id: String(emp['Employee_id']).trim() }),
    department: emp['Department'] || emp.department || '',
    function: emp['Function'] || emp.function || emp.Function || '',
    teamLead: emp['Team_Lead'] || emp['Teamlead'] || emp.teamLead || '',
  };
};

export const EMPLOYEES_QUERY_KEY = ['employees'] as const;

/** Fetches employees and maps to User[]. Single source - tries getEmployees, fallback getEmployeesFromAccounts for Intern. */
export function useEmployeesQuery(enabled: boolean) {
  return useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: async () => {
      try {
        const employees = await getEmployees();
        return employees.map(mapEmployeeToUser);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) {
          const fromAccounts = await getEmployeesFromAccounts();
          return fromAccounts.map(mapEmployeeToUser);
        }
        throw err;
      }
    },
    enabled,
    staleTime: 60 * 1000, // 1 min - avoid refetch on tab switch
    gcTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useEmployeesInvalidate() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY }), [queryClient]);
}
