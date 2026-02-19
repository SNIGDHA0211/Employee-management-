import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserRole, User, Task, Project, Message, ChatGroup, AttendanceRecord, Tour, formatRoleForDisplay } from './types';
import api, { 
  login as apiLogin, 
  getEmployeeDashboard,
  logout as apiLogout,
  getRooms,
  getHolidays,
  getEvents,
  getTours,
  getBookSlots,
  viewTasks as apiViewTasks,
  viewAssignedTasks as apiViewAssignedTasks,
} from './services/api';
import { getNMRHIAllowedCategories } from './components/NMRHI/constants';
import { convertApiTasksToTasks } from './utils/taskConversion';
import { clearAuthData } from './services/utils/auth';
import { Sidebar, Header } from './components/Layout';
import { MeetCard } from './components/MeetCard';
import { TaskBoard } from './components/TaskBoard';
import { ChatSystem } from './components/ChatSystem';
import { StatCard, ProjectCard, PerformanceChart, BossRevenueChart, DistributionChart } from './components/DashboardWidgets';
import { AdminPanel } from './components/AdminPanel';
import { AttendanceTours } from './components/AttendanceTours';
import { ReportsPage } from './components/reports';
import { ScheduleHubPage } from './components/calendars';
import type { Meeting, Holiday, Tour as ScheduleTour } from './components/calendars/types';
import { MeetingStatus, MeetingType } from './components/calendars/types';
import { addDays, format } from 'date-fns';
import { MDDashboardPage } from './components/MDDashboard';
import { NMRHIPage } from './components/NMRHI';
import AdminDashboard from './components/AdminOps/AdminDashboard';
import AssetManager from './components/AdminOps/AssetManager';
import VendorManager from './components/AdminOps/VendorManager';
import ExpenseManager from './components/AdminOps/ExpenseManager';
import BillsManager from './components/AdminOps/BillsManager';
import { Users, Briefcase, CheckSquare, AlertTriangle, ShieldCheck, Activity, Lock, User as UserIcon, ArrowRight, Clock, CheckCircle2, XCircle, Leaf, Building2, Cpu, Database, Fingerprint, X, Mail, Calendar, Briefcase as BriefcaseIcon, Eye, EyeOff, Shield, Download } from 'lucide-react';
import { Asset, Bill, Expense, Vendor } from './types';
import { getBills } from './services/bill.service';
import { getExpenses } from './services/expense.service';
import { getVendors } from './services/vendor.service';
import { useEmployeesQuery, useEmployeesInvalidate } from './hooks/useEmployees';
import { useBranchesQuery } from './hooks/useBranches';
import { useMeetingPushQuery, useMeetingPushInvalidate } from './hooks/useMeetingPush';
import { useTasksQuery, usePrefetchTasks } from './hooks/useTasks';
import { requestPermission, handleIncomingNotification } from './services/notification.service';

// Helper function to convert Photo_link to absolute URL with /media/ prefix for Django
const convertPhotoLinkToUrl = (photoLink: string | null | undefined): string => {
  if (!photoLink || typeof photoLink !== 'string' || photoLink.trim() === '') {
    return '';
  }
  
  const trimmedLink = photoLink.trim();
  
  // If it's already an absolute URL (http/https), return as is
  if (trimmedLink.startsWith('http://') || trimmedLink.startsWith('https://')) {
    return trimmedLink;
  }
  
  // If it's a data URI, return as is
  if (trimmedLink.startsWith('data:')) {
    return trimmedLink;
  }
  
  // If it's a fallback avatar URL, return as is
  if (trimmedLink.includes('ui-avatars.com')) {
    return trimmedLink;
  }
  
  // Convert relative URL to absolute with /media/ prefix for Django
  const isDevelopment = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.startsWith('192.168.')
  );
  const apiBaseUrl = isDevelopment ? 'https://employee-management-system-tmrl.onrender.com' : 'https://employee-management-system-tmrl.onrender.com';
  
  // Handle Django media files - if path doesn't start with /media/, add it
  if (!trimmedLink.startsWith('/media/') && !trimmedLink.startsWith('media/')) {
    // If path starts with /, remove it first, then add /media/
    const cleanPath = trimmedLink.startsWith('/') ? trimmedLink.substring(1) : trimmedLink;
    return `${apiBaseUrl}/media/${cleanPath}`;
  } else if (trimmedLink.startsWith('/')) {
    // If it already has /media/, just prepend base URL
    return `${apiBaseUrl}${trimmedLink}`;
  } else {
    // If it starts with media/, prepend base URL with /
    return `${apiBaseUrl}/${trimmedLink}`;
  }
};

const LoginPage: React.FC<{ onLogin: (u: User) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Credentials required');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
        // Try backend API login first (username can be fullName, email, or ID)
        // Try regular login first (/accounts/login/), then admin endpoint (/admin/) as fallback
        let loginResponse: any;
        
        try {
          loginResponse = await apiLogin(username, password, false);
        } catch (regularError: any) {
          const status = regularError?.response?.status;
          // Only try admin endpoint for 401/403; 400 means invalid credentials - don't retry
          if (status === 401 || status === 403) {
            try {
              loginResponse = await apiLogin(username, password, true);
            } catch (adminError: any) {
              throw adminError; // Show admin endpoint error (e.g. "Access forbidden")
            }
          } else {
            throw regularError;
          }
        }
        
        // If API login succeeds, use the response to create/login user
        // Map API response to User type (no mock fallback - build from API only)
        let userProfile: (User & { Employee_id?: string }) | null = null;

        // Helper function to extract role from API response (handles QuerySet, objects, strings)
        const extractRoleFromApiResponse = (apiRole: any): string => {
          // If it's already a string, check if it's a QuerySet string or a simple role string
          if (typeof apiRole === 'string') {
            const trimmed = apiRole.trim();
            // Check if it's a QuerySet string representation (contains QuerySet or has Role pattern)
            if (trimmed.includes('QuerySet') || (trimmed.includes('Role') && (trimmed.includes('[') || trimmed.includes('{')))) {
              // Don't return, continue to QuerySet parsing below
            } else {
              // It's a simple role string like "MD", "ADMIN", etc.
              return trimmed;
            }
          }
          
          // If it's an array, get the first element
          if (Array.isArray(apiRole) && apiRole.length > 0) {
            const firstItem = apiRole[0];
            // If first item is an object with Role property
            if (firstItem && typeof firstItem === 'object' && firstItem.Role) {
              return String(firstItem.Role);
            }
            // If first item is a string
            if (typeof firstItem === 'string') {
              return firstItem;
            }
          }
          
          // If it's an object with Role property
          if (apiRole && typeof apiRole === 'object' && !Array.isArray(apiRole)) {
            if (apiRole.Role) {
              return String(apiRole.Role);
            }
            // Check for role in various possible keys
            if (apiRole.role) {
              return String(apiRole.role);
            }
            if (apiRole.ROLE) {
              return String(apiRole.ROLE);
            }
          }
          
          // If it's a QuerySet-like object (has string representation)
          const apiRoleString = String(apiRole);
          
          // Try multiple patterns to extract role from QuerySet string
          // Pattern 1: <QuerySet [{'Role': 'MD'}]> - single quotes
          let querySetMatch = apiRoleString.match(/\{'Role':\s*'([^']+)'\}/);
          if (querySetMatch && querySetMatch[1]) {
            return querySetMatch[1];
          }
          
          // Pattern 2: <QuerySet [{"Role": "MD"}]> - double quotes
          querySetMatch = apiRoleString.match(/\{"Role":\s*"([^"]+)"\}/);
          if (querySetMatch && querySetMatch[1]) {
            return querySetMatch[1];
          }
          
          // Pattern 3: More flexible - any quotes around Role
          querySetMatch = apiRoleString.match(/Role['":\s]+['"]([^'"]+)['"]/i);
          if (querySetMatch && querySetMatch[1]) {
            return querySetMatch[1];
          }
          
          // Pattern 4: Try to find 'MD' or role value directly in the string
          querySetMatch = apiRoleString.match(/['"]?Role['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
          if (querySetMatch && querySetMatch[1]) {
            return querySetMatch[1];
          }
          
          // Pattern 5: Look for common role values in the string (most reliable fallback)
          // Check for quoted values first (more specific)
          const roleValues = ['MD', 'ADMIN', 'HR', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'];
          for (const role of roleValues) {
            // Look for 'MD' or "MD" in the string (quoted)
            if (apiRoleString.includes(`'${role}'`) || apiRoleString.includes(`"${role}"`)) {
              return role;
            }
            // Also check for unquoted but with context (Role: MD or Role=MD)
            if (apiRoleString.match(new RegExp(`Role[^a-zA-Z]*${role}[^a-zA-Z]`, 'i'))) {
              return role;
            }
          }
          
          // Pattern 6: Last resort - find any role value as a standalone word in the string
          for (const role of roleValues) {
            // Look for the role as a standalone word (not part of another word)
            const roleRegex = new RegExp(`\\b${role}\\b`, 'i');
            if (roleRegex.test(apiRoleString)) {
              return role.toUpperCase(); // Ensure uppercase
            }
          }
          
          return apiRoleString;
        };

        // Helper function to map API role to UserRole enum
        const mapApiRoleToUserRole = (apiRole: any): UserRole => {
          // First extract the role string from various formats
          const extractedRole = extractRoleFromApiResponse(apiRole);
          const roleString = String(extractedRole).trim();
          const normalizedRole = roleString.toUpperCase();
          
          // Normalize team leader variations: "Team lead", "Team Leader", "TEAM LEADER", "TEAM_LEADER", etc.
          const normalizedTeamLeader = normalizedRole.replace(/[_\s]+/g, '_'); // Replace spaces/underscores with single underscore
          
          // Direct match
          if (normalizedRole === 'MD') return UserRole.MD;
          if (normalizedRole === 'ADMIN') return UserRole.ADMIN;
          if (normalizedRole === 'HR') return UserRole.HR;
          if (normalizedTeamLeader === 'TEAM_LEADER' || 
              normalizedTeamLeader === 'TEAMLEADER' ||
              (normalizedRole.includes('TEAM') && normalizedRole.includes('LEAD'))) {
            return UserRole.TEAM_LEADER;
          }
          if (normalizedRole === 'EMPLOYEE') return UserRole.EMPLOYEE;
          if (normalizedRole === 'INTERN') return UserRole.INTERN;
          
          // Check if it's in the enum values
          if (Object.values(UserRole).includes(normalizedRole as UserRole)) {
            return normalizedRole as UserRole;
          }
          
          return UserRole.EMPLOYEE;
        };

        // Helper to extract name from dashboard - supports many backend field name variations
        const extractNameFromDashboard = (dash: any, empId: string, uname: string): string => {
          const first = dash?.['first_name'] || dash?.first_name;
          const last = dash?.['last_name'] || dash?.last_name;
          let name = '';
          if (first || last) {
            name = [first, last].filter(Boolean).join(' ').trim();
          }
          if (!name) {
            const raw = dash?.['Name'] || dash?.['Full Name'] || dash?.name || dash?.['full_name'] || dash?.['Full_name'] || dash?.['fullName'] || dash?.['employee_name'] || dash?.['Employee_Name'];
            name = typeof raw === 'string' ? raw.trim() : '';
          }
          // Don't use Employee_id or username as name when they look like numeric IDs
          const looksLikeId = (s: string) => /^\d+$/.test(String(s).trim());
          if (name && looksLikeId(name) && (name === empId || name === uname)) name = '';
          return name || '';
        };
        
        // Try to fetch full employee details from dashboard endpoint first
        let employeeDashboard: any = null;
        try {
          employeeDashboard = await getEmployeeDashboard();
        } catch (_dashboardError: any) {
          // If dashboard fetch fails, continue with login response data
        }
        
        // If user found in mock data, update it with dashboard data if available
        if (userProfile) {
          // Update with dashboard data if available - using same field names as createEmployee
          if (employeeDashboard) {
            const apiRole = employeeDashboard?.['Role'] || employeeDashboard?.Role || loginResponse?.Role;
            const mappedRole = mapApiRoleToUserRole(apiRole);
            
            // CRITICAL: Preserve Employee_id as string to keep leading zeros
            const dashboardEmployeeId = employeeDashboard?.['Employee_id'] !== undefined && employeeDashboard?.['Employee_id'] !== null
              ? String(employeeDashboard?.['Employee_id'])
              : (employeeDashboard?.['Employee ID'] !== undefined && employeeDashboard?.['Employee ID'] !== null
                  ? String(employeeDashboard?.['Employee ID'])
                  : (employeeDashboard?.id !== undefined && employeeDashboard?.id !== null
                      ? String(employeeDashboard?.id)
                      : userProfile.id));
            
            const dashName = extractNameFromDashboard(employeeDashboard, dashboardEmployeeId, username);
            const fallbackName = userProfile.name && !/^\d+$/.test(String(userProfile.name).trim()) ? userProfile.name : '';
            userProfile = {
              ...userProfile,
              id: dashboardEmployeeId, // Set to Employee_id from dashboard (preserved as string)
              name: dashName || fallbackName || dashboardEmployeeId,
              email: employeeDashboard?.['Email_id'] || employeeDashboard?.['Email Address'] || employeeDashboard?.email || userProfile.email,
              role: mappedRole,
              designation: employeeDashboard?.['Designation'] || employeeDashboard?.designation || userProfile.designation,
              branch: (employeeDashboard?.['Branch'] || employeeDashboard?.branch || userProfile.branch) as any,
              joinDate: employeeDashboard?.['Date_of_join'] || employeeDashboard?.['Joining Date'] || employeeDashboard?.joinDate || userProfile.joinDate,
              birthDate: employeeDashboard?.['Date_of_birth'] || employeeDashboard?.['Date of Birth'] || employeeDashboard?.birthDate || userProfile.birthDate,
              avatar: (() => {
                // Prioritize Photo_link from dashboard API (same field name used in createEmployee)
                const photoLink = employeeDashboard?.['Photo_link'] || employeeDashboard?.['Profile Picture'] || employeeDashboard?.avatar || employeeDashboard?.profilePicture || userProfile.avatar;
                
                if (photoLink) {
                  const convertedUrl = convertPhotoLinkToUrl(photoLink);
                  if (convertedUrl) return convertedUrl;
                }
                return userProfile.avatar;
              })(),
            } as User & { Employee_id?: string };
            
            // Add Employee_id separately to avoid TypeScript error
            (userProfile as any).Employee_id = dashboardEmployeeId;
          } else if (loginResponse?.Role) {
            // Update role from API response if dashboard data not available
            const apiRole = loginResponse.Role;
            const mappedRole = mapApiRoleToUserRole(apiRole);
            userProfile = { ...userProfile, role: mappedRole };
          }
           onLogin(userProfile);
        } else {
          // Create new user from API response (API login was successful)
          
          const apiRole = loginResponse?.Role || employeeDashboard?.['Role'] || employeeDashboard?.Role;
          
          // Only use EMPLOYEE as fallback if Role is completely missing/null/undefined
          // Don't default here - let the extraction function handle QuerySet objects
          const mappedRole = (apiRole !== null && apiRole !== undefined) 
            ? mapApiRoleToUserRole(apiRole) 
            : UserRole.EMPLOYEE;
          
          // Use dashboard data if available - using same field names as createEmployee
          // CRITICAL: Preserve Employee_id as string to keep leading zeros
          const employeeId = employeeDashboard?.['Employee_id'] !== undefined && employeeDashboard?.['Employee_id'] !== null
            ? String(employeeDashboard?.['Employee_id'])
            : (employeeDashboard?.['Employee ID'] !== undefined && employeeDashboard?.['Employee ID'] !== null
                ? String(employeeDashboard?.['Employee ID'])
                : (employeeDashboard?.id !== undefined && employeeDashboard?.id !== null
                    ? String(employeeDashboard?.id)
                    : String(username)));
          
          const fullName = extractNameFromDashboard(employeeDashboard, employeeId, username) || loginResponse?.username || username;
          const email = employeeDashboard?.['Email_id'] || employeeDashboard?.['Email Address'] || employeeDashboard?.email || (username.includes('@') ? username : `${username}@planeteye.com`);
          const designation = employeeDashboard?.['Designation'] || employeeDashboard?.designation || '';
          const branch = employeeDashboard?.['Branch'] || employeeDashboard?.branch || '';
          const joinDate = employeeDashboard?.['Date_of_join'] || employeeDashboard?.['Joining Date'] || employeeDashboard?.joinDate || new Date().toISOString().split('T')[0];
          const birthDate = employeeDashboard?.['Date_of_birth'] || employeeDashboard?.['Date of Birth'] || employeeDashboard?.birthDate || '1995-01-01';
          const avatar = (() => {
            // Prioritize Photo_link from dashboard API (same field name used in createEmployee)
            const photoLink = employeeDashboard?.['Photo_link'] || employeeDashboard?.['Profile Picture'] || employeeDashboard?.avatar || employeeDashboard?.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
            
            // If it's a fallback avatar, return as is
            if (photoLink.includes('ui-avatars.com')) {
              return photoLink;
            }
            
            // If it's a string URL (not a File object)
            if (typeof photoLink === 'string') {
              // If it's already an absolute URL (http/https), return as is
              if (photoLink.startsWith('http://') || photoLink.startsWith('https://')) {
                return photoLink;
              }
              
              // If it's a data URI, return as is
              if (photoLink.startsWith('data:')) {
                return photoLink;
              }
              
              // If it's a relative URL, convert to absolute using API base URL
              const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.');
              const apiBaseUrl = isDevelopment ? 'https://employee-management-system-tmrl.onrender.com' : 'https://employee-management-system-tmrl.onrender.com';
              
              // Handle both /media/... and media/... formats
              if (photoLink.startsWith('/')) {
                return `${apiBaseUrl}${photoLink}`;
              } else {
                return `${apiBaseUrl}/${photoLink}`;
              }
            }
            
            return photoLink;
          })();
          
          // Set designation based on role if not provided
          const getDesignationFromRole = (role: UserRole): string => {
            if (designation) return designation; // Use provided designation
            switch (role) {
              case UserRole.MD: return 'Managing Director';
              case UserRole.ADMIN: return 'Administrator';
              case UserRole.HR: return 'HR';
              case UserRole.TEAM_LEADER: return 'Team Leader';
              case UserRole.EMPLOYEE: return 'Employee';
              case UserRole.INTERN: return 'Intern';
              default: return 'Employee';
            }
          };

          const newUser = {
            id: employeeId, // Set to Employee_id (preserved as string with leading zeros)
            name: fullName,
            email: email,
            role: mappedRole,
            avatar: avatar,
            status: 'PRESENT' as const,
             leaveBalance: 12,
             score: 0,
            designation: getDesignationFromRole(mappedRole),
            joinDate: joinDate,
            birthDate: birthDate,
            branch: branch as any,
          } as User & { Employee_id?: string };
          
          // Add Employee_id separately to avoid TypeScript error
          (newUser as any).Employee_id = employeeId;
          onLogin(newUser);
        }
    } catch (err: any) {
        // No mock fallback - API only; show error
        const user: User | undefined = undefined;
        if (user) {
          onLogin(user);
        } else {
          
          // Check if error is the QuerySet backend error
          const errorMsg = err?.message || '';
          if (errorMsg.includes("'QuerySet' object has no attribute 'Role'") || 
              errorMsg.includes('QuerySet') && errorMsg.includes('Role')) {
            setError('Backend Error: The server has a bug. The backend developer needs to fix the login endpoint. Error: QuerySet object has no attribute Role. Please contact the backend team.');
          } else {
            setError(err?.message || 'Invalid Full Name, Email, ID or Password. Please check your credentials.');
          }
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Animated Background Layers */}
      <div className="absolute inset-0 cyber-grid opacity-30 animate-data-flow"></div>
      <div className="absolute top-[-30%] left-[-15%] w-[80%] h-[80%] bg-brand-500/10 rounded-full blur-[180px]"></div>
      <div className="absolute bottom-[-30%] right-[-15%] w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[180px]"></div>

      <div className="w-full max-w-6xl flex flex-col md:flex-row items-center gap-12 md:gap-24 z-10">
        
        {/* Left Branding Section */}
        <div className={`flex-1 text-center md:text-left space-y-12 transition-all duration-1000 transform ${visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none">
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-600 animate-glow">AI</span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl font-medium tracking-wide"></p>
          </div>

          <div className="space-y-8">
            <div className={`flex items-center space-x-6 group transition-all duration-700 delay-300 transform ${visible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}>
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-[1.25rem] flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:scale-110 transition-all duration-500 shadow-xl shadow-emerald-500/5">
                <Leaf className="text-emerald-400" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white group-hover:text-emerald-300 transition-colors">planeteye AI Farm</h2>
                <p className="text-slate-500 text-sm font-semibold tracking-wider uppercase">Bio-Neural Agriculture Ops</p>
              </div>
            </div>

            <div className={`flex items-center space-x-6 group transition-all duration-700 delay-500 transform ${visible ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'}`}>
              <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/20 rounded-[1.25rem] flex items-center justify-center group-hover:bg-brand-500/20 group-hover:scale-110 transition-all duration-500 shadow-xl shadow-brand-500/5">
                <Building2 className="text-brand-500" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white group-hover:text-brand-300 transition-colors">planeteye AI Infra</h2>
                <p className="text-slate-500 text-sm font-semibold tracking-wider uppercase">Strategic Asset Management</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Login Card */}
        <div className={`flex-1 w-full max-w-md transition-all duration-1000 delay-700 transform ${visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
          <div className="glass-card rounded-[3rem] p-10 md:p-14 shadow-2xl relative overflow-hidden animate-float">
            {/* Glossy overlay effect */}
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="mb-12 text-center space-y-3">
                <div className="inline-flex flex-col items-center">
                   <h3 className="text-3xl font-white tracking-tight text-white">
                     planeteye <span className="text-brand-600">AI</span>
                   </h3>
                   <div className="h-1 w-12 bg-brand-500 rounded-full mt-1"></div>
                </div>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Portal Access</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-7">
                <div className={`space-y-2 transition-all duration-700 opacity-0 transform translate-y-4 ${visible ? 'opacity-100 translate-y-0 stagger-1 animate-slide-up' : ''}`}>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Username</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      required
                      className="w-full bg-slate-100/50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:ring-8 focus:ring-brand-500/5 focus:border-brand-500 focus:outline-none transition-all text-slate-800 font-bold placeholder-slate-400"
                      placeholder="Enter Emp ID"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className={`space-y-2 transition-all duration-700 opacity-0 transform translate-y-4 ${visible ? 'opacity-100 translate-y-0 stagger-2 animate-slide-up' : ''}`}>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-500 transition-colors" size={18} />
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      className="w-full bg-slate-100/50 border-2 border-slate-100 rounded-2xl pl-12 pr-12 py-4 focus:bg-white focus:ring-8 focus:ring-brand-500/5 focus:border-brand-500 focus:outline-none transition-all text-slate-800 font-bold placeholder-slate-400"
                      placeholder="Enter Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500 transition-colors focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-2xl border border-red-100 animate-scale-in">
                    <XCircle size={18} className="shrink-0" />
                    <span className="text-xs font-black uppercase tracking-tight">{error}</span>
                  </div>
                )}

                <div className={`transition-all duration-700 opacity-0 transform translate-y-4 ${visible ? 'opacity-100 translate-y-0 stagger-3 animate-slide-up' : ''}`}>
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className={`w-full relative group overflow-hidden bg-slate-950 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-brand-600 transition-all shadow-2xl shadow-brand-900/20 flex items-center justify-center space-x-3 active:scale-[0.98] ${isLoading ? 'opacity-70' : ''}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Fingerprint size={18} className="text-brand-400 group-hover:text-white transition-colors" />
                        <span>Initialize Session</span>
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Footer System Status */}
      <div className={`fixed bottom-10 flex flex-col items-center space-y-4 transition-all duration-1000 delay-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Node Cluster Active</span>
          </div>
          <div className="h-4 w-px bg-slate-800/50"></div>
          <span className="text-slate-600 text-[10px] font-black uppercase tracking-[0.4em]">Protocols Secure v2.4</span>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Monitor currentUser changes to detect role overwrites
  useEffect(() => {
    // Role monitoring removed - no console logs
  }, [currentUser]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const isMD = currentUser?.role === UserRole.MD;
  const tasksAssignQuery = useTasksQuery('assign', currentUser, isMD && activeTab === 'dashboard');
  const tasksForDashboard = React.useMemo(() => {
    const raw = tasksAssignQuery.data;
    if (!raw || !currentUser) return [];
    return convertApiTasksToTasks(raw, users, currentUser);
  }, [tasksAssignQuery.data, users, currentUser]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null); // For employee detail modal
  const [showFilteredUsersModal, setShowFilteredUsersModal] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [filterType, setFilterType] = useState<'branch' | 'role' | null>(null);
  const [filterValue, setFilterValue] = useState<string>('');
  const [showUserProfileSidebar, setShowUserProfileSidebar] = useState(false);
  const [showMeetCard, setShowMeetCard] = useState(false);
  const [meetingRefreshTrigger, setMeetingRefreshTrigger] = useState(0);
  const [assetsRefreshTrigger, setAssetsRefreshTrigger] = useState(0);
  const [vendorsRefreshTrigger, setVendorsRefreshTrigger] = useState(0);
  const [expensesRefreshTrigger, setExpensesRefreshTrigger] = useState(0);
  const assetsLastFetchedRef = useRef<number>(-1);
  const vendorsLastFetchedRef = useRef<number>(-1);
  const expensesLastFetchedRef = useRef<number>(-1);
  const [scheduleHolidays, setScheduleHolidays] = useState<Holiday[]>([]);
  const [scheduleTours, setScheduleTours] = useState<ScheduleTour[]>([]);
  const [scheduleMeetings, setScheduleMeetings] = useState<Meeting[]>([]);
  const [scheduleRefreshTrigger, setScheduleRefreshTrigger] = useState(0);
  const scheduleLastFetchedRef = useRef<number>(-1);
  const scheduleMeetingsCacheRef = useRef<Record<string, Meeting[]>>({});
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;
  const [notificationMeetings, setNotificationMeetings] = useState<any[]>([]);
  const [toastNotification, setToastNotification] = useState<{ title: string; message: string } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allowedNMRHICategories, setAllowedNMRHICategories] = useState<string[]>([]);
  const [meetRooms, setMeetRooms] = useState<Array<{ id: number; name: string }>>([]);
  const [meetEmployees, setMeetEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<string[]>([]);

  
  // Keep sidebar state in sync with viewport: closed on mobile, open on desktop
  useEffect(() => {
    const onResize = () => {
      setIsSidebarOpen((prev) => {
        const isDesktop = window.innerWidth >= 768;
        return isDesktop ? true : false;
      });
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // WebSocket notifications - connect after login
  useEffect(() => {
    if (!currentUser) return;

    // Request notification permission (triggered by login; required for desktop notifications)
    requestPermission().then((perm) => {
      if (perm === 'denied') {
        console.info('[Notifications] Permission denied – desktop notifications disabled');
      }
    });

    let closed = false;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    const getDelay = () => Math.min(3000 * 2 ** retryCount, 30000); // 3s, 6s, 12s, 24s, 30s
    let currentWs: WebSocket | null = null;
    let hasLoggedGiveUp = false;

    const connect = () => {
      const isDev = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.')
      );
      const productionUrl = 'https://employee-management-system-tmrl.onrender.com';
      const wsUrl = isDev
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/notifications/`
        : `${productionUrl.replace(/^https/, 'wss')}/ws/notifications/`;
      const ws = new WebSocket(wsUrl);
      currentWs = ws;
      ws.onopen = () => {
        retryCount = 0;
        hasLoggedGiveUp = false;
        console.log('WebSocket connected (session auth)');
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;
          if (data.type === 'notification' || data.type === 'send_notification') {
            const payload = {
              type: data.type,
              title: data.title ?? data.data?.title ?? 'Notification',
              message: data.message ?? data.data?.message ?? '',
              extra: data.extra ?? data.data?.extra,
            };
            handleIncomingNotification(payload);
            setToastNotification({ title: payload.title, message: payload.message });
          }
          console.log('[WebSocket] Message:', data);
        } catch {
          console.log('[WebSocket] Message:', event.data);
        }
      };
      ws.onerror = () => {
        if (!closed && retryCount >= maxRetries && !hasLoggedGiveUp) {
          hasLoggedGiveUp = true;
          console.warn('WebSocket unavailable – notifications disabled. Ensure backend is running and reachable.');
        }
      };
      ws.onclose = (event) => {
        if (ws === currentWs && pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (closed) return;
        if (event.code === 4001) {
          console.log('Not authenticated – please log in');
          return;
        }
        if (event.code === 1006 && retryCount < maxRetries) {
          retryCount++;
          reconnectTimeout = setTimeout(connect, getDelay());
        } else if (!hasLoggedGiveUp) {
          hasLoggedGiveUp = true;
          console.warn('WebSocket unavailable – notifications disabled. Ensure backend is running and reachable.');
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pingInterval) clearInterval(pingInterval);
      if (currentWs) currentWs.close();
    };
  }, [currentUser]);

  // Auto-dismiss toast notification
  useEffect(() => {
    if (!toastNotification) return;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastNotification(null);
      toastTimeoutRef.current = null;
    }, 5000);
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [toastNotification]);

  // Restore authenticated session & last active tab on page refresh
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedUser = window.localStorage.getItem('current_user');
      const storedTab = window.localStorage.getItem('active_tab');

      // Restore if we have a previously saved user
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        setCurrentUser(parsedUser);

        const hrAllowedTabs = ['dashboard', 'schedule-hub', 'assignTask', 'reportingTask', 'messages'];
        if (storedTab && storedTab !== 'team') {
          if (parsedUser.role === UserRole.HR && !hrAllowedTabs.includes(storedTab)) {
            setActiveTab('dashboard');
          } else {
            setActiveTab(storedTab);
          }
        } else {
          // Fallback: decide default tab by role if no tab stored
          if (parsedUser.role === UserRole.ADMIN) {
            setActiveTab('admin');
          } else if (parsedUser.role === UserRole.HR) {
            setActiveTab('dashboard');
          } else if (parsedUser.role === UserRole.MD) {
            setActiveTab('dashboard');
          } else {
            setActiveTab('assignTask');
          }
        }
      } else {
        // No valid session – clear any stale stored data
        window.localStorage.removeItem('current_user');
        window.localStorage.removeItem('active_tab');
        clearAuthData();
      }
    } catch (e) {
      // If anything goes wrong parsing, clear and start fresh
      window.localStorage.removeItem('current_user');
      window.localStorage.removeItem('active_tab');
      clearAuthData();
    }
  }, []);

  // Helper function to normalize branch names for comparison
  const normalizeBranchName = (branch: string): string => {
    return branch.toUpperCase().replace(/\s+/g, '_');
  };

  // Helper function to format branch name for display
  const formatBranchName = (branch: string): string => {
    // If branch is already formatted (e.g., "Farm Core"), return as is
    if (branch.includes(' ')) return branch;
    // Otherwise, convert "FARM_CORE" to "Farm Core"
    return branch.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Fetch user profile picture from dashboard API when user logs in
  useEffect(() => {
    const fetchUserAvatar = async () => {
      if (currentUser && currentUser.id) {
        try {
          const employeeDashboard = await getEmployeeDashboard();
          const photoLink = employeeDashboard?.['Photo_link'] || employeeDashboard?.['Profile Picture'];
          
          if (photoLink && typeof photoLink === 'string' && photoLink.trim() !== '') {
            let avatarUrl = photoLink.trim();
            
            // Convert relative URL to absolute using helper function
            const convertedUrl = convertPhotoLinkToUrl(avatarUrl);
            if (convertedUrl) avatarUrl = convertedUrl;
            
            if (currentUser.avatar !== avatarUrl) {
              setCurrentUser({
                ...currentUser,
                avatar: avatarUrl
              });
            }
          }
        } catch (err: any) {
          console.error('❌ [AVATAR] Error fetching user avatar from dashboard:', err);
          console.error('❌ [AVATAR] Error details:', err.message, err.response?.data);
          // Don't update avatar if API fails - keep existing one
        }
      }
    };
    
    // Always try to fetch avatar from dashboard API to get latest Photo_link
    if (currentUser && currentUser.id) {
      fetchUserAvatar();
    }
  }, [currentUser?.id]); // Only run when user ID changes (after login)

  // Load meeting rooms for Meet card after login (employees come from shared users)
  useEffect(() => {
    if (!currentUser?.id) return;
    getRooms()
      .then((roomsList) => setMeetRooms(roomsList || []))
      .catch(() => setMeetRooms([]));
  }, [currentUser?.id]);

  // Meeting push - single source via React Query (no duplicate fetch from Layout)
  const { data: meetingPushData } = useMeetingPushQuery(!!currentUser?.id);
  const invalidateMeetingPush = useMeetingPushInvalidate();
  useEffect(() => {
    if (meetingPushData) setNotificationMeetings(Array.isArray(meetingPushData) ? meetingPushData : []);
  }, [meetingPushData]);
  useEffect(() => {
    if (meetingRefreshTrigger > 0 && currentUser?.id) invalidateMeetingPush();
  }, [meetingRefreshTrigger, currentUser?.id, invalidateMeetingPush]);

  // Branches - cached via React Query, only when dashboard active
  const { data: branchesData, isLoading: isLoadingBranches } = useBranchesQuery(
    activeTab === 'dashboard' && !!currentUser
  );
  useEffect(() => {
    if (branchesData) setBranches(Array.isArray(branchesData) ? branchesData : []);
    else if (!isLoadingBranches && activeTab !== 'dashboard') setBranches([]);
  }, [branchesData, isLoadingBranches, activeTab]);

  // Fetch bills when Admin or MD opens Admin Dashboard
  useEffect(() => {
    const fetchBills = async () => {
      if ((currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.MD) || activeTab !== 'admin-dashboard') return;
      try {
        const billsData = await getBills();
        setBills(Array.isArray(billsData) ? billsData : []);
      } catch (err: any) {
        console.error('Error fetching bills:', err);
      }
    };
    fetchBills();
  }, [activeTab, currentUser?.role]);

  // Fetch vendors in memory - only reload when updated (create/edit/delete in VendorManager)
  useEffect(() => {
    const shouldFetch = (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MD) &&
      (activeTab === 'admin-dashboard' || activeTab === 'admin-vendors') &&
      vendorsLastFetchedRef.current !== vendorsRefreshTrigger;
    if (!shouldFetch) return;
    const fetchVendors = async () => {
      try {
        const list = await getVendors();
        setVendors(Array.isArray(list) ? list : []);
        vendorsLastFetchedRef.current = vendorsRefreshTrigger;
      } catch (err: any) {
        console.error('Error fetching vendors:', err);
      }
    };
    fetchVendors();
  }, [activeTab, currentUser?.role, vendorsRefreshTrigger]);

  // Fetch expenses in memory - only reload when updated (create/edit/delete in ExpenseManager)
  useEffect(() => {
    const shouldFetch = (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MD) &&
      (activeTab === 'admin-dashboard' || activeTab === 'admin-expenses') &&
      expensesLastFetchedRef.current !== expensesRefreshTrigger;
    if (!shouldFetch) return;
    const fetchExpenses = async () => {
      try {
        const list = await getExpenses();
        setExpenses(Array.isArray(list) ? list : []);
        expensesLastFetchedRef.current = expensesRefreshTrigger;
      } catch (err: any) {
        console.error('Error fetching expenses:', err);
      }
    };
    fetchExpenses();
  }, [activeTab, currentUser?.role, expensesRefreshTrigger]);

  // Fetch assets once in memory - only reload when updated (create/edit/delete in AssetManager)
  useEffect(() => {
    const shouldFetch = (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MD) &&
      (activeTab === 'admin-dashboard' || activeTab === 'admin-assets') &&
      assetsLastFetchedRef.current !== assetsRefreshTrigger;
    if (!shouldFetch) return;
    const fetchAssets = async () => {
      try {
        const res = await api.get('/adminapi/assets/');
        const list = Array.isArray(res.data) ? res.data : [];
        const mapped: Asset[] = list.map((item: any) => ({
          id: String(item.id),
          type: item.asset_type,
          name: item.asset_name,
          author: item.author,
          code: item.asset_code ?? '',
          status: item.status === 'COMPLETED' ? 'Completed' : item.status === 'INPROCESS' ? 'Inprocess' : 'Pending',
          createdAt: item.created_at ?? new Date().toISOString().split('T')[0],
        }));
        setAssets(mapped);
        assetsLastFetchedRef.current = assetsRefreshTrigger;
      } catch (err: any) {
        console.error('Error fetching assets:', err);
      }
    };
    fetchAssets();
  }, [activeTab, currentUser?.role, assetsRefreshTrigger]);

  // Schedule Hub: fetch holidays, events, tours in parallel - cache, refetch only on update
  useEffect(() => {
    const shouldFetch =
      currentUser &&
      activeTab === 'schedule-hub' &&
      scheduleLastFetchedRef.current !== scheduleRefreshTrigger;
    if (!shouldFetch) return;
    const fetchScheduleData = async () => {
      try {
        const [holidayList, eventList, tourList] = await Promise.all([
          getHolidays(),
          getEvents(),
          getTours(),
        ]);
        const holidays: Holiday[] = (holidayList || []).map((h: any) => {
          const rawDate = h.date?.includes?.('T') ? h.date.split('T')[0] : (h.date || '').substring(0, 10);
          return { id: String(h.id), name: h.name, date: rawDate, type: 'holiday' as const };
        });
        const events: Holiday[] = (eventList || []).map((e: any) => {
          const rawDate = e.date?.includes?.('T') ? e.date.split('T')[0] : (e.date || '').substring(0, 10);
          return {
            id: String(e.id),
            name: e.title,
            date: rawDate,
            type: 'event' as const,
            motive: e.motive,
            time: e.time,
          };
        });
        setScheduleHolidays([...holidays, ...events]);
        const mappedTours: ScheduleTour[] = (tourList || []).map((item: any) => {
          const memberDetails = item.member_details || [];
          const attendees = (item.members || []).map((m: any) => String(m));
          const attendeeNames: Record<string, string> = {};
          memberDetails.forEach((m: any) => {
            const id = String(m.username ?? m.id ?? m.Employee_id ?? '');
            const fullName = m.full_name ?? m['full_name'] ?? m['Full Name'] ?? m.name ?? m.Name ?? 'Unknown';
            if (id) attendeeNames[id] = fullName;
          });
          const rawStart = item.starting_date;
          const fallbackDate = item.created_at?.split?.('T')[0] || format(new Date(), 'yyyy-MM-dd');
          const startDate = rawStart
            ? (rawStart.includes?.('T') ? rawStart.split('T')[0] : rawStart).substring(0, 10)
            : fallbackDate.substring(0, 10);
          const duration = item.duration_days ?? 1;
          const endDate = format(
            addDays(new Date(startDate), Math.max(0, duration - 1)),
            'yyyy-MM-dd'
          );
          return {
            id: String(item.id),
            name: item.tour_name || 'Tour',
            location: item.location || '',
            description: item.description ?? undefined,
            startDate,
            endDate,
            attendees,
            attendeeNames,
          };
        });
        setScheduleTours(mappedTours);
        scheduleLastFetchedRef.current = scheduleRefreshTrigger;
      } catch (err) {
        console.error('Error fetching schedule data:', err);
      }
    };
    fetchScheduleData();
  }, [activeTab, currentUser?.id, scheduleRefreshTrigger]);

  const mapApiToMeeting = useCallback((item: any): Meeting => {
    let memberDetails = item.member_details;
    if (!Array.isArray(memberDetails)) {
      memberDetails = memberDetails?.results ?? memberDetails?.data ?? memberDetails?.members ?? [];
    }
    if (!Array.isArray(memberDetails)) memberDetails = [];
    const rawMembers = Array.isArray(item.members) ? item.members : [];
    const attendeeNames: Record<string, string> = {};
    const attendees: string[] = [];
    memberDetails.forEach((m: any, idx: number) => {
      const name = m.full_name ?? m['full_name'] ?? m['Full Name'] ?? m.name ?? m.Name ?? 'Unknown';
      const id = m.username ?? m.id ?? m.Employee_id ?? m.employee_id;
      const key = id ? String(id) : (name || `_idx_${idx}`);
      attendees.push(key);
      attendeeNames[key] = name;
      if (id) attendeeNames[String(id)] = name;
    });
    let finalAttendees = attendees.length > 0
      ? attendees
      : rawMembers.map((m: any) => String(m));
    finalAttendees = finalAttendees.filter((a) => a != null && String(a).trim() !== '');
    if (finalAttendees.length > 0 && Object.keys(attendeeNames).length === 0 && memberDetails.length > 0) {
      memberDetails.forEach((m: any, idx: number) => {
        const name = m.full_name ?? m['full_name'] ?? m.name ?? m.Name ?? 'Unknown';
        const aid = finalAttendees[idx];
        if (aid) attendeeNames[aid] = name;
      });
    }
    const statusStr = (item.status || '').toLowerCase();
    const status =
      statusStr === 'done' ? MeetingStatus.DONE :
      statusStr === 'cancelled' ? MeetingStatus.CANCELLED :
      statusStr === 'exceeded' ? MeetingStatus.EXCEEDED :
      MeetingStatus.PENDING;
    const startTime = item.start_time ? String(item.start_time).substring(0, 5) : '09:00';
    const endTime = item.end_time ? String(item.end_time).substring(0, 5) : '10:00';
    const rawDate = item.date || '';
    const date = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.substring(0, 10);
    return {
      id: String(item.id),
      title: item.meeting_title || 'No title',
      description: item.description ?? undefined,
      hallName: item.room || 'N/A',
      startTime,
      endTime,
      date,
      type: item.meeting_type === 'group' ? MeetingType.GROUP : MeetingType.INDIVIDUAL,
      attendees: finalAttendees,
      status,
      attendeeNames,
      createdByName: item.creater_details?.full_name,
    };
  }, []);

  const fetchMeetingsForMonth = useCallback(async (month: number, year: number) => {
    const cacheKey = `${year}-${String(month).padStart(2, '0')}`;
    const cached = scheduleMeetingsCacheRef.current[cacheKey];
    if (cached) {
      setScheduleMeetings(cached);
      return;
    }
    try {
      const list = await getBookSlots(month, year);
      if (!Array.isArray(list)) return;
      const mapped: Meeting[] = list.map(mapApiToMeeting);
      const monthStr = String(month).padStart(2, '0');
      const filtered = mapped.filter((m) => {
        const mDate = m.date || '';
        const mMonth = mDate.length >= 7 ? mDate.substring(5, 7) : '';
        const mYear = mDate.length >= 4 ? mDate.substring(0, 4) : '';
        return mYear === String(year) && mMonth === monthStr;
      });
      scheduleMeetingsCacheRef.current[cacheKey] = filtered;
      setScheduleMeetings(filtered);
    } catch {
      // Keep existing on error
    }
  }, [mapApiToMeeting]);

  const onScheduleDataUpdated = useCallback(() => {
    setScheduleRefreshTrigger((t) => t + 1);
  }, []);

  // Fetch employees via React Query - cached, single call, no Strict Mode duplicates
  const { data: employeesData } = useEmployeesQuery(!!currentUser?.id);
  const invalidateEmployees = useEmployeesInvalidate();

  useEffect(() => {
    if (!employeesData || !currentUser?.id) return;
    const cu = currentUserRef.current;
    if (!cu) return;
    const finalUsers = employeesData.map(u =>
      (u.id === cu.id || u.email === cu.email || (u.name && cu.name && u.name.toLowerCase() === cu.name.toLowerCase()))
        ? { ...u, role: cu.role }
        : u
    );
    const match = finalUsers.find(u =>
      u.id === cu.id ||
      (u.Employee_id && cu.Employee_id && String(u.Employee_id) === String(cu.Employee_id)) ||
      u.email === cu.email ||
      (cu.name && u.name && u.name.toLowerCase() === cu.name.toLowerCase())
    );
    if (match) {
      const needsNameEnrichment = !cu.name || /^\d+$/.test(String(cu.name).trim()) || String(cu.name).trim() === String(cu.Employee_id || cu.id).trim();
      const hasValidName = match.name && match.name.trim() && match.name !== 'Unknown' && !/^\d+$/.test(String(match.name).trim());
      setCurrentUser(prev => {
        if (!prev) return prev;
        const updates: Partial<User> = {};
        if (match.numberOfDaysFromJoining != null) updates.numberOfDaysFromJoining = match.numberOfDaysFromJoining;
        if (needsNameEnrichment && hasValidName) updates.name = match.name;
        return Object.keys(updates).length ? { ...prev, ...updates } : prev;
      });
    }
    setUsers(finalUsers);
  }, [employeesData, currentUser?.id, currentUser?.role]);

  // NMRHI allowed categories: MD sees all; Employees see only pages matching their function (from users list)
  useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.role === UserRole.MD) {
      setAllowedNMRHICategories(['nmrhi-npd', 'nmrhi-mmr', 'nmrhi-rg', 'nmrhi-hc', 'nmrhi-ip']);
      return;
    }
    if (currentUser.role === UserRole.HR) {
      setAllowedNMRHICategories([]);
      return;
    }
    const emp = users.find((u: any) =>
      u.id === currentUser.id ||
      (u.Employee_id && currentUser.Employee_id && String(u.Employee_id) === String(currentUser.Employee_id)) ||
      (u.email && currentUser.email && u.email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (u.name && currentUser.name && u.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
    );
    if (emp) {
      setAllowedNMRHICategories(getNMRHIAllowedCategories(emp));
    } else {
      setAllowedNMRHICategories([]);
    }
  }, [currentUser?.id, currentUser?.email, currentUser?.name, currentUser?.role, users]);

  // Derive meetEmployees from shared users - use Employee_id for API (not name)
  useEffect(() => {
    if (users.length > 0) {
      setMeetEmployees(users.map((u) => ({
        id: String(u.Employee_id ?? u.id),
        name: u.name,
      })));
    }
  }, [users]);

  const handleAddUser = useCallback((newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
    invalidateEmployees(); // Refetch to sync with server
  }, [invalidateEmployees]);

  const handleDeleteUser = useCallback((userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    invalidateEmployees(); // Refetch to sync with server
  }, [invalidateEmployees]);

  // Prefetch tasks on hover - uses React Query cache, TaskBoard will use same cache
  const prefetchTasksFn = usePrefetchTasks();
  const prefetchTasks = useCallback(() => {
    if (!currentUser?.id || activeTab === 'assignTask' || activeTab === 'reportingTask') return;
    const isMD = currentUser.role === UserRole.MD;
    prefetchTasksFn('assign', isMD);
    prefetchTasksFn('reporting', isMD);
  }, [currentUser?.id, currentUser?.role, activeTab, prefetchTasksFn]);

  const handleAddTour = (newTour: Tour) => {
     setTours([...tours, newTour]);
  };

  const handleLogin = (user: User) => {
    // CRITICAL: Fix role if it's in string format but not enum
    // Convert to string first to handle both enum and string types
    const roleString = String(user.role);
    const roleUpper = roleString.toUpperCase().trim();
    
    // Normalize team leader variations: "Team lead", "Team Leader", "TEAM LEADER", "TEAM_LEADER", etc.
    const normalizedTeamLeader = roleUpper.replace(/[_\s]+/g, '_'); // Replace spaces/underscores with single underscore
    
    let fixedRole = user.role;
    
    if (roleUpper === 'MD') {
      fixedRole = UserRole.MD;
    } else if (roleUpper === 'ADMIN') {
      fixedRole = UserRole.ADMIN;
    } else if (roleUpper === 'HR') {
      fixedRole = UserRole.HR;
    } else if (normalizedTeamLeader === 'TEAM_LEADER' || 
               normalizedTeamLeader === 'TEAMLEADER' ||
               (roleUpper.includes('TEAM') && roleUpper.includes('LEAD'))) {
      fixedRole = UserRole.TEAM_LEADER;
    } else if (roleUpper === 'EMPLOYEE') {
      fixedRole = UserRole.EMPLOYEE;
    } else if (roleUpper === 'INTERN') {
      fixedRole = UserRole.INTERN;
    }
    
    // CRITICAL: Ensure role is properly set before setting currentUser
    const finalUser: User = {
      ...user,
      role: fixedRole || UserRole.EMPLOYEE, // Use fixed role or fallback
    };
    
    setCurrentUser(finalUser);

    // Decide starting tab based on role and persist it
    let nextTab = 'assignTask';
    if (finalUser.role === UserRole.ADMIN) {
      nextTab = 'admin';
    } else if (finalUser.role === UserRole.HR) {
      nextTab = 'dashboard';
    } else if (finalUser.role === UserRole.MD) {
      nextTab = 'dashboard';
    }

    setActiveTab(nextTab);

    // Persist logged-in user and active tab to survive page refresh
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('current_user', JSON.stringify(finalUser));
      window.localStorage.setItem('active_tab', nextTab);
    }
  };

  const isLoggingOutRef = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    try {
      await apiLogout();
    } catch {
      // Already logged out or network error - still clear local state
    } finally {
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('current_user');
        window.localStorage.removeItem('active_tab');
      }
      clearAuthData();
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
    }
  }, []);

  // Redirect away from Team page (removed for all roles)
  useEffect(() => {
    if (activeTab === 'team') {
      setActiveTab('dashboard');
      if (typeof window !== 'undefined') window.localStorage.setItem('active_tab', 'dashboard');
    }
  }, [activeTab]);

  // HR can only access dashboard, schedule-hub, tasks, messages – redirect if on invalid tab
  useEffect(() => {
    if (!currentUser || currentUser.role !== UserRole.HR) return;
    const hrAllowedTabs = ['dashboard', 'schedule-hub', 'assignTask', 'reportingTask', 'messages'];
    if (!hrAllowedTabs.includes(activeTab)) {
      setActiveTab('dashboard');
      if (typeof window !== 'undefined') window.localStorage.setItem('active_tab', 'dashboard');
    }
  }, [currentUser, activeTab]);

  // Whenever active tab changes while logged in, keep it in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!currentUser) return;
    if (activeTab === 'team') return; // skip persisting removed Team tab
    window.localStorage.setItem('active_tab', activeTab);
  }, [activeTab, currentUser]);
  
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderDashboard = () => {
    // MD gets the executive dashboard
    if (currentUser.role === UserRole.MD) {
      return (
        <MDDashboardPage 
          userName={currentUser.name}
          userAvatar={currentUser.avatar}
          employees={users}
        />
      );
    }
    
    // Dashboard - Under Maintenance for other roles (Admin, Employee, etc.)
    return (
      <div className="p-10 text-center text-gray-500">
        <p className="text-xl font-semibold mb-2">Dashboard is currently under maintenance.</p>
        <p className="text-sm">Please check back later.</p>
      </div>
    );
  };
  
  // All dashboard code below is commented out - Dashboard under maintenance for all roles
  /*
  const renderDashboard_OLD = () => {
    // Check if Admin role - show Admin dashboard with 3 cards
    if (currentUser.role === UserRole.ADMIN) {
      const adminPresentCount = users.filter(u => u.status === 'PRESENT').length;
      const adminAbsentCount = users.filter(u => u.status === 'ABSENT' || u.status === 'ON_LEAVE').length;
      
      // Calculate branch counts dynamically from fetched branches (for Admin dashboard)
      const adminDashboardBranchData = branches.map(branch => {
        const normalizedBranch = normalizeBranchName(branch);
        const count = users.filter(u => {
          const userBranch = u.branch ? normalizeBranchName(String(u.branch)) : '';
          return userBranch === normalizedBranch;
        }).length;
        
        // Color mapping for branches
        const colorMap: Record<string, string> = {
          'TECH': '#3b82f6',
          'FARM_CORE': '#16a34a',
          'FARM_TECH': '#4ade80',
          'INFRA_CORE': '#ea580c',
          'INFRA_TECH': '#fca5a5',
        };
        
        return {
          name: formatBranchName(branch),
          value: count,
          color: colorMap[normalizedBranch] || '#6b7280',
          originalName: branch,
        };
      });
      
      const adminEmployeeCount = users.filter(u => u.role === UserRole.EMPLOYEE).length;
      const adminInternCount = users.filter(u => u.role === UserRole.INTERN).length;
      const adminTlCount = users.filter(u => u.role === UserRole.TEAM_LEADER).length;

      return (
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Today's Attendance</h3>
              <div className="flex justify-between items-center px-4 mb-4">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-2xl font-bold mx-auto mb-2">
                    {adminPresentCount}
                  </div>
                  <p className="text-sm font-semibold text-gray-600">Present</p>
                </div>
                <div className="h-12 w-px bg-gray-200"></div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-bold mx-auto mb-2">
                    {adminAbsentCount}
                  </div>
                  <p className="text-sm font-semibold text-gray-600">Absent</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-2">
                <div className="bg-green-500 h-full" style={{ width: `${(adminPresentCount / users.length) * 100}%` }}></div>
              </div>
            </div>

            <DistributionChart 
              title="Workforce by Branch" 
              data={adminDashboardBranchData}
              onBarClick={(branchName) => {
                const branchInfo = adminDashboardBranchData.find(b => b.name === branchName);
                const originalBranchName = branchInfo?.originalName || branchName;
                const normalizedBranchName = normalizeBranchName(originalBranchName);
                const filtered = users.filter((u) => {
                  const empBranch = u.branch || '';
                  const normalizedEmpBranch = normalizeBranchName(empBranch);
                  return normalizedEmpBranch === normalizedBranchName || empBranch === originalBranchName || empBranch === branchName || normalizedEmpBranch === normalizeBranchName(branchName);
                });
                setFilteredUsers(filtered);
                setFilterType('branch');
                setFilterValue(branchName);
                setShowFilteredUsersModal(true);
              }}
            />

            <DistributionChart 
              title="Workforce by Role" 
              data={[
                { name: 'Leader', value: adminTlCount, color: '#8b5cf6' },
                { name: 'Employee', value: adminEmployeeCount, color: '#06b6d4' },
                { name: 'Intern', value: adminInternCount, color: '#ec4899' }
              ]}
              onBarClick={(roleName) => {
                const roleMap: Record<string, UserRole> = { 'Leader': UserRole.TEAM_LEADER, 'Employee': UserRole.EMPLOYEE, 'Intern': UserRole.INTERN };
                const targetRole = roleMap[roleName];
                const filtered = users.filter((u) => u.role === targetRole);
                setFilteredUsers(filtered);
                setFilterType('role');
                setFilterValue(roleName);
                setShowFilteredUsersModal(true);
              }}
            />
          </div>
        </div>
      );
    }

    // Force check - if role is string "MD", convert to enum
    let userRole = currentUser.role;
    if (userRole === 'MD' || userRole === 'md' || String(userRole).toUpperCase() === 'MD') {
      userRole = UserRole.MD;
    }
    
    const isMD = userRole === UserRole.MD;
    const isAdmin = userRole === UserRole.ADMIN;
    
    // Calculate project counts - no mock data, using empty array or API data
    const activeProjects = Array.isArray(projects) ? projects.filter(p => p && p.status === 'ACTIVE').length : 0;
    const pendingProjects = Array.isArray(projects) ? projects.filter(p => p && p.status === 'PLANNING').length : 0;
    const completedProjects = Array.isArray(projects) ? projects.filter(p => p && p.status === 'COMPLETED').length : 0;
    
    const presentCount = users.filter(u => u.status === 'PRESENT').length;
    const absentCount = users.filter(u => u.status === 'ABSENT' || u.status === 'ON_LEAVE').length;

    // Calculate branch counts dynamically from fetched branches (only from API)
    const branchData = branches.map(branch => {
      const normalizedBranch = normalizeBranchName(branch);
      const count = users.filter(u => {
        const userBranch = u.branch ? normalizeBranchName(String(u.branch)) : '';
        return userBranch === normalizedBranch;
      }).length;
      
      // Color mapping for branches
      const colorMap: Record<string, string> = {
        'TECH': '#3b82f6',
        'FARM_CORE': '#16a34a',
        'FARM_TECH': '#4ade80',
        'INFRA_CORE': '#ea580c',
        'INFRA_TECH': '#fca5a5',
      };
      
      return {
        name: formatBranchName(branch),
        value: count,
        color: colorMap[normalizedBranch] || '#6b7280',
        originalName: branch, // Store original for filtering
      };
    });

    const employeeCount = users.filter(u => u.role === UserRole.EMPLOYEE).length;
    const internCount = users.filter(u => u.role === UserRole.INTERN).length;
    const tlCount = users.filter(u => u.role === UserRole.TEAM_LEADER).length;

    // CRITICAL: Multiple checks to ensure MD role is detected
    // Check if role is MD in any format (enum, string, case-insensitive)
    const checkIsMD = isMD || 
                      currentUser.role === 'MD' || 
                      currentUser.role === 'md' ||
                      String(currentUser.role).toUpperCase().trim() === 'MD' ||
                      currentUser.role === UserRole.MD;
    
    if (checkIsMD) {
       const usersWithCalculatedScores = users.map(user => {
           const completedTasks = tasksForDashboard.filter(t => 
             (t.assigneeId === user.id || t.assigneeIds?.includes(user.id)) && 
             t.status === 'COMPLETED'
           );
           
           let calculatedScore = 0;
           completedTasks.forEach(t => {
               if (t.type === 'SOS') calculatedScore += 50;
               else if (t.type === '1_DAY') calculatedScore += 30;
               else calculatedScore += 10;
           });
           return { ...user, score: calculatedScore };
       });

       return (
         <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Executive Overview</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               <StatCard 
                 title="Current Projects" 
                 value={Number(activeProjects) || 0} 
                 color="border-l-blue-500" 
                 icon={Activity} 
               />
               <StatCard 
                 title="Pending Projects" 
                 value={Number(pendingProjects) || 0} 
                 color="border-l-yellow-500" 
                 icon={Clock} 
               />
               <StatCard 
                 title="Completed Projects" 
                 value={Number(completedProjects) || 0} 
                 color="border-l-green-500" 
                 icon={CheckCircle2} 
               />
               <StatCard 
                 title="Total Workforce" 
                 value={users.length} 
                 color="border-l-purple-600" 
                 icon={Users} 
               />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
                  <h3 className="text-lg font-bold text-gray-800 mb-6">Today's Attendance</h3>
                  <div className="flex justify-between items-center px-4 mb-4">
                     <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-2xl font-bold mx-auto mb-2">
                           {presentCount}
                        </div>
                        <p className="text-sm font-semibold text-gray-600">Present</p>
                     </div>
                     <div className="h-12 w-px bg-gray-200"></div>
                     <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-bold mx-auto mb-2">
                           {absentCount}
                        </div>
                        <p className="text-sm font-semibold text-gray-600">Absent</p>
                     </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mt-2">
                      <div className="bg-green-500 h-full" style={{ width: `${(presentCount / users.length) * 100}%` }}></div>
                  </div>
               </div>

               <DistributionChart 
                 title="Workforce by Branch" 
                 data={branchData}
                 onBarClick={(branchName) => {
                   const branchInfo = branchData.find(b => b.name === branchName);
                   const originalBranchName = branchInfo?.originalName || branchName;
                   const normalizedBranchName = normalizeBranchName(originalBranchName);
                   const filtered = users.filter((u) => {
                     const empBranch = u.branch || '';
                     const normalizedEmpBranch = normalizeBranchName(empBranch);
                     return normalizedEmpBranch === normalizedBranchName || empBranch === originalBranchName || empBranch === branchName || normalizedEmpBranch === normalizeBranchName(branchName);
                   });
                   setFilteredUsers(filtered);
                   setFilterType('branch');
                   setFilterValue(branchName);
                   setShowFilteredUsersModal(true);
                 }}
               />

               <DistributionChart 
                 title="Workforce by Role" 
                 data={[
                    { name: 'Leader', value: tlCount, color: '#8b5cf6' },
                    { name: 'Employee', value: employeeCount, color: '#06b6d4' },
                    { name: 'Intern', value: internCount, color: '#ec4899' }
                 ]}
                 onBarClick={(roleName) => {
                   const roleMap: Record<string, UserRole> = { 'Leader': UserRole.TEAM_LEADER, 'Employee': UserRole.EMPLOYEE, 'Intern': UserRole.INTERN };
                   const targetRole = roleMap[roleName];
                   const filtered = users.filter((u) => u.role === targetRole);
                   setFilteredUsers(filtered);
                   setFilterType('role');
                   setFilterValue(roleName);
                   setShowFilteredUsersModal(true);
                 }}
               />
            </div>
         </div>
       );
    }
    
    // Employee Dashboard - Under Maintenance
    return (
      <div className="p-10 text-center text-gray-500">
        <p className="text-xl font-semibold mb-2">Dashboard is currently under maintenance.</p>
        <p className="text-sm">Please check back later.</p>
      </div>
    );
  };
  */

  const renderContent = () => {
    const effectiveTab = activeTab === 'team' ? 'dashboard' : activeTab;
    switch (effectiveTab) {
      case 'dashboard':
        return renderDashboard();

      case 'admin-dashboard':
        if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.MD) return <div>Access Denied</div>;
        return <AdminDashboard assets={assets} bills={bills} expenses={expenses} vendors={vendors} />;

      case 'admin-assets':
        if (currentUser.role !== UserRole.ADMIN) return <div>Access Denied</div>;
        return <AssetManager assets={assets} setAssets={setAssets} onAssetsUpdated={() => setAssetsRefreshTrigger((t) => t + 1)} />;

      case 'admin-vendors':
        if (currentUser.role !== UserRole.ADMIN) return <div>Access Denied</div>;
        return <VendorManager vendors={vendors} setVendors={setVendors} onVendorsUpdated={() => setVendorsRefreshTrigger((t) => t + 1)} />;

      case 'admin-expenses':
        if (currentUser.role !== UserRole.ADMIN) return <div>Access Denied</div>;
        return <ExpenseManager expenses={expenses} setExpenses={setExpenses} onExpensesUpdated={() => setExpensesRefreshTrigger((t) => t + 1)} />;

      case 'admin-bills':
        if (currentUser.role !== UserRole.ADMIN) return <div>Access Denied</div>;
        return <BillsManager bills={bills} setBills={setBills} />;
      
      case 'assignTask':
        // Assign Task Page → /tasks/viewAssignedTasks/ (for MD and all users)
        // Shows tasks assigned to the current user
        return <TaskBoard currentUser={currentUser} users={users} projects={projects} viewMode="assign" setActiveTab={setActiveTab} />;
      
      case 'reportingTask':
        // Reporting Page → /tasks/viewTasks/ (for MD and all users)
        // MD: Shows tasks created by users (filters out tasks created by MD)
        // Users: Shows tasks created by them (tasks they created)
        return <TaskBoard currentUser={currentUser} users={users} projects={projects} viewMode="reporting" setActiveTab={setActiveTab} />;
      
      case 'messages':
        return <ChatSystem currentUser={currentUser} groups={groups} messages={messages} users={users} setMessages={setMessages} setGroups={setGroups} />;

      case 'allUsers':
        // MD: show the same user-management table layout as Admin panel (list view)
        return (
          <AdminPanel
            users={users}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onRefreshEmployees={invalidateEmployees}
          />
        );
      
      case 'schedule-hub':
        return (
          <ScheduleHubPage
            currentUser={currentUser}
            holidays={scheduleHolidays}
            tours={scheduleTours}
            meetings={scheduleMeetings}
            setMeetings={setScheduleMeetings}
            fetchMeetingsForMonth={fetchMeetingsForMonth}
            onScheduleDataUpdated={onScheduleDataUpdated}
            meetingsCacheRef={scheduleMeetingsCacheRef}
            users={users}
          />
        );

      case 'attendance':
        // Attendance & Tours - Under Maintenance
        return (
          <div className="p-10 text-center text-gray-500">
            <p className="text-xl font-semibold mb-2">Attendance & Tours is currently under maintenance.</p>
            <p className="text-sm">Please check back later.</p>
          </div>
        );
        // return <AttendanceTours currentUser={currentUser} users={users} attendance={attendance} tours={tours} onAddTour={handleAddTour} />;

      case 'reports':
        // Reports page - Available for Employee, Intern, TeamLead
        return (
          <ReportsPage 
            currentUserName={currentUser.name} 
            currentUserDepartment={currentUser.branch || undefined}
            users={users}
          />
        );

      case 'nmrhi-npd':
        return <NMRHIPage currentUserName={currentUser.name} currentUserId={currentUser.id} isMD={currentUser.role === UserRole.MD} users={users} categoryId="nmrhi-npd" allowedCategoryIds={allowedNMRHICategories} />;
      
      case 'nmrhi-mmr':
        return <NMRHIPage currentUserName={currentUser.name} currentUserId={currentUser.id} isMD={currentUser.role === UserRole.MD} users={users} categoryId="nmrhi-mmr" allowedCategoryIds={allowedNMRHICategories} />;
      
      case 'nmrhi-rg':
        return <NMRHIPage currentUserName={currentUser.name} currentUserId={currentUser.id} isMD={currentUser.role === UserRole.MD} users={users} categoryId="nmrhi-rg" allowedCategoryIds={allowedNMRHICategories} />;
      
      case 'nmrhi-hc':
        return <NMRHIPage currentUserName={currentUser.name} currentUserId={currentUser.id} isMD={currentUser.role === UserRole.MD} users={users} categoryId="nmrhi-hc" allowedCategoryIds={allowedNMRHICategories} />;
      
      case 'nmrhi-ip':
        return <NMRHIPage currentUserName={currentUser.name} currentUserId={currentUser.id} isMD={currentUser.role === UserRole.MD} users={users} categoryId="nmrhi-ip" allowedCategoryIds={allowedNMRHICategories} />;

      case 'projects':
        // Commented out - Projects page temporarily disabled
        return (
          <div className="p-10 text-center text-gray-500">
            <p>Projects page is currently under maintenance.</p>
          </div>
        );
        // return (
        //   <div className="space-y-6">
        //      <div className="flex justify-between items-center">
        //         <h2 className="text-2xl font-bold text-gray-800">Project Management</h2>
        //         {[UserRole.MD, UserRole.ADMIN].includes(currentUser.role) && (
        //            <button className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-brand-700">+ New Project</button>
        //         )}
        //      </div>
        //      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        //         {projects.map(p => <ProjectCard key={p.id} project={p} userRole={currentUser.role} />)}
        //       </div>
        //   </div>
        // );

      case 'admin':
         if (currentUser.role !== UserRole.ADMIN) return <div>Access Denied</div>;

         return (
            <div className="space-y-6">
              <AdminPanel users={users} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} onRefreshEmployees={invalidateEmployees} />
            </div>
         );

      default:
        return <div className="p-10 text-center text-gray-500">Module under development</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        user={currentUser} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onUserProfileClick={() => setShowUserProfileSidebar(true)}
        onTasksHover={prefetchTasks}
        allowedNMRHICategories={allowedNMRHICategories}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={currentUser} users={users} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onMeetClick={() => setShowMeetCard(true)} meetingRefreshTrigger={meetingRefreshTrigger} notificationMeetings={notificationMeetings} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 md:p-6">
          {renderContent()}
        </main>
      </div>

      {/* In-app toast notification */}
      {toastNotification && (
        <div
          className="fixed top-4 right-4 z-[9999] max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 p-4"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{toastNotification.title}</p>
              <p className="mt-1 text-sm text-gray-600 line-clamp-3">{toastNotification.message}</p>
            </div>
            <button
              onClick={() => {
                setToastNotification(null);
                if (toastTimeoutRef.current) {
                  clearTimeout(toastTimeoutRef.current);
                  toastTimeoutRef.current = null;
                }
              }}
              className="text-gray-400 hover:text-gray-600 p-1 -m-1"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Meet Card - from header Meet button */}
      {showMeetCard && currentUser && (
        <MeetCard
          onClose={() => setShowMeetCard(false)}
          onMeetingCreated={() => {
            setTimeout(() => setMeetingRefreshTrigger((t) => t + 1), 400);
          }}
          currentUser={currentUser}
          rooms={meetRooms}
          employees={meetEmployees}
        />
      )}

      {/* Filtered Users Modal */}
      {showFilteredUsersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {filterType === 'branch' ? 'Users in' : 'Users with role'} {filterValue}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{filteredUsers.length} user(s) found</p>
              </div>
              <button 
                onClick={() => setShowFilteredUsersModal(false)} 
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-2 shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {filteredUsers.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No users found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        setSelectedEmployee(user);
                        setShowFilteredUsersModal(false);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={user.avatar || ''}
                          alt={user.name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs px-2 py-1 bg-brand-100 text-brand-700 rounded-full">
                              {user.designation || 'Employee'}
                            </span>
                            {filterType === 'branch' && (
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                {user.role}
                              </span>
                            )}
                            {filterType === 'role' && (
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                {user.branch}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowFilteredUsersModal(false)}
                className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Sidebar - From Sidebar Click */}
      {showUserProfileSidebar && currentUser && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 backdrop-blur-sm"
            onClick={() => setShowUserProfileSidebar(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
            {/* Header - Dark Theme */}
            <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-slate-700">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="relative flex-shrink-0">
                    <img
                      src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`}
                      alt={currentUser.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-blue-400 shadow-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`;
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">{currentUser.name}</h2>
                    <p className="text-white/90 font-semibold mt-1 text-sm">{currentUser.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserProfileSidebar(false)}
                  className="text-white/70 hover:text-white bg-white/10 rounded-full p-2 shadow-sm ml-2 flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="/monitor.exe"
                  download="monitor.exe"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                >
                  <Download size={18} />
                  Download Monitor
                </a>
                {currentUser.role === UserRole.MD && (
                  <a
                    href="/admin.exe"
                    download="admin.exe"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                  >
                    <Download size={18} />
                    Download Admin Monitor
                  </a>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Employee ID */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon className="text-gray-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee ID</p>
                    <p className="text-lg font-bold text-gray-800 mt-1">{currentUser.id}</p>
                  </div>
                </div>

                {/* Designation */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Briefcase className="text-blue-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Designation</p>
                    <p className="text-lg font-semibold text-gray-800 mt-1">{currentUser.designation || 'N/A'}</p>
                  </div>
                </div>

                {/* Role */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Shield className="text-purple-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</p>
                    <p className="text-lg font-semibold text-gray-800 mt-1">{currentUser.role || 'N/A'}</p>
                  </div>
                </div>

                {/* Team / Branch */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
                    <Users className="text-cyan-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Team / Branch</p>
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {currentUser.branch ? String(currentUser.branch).replace('_', ' ') : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Joining Date */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Calendar className="text-green-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Joining Date</p>
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {currentUser.joinDate 
                        ? new Date(currentUser.joinDate).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Days From Joining */}
                {(currentUser.numberOfDaysFromJoining !== undefined && currentUser.numberOfDaysFromJoining !== null && currentUser.numberOfDaysFromJoining !== '') && (
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Clock className="text-indigo-600" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Days From Joining</p>
                      <p className="text-lg font-semibold text-gray-800 mt-1">{currentUser.numberOfDaysFromJoining}</p>
                    </div>
                  </div>
                )}

                {/* Birthdate */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Calendar className="text-purple-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Birthdate</p>
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {currentUser.birthDate 
                        ? new Date(currentUser.birthDate).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Email Address */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Mail className="text-orange-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email Address</p>
                    <p className="text-lg font-semibold text-gray-800 mt-1">{currentUser.email || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowUserProfileSidebar(false)}
                className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}