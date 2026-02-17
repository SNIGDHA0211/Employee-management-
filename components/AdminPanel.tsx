import React, { useState, useEffect, useRef } from 'react';
import { useRolesQuery } from '../hooks/useRoles';
import { useBranchesQuery } from '../hooks/useBranches';
import { User, UserRole, formatRoleForDisplay } from '../types';
import { UserPlus, Trash2, Shield, Calendar, Mail, User as UserIcon, Upload, Hash, Camera, Lock, Key, Building2, X, Briefcase, Users as UsersIcon, Pencil, Clock, Plus, Search } from 'lucide-react';
import api, { 
  getDesignations as apiGetDesignations,
  getDepartmentsandFunctions as apiGetDepartmentsandFunctions,
  createEmployee as apiCreateEmployee,
  updateProfile as apiUpdateProfile,
  changePhoto as apiChangePhoto,
  deleteEmployee as apiDeleteEmployee,
  adminChangePassword as apiAdminChangePassword
} from '../services/api';

interface AdminPanelProps {
  users: User[];
  onAddUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onRefreshEmployees?: () => void | Promise<void>;
}

const AdminPanelInner: React.FC<AdminPanelProps> = ({ users, onAddUser, onDeleteUser, onRefreshEmployees }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Use shared users from App (no local fetch - single source of truth)
  const displayUsers = users.filter(user => {
    const isMockUser = /^u\d+$/.test(user.id);
    return !isMockUser;
  });

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const filteredDisplayUsers = userSearchQuery.trim()
    ? displayUsers.filter(user => {
        const q = userSearchQuery.trim().toLowerCase();
        const name = (user.name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const id = (user.id || '').toLowerCase();
        const empId = String((user as any).Employee_id || '').toLowerCase();
        return name.includes(q) || email.includes(q) || id.includes(q) || empId.includes(q);
      })
    : displayUsers;

  useEffect(() => {
    const employees = users.filter(user => !/^u\d+$/.test(user.id));
    console.log('[AdminPanel] All employees:', employees);
  }, [users]);

  // Password Reset State
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  
  // User Profile Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: '',
    designation: '',
    branch: '',
    department: '',
    joinDate: '',
    birthDate: '',
    password: '',
    profilePicture: null as File | null,
  });
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);

  // Update Employee sidebar (opens when pencil clicked)
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [updateSidebarFormData, setUpdateSidebarFormData] = useState({
    name: '',
    email: '',
    role: '',
    designation: '',
    branch: '',
    department: '',
    function: '',
    teamLead: '',
    joinDate: '',
    birthDate: '',
    password: '',
  });
  const [updateSidebarAvatarPreview, setUpdateSidebarAvatarPreview] = useState<string | null>(null);
  const [updateSidebarAvatarFile, setUpdateSidebarAvatarFile] = useState<File | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    role: '' as string | UserRole,
    designation: '',
    birthDate: '',
    joinDate: new Date().toISOString().split('T')[0],
    password: '', // New password field
    branch: '',
    department: '',
    function: '',
    teamLead: '', // Team Lead Employee_id
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null); // Store the actual file object
  
  // Designations, Branches, Departments, Functions, Roles, and Team Leads from API
  const [designations, setDesignations] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [functions, setFunctions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [teamLeads, setTeamLeads] = useState<Array<{ Name: string; Employee_id: string }>>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const optionsLoadedRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  // Roles and branches - cached via React Query (shared with TaskBoard)
  const { data: rolesData } = useRolesQuery(true);
  const { data: branchesData } = useBranchesQuery(true);
  useEffect(() => {
    if (rolesData) {
      let validRoles = Array.isArray(rolesData) ? rolesData.filter((r: any) => r != null && typeof r === 'string' && String(r).trim() !== '') : [];
      const hasTeamLead = validRoles.some((r: string) => {
        const u = String(r).toUpperCase().replace(/[_\s]/g, '');
        return u === 'TEAMLEAD' || u === 'TEAMLEADER' || (u.includes('TEAM') && u.includes('LEAD'));
      });
      if (!hasTeamLead) validRoles = [...validRoles, 'TeamLead'];
      setRoles(validRoles);
    } else setRoles([]);
  }, [rolesData]);
  useEffect(() => {
    if (branchesData) setBranches(Array.isArray(branchesData) ? branchesData.filter((b: any) => b != null && typeof b === 'string' && String(b).trim() !== '') : []);
    else setBranches([]);
  }, [branchesData]);

  const isTeamleadUser = (u: User) => {
    if (u.role === UserRole.TEAM_LEADER) return true;
    const raw = String((u as any).rawRole || u.role || '').toUpperCase().replace(/[_\s]/g, '');
    return raw === 'TEAMLEAD' || raw === 'TEAMLEADER' || (raw.includes('TEAM') && raw.includes('LEAD'));
  };

  /** Resolve team lead (name or Employee_id) to Employee_id for API payload */
  const resolveTeamLeadToEmployeeId = (value: string): string | undefined => {
    if (!value || !value.trim()) return undefined;
    const byId = teamLeads.find(t => String(t.Employee_id).trim() === value.trim());
    if (byId) return byId.Employee_id;
    const byName = teamLeads.find(t => String(t.Name || '').trim() === value.trim());
    if (byName) return byName.Employee_id;
    const byIdInUsers = users.find(u => String((u as any).Employee_id ?? u.id) === value.trim());
    if (byIdInUsers) return String((byIdInUsers as any).Employee_id ?? byIdInUsers.id);
    const byNameInUsers = users.find(u => String(u.name || '').trim() === value.trim());
    if (byNameInUsers) return String((byNameInUsers as any).Employee_id ?? byNameInUsers.id);
    return value; // Already an ID or unknown - send as-is
  };

  /** Populate teamLeads with all users who have Teamlead role (for edit employee panel) */
  const populateAllTeamLeads = () => {
    const tlList = users
      .filter(u => !/^u\d+$/.test(u.id) && isTeamleadUser(u))
      .map(u => ({ Name: u.name || 'Unknown', Employee_id: String((u as any).Employee_id || u.id || '') }))
      .filter(tl => tl.Employee_id);
    setTeamLeads(tlList);
  };

  // Derive team leads from users (get employees) - no separate API call
  const deriveTeamLeadsFromUsers = (role: string) => {
    const normalizedRole = String(role).trim().toUpperCase();
    if (normalizedRole !== 'EMPLOYEE' && normalizedRole !== 'INTERN') {
      setTeamLeads([]);
      setFormData(prev => ({ ...prev, teamLead: '' }));
      return;
    }
    const tlList = users
      .filter(u => !/^u\d+$/.test(u.id) && isTeamleadUser(u))
      .map(u => ({ Name: u.name || 'Unknown', Employee_id: String((u as any).Employee_id || u.id || '') }))
      .filter(tl => tl.Employee_id);
    setTeamLeads(tlList);
  };

  // Fetch departments and functions based on selected role (using combined endpoint)
  const fetchDepartmentsAndFunctionsForRole = async (role: string) => {
    if (!role || role.trim() === '') {
      setDepartments([]);
      setFunctions([]);
      return;
    }

    try {
      const data = await apiGetDepartmentsandFunctions(role);
      // Check if data is valid
      if (!data || typeof data !== 'object') {
        console.error('❌ [ADMIN PANEL] Invalid response format:', data);
        setDepartments([]);
        setFunctions([]);
        return;
      }
      
      // Filter and sanitize departments - only keep valid strings
      const validDepartments = Array.isArray(data.departments)
        ? data.departments.filter(d => d != null && typeof d === 'string' && d.trim() !== '')
        : [];
      
      // Filter and sanitize functions - only keep valid strings
      const validFunctions = Array.isArray(data.functions)
        ? data.functions.filter(f => f != null && typeof f === 'string' && f.trim() !== '')
        : [];
      setDepartments(validDepartments);
      setFunctions(validFunctions);
    } catch (err: any) {
      console.error('❌ [ADMIN PANEL] Error fetching departments and functions:', err);
      console.error('❌ [ADMIN PANEL] Error details:', {
        message: err?.message,
        response: err?.response?.data,
        status: err?.response?.status,
        url: err?.config?.url
      });
      setDepartments([]);
      setFunctions([]);
    }
  };

  // Fetch departments, functions, and team leads when role changes in form
  useEffect(() => {
    if (formData.role && String(formData.role).trim() !== '') {
      const roleStr = String(formData.role).toUpperCase().trim();
      // Only fetch departments and functions for non-MD/Admin roles
      if (roleStr !== 'MD' && roleStr !== 'ADMIN') {
        fetchDepartmentsAndFunctionsForRole(String(formData.role));
      } else {
        setDepartments([]);
        setFunctions([]);
      }
      
      // Derive team leads from users for Employee and Intern roles
      if (roleStr === 'EMPLOYEE' || roleStr === 'INTERN') {
        deriveTeamLeadsFromUsers(String(formData.role));
      } else {
        setTeamLeads([]);
        setFormData(prev => ({ ...prev, teamLead: '' })); // Clear team lead selection
      }
    } else {
      setDepartments([]);
      setFunctions([]);
      setTeamLeads([]);
      setFormData(prev => ({ ...prev, teamLead: '' }));
    }
  }, [formData.role, users]);

  // Map a single API employee object to User (shared by onRefreshEmployees and fetchListData)
  const mapEmployeeToUser = (emp: any): User & { rawRole?: string; department?: string; function?: string; teamLead?: string } => {
        // Field mapping priority (matches App.tsx exactly):
        // Employee_id → Employee ID → id
        // Name → Full Name → name
        // Email_id → Email Address → email
        // Role → role (FETCHED FROM API)
        // Designation → designation
        // Branch → branch
        // Date_of_join → Joining Date → joinDate
        // Date_of_birth → Date of Birth → birthDate
        // Photo_link → Profile Picture → avatar → profilePicture
        const employeeId = emp['Employee_id'] || emp['Employee ID'] || emp.id || '';
        const fullName = emp['Name'] || emp['Full Name'] || emp.name || 'Unknown';
        const email = emp['Email_id'] || emp['Email Address'] || emp.email || '';
        
        // CRITICAL: Fetch Role from API - check multiple possible field names
        // Priority: Role (capital R) → role (lowercase) → ROLE (uppercase) → default to EMPLOYEE
        const roleFromAPI = emp['Role'] || emp.role || emp['role'] || emp.ROLE;
        // Store raw role from API FIRST (before any transformation) - exactly as backend sends it
        // DO NOT transform, uppercase, or modify in any way - preserve exactly as received
        const rawRoleFromAPI = roleFromAPI ? String(roleFromAPI).trim() : 'EMPLOYEE';
        
        // Use roleFromAPI for enum mapping (but don't modify rawRoleFromAPI)
        const role = roleFromAPI || 'EMPLOYEE';
        const designation = emp['Designation'] || emp.designation || '';
        const branch = emp['Branch'] || emp.branch || '';
        const department = emp['Department'] || emp.department || '';
        const functionValue = emp['Function'] || emp.function || emp.Function || '';
        const teamLead = emp['Teamlead'] || emp['Team_Lead'] || emp.teamLead || emp['Team Lead'] || emp['TeamLead'] || '';
        const joinDate = emp['Date_of_join'] || emp['Joining Date'] || emp.joinDate || new Date().toISOString().split('T')[0];
        const birthDate = emp['Date_of_birth'] || emp['Date of Birth'] || emp.birthDate || '1995-01-01';
        // Get avatar URL - handle both full URLs and relative paths
        let avatar = emp['Photo_link'] || emp['Profile Picture'] || emp.avatar || emp.profilePicture || '';
        
        // If avatar is a relative path, convert it to full URL
        if (avatar && !avatar.startsWith('http') && !avatar.startsWith('data:')) {
          // Check if it's a relative path that needs the base URL
          // Assuming the backend serves images from a specific endpoint
          // You may need to adjust this based on your backend setup
          if (avatar.startsWith('/')) {
            avatar = `https://employee-management-system-tmrl.onrender.com${avatar}`;
          } else if (avatar) {
            avatar = `https://employee-management-system-tmrl.onrender.com/${avatar}`;
          }
        }
        
        // Fallback to generated avatar if no image is available
        const avatarUrl = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
        
        // Map role to UserRole enum ONLY for internal logic/permissions (not for display)
        // Use rawRoleFromAPI (already stored above) for the mapping
        const roleString = rawRoleFromAPI;
        const roleUpper = roleString.toUpperCase();
        let userRole: UserRole = UserRole.EMPLOYEE;
        
        // Normalize team leader variations: "Team lead", "Team Leader", "TEAM LEADER", "TEAM_LEADER", "TeamLead", etc.
        const normalizedRole = roleUpper.replace(/[_\s]+/g, '_');
        const normalizedCompact = roleUpper.replace(/[_\s]+/g, '');

        if (roleUpper === 'MD') userRole = UserRole.MD;
        else if (roleUpper === 'ADMIN') userRole = UserRole.ADMIN;
        else if (normalizedRole === 'TEAM_LEADER' || 
                 normalizedRole === 'TEAMLEADER' ||
                 normalizedCompact === 'TEAMLEAD' ||
                 (roleUpper.includes('TEAM') && roleUpper.includes('LEAD'))) {
          userRole = UserRole.TEAM_LEADER;
        }
        else if (roleUpper === 'EMPLOYEE') userRole = UserRole.EMPLOYEE;
        else if (roleUpper === 'INTERN') userRole = UserRole.INTERN;
        
        // Get password from various possible field names
        const password = emp['Initial Password'] || 
                        emp['Password'] || 
                        emp['password'] || 
                        emp.password || 
                        '';
        
    return {
      id: employeeId,
      name: fullName,
      email: email,
      role: userRole,
      designation: designation,
      birthDate: birthDate,
      joinDate: joinDate,
      avatar: avatarUrl,
      status: 'PRESENT',
      leaveBalance: 12,
      score: 0,
      branch: branch as any,
      password: password,
      rawRole: rawRoleFromAPI,
      department: department,
      function: functionValue,
      teamLead: teamLead,
    };
  };

  // Fetch designations and departments on mount (roles/branches from React Query)
  const fetchListData = async () => {
    setIsLoadingOptions(true);
    setError(null);
    try {
      const [designationsData, deptFuncData] = await Promise.all([
        apiGetDesignations().catch((e) => { console.error('❌ Designations fetch:', e); return []; }),
        apiGetDepartmentsandFunctions('Employee').catch((e) => { console.error('❌ Depts/functions fetch:', e); return null; }),
      ]);
      const validDesignations = Array.isArray(designationsData) ? designationsData.filter((d: any) => d != null && typeof d === 'string' && String(d).trim() !== '') : [];
      setDesignations(validDesignations);
      if (deptFuncData && typeof deptFuncData === 'object') {
        const validDepts = Array.isArray(deptFuncData.departments) ? deptFuncData.departments.filter((d: any) => d != null && typeof d === 'string' && String(d).trim() !== '') : [];
        const validFuncs = Array.isArray(deptFuncData.functions) ? deptFuncData.functions.filter((f: any) => f != null && typeof f === 'string' && String(f).trim() !== '') : [];
        setDepartments(validDepts);
        setFunctions(validFuncs);
      }
      optionsLoadedRef.current = true;
      setError(null);
    } catch (err: any) {
      console.error("❌ [ADMIN PANEL] Error fetching list data:", err);
      let errorMessage = err?.message || 'Failed to load data from server';
      if (err?.response?.status === 500) errorMessage = 'Server error. Please try again.';
      else if (err?.response?.status === 401 || err?.response?.status === 403) errorMessage = 'Authentication failed. Please login again.';
      else if (err?.response?.status === 404) errorMessage = 'Endpoint not found. Please verify the API.';
      if (errorMessage.includes('<')) errorMessage = errorMessage.replace(/<[^>]*>/g, '').trim();
      if (errorMessage.length > 300) errorMessage = errorMessage.substring(0, 300) + '...';
      setError(errorMessage);
    } finally {
      setIsLoadingOptions(false);
      hasLoadedOnceRef.current = true;
    }
  };

  // Fetch list data (employees + options) once on mount only — same pattern as AssetManager
  // Refetch only after add/update/delete mutations (see handleSubmit, handleSaveEdit, handleUpdateSidebarSubmit, delete handler)
  useEffect(() => {
    fetchListData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Store the actual file object
      setAvatarFile(file);
      
      // Also create preview for display
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Call the API to create employee
      await apiCreateEmployee({
        employeeId: formData.employeeId || `u${Date.now()}`,
        password: formData.password || '12345',
        fullName: formData.name,
        role: String(formData.role), // Use role value as-is from API
        designation: formData.designation,
        branch: formData.branch,
        department: formData.department,
        function: formData.function,
        teamLead: resolveTeamLeadToEmployeeId(formData.teamLead) || undefined,
        joiningDate: formData.joinDate,
        dateOfBirth: formData.birthDate,
        profilePicture: avatarFile, // Pass the actual File object, not base64
        emailAddress: formData.email,
      });

      // If API call succeeds, add user to local state
    const newUser: User = {
      id: formData.employeeId || `u${Date.now()}`,
      name: formData.name,
      email: formData.email,
      role: formData.role as UserRole,
      designation: formData.designation,
      birthDate: formData.birthDate,
      joinDate: formData.joinDate,
      avatar: avatarPreview || `https://ui-avatars.com/api/?name=${formData.name}&background=random`,
      status: 'PRESENT',
      leaveBalance: 12,
      score: 0,
      password: formData.password || '12345',
      branch: (formData.branch || undefined) as User['branch'],
    };
    onAddUser(newUser);
      
      // Reset form
    setFormData({
      employeeId: '',
      name: '',
      email: '',
      role: '',
      designation: '',
      birthDate: '',
      joinDate: new Date().toISOString().split('T')[0],
      password: '',
      branch: '',
      department: '',
      function: '',
      teamLead: '',
    });
    setAvatarPreview(null);
      setAvatarFile(null); // Clear the file object
    setActiveTab('list');
      alert("Employee created successfully!");
      
      // Refresh employees from API after creating
      setTimeout(() => {
        onRefreshEmployees?.();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Failed to create employee. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (userId: string) => {
      if (!newPassword) return;
      
      const user = displayUsers.find(u => u.id === userId);
      if (!user) return;

      const employeeId = (user as any).Employee_id ?? user.id;

      setIsLoading(true);
      setError(null);

      try {
        await apiAdminChangePassword(employeeId, newPassword);
        (user as any).password = newPassword;
        alert(`Password for ${user.name} has been updated successfully.`);
        setResetPasswordId(null);
        setNewPassword('');
      } catch (err: any) {
        setError(err?.message || 'Failed to update password. Please try again.');
      } finally {
        setIsLoading(false);
      }
  };

  const handleEditPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;
    const preview = URL.createObjectURL(file);
    setEditPhotoPreview(preview);
    setEditFormData(prev => ({ ...prev, profilePicture: file }));
    try {
      setIsLoading(true);
      setError(null);
      await apiChangePhoto(selectedUser.id, file);
      alert('Photo updated successfully!');
      setEditFormData(prev => ({ ...prev, profilePicture: null }));
      setSelectedUser(prev => prev ? { ...prev, avatar: preview } : null);
      await onRefreshEmployees?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update photo.');
    } finally {
      setIsLoading(false);
    }
    e.target.value = '';
  };

  const handleOpenEditSidebar = (user: User) => {
    const rawRole = (user as any).rawRole || String(user.role);
    const roleUpper = rawRole.toUpperCase().trim();
    const rawTeamLead = (user as any).teamLead || (user as any).Team_Lead || (user as any).Teamlead || '';
    let resolvedTeamLead = rawTeamLead;
    if (rawTeamLead) {
      const byId = users.find(u => String((u as any).Employee_id ?? u.id) === rawTeamLead);
      if (byId) resolvedTeamLead = String((byId as any).Employee_id ?? byId.id);
      else {
        const byName = users.find(u => String(u.name || '').trim() === String(rawTeamLead).trim());
        if (byName) resolvedTeamLead = String((byName as any).Employee_id ?? byName.id);
      }
    }
    setEditingUser(user);
    setUpdateSidebarFormData({
      name: user.name,
      email: user.email || '',
      role: rawRole,
      designation: user.designation || '',
      branch: user.branch || '',
      department: (user as any).department || '',
      function: (user as any).function || '',
      teamLead: resolvedTeamLead,
      joinDate: user.joinDate ? new Date(user.joinDate).toISOString().split('T')[0] : '',
      birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '',
      password: '',
    });
    setUpdateSidebarAvatarPreview(user.avatar || null);
    setUpdateSidebarAvatarFile(null);
    populateAllTeamLeads(); // Always show all team leads in edit employee panel
    if (roleUpper !== 'MD' && roleUpper !== 'ADMIN') {
      fetchDepartmentsAndFunctionsForRole(rawRole);
    }
  };

  const handleCloseEditSidebar = () => {
    setEditingUser(null);
    setUpdateSidebarFormData({
      name: '',
      email: '',
      role: '',
      designation: '',
      branch: '',
      department: '',
      function: '',
      teamLead: '',
      joinDate: '',
      birthDate: '',
      password: '',
    });
    setUpdateSidebarAvatarPreview(null);
    setUpdateSidebarAvatarFile(null);
  };

  const handleUpdateSidebarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const employeeIdForApi = (editingUser as any).Employee_id ?? editingUser.id;
      if (updateSidebarAvatarFile instanceof File) {
        await apiChangePhoto(employeeIdForApi, updateSidebarAvatarFile);
      }
      await apiUpdateProfile({
        employeeId: employeeIdForApi,
        password: updateSidebarFormData.password || undefined,
        fullName: updateSidebarFormData.name,
        role: updateSidebarFormData.role,
        designation: updateSidebarFormData.designation || undefined,
        branch: updateSidebarFormData.branch || undefined,
        department: updateSidebarFormData.department || undefined,
        function: updateSidebarFormData.function || undefined,
        teamLead: resolveTeamLeadToEmployeeId(updateSidebarFormData.teamLead) || undefined,
        joiningDate: updateSidebarFormData.joinDate,
        dateOfBirth: updateSidebarFormData.birthDate,
        profilePicture: null,
        emailAddress: updateSidebarFormData.email,
      });
      await onRefreshEmployees?.();
      handleCloseEditSidebar();
      alert('Employee updated successfully!');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update employee.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = () => {
    if (!selectedUser) return;
    const rawRole = (selectedUser as any).rawRole || String(selectedUser.role);
    setEditFormData({
      name: selectedUser.name,
      email: selectedUser.email || '',
      role: rawRole,
      designation: selectedUser.designation || '',
      branch: selectedUser.branch || '',
      department: (selectedUser as any).department || '',
      joinDate: selectedUser.joinDate ? new Date(selectedUser.joinDate).toISOString().split('T')[0] : '',
      birthDate: selectedUser.birthDate ? new Date(selectedUser.birthDate).toISOString().split('T')[0] : '',
      password: '',
      profilePicture: null,
    });
    setEditPhotoPreview(null);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditPhotoPreview(null);
    setEditFormData({
      name: '',
      email: '',
      role: '',
      designation: '',
      branch: '',
      department: '',
      joinDate: '',
      birthDate: '',
      password: '',
      profilePicture: null,
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    setError(null);

    try {
      if (editFormData.profilePicture instanceof File) {
        await apiChangePhoto(selectedUser.id, editFormData.profilePicture);
      }
      await apiUpdateProfile({
        employeeId: selectedUser.id,
        password: editFormData.password || undefined,
        fullName: editFormData.name,
        role: editFormData.role,
        designation: editFormData.designation || undefined,
        branch: editFormData.branch || undefined,
        department: editFormData.department || undefined,
        function: (selectedUser as any).function || undefined,
        teamLead: (selectedUser as any).teamLead || (selectedUser as any).Team_Lead || undefined,
        joiningDate: editFormData.joinDate,
        dateOfBirth: editFormData.birthDate,
        profilePicture: null,
        emailAddress: editFormData.email,
      });

      // Update the selected user in the list
      const branchValue = editFormData.branch as User['branch'];
      const updatedUser: User = {
        ...selectedUser,
        name: editFormData.name,
        email: editFormData.email,
        role: editFormData.role as UserRole,
        designation: editFormData.designation,
        branch: branchValue || undefined,
        joinDate: editFormData.joinDate,
        birthDate: editFormData.birthDate,
      };
      (updatedUser as any).rawRole = editFormData.role;
      (updatedUser as any).department = editFormData.department;

      setSelectedUser(updatedUser);
      setIsEditMode(false);
      setEditPhotoPreview(null);
      
      // Refresh employees from API
      setTimeout(() => {
        onRefreshEmployees?.();
      }, 500);
      
      alert('User profile updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update user profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSidebarAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpdateSidebarAvatarFile(file);
    const preview = URL.createObjectURL(file);
    setUpdateSidebarAvatarPreview(preview);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 p-4 flex flex-wrap items-center gap-3">
        <button 
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          User Management
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'add' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
        >
          <UserPlus size={18} />
          <span>Add Employee</span>
        </button>
        {activeTab === 'list' && (
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md ml-auto">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by employee name, email, or ID..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none bg-white"
              />
            </div>
            {userSearchQuery && (
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {filteredDisplayUsers.length} of {displayUsers.length}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold mb-1">⚠️ {error.includes('Permission Denied') || error.includes('403') ? 'Permission Error' : error.includes('Authentication') || error.includes('401') ? 'Authentication Error' : 'Error'}</p>
                <p className="text-sm">{error}</p>
              </div>
              <button
                onClick={() => {
                  setError(null);
                  if (error.includes('load data') || error.includes('fetch')) {
                    fetchListData();
                  }
                }}
                className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium whitespace-nowrap flex-shrink-0"
              >
                {(error.includes('load data') || error.includes('fetch')) ? 'Retry' : 'Dismiss'}
              </button>
            </div>
          </div>
        )}
        {activeTab === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-500 text-sm border-b border-gray-100">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Employee</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Designation</th>
                  <th className="pb-3 font-medium">Branch</th>
                  <th className="pb-3 font-medium">Department</th>
                  <th className="pb-3 font-medium">Function</th>
                  <th className="pb-3 font-medium">Team Lead</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Birth Date</th>
                  <th className="pb-3 font-medium">Joined</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredDisplayUsers.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center">
                      {error ? (
                        <div className="flex flex-col items-center space-y-2">
                          <span className="text-red-600 font-semibold">⚠️ Error loading employees</span>
                          <span className="text-sm text-gray-600 max-w-2xl px-4">{error}</span>
                        </div>
                      ) : userSearchQuery.trim() ? (
                        <span className="text-gray-500">No employees match &quot;{userSearchQuery.trim()}&quot;</span>
                      ) : (
                        <span className="text-gray-500">No employees found in the system.</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredDisplayUsers.map(user => {
                    // Ensure avatar URL is properly formatted
                    const avatarUrl = user.avatar && user.avatar.trim() 
                      ? (user.avatar.startsWith('http') || user.avatar.startsWith('data:') 
                          ? user.avatar 
                          : `https://employee-management-system-tmrl.onrender.com${user.avatar.startsWith('/') ? '' : '/'}${user.avatar}`)
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                    
                    return (
                  <tr 
                    key={user.id} 
                    className="group cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleOpenEditSidebar(user)}
                  >
                    <td className="py-3 text-sm text-gray-500 font-mono">{user.id}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center space-x-3">
                            <div className="relative flex-shrink-0">
                              <img 
                                src={avatarUrl} 
                                className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 shadow-sm" 
                                alt={user.name}
                                onError={(e) => {
                                  // Fallback to generated avatar if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  if (!target.src.includes('ui-avatars.com')) {
                                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                                  }
                                }}
                              />
                            </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-800 text-sm">{user.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <p className="text-xs text-gray-600">{user.email || 'N/A'}</p>
                    </td>
                    <td className="py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700">
                        {user.designation || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3">
                      <p className="text-xs text-gray-600">{user.branch || 'N/A'}</p>
                    </td>
                    <td className="py-3">
                      <p className="text-xs text-gray-600">{(user as any).department || 'N/A'}</p>
                    </td>
                    {/* Function Column */}
                    <td className="py-3">
                      <p className="text-xs text-gray-600">{(user as any).function || 'N/A'}</p>
                    </td>
                    {/* Team Lead Column */}
                    <td className="py-3">
                      <p className="text-xs text-gray-600">{(user as any).teamLead || (user as any).Team_Lead || 'N/A'}</p>
                    </td>
                    <td className="py-3">
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700">
                        {(user as any).rawRole || String(user.role) || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3">
                      <p className="text-xs text-gray-600">{user.birthDate || 'N/A'}</p>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col">
                        <p className="text-xs text-gray-600">{user.joinDate || 'N/A'}</p>
                        {user.numberOfDaysFromJoining && (
                          <p className="text-[10px] text-gray-400">{user.numberOfDaysFromJoining}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-xs text-gray-600">{user.status || 'PRESENT'}</span>
                      </span>
                    </td>
                    <td className="py-3 align-top">
                      <div className="flex items-start justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditSidebar(user);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Employee"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setResetPasswordId(user.id);
                                setNewPassword('');
                              }}
                              className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                              title="Reset Password"
                            >
                              <Key size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) return;
                                (async () => {
                                  try {
                                    setIsLoading(true);
                                    await apiDeleteEmployee(user.id);
                                    onDeleteUser(user.id);
                                    await onRefreshEmployees?.();
                                    if (selectedUser?.id === user.id) {
                                      setSelectedUser(null);
                                      setIsEditMode(false);
                                    }
                                    alert('User deleted successfully.');
                                  } catch (err: any) {
                                    alert(err.message || 'Failed to delete user. Please try again.');
                                  } finally {
                                    setIsLoading(false);
                                  }
                                })();
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                        </>
                      </div>
                    </td>
                  </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
            {/* Profile Image Upload */}
            <div className="flex flex-col items-center justify-center mb-6">
               <div className="relative group">
                 <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="text-gray-400" size={32} />
                    )}
                 </div>
                 <label className="absolute bottom-0 right-0 bg-brand-600 text-white p-2 rounded-full cursor-pointer hover:bg-brand-700 shadow-sm">
                    <Upload size={14} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                 </label>
               </div>
               <p className="text-xs text-gray-500 mt-2">Upload Profile Picture</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Employee ID</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input required type="text" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="EMP-001" value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input required type="text" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input required type="email" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="john@nexus.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>

               <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Initial Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input required type="text" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="Create password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Role</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-3 text-gray-400" size={18} />
                  <select 
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" 
                    value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                    disabled={isLoadingOptions}
                  >
                    <option value="">Select Role</option>
                    {Array.isArray(roles) && roles.length > 0 ? (
                      roles
                        .filter(r => r != null && typeof r === 'string' && r.trim() !== '')
                        .map((role, index) => (
                          <option key={`role-api-${String(role)}-${index}`} value={String(role)}>
                            {formatRoleForDisplay(String(role))}
                          </option>
                        ))
                    ) : (
                      !isLoadingOptions && Object.values(UserRole).map((role, index) => (
                        <option key={`role-enum-${role}-${index}`} value={role}>{role}</option>
                      ))
                    )}
                  </select>
                </div>
                {isLoadingOptions && <p className="text-xs text-gray-500">Loading roles...</p>}
                {!isLoadingOptions && roles.length === 0 && <p className="text-xs text-yellow-600">No roles found. Using default roles.</p>}
              </div>

              {/* Designation - Optional, hidden when MD role is selected */}
              {formData.role && String(formData.role).toUpperCase().trim() !== 'MD' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Designation</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" 
                    value={formData.designation} 
                    onChange={e => setFormData({...formData, designation: e.target.value})}
                    disabled={isLoadingOptions}
                  >
                    <option value="">Select Designation</option>
                    {Array.isArray(designations) && designations.length > 0 ? (
                      designations
                        .filter(d => d != null && typeof d === 'string' && d.trim() !== '')
                        .map((designation) => (
                          <option key={`designation-${String(designation)}`} value={String(designation)}>
                            {String(designation)}
                          </option>
                        ))
                    ) : (
                      !isLoadingOptions && <option disabled>No designations available</option>
                    )}
                  </select>
                  {isLoadingOptions && <p className="text-xs text-gray-500">Loading designations...</p>}
                  {!isLoadingOptions && designations.length === 0 && <p className="text-xs text-yellow-600">No designations found. Check console for errors.</p>}
                </div>
              )}

              {/* Branch - Optional, hidden when MD role is selected */}
              {formData.role && String(formData.role).toUpperCase().trim() !== 'MD' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Branch</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-gray-400" size={18} />
                    <select 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" 
                      value={formData.branch} 
                      onChange={e => setFormData({...formData, branch: e.target.value})}
                      disabled={isLoadingOptions}
                    >
                      <option value="">Select Branch</option>
                      {Array.isArray(branches) && branches.length > 0 ? (
                        branches
                          .filter(b => b != null && typeof b === 'string' && b.trim() !== '')
                          .map((branch) => (
                            <option key={`branch-${String(branch)}`} value={String(branch)}>
                              {String(branch)}
                            </option>
                          ))
                      ) : (
                        !isLoadingOptions && <option disabled>No branches available</option>
                      )}
                    </select>
                  </div>
                  {isLoadingOptions && <p className="text-xs text-gray-500">Loading branches...</p>}
                  {!isLoadingOptions && branches.length === 0 && <p className="text-xs text-yellow-600">No branches found. Check console for errors.</p>}
                </div>
              )}

              {/* Department - Optional, hidden when MD role is selected */}
              {formData.role && String(formData.role).toUpperCase().trim() !== 'MD' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Department</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 text-gray-400" size={18} />
                    <select 
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" 
                      value={formData.department} 
                      onChange={e => setFormData({...formData, department: e.target.value})}
                      disabled={isLoadingOptions}
                    >
                      <option value="">Select Department</option>
                      {Array.isArray(departments) && departments.length > 0 ? (
                        departments
                          .filter(d => d != null && typeof d === 'string' && d.trim() !== '')
                          .map((department) => (
                            <option key={`department-${String(department)}`} value={String(department)}>
                              {String(department)}
                            </option>
                          ))
                      ) : (
                        !isLoadingOptions && <option disabled>No departments available</option>
                      )}
                    </select>
                  </div>
                  {isLoadingOptions && <p className="text-xs text-gray-500">Loading departments...</p>}
                  {!isLoadingOptions && departments.length === 0 && <p className="text-xs text-yellow-600">No departments found. Check console for errors.</p>}
                </div>
              )}

              {/* Function - Optional, hidden when MD role is selected */}
              {formData.role && String(formData.role).toUpperCase().trim() !== 'MD' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Function</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 text-gray-400" size={18} />
                    <select
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                      value={formData.function}
                      onChange={e => setFormData({...formData, function: e.target.value})}
                      disabled={isLoadingOptions}
                    >
                      <option value="">Select Function</option>
                      {Array.isArray(functions) && functions.length > 0 ? (
                        functions
                          .filter(f => f != null && typeof f === 'string' && f.trim() !== '')
                          .map((func) => (
                            <option key={`function-${String(func)}`} value={String(func)}>
                              {String(func)}
                            </option>
                          ))
                      ) : (
                        !isLoadingOptions && <option disabled>No functions available</option>
                      )}
                    </select>
                  </div>
                  {isLoadingOptions && <p className="text-xs text-gray-500">Loading functions...</p>}
                  {!isLoadingOptions && functions.length === 0 && <p className="text-xs text-yellow-600">No functions found. Check console for errors.</p>}
                </div>
              )}

              {/* Team Lead - Optional, only shown for Employee and Intern roles */}
              {formData.role && (String(formData.role).toUpperCase().trim() === 'EMPLOYEE' || String(formData.role).toUpperCase().trim() === 'INTERN') && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Team Lead</label>
                  <div className="relative">
                    <UsersIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                    <select
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                      value={formData.teamLead}
                      onChange={e => setFormData({...formData, teamLead: e.target.value})}
                    >
                      <option value="">Select Team Lead</option>
                      {Array.isArray(teamLeads) && teamLeads.length > 0 ? (
                        teamLeads.map((teamLead) => (
                          <option key={`teamlead-${teamLead.Employee_id}`} value={teamLead.Employee_id}>
                            {teamLead.Name}
                          </option>
                        ))
                      ) : (
                        <option disabled>No team leads available</option>
                      )}
                    </select>
                  </div>
                  {teamLeads.length === 0 && formData.role && (
                    <p className="text-xs text-gray-500">No team leads in employees list.</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Date of Birth</label>
                <input required type="date" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Joining Date</label>
                <input required type="date" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" value={formData.joinDate} onChange={e => setFormData({...formData, joinDate: e.target.value})} />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
               <button type="button" onClick={() => setActiveTab('list')} disabled={isLoading} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg mr-2 disabled:opacity-50">Cancel</button>
               <button type="submit" disabled={isLoading} className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium shadow-sm disabled:opacity-50 flex items-center space-x-2">
                 {isLoading ? (
                   <>
                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     <span>Creating...</span>
                   </>
                 ) : (
                   <span>Add Employee</span>
                 )}
               </button>
            </div>
          </form>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetPasswordId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-white rounded-xl p-6 w-96 shadow-2xl animate-float">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Change Password</h3>
                  <p className="text-sm text-gray-500 mb-4">Enter new password for selected user.</p>
                  
                  <input 
                      type="text" 
                      autoFocus
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                  />
                  
                  <div className="flex justify-end space-x-2">
                      <button onClick={() => { setResetPasswordId(null); setNewPassword(''); }} disabled={isLoading} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancel</button>
                      <button onClick={() => handlePasswordReset(resetPasswordId)} disabled={isLoading || !newPassword} className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center space-x-2">
                        {isLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span>Save</span>
                        )}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Update Employee Sidebar - opens when pencil clicked or row clicked */}
      {editingUser && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 backdrop-blur-sm"
            onClick={handleCloseEditSidebar}
          />
          <div className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[95vw] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Update Employee</h2>
              <button onClick={handleCloseEditSidebar} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateSidebarSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                    {updateSidebarAvatarPreview ? (
                      <img src={updateSidebarAvatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="text-gray-400" size={28} />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-brand-600 text-white p-1.5 rounded-full cursor-pointer hover:bg-brand-700 shadow-sm">
                    <Upload size={12} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleUpdateSidebarAvatarChange} />
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-1">Change Photo</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Full Name *</label>
                <input required type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="John Doe" value={updateSidebarFormData.name} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Email *</label>
                <input required type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="john@example.com" value={updateSidebarFormData.email} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Role *</label>
                <select required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" value={updateSidebarFormData.role} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, role: e.target.value }))}>
                  {roles.map((r) => <option key={r} value={r}>{formatRoleForDisplay(r)}</option>)}
                  {updateSidebarFormData.role && !roles.includes(updateSidebarFormData.role) && <option value={updateSidebarFormData.role}>{updateSidebarFormData.role}</option>}
                </select>
              </div>
              {updateSidebarFormData.role && String(updateSidebarFormData.role).toUpperCase().trim() !== 'MD' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Designation</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" value={updateSidebarFormData.designation} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, designation: e.target.value }))}>
                      <option value="">Select Designation</option>
                      {designations.map((d) => <option key={d} value={d}>{d}</option>)}
                      {updateSidebarFormData.designation && !designations.includes(updateSidebarFormData.designation) && <option value={updateSidebarFormData.designation}>{updateSidebarFormData.designation}</option>}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Branch</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" value={updateSidebarFormData.branch} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, branch: e.target.value }))}>
                      <option value="">Select Branch</option>
                      {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                      {updateSidebarFormData.branch && !branches.includes(updateSidebarFormData.branch) && <option value={updateSidebarFormData.branch}>{updateSidebarFormData.branch}</option>}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Department</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" value={updateSidebarFormData.department} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, department: e.target.value }))}>
                      <option value="">Select Department</option>
                      {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                      {updateSidebarFormData.department && !departments.includes(updateSidebarFormData.department) && <option value={updateSidebarFormData.department}>{updateSidebarFormData.department}</option>}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Function</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" value={updateSidebarFormData.function} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, function: e.target.value }))}>
                      <option value="">Select Function</option>
                      {functions.map((f) => <option key={f} value={f}>{f}</option>)}
                      {updateSidebarFormData.function && !functions.includes(updateSidebarFormData.function) && <option value={updateSidebarFormData.function}>{updateSidebarFormData.function}</option>}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Team Lead</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white" value={updateSidebarFormData.teamLead} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, teamLead: e.target.value }))}>
                      <option value="">Select Team Lead</option>
                      {teamLeads.map((tl) => <option key={tl.Employee_id} value={tl.Employee_id}>{tl.Name}</option>)}
                      {updateSidebarFormData.teamLead && !teamLeads.some(t => t.Employee_id === updateSidebarFormData.teamLead) && <option value={updateSidebarFormData.teamLead}>Current: {updateSidebarFormData.teamLead}</option>}
                    </select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Date of Birth *</label>
                <input required type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" value={updateSidebarFormData.birthDate} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, birthDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Joining Date *</label>
                <input required type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" value={updateSidebarFormData.joinDate} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, joinDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">New Password (optional)</label>
                <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none" placeholder="Leave blank to keep current" value={updateSidebarFormData.password} onChange={e => setUpdateSidebarFormData(prev => ({ ...prev, password: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={handleCloseEditSidebar} disabled={isLoading} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Updating...</span></> : <span>Update</span>}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* User Profile Sidebar */}
      {selectedUser && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 backdrop-blur-sm"
            onClick={() => {
              setSelectedUser(null);
              setIsEditMode(false);
            }}
          />
          
          {/* Sidebar */}
          <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
            {/* Header - Dark Theme with avatar */}
            <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-slate-700">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 shadow-sm flex-shrink-0"
                    alt={selectedUser.name}
                    src={selectedUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name)}&background=random`}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-white truncate">{selectedUser.name}</h2>
                    <p className="text-white/90 font-semibold mt-1 text-sm">
                    {(() => {
                      const rawRole = (selectedUser as any).rawRole;
                      return rawRole ? String(rawRole) : 'N/A';
                    })()}
                  </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setIsEditMode(false);
                  }}
                  className="text-white/70 hover:text-white bg-white/10 rounded-full p-2 shadow-sm ml-2 flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {/* Employee ID - Read Only (plain text, no card) */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Employee ID
                  </p>
                  <p className="text-lg font-bold text-gray-800 mt-1">
                    {selectedUser.id}
                  </p>
                </div>

                {/* Profile Photo */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Profile Photo</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative inline-block">
                      <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {editPhotoPreview ? (
                          <img src={editPhotoPreview} alt="New" className="w-full h-full object-cover" />
                        ) : selectedUser.avatar ? (
                          <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                        ) : (
                          <Camera className="text-gray-400" size={24} />
                        )}
                      </div>
                      {isEditMode && (
                        <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-700 shadow border-2 border-white z-10">
                          <Plus size={14} strokeWidth={2.5} />
                          <input type="file" className="hidden" accept="image/*" onChange={handleEditPhotoChange} />
                        </label>
                      )}
                    </div>
                    {isEditMode && (
                      <label className="inline-flex items-center gap-2 px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 cursor-pointer text-sm font-medium whitespace-nowrap">
                        <Upload size={16} className="flex-shrink-0" />
                        Select new photo
                        <input type="file" className="hidden" accept="image/*" onChange={handleEditPhotoChange} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</p>
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {selectedUser.name}
                    </p>
                  )}
                </div>

                {/* Designation */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Designation</p>
                  {isEditMode ? (
                    <select
                      value={editFormData.designation}
                      onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                    >
                      <option value="">Select Designation</option>
                      {designations.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      {editFormData.designation && !designations.includes(editFormData.designation) && (
                        <option value={editFormData.designation}>{editFormData.designation}</option>
                      )}
                    </select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {selectedUser.designation || 'N/A'}
                    </p>
                  )}
                </div>

                    {/* Role */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</p>
                  {isEditMode ? (
                    <select
                      value={editFormData.role}
                      onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {(() => {
                        const rawRole = (selectedUser as any).rawRole;
                        return rawRole ? String(rawRole) : 'N/A';
                      })()}
                    </p>
                  )}
                </div>

                {/* Team / Branch */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Team / Branch</p>
                  {isEditMode ? (
                    <select
                      value={editFormData.branch}
                      onChange={(e) => setEditFormData({ ...editFormData, branch: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      <option value="">Select Branch</option>
                      {branches.map((branch) => (
                        <option key={branch} value={branch}>
                          {branch}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {selectedUser.branch ? String(selectedUser.branch).replace('_', ' ') : 'N/A'}
                    </p>
                  )}
                </div>

                {/* Joining Date */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Joining Date</p>
                  {isEditMode ? (
                    <input
                      type="date"
                      value={editFormData.joinDate}
                      onChange={(e) => setEditFormData({ ...editFormData, joinDate: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {selectedUser.joinDate
                        ? new Date(selectedUser.joinDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                  )}
                </div>

                {/* Days From Joining */}
                {!isEditMode &&
                  selectedUser.numberOfDaysFromJoining !== undefined &&
                  selectedUser.numberOfDaysFromJoining !== null &&
                  selectedUser.numberOfDaysFromJoining !== '' && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Days From Joining
                      </p>
                      <p className="text-lg font-semibold text-gray-800 mt-1">
                        {selectedUser.numberOfDaysFromJoining}
                      </p>
                    </div>
                  )}

                {/* Birthdate */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Birthdate</p>
                  {isEditMode ? (
                    <input
                      type="date"
                      value={editFormData.birthDate}
                      onChange={(e) => setEditFormData({ ...editFormData, birthDate: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {selectedUser.birthDate
                        ? new Date(selectedUser.birthDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email Address</p>
                  {isEditMode ? (
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  ) : (
                    <p className="text-lg font-semibold text-gray-800 mt-1">
                      {selectedUser.email || 'N/A'}
                    </p>
                  )}
                </div>

                {/* Password (only in edit mode) */}
                {isEditMode && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      New Password (Optional)
                    </p>
                    <input
                      type="password"
                      value={editFormData.password}
                      onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                      placeholder="Leave empty to keep current password"
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              {isEditMode ? (
                <div className="flex space-x-2">
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save</span>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleEditClick}
                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setIsEditMode(false);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Re-render only when users data changes (add/update/delete), not on every parent re-render or click
export const AdminPanel = React.memo(AdminPanelInner, (prev, next) =>
  prev.users === next.users && prev.onRefreshEmployees === next.onRefreshEmployees
);