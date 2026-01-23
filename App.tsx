import React, { useState, useEffect } from 'react';
import { UserRole, User, Task, Project, Message, ChatGroup, AttendanceRecord, Tour, formatRoleForDisplay } from './types';
import { MOCK_USERS, MOCK_TASKS, MOCK_GROUPS, MOCK_MESSAGES, MOCK_ATTENDANCE, MOCK_TOURS } from './services/mockData';
import api, { 
  login as apiLogin, 
  getEmployeeDashboard,
  getEmployees as apiGetEmployees,
  getBranch as apiGetBranch,
  logout as apiLogout
} from './services/api';
import { Sidebar, Header, BirthdayBanner } from './components/Layout';
import { TaskBoard } from './components/TaskBoard';
import { ChatSystem } from './components/ChatSystem';
import { StatCard, ProjectCard, PerformanceChart, BossRevenueChart, DistributionChart } from './components/DashboardWidgets';
import { AdminPanel } from './components/AdminPanel';
import { AttendanceTours } from './components/AttendanceTours';
import { ReportsPage } from './components/reports';
import { MDDashboardPage } from './components/MDDashboard';
import { NMRHIPage } from './components/NMRHI';
import { Users, Briefcase, CheckSquare, AlertTriangle, ShieldCheck, Activity, Lock, User as UserIcon, ArrowRight, Clock, CheckCircle2, XCircle, Leaf, Building2, Cpu, Database, Fingerprint, X, Mail, Calendar, Briefcase as BriefcaseIcon, Eye, EyeOff, Shield } from 'lucide-react';

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
        // Try admin endpoint first, then fallback to regular login if it fails
        let loginResponse: any;
        
        try {
          loginResponse = await apiLogin(username, password, true);
        } catch (adminError: any) {
          try {
            loginResponse = await apiLogin(username, password, false);
          } catch (regularError: any) {
            throw regularError; // Throw the error to be caught by outer catch
          }
        }
        
        // If API login succeeds, use the response to create/login user
        // Map API response to User type
        let userProfile = MOCK_USERS.find(u => 
          u.name.toLowerCase() === username.toLowerCase() ||
          u.email.toLowerCase() === username.toLowerCase() || 
          u.id.toLowerCase() === username.toLowerCase()
        );

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
          const roleValues = ['MD', 'ADMIN', 'TEAM_LEADER', 'EMPLOYEE', 'INTERN'];
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
          
          // Log unmapped role for debugging
          console.log(`⚠️ [LOGIN] Unmapped role: "${roleString}" (normalized: "${normalizedRole}") - defaulting to EMPLOYEE`);
          
          return UserRole.EMPLOYEE;
        };

        // Try to fetch full employee details from dashboard endpoint first
        let employeeDashboard: any = null;
        try {
          employeeDashboard = await getEmployeeDashboard();
        } catch (dashboardError: any) {
          // If dashboard fetch fails, continue with login response data
          console.warn('Failed to fetch employee dashboard, using login response data:', dashboardError.message);
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
            
            console.log("🔍 [LOGIN] Dashboard Employee_id:", dashboardEmployeeId);
            console.log("🔍 [LOGIN] Original userProfile.id:", userProfile.id);
            
            userProfile = {
              ...userProfile,
              id: dashboardEmployeeId, // Set to Employee_id from dashboard (preserved as string)
              name: employeeDashboard?.['Name'] || employeeDashboard?.['Full Name'] || employeeDashboard?.name || userProfile.name,
              email: employeeDashboard?.['Email_id'] || employeeDashboard?.['Email Address'] || employeeDashboard?.email || userProfile.email,
              role: mappedRole,
              designation: employeeDashboard?.['Designation'] || employeeDashboard?.designation || userProfile.designation,
              branch: (employeeDashboard?.['Branch'] || employeeDashboard?.branch || userProfile.branch) as any,
              joinDate: employeeDashboard?.['Date_of_join'] || employeeDashboard?.['Joining Date'] || employeeDashboard?.joinDate || userProfile.joinDate,
              birthDate: employeeDashboard?.['Date_of_birth'] || employeeDashboard?.['Date of Birth'] || employeeDashboard?.birthDate || userProfile.birthDate,
              avatar: (() => {
                // Prioritize Photo_link from dashboard API (same field name used in createEmployee)
                const photoLink = employeeDashboard?.['Photo_link'] || employeeDashboard?.['Profile Picture'] || employeeDashboard?.avatar || employeeDashboard?.profilePicture || userProfile.avatar;
                
                console.log('🖼️ [LOGIN] Photo_link from dashboard:', photoLink);
                console.log('🖼️ [LOGIN] employeeDashboard keys:', employeeDashboard ? Object.keys(employeeDashboard) : 'null');
                
                if (photoLink) {
                  const convertedUrl = convertPhotoLinkToUrl(photoLink);
                  if (convertedUrl) {
                    console.log('🔗 [LOGIN] Converted Photo_link:', photoLink, 'to URL:', convertedUrl);
                    return convertedUrl;
                  }
                }
                
                console.warn('⚠️ [LOGIN] No valid Photo_link found, using existing avatar:', userProfile.avatar);
                return userProfile.avatar;
              })(),
            } as User & { Employee_id?: string };
            
            // Add Employee_id separately to avoid TypeScript error
            (userProfile as any).Employee_id = dashboardEmployeeId;
            
            console.log("✅ [LOGIN] Updated userProfile with Employee_id:", {
              id: userProfile.id,
              Employee_id: (userProfile as any).Employee_id,
              name: userProfile.name
            });
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
          
          console.log("🔍 [LOGIN] Logged-in user Employee_id:", employeeId);
          console.log("🔍 [LOGIN] Employee_id from dashboard:", employeeDashboard?.['Employee_id']);
          console.log("🔍 [LOGIN] Employee_id from loginResponse:", loginResponse?.Employee_id);
          
          const fullName = employeeDashboard?.['Name'] || employeeDashboard?.['Full Name'] || employeeDashboard?.name || loginResponse?.username || username;
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
          
          console.log("✅ [LOGIN] Final logged-in user object:", {
            id: newUser.id,
            Employee_id: (newUser as any).Employee_id,
            name: newUser.name,
            role: newUser.role
          });
          
          onLogin(newUser);
        }
    } catch (err: any) {
        // Fallback to mock data if API fails (username can be fullName, email, or ID)
        const user = MOCK_USERS.find(u => 
          (u.name.toLowerCase() === username.toLowerCase() ||
           u.email.toLowerCase() === username.toLowerCase() || 
           u.id.toLowerCase() === username.toLowerCase()) && 
          u.password === password
        );
        
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [groups, setGroups] = useState<ChatGroup[]>(MOCK_GROUPS);
  
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [projects, setProjects] = useState<Project[]>([]); // No mock data - empty array
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(MOCK_ATTENDANCE);
  const [tours, setTours] = useState<Tour[]>(MOCK_TOURS);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null); // For employee detail modal
  const [showFilteredUsersModal, setShowFilteredUsersModal] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [filterType, setFilterType] = useState<'branch' | 'role' | null>(null);
  const [filterValue, setFilterValue] = useState<string>('');
  const [showUserProfileSidebar, setShowUserProfileSidebar] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

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
          console.log('🔄 [AVATAR] Fetching avatar from dashboard API...');
          const employeeDashboard = await getEmployeeDashboard();
          console.log('📦 [AVATAR] Dashboard response:', employeeDashboard);
          
          const photoLink = employeeDashboard?.['Photo_link'] || employeeDashboard?.['Profile Picture'];
          console.log('🖼️ [AVATAR] Photo_link value:', photoLink);
          console.log('🖼️ [AVATAR] Photo_link type:', typeof photoLink);
          
          if (photoLink && typeof photoLink === 'string' && photoLink.trim() !== '') {
            let avatarUrl = photoLink.trim();
            
            // Convert relative URL to absolute using helper function
            const convertedUrl = convertPhotoLinkToUrl(avatarUrl);
            if (convertedUrl) {
              avatarUrl = convertedUrl;
              console.log('🔗 [AVATAR] Converted Photo_link to URL:', avatarUrl);
            } else {
              console.log('✅ [AVATAR] Using URL as-is:', avatarUrl);
            }
            
            // Update user avatar if it's different
            if (currentUser.avatar !== avatarUrl) {
              console.log('🔄 [AVATAR] Updating avatar from', currentUser.avatar, 'to', avatarUrl);
              setCurrentUser({
                ...currentUser,
                avatar: avatarUrl
              });
            } else {
              console.log('ℹ️ [AVATAR] Avatar URL unchanged');
            }
          } else {
            console.warn('⚠️ [AVATAR] No valid Photo_link found in dashboard response');
            console.log('📋 [AVATAR] Current avatar:', currentUser.avatar);
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

  // Fetch branches from API when dashboard is active
  useEffect(() => {
    const fetchBranches = async () => {
      if (activeTab === 'dashboard' && currentUser) {
        setIsLoadingBranches(true);
        try {
          const fetchedBranches = await apiGetBranch();
          setBranches(fetchedBranches);
        } catch (err: any) {
          console.error('Error fetching branches:', err);
          // Don't set fallback - only use API data
          setBranches([]);
        } finally {
          setIsLoadingBranches(false);
        }
      }
    };
    fetchBranches();
  }, [activeTab, currentUser]);

  // Fetch employees from API when switching to team tab
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!currentUser || activeTab !== 'team') return;
      
      try {
        const employees = await apiGetEmployees();
        
        // Helper function to extract and map role (reuse the same logic from login)
        const extractRoleFromApiResponse = (apiRole: any): string => {
          if (typeof apiRole === 'string') return apiRole;
          if (Array.isArray(apiRole) && apiRole.length > 0) {
            const firstItem = apiRole[0];
            if (firstItem && typeof firstItem === 'object' && firstItem.Role) {
              return firstItem.Role;
            }
            if (typeof firstItem === 'string') return firstItem;
          }
          if (apiRole && typeof apiRole === 'object') {
            if (apiRole.Role) return apiRole.Role;
            if (apiRole.role) return apiRole.role;
            if (apiRole.ROLE) return apiRole.ROLE;
          }
          const apiRoleString = String(apiRole);
          const querySetMatch = apiRoleString.match(/\{'Role':\s*'([^']+)'\}/) || 
                                apiRoleString.match(/\{"Role":\s*"([^"]+)"\}/) ||
                                apiRoleString.match(/Role['":\s]+['"]([^'"]+)['"]/i);
          if (querySetMatch && querySetMatch[1]) return querySetMatch[1];
          return apiRoleString;
        };

        const mapApiRoleToUserRole = (apiRole: any): UserRole => {
          const extractedRole = extractRoleFromApiResponse(apiRole);
          const normalizedRole = extractedRole.toUpperCase().trim();
          if (normalizedRole === 'MD') return UserRole.MD;
          if (normalizedRole === 'ADMIN') return UserRole.ADMIN;
          if (normalizedRole === 'TEAM_LEADER' || normalizedRole === 'TEAM LEADER') return UserRole.TEAM_LEADER;
          if (normalizedRole === 'EMPLOYEE') return UserRole.EMPLOYEE;
          if (normalizedRole === 'INTERN') return UserRole.INTERN;
          if (Object.values(UserRole).includes(normalizedRole as UserRole)) {
            return normalizedRole as UserRole;
          }
          return UserRole.EMPLOYEE;
        };

        // Convert API employees to User format and merge with existing users
        const apiUsersList: User[] = employees.map((emp: any) => {
          // Use field names matching createEmployee: Employee_id, Name, Email_id, etc.
          // CRITICAL: Preserve Employee_id as STRING to keep leading zeros (e.g., "00011" not 11)
          // The API might return it as number, so we MUST convert to string immediately
          const rawEmployeeId = emp['Employee_id'] || emp['Employee ID'] || emp.id;
          const employeeId = rawEmployeeId !== undefined && rawEmployeeId !== null 
            ? String(rawEmployeeId).trim() 
            : '';
          
          // Log if we detect a number that might have lost leading zeros
          if (typeof rawEmployeeId === 'number' && rawEmployeeId < 1000) {
            console.warn(`⚠️ [FETCH EMPLOYEES] Employee_id came as number: ${rawEmployeeId} (converted to string: "${employeeId}")`);
            console.warn(`   This might have lost leading zeros! Original value might have been "000${rawEmployeeId}" or similar.`);
            console.warn(`   Full employee object:`, emp);
          }
          
          const fullName = emp['Name'] || emp['Full Name'] || emp.name || 'Unknown';
          const email = emp['Email_id'] || emp['Email Address'] || emp.email || '';
          const designation = emp['Designation'] || emp.designation || 'Employee';
          const role = emp['Role'] || emp.role || 'EMPLOYEE';
          const branch = emp['Branch'] || emp.branch || 'TECH';
          const joinDate = emp['Date_of_join'] || emp['Joining Date'] || emp.joinDate || new Date().toISOString().split('T')[0];
          const birthDate = emp['Date_of_birth'] || emp['Date of Birth'] || emp.birthDate || '1995-01-01';
          const photoLink = emp['Photo_link'] || emp['Profile Picture'] || emp.avatar || emp.profilePicture || '';
          
          const existingUser = users.find(u => 
            u.id === employeeId || 
            u.email === email ||
            u.name.toLowerCase() === fullName.toLowerCase()
          );
          
          // IMPORTANT: Don't overwrite currentUser's role if this is the logged-in user
          const isCurrentUser = currentUser && (
            currentUser.id === employeeId ||
            currentUser.email === email ||
            currentUser.name.toLowerCase() === fullName.toLowerCase()
          );
          
          if (existingUser) {
            // Update existing user with API data, but preserve currentUser's role
            const mappedRole = role ? mapApiRoleToUserRole(role) : existingUser.role;
            const updatedUser = {
              ...existingUser,
              id: employeeId || existingUser.id, // Ensure ID is set (already string with leading zeros)
              name: fullName || existingUser.name,
              email: email || existingUser.email,
              role: isCurrentUser ? currentUser.role : mappedRole, // Preserve currentUser's role
              designation: designation || existingUser.designation,
              birthDate: birthDate || existingUser.birthDate,
              joinDate: joinDate || existingUser.joinDate,
              avatar: convertPhotoLinkToUrl(photoLink) || existingUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
              branch: (branch || existingUser.branch) as any,
              // Preserve original Employee_id field from API for reference
              ...(emp['Employee_id'] !== undefined && { Employee_id: String(emp['Employee_id']).trim() }),
            };
            return updatedUser;
          } else {
            // Create new user from API
            const mappedRole = role ? mapApiRoleToUserRole(role) : UserRole.EMPLOYEE;
            const newUser = {
              id: employeeId, // Already converted to string with leading zeros preserved
              name: fullName,
              email: email,
              role: mappedRole,
              designation: designation,
              birthDate: birthDate,
              joinDate: joinDate,
              avatar: convertPhotoLinkToUrl(photoLink) || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
              status: 'PRESENT' as const,
              leaveBalance: 12,
              score: 0,
              branch: branch as any,
              password: emp['Initial Password'] || emp.password,
              // Preserve original Employee_id field from API for reference
              ...(emp['Employee_id'] !== undefined && { Employee_id: String(emp['Employee_id']).trim() }),
            };
            return newUser;
          }
        });
        
        // Use ONLY API users (no mock data, no merging)
        // IMPORTANT: If currentUser is in the list, make sure their role is preserved
        const finalUsers = apiUsersList.map(u => {
          if (currentUser && (u.id === currentUser.id || u.email === currentUser.email || u.name.toLowerCase() === currentUser.name.toLowerCase())) {
            return { ...u, role: currentUser.role };
          }
          return u;
        });
        
        // Set users to API data only (replace all mock data)
        setUsers(finalUsers);
      } catch (err: any) {
        // Keep existing users on error
      }
    };

    fetchEmployees();
  }, [activeTab, currentUser]);

  const handleAddUser = (newUser: User) => {
    setUsers([...users, newUser]);
  };

  const handleDeleteUser = (userId: string) => {
      setUsers(users.filter(u => u.id !== userId));
  };

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
    } else if (normalizedTeamLeader === 'TEAM_LEADER' || 
               normalizedTeamLeader === 'TEAMLEADER' ||
               (roleUpper.includes('TEAM') && roleUpper.includes('LEAD'))) {
      fixedRole = UserRole.TEAM_LEADER;
    } else if (roleUpper === 'EMPLOYEE') {
      fixedRole = UserRole.EMPLOYEE;
    } else if (roleUpper === 'INTERN') {
      fixedRole = UserRole.INTERN;
    }
    
    // Log role mapping for debugging
    if (roleString !== String(fixedRole)) {
      console.log(`🔍 [LOGIN] Role mapping: "${roleString}" → "${roleUpper}" → ${fixedRole}`);
    }
    
    // CRITICAL: Ensure role is properly set before setting currentUser
    const finalUser: User = {
      ...user,
      role: fixedRole || UserRole.EMPLOYEE, // Use fixed role or fallback
    };
    
    setCurrentUser(finalUser);
    
    if (finalUser.role === UserRole.ADMIN) {
      setActiveTab('admin');
    } else if (finalUser.role === UserRole.MD) {
      setActiveTab('dashboard');
    } else {
      setActiveTab('assignTask');
    }
  };

  const handleLogout = async () => {
    await apiLogout();
    setCurrentUser(null);
  };
  
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
              onBarClick={async (branchName) => {
                try {
                  const employees = await apiGetEmployees();
                  
                  // Find the original branch name from branchData
                  const branchInfo = adminDashboardBranchData.find(b => b.name === branchName);
                  const originalBranchName = branchInfo?.originalName || branchName;
                  
                  // Normalize for comparison
                  const normalizedBranchName = normalizeBranchName(originalBranchName);
                  
                  const filtered = employees.filter((emp: any) => {
                    const empBranch = emp['Branch'] || emp.branch || '';
                    const normalizedEmpBranch = normalizeBranchName(empBranch);
                    // Match by normalized name or exact match
                    return normalizedEmpBranch === normalizedBranchName || 
                           empBranch === originalBranchName || 
                           empBranch === branchName ||
                           normalizedEmpBranch === normalizeBranchName(branchName);
                  }).map((emp: any) => {
                    const employeeId = emp['Employee_id'] || emp['Employee ID'] || emp.id || '';
                    const fullName = emp['Name'] || emp['Full Name'] || emp.name || '';
                    const email = emp['Email_id'] || emp['Email Address'] || emp.email || '';
                    const role = emp['Role'] || emp.role || 'EMPLOYEE';
                    const designation = emp['Designation'] || emp.designation || '';
                    const photoLink = emp['Photo_link'] || emp['Profile Picture'] || emp.avatar || emp.profilePicture || '';
                    const branch = emp['Branch'] || emp.branch || 'TECH';
                    
                    let userRole: UserRole = UserRole.EMPLOYEE;
                    const roleUpper = String(role).toUpperCase();
                    if (roleUpper === 'MD') userRole = UserRole.MD;
                    else if (roleUpper === 'ADMIN') userRole = UserRole.ADMIN;
                    else if (roleUpper === 'TEAM_LEADER' || roleUpper === 'TEAM LEADER') userRole = UserRole.TEAM_LEADER;
                    else if (roleUpper === 'EMPLOYEE') userRole = UserRole.EMPLOYEE;
                    else if (roleUpper === 'INTERN') userRole = UserRole.INTERN;
                    
                    return {
                      id: employeeId,
                      name: fullName,
                      email: email,
                      role: userRole,
                      designation: designation,
                      avatar: convertPhotoLinkToUrl(photoLink) || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
                      status: 'PRESENT' as const,
                      leaveBalance: 0,
                      score: 0,
                      branch: branch as any,
                      joinDate: emp['Date_of_join'] || emp['Joining Date'] || emp.joinDate || new Date().toISOString().split('T')[0],
                      birthDate: emp['Date_of_birth'] || emp['Date of Birth'] || emp.birthDate || '1995-01-01',
                    };
                  });
                  
                  setFilteredUsers(filtered);
                  setFilterType('branch');
                  setFilterValue(branchName);
                  setShowFilteredUsersModal(true);
                } catch (err: any) {
                  console.error('Error fetching employees by branch:', err);
                  alert('Failed to load employees. Please try again.');
                }
              }}
            />

            <DistributionChart 
              title="Workforce by Role" 
              data={[
                { name: 'Leader', value: adminTlCount, color: '#8b5cf6' },
                { name: 'Employee', value: adminEmployeeCount, color: '#06b6d4' },
                { name: 'Intern', value: adminInternCount, color: '#ec4899' }
              ]}
              onBarClick={async (roleName) => {
                try {
                  const employees = await apiGetEmployees();
                  
                  // Map role display names to UserRole enum
                  const roleMap: Record<string, UserRole> = {
                    'Leader': UserRole.TEAM_LEADER,
                    'Employee': UserRole.EMPLOYEE,
                    'Intern': UserRole.INTERN,
                  };
                  
                  const targetRole = roleMap[roleName];
                  
                  const filtered = employees.filter((emp: any) => {
                    const role = emp['Role'] || emp.role || 'EMPLOYEE';
                    const roleUpper = String(role).toUpperCase();
                    
                    if (targetRole === UserRole.TEAM_LEADER) {
                      return roleUpper === 'TEAM_LEADER' || roleUpper === 'TEAM LEADER';
                    } else if (targetRole === UserRole.EMPLOYEE) {
                      return roleUpper === 'EMPLOYEE';
                    } else if (targetRole === UserRole.INTERN) {
                      return roleUpper === 'INTERN';
                    }
                    return false;
                  }).map((emp: any) => {
                    const employeeId = emp['Employee_id'] || emp['Employee ID'] || emp.id || '';
                    const fullName = emp['Name'] || emp['Full Name'] || emp.name || '';
                    const email = emp['Email_id'] || emp['Email Address'] || emp.email || '';
                    const role = emp['Role'] || emp.role || 'EMPLOYEE';
                    const designation = emp['Designation'] || emp.designation || '';
                    const photoLink = emp['Photo_link'] || emp['Profile Picture'] || emp.avatar || emp.profilePicture || '';
                    const branch = emp['Branch'] || emp.branch || 'TECH';
                    
                    let userRole: UserRole = UserRole.EMPLOYEE;
                    const roleUpper = String(role).toUpperCase();
                    if (roleUpper === 'MD') userRole = UserRole.MD;
                    else if (roleUpper === 'ADMIN') userRole = UserRole.ADMIN;
                    else if (roleUpper === 'TEAM_LEADER' || roleUpper === 'TEAM LEADER') userRole = UserRole.TEAM_LEADER;
                    else if (roleUpper === 'EMPLOYEE') userRole = UserRole.EMPLOYEE;
                    else if (roleUpper === 'INTERN') userRole = UserRole.INTERN;
                    
                    return {
                      id: employeeId,
                      name: fullName,
                      email: email,
                      role: userRole,
                      designation: designation,
                      avatar: convertPhotoLinkToUrl(photoLink) || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
                      status: 'PRESENT' as const,
                      leaveBalance: 0,
                      score: 0,
                      branch: branch as any,
                      joinDate: emp['Date_of_join'] || emp['Joining Date'] || emp.joinDate || new Date().toISOString().split('T')[0],
                      birthDate: emp['Date_of_birth'] || emp['Date of Birth'] || emp.birthDate || '1995-01-01',
                    };
                  });
                  
                  setFilteredUsers(filtered);
                  setFilterType('role');
                  setFilterValue(roleName);
                  setShowFilteredUsersModal(true);
                } catch (err: any) {
                  console.error('Error fetching employees by role:', err);
                  alert('Failed to load employees. Please try again.');
                }
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
           const completedTasks = tasks.filter(t => 
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
            <BirthdayBanner users={users} currentUser={currentUser} />
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
                 onBarClick={async (branchName) => {
                   try {
                     const employees = await apiGetEmployees();
                     
                     // Find the original branch name from branchData
                     const branchInfo = branchData.find(b => b.name === branchName);
                     const originalBranchName = branchInfo?.originalName || branchName;
                     
                     // Normalize for comparison
                     const normalizedBranchName = normalizeBranchName(originalBranchName);
                     
                     const filtered = employees.filter((emp: any) => {
                       const empBranch = emp['Branch'] || emp.branch || '';
                       const normalizedEmpBranch = normalizeBranchName(empBranch);
                       // Match by normalized name or exact match
                       return normalizedEmpBranch === normalizedBranchName || 
                              empBranch === originalBranchName || 
                              empBranch === branchName ||
                              normalizedEmpBranch === normalizeBranchName(branchName);
                     }).map((emp: any) => {
                       const employeeId = emp['Employee_id'] || emp['Employee ID'] || emp.id || '';
                       const fullName = emp['Name'] || emp['Full Name'] || emp.name || '';
                       const email = emp['Email_id'] || emp['Email Address'] || emp.email || '';
                       const role = emp['Role'] || emp.role || 'EMPLOYEE';
                       const designation = emp['Designation'] || emp.designation || '';
                       const photoLink = emp['Photo_link'] || emp['Profile Picture'] || emp.avatar || emp.profilePicture || '';
                       const branch = emp['Branch'] || emp.branch || 'TECH';
                       
                       let userRole: UserRole = UserRole.EMPLOYEE;
                       const roleUpper = String(role).toUpperCase();
                       if (roleUpper === 'MD') userRole = UserRole.MD;
                       else if (roleUpper === 'ADMIN') userRole = UserRole.ADMIN;
                       else if (roleUpper === 'TEAM_LEADER' || roleUpper === 'TEAM LEADER') userRole = UserRole.TEAM_LEADER;
                       else if (roleUpper === 'EMPLOYEE') userRole = UserRole.EMPLOYEE;
                       else if (roleUpper === 'INTERN') userRole = UserRole.INTERN;
                       
                       return {
                         id: employeeId,
                         name: fullName,
                         email: email,
                         role: userRole,
                         designation: designation,
                         avatar: convertPhotoLinkToUrl(photoLink) || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
                         status: 'PRESENT' as const,
                         leaveBalance: 0,
                         score: 0,
                         branch: branch as any,
                         joinDate: emp['Date_of_join'] || emp['Joining Date'] || emp.joinDate || new Date().toISOString().split('T')[0],
                         birthDate: emp['Date_of_birth'] || emp['Date of Birth'] || emp.birthDate || '1995-01-01',
                       };
                     });
                     
                     setFilteredUsers(filtered);
                     setFilterType('branch');
                     setFilterValue(branchName);
                     setShowFilteredUsersModal(true);
                   } catch (err: any) {
                     console.error('Error fetching employees by branch:', err);
                     alert('Failed to load employees. Please try again.');
                   }
                 }}
               />

               <DistributionChart 
                 title="Workforce by Role" 
                 data={[
                    { name: 'Leader', value: tlCount, color: '#8b5cf6' },
                    { name: 'Employee', value: employeeCount, color: '#06b6d4' },
                    { name: 'Intern', value: internCount, color: '#ec4899' }
                 ]}
                 onBarClick={async (roleName) => {
                   try {
                     const employees = await apiGetEmployees();
                     // Map role names to match API values
                     const roleMap: Record<string, string> = {
                       'Leader': 'TEAM_LEADER',
                       'Employee': 'EMPLOYEE',
                       'Intern': 'INTERN'
                     };
                     
                     const targetRole = roleMap[roleName] || roleName.toUpperCase();
                     
                     const filtered = employees.filter((emp: any) => {
                       const role = emp['Role'] || emp.role || '';
                       const roleUpper = String(role).toUpperCase();
                       return roleUpper === targetRole || 
                              (targetRole === 'TEAM_LEADER' && (roleUpper === 'TEAM LEADER' || roleUpper === 'TEAM_LEADER'));
                     }).map((emp: any) => {
                       const employeeId = emp['Employee_id'] || emp['Employee ID'] || emp.id || '';
                       const fullName = emp['Name'] || emp['Full Name'] || emp.name || '';
                       const email = emp['Email_id'] || emp['Email Address'] || emp.email || '';
                       const role = emp['Role'] || emp.role || 'EMPLOYEE';
                       const designation = emp['Designation'] || emp.designation || '';
                       const photoLink = emp['Photo_link'] || emp['Profile Picture'] || emp.avatar || emp.profilePicture || '';
                       const branch = emp['Branch'] || emp.branch || 'TECH';
                       
                       let userRole: UserRole = UserRole.EMPLOYEE;
                       const roleUpper = String(role).toUpperCase();
                       if (roleUpper === 'MD') userRole = UserRole.MD;
                       else if (roleUpper === 'ADMIN') userRole = UserRole.ADMIN;
                       else if (roleUpper === 'TEAM_LEADER' || roleUpper === 'TEAM LEADER') userRole = UserRole.TEAM_LEADER;
                       else if (roleUpper === 'EMPLOYEE') userRole = UserRole.EMPLOYEE;
                       else if (roleUpper === 'INTERN') userRole = UserRole.INTERN;
                       
                       return {
                         id: employeeId,
                         name: fullName,
                         email: email,
                         role: userRole,
                         designation: designation,
                         avatar: convertPhotoLinkToUrl(photoLink) || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
                         status: 'PRESENT' as const,
                         leaveBalance: 0,
                         score: 0,
                         branch: branch as any,
                         joinDate: emp['Date_of_join'] || emp['Joining Date'] || emp.joinDate || new Date().toISOString().split('T')[0],
                         birthDate: emp['Date_of_birth'] || emp['Date of Birth'] || emp.birthDate || '1995-01-01',
                       };
                     });
                     
                     setFilteredUsers(filtered);
                     setFilterType('role');
                     setFilterValue(roleName);
                     setShowFilteredUsersModal(true);
                   } catch (err: any) {
                     console.error('Error fetching employees by role:', err);
                     alert('Failed to load employees. Please try again.');
                   }
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
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      
      case 'assignTask':
        // Assign Task Page → /tasks/viewAssignedTasks/ (for MD and all users)
        // Shows tasks assigned to the current user
        return <TaskBoard currentUser={currentUser} tasks={tasks} users={users} projects={projects} setTasks={setTasks} viewMode="assign" />;
      
      case 'reportingTask':
        // Reporting Page → /tasks/viewTasks/ (for MD and all users)
        // MD: Shows tasks created by users (filters out tasks created by MD)
        // Users: Shows tasks created by them (tasks they created)
        return <TaskBoard currentUser={currentUser} tasks={tasks} users={users} projects={projects} setTasks={setTasks} viewMode="reporting" />;
      
      case 'messages':
        return <ChatSystem currentUser={currentUser} groups={groups} messages={messages} users={users} setMessages={setMessages} setGroups={setGroups} />;

      case 'allUsers':
        // MD: show the same user-management table layout as Admin panel (list view)
        return (
          <AdminPanel
            users={users}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
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
          />
        );

      case 'nmrhi-npd':
        return <NMRHIPage currentUserName={currentUser.name} categoryId="nmrhi-npd" />;
      
      case 'nmrhi-mmr':
        return <NMRHIPage currentUserName={currentUser.name} categoryId="nmrhi-mmr" />;
      
      case 'nmrhi-rg':
        return <NMRHIPage currentUserName={currentUser.name} categoryId="nmrhi-rg" />;
      
      case 'nmrhi-hc':
        return <NMRHIPage currentUserName={currentUser.name} categoryId="nmrhi-hc" />;
      
      case 'nmrhi-ip':
        return <NMRHIPage currentUserName={currentUser.name} categoryId="nmrhi-ip" />;

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

      case 'team':
        return (
          <>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
             {users.map(u => (
               <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center relative overflow-hidden group hover:shadow-lg transition-all">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 to-purple-500"></div>
                 <img 
                   src={u.avatar} 
                   className="w-16 h-16 rounded-full mb-3 border-2 border-white shadow-md group-hover:scale-105 transition-transform cursor-pointer" 
                   alt={u.name}
                   onClick={() => setSelectedEmployee(u)}
                 />
                 <h3 className="font-bold text-sm text-gray-900 mb-1">{u.name}</h3>
                 <p className="text-brand-600 text-xs mb-2 font-medium">{u.designation}</p>
                 <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mb-1.5 ${
                   u.role === UserRole.MD ? 'bg-purple-100 text-purple-700' :
                   u.role === UserRole.ADMIN ? 'bg-blue-100 text-blue-700' :
                   u.role === UserRole.TEAM_LEADER ? 'bg-indigo-100 text-indigo-700' :
                   u.role === UserRole.EMPLOYEE ? 'bg-gray-100 text-gray-700' :
                   'bg-pink-100 text-pink-700'
                 }`}>
                   {formatRoleForDisplay(u.role)}
                 </span>
                 {u.branch && (
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded mb-1.5 font-mono">{u.branch ? String(u.branch).replace('_', ' ') : 'N/A'}</span>
                 )}
                 <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mb-2 ${u.status === 'PRESENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                   {u.status}
                 </span>
                 <div className="w-full mt-3 pt-3 border-t border-gray-50 flex justify-between text-[10px] text-gray-500 font-medium uppercase">
                   <span>Score: <span className="text-gray-800">{u.score}</span></span>
                   <span>Joined: <span className="text-gray-800">{new Date(u.joinDate).getFullYear()}</span></span>
                 </div>
               </div>
             ))}
           </div>

           {/* Employee Detail Modal */}
           {selectedEmployee && (
             <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={() => setSelectedEmployee(null)}>
               <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl relative animate-float" onClick={(e) => e.stopPropagation()}>
                 <button 
                   onClick={() => setSelectedEmployee(null)}
                   className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                 >
                   <X size={24} />
                 </button>
                 
                 <div className="flex flex-col items-center mb-6">
                   <img 
                     src={selectedEmployee.avatar} 
                     className="w-32 h-32 rounded-full border-4 border-brand-500 shadow-lg mb-4 cursor-pointer hover:scale-105 transition-transform" 
                     alt={selectedEmployee.name}
                   />
                   <h2 className="text-2xl font-bold text-gray-900">{selectedEmployee.name}</h2>
                   <p className="text-brand-600 text-lg font-medium mt-1">{selectedEmployee.designation}</p>
                   <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider mt-2 ${
                     selectedEmployee.role === UserRole.MD ? 'bg-purple-100 text-purple-700' :
                     selectedEmployee.role === UserRole.ADMIN ? 'bg-blue-100 text-blue-700' :
                     selectedEmployee.role === UserRole.TEAM_LEADER ? 'bg-indigo-100 text-indigo-700' :
                     selectedEmployee.role === UserRole.EMPLOYEE ? 'bg-gray-100 text-gray-700' :
                     'bg-pink-100 text-pink-700'
                   }`}>
                     {formatRoleForDisplay(selectedEmployee.role)}
                   </span>
                 </div>

                 <div className="space-y-4 border-t border-gray-100 pt-6">
                   <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                       <UserIcon className="text-gray-600" size={20} />
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Employee ID</p>
                       <p className="text-sm font-bold text-gray-800">{selectedEmployee.id}</p>
                     </div>
                   </div>

                   <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
                       <BriefcaseIcon className="text-brand-600" size={20} />
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Designation</p>
                       <p className="text-sm font-bold text-gray-800">{selectedEmployee.designation}</p>
                     </div>
                   </div>

                   <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                       <UserIcon className="text-purple-600" size={20} />
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Role</p>
                       <p className="text-sm font-bold text-gray-800">{selectedEmployee.role}</p>
                     </div>
                   </div>

                   <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                       <Users className="text-blue-600" size={20} />
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Team / Branch</p>
                       <p className="text-sm font-bold text-gray-800">{selectedEmployee.branch ? String(selectedEmployee.branch).replace('_', ' ') : 'N/A'}</p>
                     </div>
                   </div>

                   <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                       <Calendar className="text-green-600" size={20} />
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Joining Date</p>
                       <p className="text-sm font-bold text-gray-800">{new Date(selectedEmployee.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                     </div>
                   </div>

                   <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                       <Calendar className="text-purple-600" size={20} />
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Birthdate</p>
                       <p className="text-sm font-bold text-gray-800">{new Date(selectedEmployee.birthDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                     </div>
                   </div>

                   <div className="flex items-center space-x-3">
                     <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                       <Mail className="text-orange-600" size={20} />
                     </div>
                     <div>
                       <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Email Address</p>
                       <p className="text-sm font-bold text-gray-800 break-all">{selectedEmployee.email}</p>
                     </div>
                   </div>

                   <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                     <div className="text-center">
                       <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Score</p>
                       <p className="text-2xl font-bold text-brand-600">{selectedEmployee.score}</p>
                     </div>
                     <div className="text-center">
                       <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Status</p>
                       <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${selectedEmployee.status === 'PRESENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                         {selectedEmployee.status}
                       </span>
                     </div>
                   </div>
                 </div>
               </div>
             </div>
           )}
          </>
        );
      
      case 'admin':
         if (currentUser.role !== UserRole.ADMIN) return <div>Access Denied</div>;

         return (
            <div className="space-y-6">
              <AdminPanel users={users} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} />
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
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        onUserProfileClick={() => setShowUserProfileSidebar(true)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={currentUser} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 md:p-6">
          {renderContent()}
        </main>
      </div>

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