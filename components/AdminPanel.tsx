
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, formatRoleForDisplay } from '../types';
import { UserPlus, Trash2, Shield, Calendar, Mail, User as UserIcon, Upload, Hash, Camera, Lock, Key, Building2, X, Briefcase, Users as UsersIcon, Pencil, Check, XCircle, Clock, Plus } from 'lucide-react';
import api, { 
  getDesignations as apiGetDesignations,
  getBranch as apiGetBranch,
  getDepartmentsandFunctions as apiGetDepartmentsandFunctions,
  getTeamleads as apiGetTeamleads,
  getRoles as apiGetRoles,
  createEmployee as apiCreateEmployee,
  updateProfile as apiUpdateProfile,
  changePhoto as apiChangePhoto,
  deleteEmployee as apiDeleteEmployee
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

  // Inline editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [inlineEditData, setInlineEditData] = useState<Record<string, {
    name: string;
    email: string;
    role: string;
    designation: string;
    branch: string;
    department: string;
    function: string;
    joinDate: string;
    birthDate: string;
  }>>({});

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
  const [isLoadingTeamLeads, setIsLoadingTeamLeads] = useState(false);
  const optionsLoadedRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  // Fetch designations, branches, and roles function (departments fetched separately based on role)
  const fetchDesignationsAndBranches = async () => {
    setIsLoadingOptions(true);
    try {
      const [designationsData, branchesData, rolesData] = await Promise.all([
        apiGetDesignations().catch((err) => { console.error('❌ Designations fetch error:', err); return []; }),
        apiGetBranch().catch((err) => { console.error('❌ Branch fetch error:', err); return []; }),
        apiGetRoles().catch((err) => { console.error('❌ Roles fetch error:', err); return []; })
      ]);
      
      // Filter and sanitize designations - only keep valid strings
      const validDesignations = Array.isArray(designationsData) 
        ? designationsData.filter(d => d != null && typeof d === 'string' && d.trim() !== '')
        : [];
      
      // Filter and sanitize branches - only keep valid strings
      const validBranches = Array.isArray(branchesData)
        ? branchesData.filter(b => b != null && typeof b === 'string' && b.trim() !== '')
        : [];
      
      // Filter and sanitize roles - only keep valid strings
      const validRoles = Array.isArray(rolesData)
        ? rolesData.filter(r => r != null && typeof r === 'string' && r.trim() !== '')
        : [];
      
      setDesignations(validDesignations);
      setBranches(validBranches);
      setRoles(validRoles);
      optionsLoadedRef.current = true;
    } catch (err: any) {
      console.error('❌ [ADMIN PANEL] Error fetching options:', err);
      setDesignations([]);
      setBranches([]);
      setRoles([]);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  // Fetch team leads based on selected role
  const fetchTeamLeadsForRole = async (role: string) => {
    // Only fetch team leads for Employee and Intern roles
    const normalizedRole = String(role).trim().toUpperCase();
    if (normalizedRole !== 'EMPLOYEE' && normalizedRole !== 'INTERN') {
      setTeamLeads([]);
      setFormData(prev => ({ ...prev, teamLead: '' })); // Clear team lead selection
      return;
    }

    setIsLoadingTeamLeads(true);
    try {
      const teamLeadsData = await apiGetTeamleads(role);
      setTeamLeads(teamLeadsData || []);
    } catch (error: any) {
      console.error('❌ [ADMIN] Error fetching team leads:', error);
      setTeamLeads([]);
      setError('Failed to load team leads. Please try again.');
    } finally {
      setIsLoadingTeamLeads(false);
    }
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
      
      // Fetch team leads for Employee and Intern roles
      if (roleStr === 'EMPLOYEE' || roleStr === 'INTERN') {
        fetchTeamLeadsForRole(String(formData.role));
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
  }, [formData.role]);

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
        const teamLead = emp['Team_Lead'] || emp.teamLead || emp['Team Lead'] || emp['TeamLead'] || '';
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
        
        // Normalize team leader variations: "Team lead", "Team Leader", "TEAM LEADER", "TEAM_LEADER", etc.
        const normalizedRole = roleUpper.replace(/[_\s]+/g, '_'); // Replace spaces/underscores with single underscore
        
        if (roleUpper === 'MD') userRole = UserRole.MD;
        else if (roleUpper === 'ADMIN') userRole = UserRole.ADMIN;
        else if (normalizedRole === 'TEAM_LEADER' || 
                 normalizedRole === 'TEAMLEADER' ||
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

  // Fetch options only on mount (employees come from shared users via props)
  const fetchListData = async () => {
    setIsLoadingOptions(true);
    setError(null);
    try {
      const [designationsData, branchesData, rolesData, deptFuncData] = await Promise.all([
        apiGetDesignations().catch((e) => { console.error('❌ Designations fetch:', e); return []; }),
        apiGetBranch().catch((e) => { console.error('❌ Branch fetch:', e); return []; }),
        apiGetRoles().catch((e) => { console.error('❌ Roles fetch:', e); return []; }),
        apiGetDepartmentsandFunctions('Employee').catch((e) => { console.error('❌ Depts/functions fetch:', e); return null; }),
      ]);
      const validDesignations = Array.isArray(designationsData) ? designationsData.filter((d: any) => d != null && typeof d === 'string' && String(d).trim() !== '') : [];
      const validBranches = Array.isArray(branchesData) ? branchesData.filter((b: any) => b != null && typeof b === 'string' && String(b).trim() !== '') : [];
      const validRoles = Array.isArray(rolesData) ? rolesData.filter((r: any) => r != null && typeof r === 'string' && String(r).trim() !== '') : [];
      setDesignations(validDesignations);
      setBranches(validBranches);
      setRoles(validRoles);
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
  // Refetch only after add/update/delete mutations (see handleSubmit, handleSaveEdit, handleSaveInlineEdit, delete handler)
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
        teamLead: formData.teamLead || undefined, // Include teamLead if selected
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

      setIsLoading(true);
      setError(null);

      try {
        // Update profile with new password
        // Pass null for profilePicture since we're only updating password
        // Backend will keep existing photo if no file is provided
        await apiUpdateProfile({
          employeeId: user.id,
          password: newPassword,
          fullName: user.name,
          role: String(user.role), // Convert to string
          designation: user.designation,
          branch: user.branch || '',
          department: (user as any).department || '',
          joiningDate: user.joinDate,
          dateOfBirth: user.birthDate,
          profilePicture: null, // Don't send URL string - backend expects File or null
          emailAddress: user.email,
        });

          user.password = newPassword; 
        alert(`Password for ${user.name} has been updated successfully.`);
          setResetPasswordId(null);
          setNewPassword('');
      } catch (err: any) {
        setError(err.message || 'Failed to update password. Please try again.');
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

  const handleTablePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, user: User) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsLoading(true);
      setError(null);
      await apiChangePhoto(user.id, file);
      alert('Photo updated successfully!');
      await onRefreshEmployees?.();
    } catch (err: any) {
      setError(err.message || 'Failed to update photo.');
    } finally {
      setIsLoading(false);
    }
    e.target.value = '';
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
        designation: editFormData.designation,
        branch: editFormData.branch,
        department: editFormData.department,
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

  // Inline editing handlers
  const handleStartInlineEdit = (user: User) => {
    setEditingUserId(user.id);
    setInlineEditData({
      [user.id]: {
        name: user.name,
        email: user.email || '',
        role: (user as any).rawRole || String(user.role),
        designation: user.designation || '',
        branch: user.branch || '',
        department: (user as any).department || '',
        function: (user as any).function || '',
        joinDate: user.joinDate ? new Date(user.joinDate).toISOString().split('T')[0] : '',
        birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '',
      }
    });
    
    // Fetch departments for the user's role
    const userRole = (user as any).rawRole || String(user.role);
    const roleUpper = userRole.toUpperCase().trim();
    if (roleUpper !== 'MD' && roleUpper !== 'ADMIN') {
      fetchDepartmentsAndFunctionsForRole(userRole);
    } else {
      setDepartments([]);
      setFunctions([]);
    }
  };

  const handleCancelInlineEdit = () => {
    setEditingUserId(null);
    setInlineEditData({});
  };

  const handleSaveInlineEdit = async (userId: string) => {
    const editData = inlineEditData[userId];
    if (!editData) return;

    const user = displayUsers.find(u => u.id === userId);
    if (!user) return;

    // Validate required fields
    if (!editData.name || !editData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!editData.email || !editData.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!editData.role || !editData.role.trim()) {
      setError('Role is required');
      return;
    }
    if (!editData.joinDate) {
      setError('Joining date is required');
      return;
    }
    if (!editData.birthDate) {
      setError('Birth date is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiUpdateProfile({
        employeeId: userId,
        fullName: editData.name.trim(),
        role: editData.role.trim(),
        designation: editData.designation?.trim() || '',
        branch: editData.branch?.trim() || '',
        department: editData.department?.trim() || '',
        joiningDate: editData.joinDate,
        dateOfBirth: editData.birthDate,
        profilePicture: null, // Don't update photo in inline edit
        emailAddress: editData.email.trim(),
      });

      // Refresh employees from API
      await onRefreshEmployees?.();
      
      setEditingUserId(null);
      setInlineEditData({});
      
      alert('Employee updated successfully!');
    } catch (err: any) {
      // Handle specific error cases
      let errorMessage = 'Failed to update employee. Please try again.';
      
      if (err.response?.status === 403) {
        errorMessage = 'Permission Denied: You do not have permission to update employee profiles. Only ADMIN or MD roles can update employee data.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication Error: Please login again.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Employee not found. The employee may have been deleted.';
      } else if (err.response?.status === 400) {
        errorMessage = err.response?.data?.message || err.response?.data?.error || 'Invalid data. Please check all fields and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      // Keep the row in edit mode so user can fix and retry
    } finally {
      setIsLoading(false);
    }
  };

  const updateInlineEditField = (userId: string, field: string, value: string) => {
    setInlineEditData(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      }
    }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 p-4 flex space-x-4">
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
                {displayUsers.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center">
                      {error ? (
                        <div className="flex flex-col items-center space-y-2">
                          <span className="text-red-600 font-semibold">⚠️ Error loading employees</span>
                          <span className="text-sm text-gray-600 max-w-2xl px-4">{error}</span>
                        </div>
                      ) : (
                        <span className="text-gray-500">No employees found in the system.</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  displayUsers.map(user => {
                    // Ensure avatar URL is properly formatted
                    const avatarUrl = user.avatar && user.avatar.trim() 
                      ? (user.avatar.startsWith('http') || user.avatar.startsWith('data:') 
                          ? user.avatar 
                          : `https://employee-management-system-tmrl.onrender.com${user.avatar.startsWith('/') ? '' : '/'}${user.avatar}`)
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                    
                    return (
                  <tr 
                    key={user.id} 
                    className={`group ${editingUserId === user.id ? 'bg-blue-50' : ''}`}
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
                              {editingUserId === user.id && (
                                <label
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-brand-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-700 shadow border-2 border-white z-10"
                                  title="Change photo"
                                >
                                  <Plus size={10} strokeWidth={2.5} />
                                  <input type="file" className="hidden" accept="image/*" onChange={(ev) => handleTablePhotoChange(ev, user)} />
                                </label>
                              )}
                            </div>
                        <div className="flex-1">
                          {editingUserId === user.id ? (
                            <input
                              type="text"
                              value={inlineEditData[user.id]?.name || user.name}
                              onChange={(e) => updateInlineEditField(user.id, 'name', e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                            />
                          ) : (
                            <p className="font-bold text-gray-800 text-sm">{user.name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3" onClick={(e) => editingUserId === user.id && e.stopPropagation()}>
                      {editingUserId === user.id ? (
                        <input
                          type="email"
                          value={inlineEditData[user.id]?.email || user.email || ''}
                          onChange={(e) => updateInlineEditField(user.id, 'email', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                      ) : (
                        <p className="text-xs text-gray-600">{user.email || 'N/A'}</p>
                      )}
                    </td>
                    <td className="py-3" onClick={(e) => editingUserId === user.id && e.stopPropagation()}>
                      {editingUserId === user.id ? (
                        <select
                          value={inlineEditData[user.id]?.designation || user.designation || ''}
                          onChange={(e) => updateInlineEditField(user.id, 'designation', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        >
                          <option value="">Select Designation</option>
                          {designations.map((designation) => (
                            <option key={designation} value={designation}>{designation}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700">
                          {user.designation || 'N/A'}
                        </span>
                      )}
                    </td>
                    <td className="py-3" onClick={(e) => editingUserId === user.id && e.stopPropagation()}>
                      {editingUserId === user.id ? (
                        <select
                          value={inlineEditData[user.id]?.branch || user.branch || ''}
                          onChange={(e) => updateInlineEditField(user.id, 'branch', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        >
                          <option value="">Select Branch</option>
                          {branches.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-gray-600">{user.branch || 'N/A'}</p>
                      )}
                    </td>
                    <td className="py-3" onClick={(e) => editingUserId === user.id && e.stopPropagation()}>
                      {editingUserId === user.id ? (
                        <select
                          value={inlineEditData[user.id]?.department || (user as any).department || ''}
                          onChange={(e) => updateInlineEditField(user.id, 'department', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        >
                          <option value="">Select Department</option>
                          {departments.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-gray-600">{(user as any).department || 'N/A'}</p>
                      )}
                    </td>
                    {/* Function Column */}
                    <td className="py-3" onClick={(e) => editingUserId === user.id && e.stopPropagation()}>
                      {editingUserId === user.id ? (
                        <select
                          value={inlineEditData[user.id]?.function || (user as any).function || ''}
                          onChange={(e) => updateInlineEditField(user.id, 'function', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        >
                          <option value="">Select Function</option>
                          {functions.map((func) => (
                            <option key={func} value={func}>{func}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-gray-600">{(user as any).function || 'N/A'}</p>
                      )}
                    </td>
                    {/* Team Lead Column */}
                    <td className="py-3" onClick={(e) => editingUserId === user.id && e.stopPropagation()}>
                      <p className="text-xs text-gray-600">{(user as any).teamLead || (user as any).Team_Lead || 'N/A'}</p>
                    </td>
                    <td className="py-3" onClick={(e) => editingUserId === user.id && e.stopPropagation()}>
                      {editingUserId === user.id ? (
                        <select
                          value={inlineEditData[user.id]?.role || (user as any).rawRole || String(user.role)}
                          onChange={(e) => updateInlineEditField(user.id, 'role', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700">
                          {(user as any).rawRole || String(user.role) || 'N/A'}
                        </span>
                      )}
                    </td>
                    <td className="py-3" onClick={(e) => editingUserId === user.id && e.stopPropagation()}>
                      {editingUserId === user.id ? (
                        <input
                          type="date"
                          value={inlineEditData[user.id]?.birthDate || (user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : '')}
                          onChange={(e) => updateInlineEditField(user.id, 'birthDate', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                      ) : (
                        <p className="text-xs text-gray-600">{user.birthDate || 'N/A'}</p>
                      )}
                    </td>
                    <td className="py-3" onClick={(e) => editingUserId === user.id && e.stopPropagation()}>
                      {editingUserId === user.id ? (
                        <input
                          type="date"
                          value={inlineEditData[user.id]?.joinDate || (user.joinDate ? new Date(user.joinDate).toISOString().split('T')[0] : '')}
                          onChange={(e) => updateInlineEditField(user.id, 'joinDate', e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        />
                      ) : (
                        <div className="flex flex-col">
                          <p className="text-xs text-gray-600">{user.joinDate || 'N/A'}</p>
                          {user.numberOfDaysFromJoining && (
                            <p className="text-[10px] text-gray-400">{user.numberOfDaysFromJoining}</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-xs text-gray-600">{user.status || 'PRESENT'}</span>
                      </span>
                    </td>
                    <td className="py-3 align-top">
                      <div className="flex items-start justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        {editingUserId === user.id ? (
                          <>
                            <button
                              onClick={() => handleSaveInlineEdit(user.id)}
                              disabled={isLoading}
                              className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Save Changes"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={handleCancelInlineEdit}
                              disabled={isLoading}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartInlineEdit(user);
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
                        )}
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
                            {String(role)}
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

              {/* Designation - Hidden when MD role is selected */}
              {formData.role && String(formData.role).toUpperCase().trim() !== 'MD' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Designation</label>
                  <select 
                    required
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

              {/* Branch - Hidden when MD role is selected */}
              {formData.role && String(formData.role).toUpperCase().trim() !== 'MD' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Branch</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-gray-400" size={18} />
                    <select 
                      required
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

              {/* Department - Hidden when MD role is selected */}
              {formData.role && String(formData.role).toUpperCase().trim() !== 'MD' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Department</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 text-gray-400" size={18} />
                    <select 
                      required
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

              {/* Function - Hidden when MD role is selected */}
              {formData.role && String(formData.role).toUpperCase().trim() !== 'MD' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Function</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 text-gray-400" size={18} />
                    <select
                      required
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

              {/* Team Lead - Only shown for Employee and Intern roles */}
              {formData.role && (String(formData.role).toUpperCase().trim() === 'EMPLOYEE' || String(formData.role).toUpperCase().trim() === 'INTERN') && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Team Lead</label>
                  <div className="relative">
                    <UsersIcon className="absolute left-3 top-3 text-gray-400" size={18} />
                    <select
                      required
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                      value={formData.teamLead}
                      onChange={e => setFormData({...formData, teamLead: e.target.value})}
                      disabled={isLoadingTeamLeads}
                    >
                      <option value="">Select Team Lead</option>
                      {Array.isArray(teamLeads) && teamLeads.length > 0 ? (
                        teamLeads.map((teamLead) => (
                          <option key={`teamlead-${teamLead.Employee_id}`} value={teamLead.Employee_id}>
                            {teamLead.Name}
                          </option>
                        ))
                      ) : (
                        !isLoadingTeamLeads && <option disabled>No team leads available</option>
                      )}
                    </select>
                  </div>
                  {isLoadingTeamLeads && <p className="text-xs text-gray-500">Loading team leads...</p>}
                  {!isLoadingTeamLeads && teamLeads.length === 0 && formData.role && (
                    <p className="text-xs text-yellow-600">No team leads found. Check console for errors.</p>
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
                    <input
                      type="text"
                      value={editFormData.designation}
                      onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
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