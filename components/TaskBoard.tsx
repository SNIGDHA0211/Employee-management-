
import React, { useState, useEffect } from 'react';
import { Task, TaskType, TaskStatus, User, UserRole, Project } from '../types';
import { AlertCircle, Calendar, CheckCircle2, Clock, MoreVertical, Plus, Search, Send, Upload, Sparkles, User as UserIcon, Users as UsersIcon, Filter, Info, ChevronDown } from 'lucide-react';
import { getTaskAssistance } from '../services/gemini';
import api, { 
  getRoles as apiGetRoles,
  getDesignations as apiGetDesignations,
  getBranch as apiGetBranch,
  getEmployees as apiGetEmployees,
  createTask as apiCreateTask,
  viewTasks as apiViewTasks,
  viewAssignedTasks as apiViewAssignedTasks,
  getTaskTypes as apiGetTaskTypes,
  getNamesFromRoleAndDesignation as apiGetNamesFromRoleAndDesignation,
  sendTaskMessage as apiSendTaskMessage,
  getTaskMessages as apiGetTaskMessages,
  changeTaskStatus as apiChangeTaskStatus
} from '../services/api';
import { convertApiTasksToTasks } from '../utils/taskConversion';

interface TaskBoardProps {
  currentUser: User;
  tasks: Task[];
  users: User[];
  projects: Project[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  viewMode?: 'assign' | 'reporting'; // New prop to control view mode
  setActiveTab?: (tab: string) => void; // Optional: switch between Reporting Task / Assigned Task from header
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ currentUser, tasks, users, projects, setTasks, viewMode = 'assign', setActiveTab }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL'); // ALL | COMPLETED | IN_PROGRESS | PENDING
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [changingStatusTaskId, setChangingStatusTaskId] = useState<string | null>(null);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null); // Track which task's dropdown is open
  const [availableUsers, setAvailableUsers] = useState<User[]>([]); // Users fetched from API for dropdown
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskType, setNewTaskType] = useState<TaskType | string>('');
  const [newTaskAssignee, setNewTaskAssignee] = useState(currentUser.id);
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([]);
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskTargetRole, setNewTaskTargetRole] = useState<string>(''); // Role selector for reporting view
  // Array of assignee objects with role, designation, and assigneeId for multiple assignees
  const [multipleAssignees, setMultipleAssignees] = useState<Array<{role: string, designation: string, assigneeId: string}>>([
    { role: '', designation: '', assigneeId: currentUser.id }
  ]);
  // Store filtered names for each assignee (by role and designation)
  const [assigneeFilteredNames, setAssigneeFilteredNames] = useState<Record<number, any[]>>({});
  const [isLoadingAssigneeNames, setIsLoadingAssigneeNames] = useState<Record<number, boolean>>({});
  // Store designations for each assignee (filtered by role)
  const [assigneeDesignations, setAssigneeDesignations] = useState<Record<number, string[]>>({});
  // Reporting By / Reporting To (for role-based Create Task form)
  const [reportingById, setReportingById] = useState<string>('');
  const [reportingToId, setReportingToId] = useState<string>('');
  const [tlCreateTaskMode, setTlCreateTaskMode] = useState<'ASSIGN_TO' | 'REPORTING_BY'>('ASSIGN_TO');
  const [reportingByRole, setReportingByRole] = useState<string>('');
  const [reportingByDesignation, setReportingByDesignation] = useState<string>('');
  const [reportingByUserId, setReportingByUserId] = useState<string>('');
  const [reportingByNames, setReportingByNames] = useState<any[]>([]);
  const [isLoadingReportingByNames, setIsLoadingReportingByNames] = useState(false);
  const [reportingByDesignations, setReportingByDesignations] = useState<string[]>([]);
  const [isLoadingReportingByDesignations, setIsLoadingReportingByDesignations] = useState(false);
  // Multiple Reporting By rows (Create Task card - same as MD Assign card "+" for Role/Designation/User)
  const [multipleReportingBy, setMultipleReportingBy] = useState<Array<{ role: string; designation: string; userId: string }>>([{ role: '', designation: '', userId: '' }]);
  const [reportingByNamesByIndex, setReportingByNamesByIndex] = useState<Record<number, any[]>>({});
  const [reportingByDesignationsByIndex, setReportingByDesignationsByIndex] = useState<Record<number, string[]>>({});
  const [isLoadingReportingByByIndex, setIsLoadingReportingByByIndex] = useState<Record<number, boolean>>({});
  
  // Role and Designation Filter State (for both modal and main view filters)
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedDesignation, setSelectedDesignation] = useState<string>('');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableDesignations, setAvailableDesignations] = useState<string[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [isLoadingDesignations, setIsLoadingDesignations] = useState(false);
  const [designationFilter, setDesignationFilter] = useState('All');
  
  // Separate filter states for main view (task cards filtering)
  const [viewFilterRole, setViewFilterRole] = useState<string>('');
  const [viewFilterDesignation, setViewFilterDesignation] = useState<string>('');
  // Date filter for Reporting Tasks - null = show all
  const [reportingDateFilter, setReportingDateFilter] = useState<string | null>(null);
  // Date filter for Assigned Tasks - null = show all
  const [assignedDateFilter, setAssignedDateFilter] = useState<string | null>(null);
  // Search filter - by task title or created by
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Branch filter - filter by branch of user who created the task
  const [branchFilter, setBranchFilter] = useState<string>('');
  
  // Filtered Names from API (based on role and designation)
  const [filteredNames, setFilteredNames] = useState<any[]>([]);
  const [isLoadingNames, setIsLoadingNames] = useState(false);
  
  // Task Types from API
  const [availableTaskTypes, setAvailableTaskTypes] = useState<string[]>([]);
  const [isLoadingTaskTypes, setIsLoadingTaskTypes] = useState(false);
  // Branches for filter
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  // Fetch roles on component mount (for main view filters)
  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoadingRoles(true);
      try {
        const roles = await apiGetRoles();
        setAvailableRoles(roles);
      } catch (roleErr: any) {
        console.error('❌ [TASK BOARD] Error fetching roles:', roleErr);
        setAvailableRoles([]);
      } finally {
        setIsLoadingRoles(false);
      }
    };
    
    fetchRoles();
  }, []);

  // Fetch branches on component mount (for branch filter)
  useEffect(() => {
    const fetchBranches = async () => {
      setIsLoadingBranches(true);
      try {
        const branches = await apiGetBranch();
        setAvailableBranches(Array.isArray(branches) ? branches.filter((b: any) => b != null && String(b).trim() !== '') : []);
      } catch (err: any) {
        console.error('❌ [TASK BOARD] Error fetching branches:', err);
        setAvailableBranches([]);
      } finally {
        setIsLoadingBranches(false);
      }
    };
    fetchBranches();
  }, []);

  // Fetch task types when modal opens
  useEffect(() => {
    const fetchTaskTypes = async () => {
      if (!showAddModal) {
        // Reset states when modal closes
        setAvailableTaskTypes([]);
        return;
      }
      
      // Reset and start loading
      setIsLoadingTaskTypes(true);
      setAvailableTaskTypes([]); // Clear previous values
      
      try {
        const taskTypes = await apiGetTaskTypes();
        const validTaskTypes = Array.isArray(taskTypes) 
          ? taskTypes.filter(t => t != null && typeof t === 'string' && t.trim() !== '')
          : [];
        
        if (validTaskTypes.length > 0) {
          setAvailableTaskTypes(validTaskTypes);
          // Reset task type selection to first available type or empty
          setNewTaskType('');
        } else {
          console.error('❌ [TASK BOARD] API returned empty or invalid task types array');
          console.error('❌ [TASK BOARD] Raw response was:', taskTypes);
          setAvailableTaskTypes([]);
        }
      } catch (err: any) {
        console.error('❌ [TASK BOARD] Error fetching task types:', err);
        console.error('❌ [TASK BOARD] Error message:', err.message);
        console.error('❌ [TASK BOARD] Error response:', err.response?.data);
        console.error('❌ [TASK BOARD] Error status:', err.response?.status);
        console.error('❌ [TASK BOARD] Full error object:', err);
        setAvailableTaskTypes([]);
      } finally {
        setIsLoadingTaskTypes(false);
      }
    };
    
    fetchTaskTypes();
  }, [showAddModal]);

  // Fetch designations when role is selected (for modal)
  useEffect(() => {
    const fetchDesignations = async () => {
      if (!showAddModal || !selectedRole || selectedRole.trim() === '' || selectedRole.toLowerCase() === 'all') {
        setAvailableDesignations([]);
        setSelectedDesignation('');
        return;
      }
      
      setIsLoadingDesignations(true);
      try {
        const designations = await apiGetDesignations(selectedRole);
        setAvailableDesignations(designations);
        // Reset designation selection when role changes
        setSelectedDesignation('');
      } catch (err: any) {
        setAvailableDesignations([]);
        setSelectedDesignation('');
      } finally {
        setIsLoadingDesignations(false);
      }
    };
    
    fetchDesignations();
  }, [selectedRole, showAddModal]);

  // Fetch designations for view filter when viewFilterRole changes
  const [viewFilterDesignations, setViewFilterDesignations] = useState<string[]>([]);
  const [isLoadingViewDesignations, setIsLoadingViewDesignations] = useState(false);
  
  useEffect(() => {
    const fetchViewDesignations = async () => {
      if (!viewFilterRole || viewFilterRole.trim() === '' || viewFilterRole.toLowerCase() === 'all') {
        setViewFilterDesignations([]);
        setViewFilterDesignation('');
        return;
      }
      
      setIsLoadingViewDesignations(true);
      try {
        const designations = await apiGetDesignations(viewFilterRole);
        setViewFilterDesignations(designations);
        setViewFilterDesignation(''); // Reset when role changes
      } catch (err: any) {
        setViewFilterDesignations([]);
        setViewFilterDesignation('');
      } finally {
        setIsLoadingViewDesignations(false);
      }
    };
    
    fetchViewDesignations();
  }, [viewFilterRole]);

  // Fetch filtered names when role or designation changes
  useEffect(() => {
    const fetchFilteredNames = async () => {
      // Only fetch if modal is open
      if (!showAddModal) return;
      
      // If both role and designation are empty or "All", fetch all names (empty params)
      const roleParam = selectedRole && selectedRole.trim() !== '' && selectedRole.toLowerCase() !== 'all' ? selectedRole : '';
      const designationParam = selectedDesignation && selectedDesignation.trim() !== '' && selectedDesignation.toLowerCase() !== 'all' ? selectedDesignation : '';
      
      setIsLoadingNames(true);
      try {
        const names = await apiGetNamesFromRoleAndDesignation(roleParam, designationParam);
        setFilteredNames(names || []);
      } catch (err: any) {
        console.error("Failed to fetch filtered names:", err);
        setFilteredNames([]);
      } finally {
        setIsLoadingNames(false);
      }
    };
    
    fetchFilteredNames();
  }, [selectedRole, selectedDesignation, showAddModal]);

  // Reset role and designation when modal closes
  useEffect(() => {
    if (!showAddModal) {
      setSelectedRole('');
      setSelectedDesignation('');
      setAvailableDesignations([]);
      setMultipleAssignees([{ role: '', designation: '', assigneeId: currentUser.id }]);
      setAssigneeFilteredNames({});
      setIsLoadingAssigneeNames({});
      setAssigneeDesignations({});
      setReportingById('');
      setReportingToId('');
      setTlCreateTaskMode('ASSIGN_TO');
      setReportingByRole('');
      setReportingByDesignation('');
      setReportingByUserId('');
      setReportingByNames([]);
      setReportingByDesignations([]);
    }
  }, [showAddModal, currentUser.id]);

  // Fetch users from API for the assign dropdown
  useEffect(() => {
    const fetchUsersForDropdown = async () => {
      setIsLoadingUsers(true);
      
      try {
        const employees = await apiGetEmployees();
        
        if (!employees || employees.length === 0) {
          setAvailableUsers([]);
          setIsLoadingUsers(false);
          return;
        }
        
        // Convert Employee format to User format for dropdown
        const convertedUsers: User[] = employees.map((emp: any) => {
          const employeeId = emp['Employee ID'] || emp['Employee_id'] || emp.id || emp.Employee_id || '';
          const fullName = emp['Full Name'] || emp['Name'] || emp.name || emp.fullName || 'Unknown';
          const email = emp['Email Address'] || emp['Email_id'] || emp.email || emp.emailAddress || '';
          const role = emp['Role'] || emp.role || 'EMPLOYEE';
          const designation = emp['Designation'] || emp.designation || 'Employee';
          const branch = emp['Branch'] || emp.branch || 'TECH';
          const joinDate = emp['Joining Date'] || emp['Date_of_join'] || emp.joinDate || new Date().toISOString().split('T')[0];
          const birthDate = emp['Date of Birth'] || emp['Date_of_birth'] || emp.birthDate || new Date().toISOString().split('T')[0];
          const photoLink = emp['Profile Picture'] || emp['Photo_link'] || emp.avatar || emp.profilePicture || '';
          
          // Map role string to UserRole enum
          let userRole: UserRole = UserRole.EMPLOYEE;
          const roleUpper = String(role).toUpperCase();
          if (roleUpper === 'MD') userRole = UserRole.MD;
          else if (roleUpper === 'ADMIN') userRole = UserRole.ADMIN;
          else if (roleUpper === 'TEAM_LEADER' || roleUpper === 'TEAM LEADER') userRole = UserRole.TEAM_LEADER;
          else if (roleUpper === 'EMPLOYEE') userRole = UserRole.EMPLOYEE;
          else if (roleUpper === 'INTERN') userRole = UserRole.INTERN;
          
          const user: User = {
            id: employeeId,
            name: fullName,
            avatar: photoLink || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
            role: userRole,
            designation: designation,
            joinDate: joinDate,
            birthDate: birthDate,
            email: email,
            status: 'PRESENT',
            leaveBalance: 0,
            score: 0,
            branch: branch as any,
          };
          
          return user;
        });
        
        // Always use API users, don't merge with dummy users
        setAvailableUsers(convertedUsers);
      } catch (err: any) {
        // Error handling - no console logs
        
        // Don't fallback to dummy users - keep empty array or show error
        setAvailableUsers([]);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    // Always fetch users when component mounts and when modal opens
    fetchUsersForDropdown();
  }, []); // Fetch on mount and re-fetch when modal opens to get latest users
  
  // Also re-fetch when modal opens to ensure we have the latest users
  useEffect(() => {
    if (showAddModal) {
      const fetchUsersForDropdown = async () => {
        setIsLoadingUsers(true);
        try {
          const employees = await apiGetEmployees();
          
          const convertedUsers: User[] = employees.map((emp: any) => {
            const employeeId = emp['Employee ID'] || emp['Employee_id'] || emp.id || emp.Employee_id || '';
            const fullName = emp['Full Name'] || emp['Name'] || emp.name || emp.fullName || 'Unknown';
            const email = emp['Email Address'] || emp['Email_id'] || emp.email || emp.emailAddress || '';
            const role = emp['Role'] || emp.role || 'EMPLOYEE';
            const designation = emp['Designation'] || emp.designation || 'Employee';
            const branch = emp['Branch'] || emp.branch || 'TECH';
            const joinDate = emp['Joining Date'] || emp['Date_of_join'] || emp.joinDate || new Date().toISOString().split('T')[0];
            const birthDate = emp['Date of Birth'] || emp['Date_of_birth'] || emp.birthDate || new Date().toISOString().split('T')[0];
            const photoLink = emp['Profile Picture'] || emp['Photo_link'] || emp.avatar || emp.profilePicture || '';
            
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
              avatar: photoLink || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
              role: userRole,
              designation: designation,
              joinDate: joinDate,
              birthDate: birthDate,
              email: email,
              status: 'PRESENT' as const,
              leaveBalance: 0,
              score: 0,
              branch: branch as any,
            };
          });
          
          setAvailableUsers(convertedUsers);
        } catch (err: any) {
          // Error handling - no console logs
        } finally {
          setIsLoadingUsers(false);
        }
      };
      
      fetchUsersForDropdown();
    }
  }, [showAddModal]);

  // Fetch tasks from API when component mounts
  useEffect(() => {
    let cancelled = false; // Ignore stale results when switching tabs (prevents reporting tasks from disappearing)

    const fetchTasks = async () => {
      setIsLoadingTasks(true);
      setTaskError(null);
      
      try {
        let apiTasks: any[];
        // MD Reporting: viewAssignedTasks. MD Assigned: viewTasks. Others: viewTasks on Reporting, viewAssignedTasks on Assigned.
        const isMD = currentUser.role === UserRole.MD;
        if (viewMode === 'reporting') {
          apiTasks = isMD ? await apiViewAssignedTasks() : await apiViewTasks();
        } else {
          apiTasks = isMD ? await apiViewTasks() : await apiViewAssignedTasks();
        }
        apiTasks = Array.isArray(apiTasks) ? apiTasks : (apiTasks && typeof apiTasks === 'object' ? [apiTasks] : []);

        // Convert API tasks to frontend Task format (handles Task_id, Title, Assigned_to, etc.)
        const convertedTasks = convertApiTasksToTasks(apiTasks, users, currentUser);
        
      const uniqueTasks = convertedTasks.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );
      if (!cancelled) setTasks(uniqueTasks);
      } catch (err: any) {
        if (!cancelled) {
          console.error('❌ [FETCH ERROR]', err);
          setTaskError(err.message || 'Failed to fetch tasks from server');
        }
      } finally {
        if (!cancelled) setIsLoadingTasks(false);
      }
    };

    fetchTasks();
    return () => { cancelled = true; };
  }, [currentUser, setTasks, viewMode, users]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openStatusDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.status-dropdown-container')) {
          setOpenStatusDropdown(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openStatusDropdown]);

  // Helper: get creator's branch for a task (by reporterId or createdByName)
  const getCreatorBranch = (task: Task): string | undefined => {
    const reporter = task.reporterId ? users.find(u =>
      u.id === task.reporterId ||
      u.name === task.reporterId ||
      u.email === task.reporterId ||
      String(u.id).toLowerCase() === String(task.reporterId).toLowerCase()
    ) : null;
    const byName = task.createdByName ? users.find(u =>
      u.name === task.createdByName ||
      u.name?.toLowerCase() === task.createdByName?.toLowerCase() ||
      u.email === task.createdByName
    ) : null;
    const creator = reporter || byName;
    const branch = creator?.branch ?? (creator as any)?.Branch ?? (creator as any)?.branch;
    return branch ? String(branch).trim() : undefined;
  };

  // Normalize branch for comparison (handle TECH, FARM_CORE, Farm Core, etc.)
  const normalizeBranch = (b: string): string =>
    b.toUpperCase().replace(/\s+/g, '_');

  // Filtering logic for Assign Task Page
  const filteredTasks = tasks.filter(task => {
    // Extract assignee information from task
    const taskAssigneeId = String(task.assigneeId || '').trim();
    const userId = String(currentUser.id || '').trim();
    const userName = String(currentUser.name || '').trim();
    const userEmail = String(currentUser.email || '').trim();
    
    // Check if task is assigned to current user (by ID, name, or email)
    const userEmployeeId = String((currentUser as any).Employee_id || (currentUser as any)['Employee ID'] || '').trim();
    const isAssignedToCurrentUser =
      !taskAssigneeId ||
      taskAssigneeId === userId ||
      taskAssigneeId === userName ||
      taskAssigneeId === userEmail ||
      taskAssigneeId === userEmployeeId ||
      taskAssigneeId.toLowerCase() === userId.toLowerCase() ||
      taskAssigneeId.toLowerCase() === userName.toLowerCase() ||
      taskAssigneeId.toLowerCase() === userEmail.toLowerCase() ||
      taskAssigneeId.toLowerCase() === userEmployeeId.toLowerCase() ||
      users.some(u => {
        const uId = String(u.id || '').trim();
        const uName = String(u.name || '').trim();
        const uEmail = String(u.email || '').trim();
        const uEmpId = String((u as any).Employee_id || (u as any)['Employee ID'] || '').trim();
        return (
          (uId && (uId === taskAssigneeId || uId.toLowerCase() === taskAssigneeId.toLowerCase())) ||
          (uName && (uName === taskAssigneeId || uName.toLowerCase() === taskAssigneeId.toLowerCase())) ||
          (uEmail && (uEmail === taskAssigneeId || uEmail.toLowerCase() === taskAssigneeId.toLowerCase())) ||
          (uEmpId && (uEmpId === taskAssigneeId || uEmpId.toLowerCase() === taskAssigneeId.toLowerCase()))
        );
      });
    
    // For Assign Task Page: Show only tasks assigned to current user
    // This applies to ALL users (MD, Admin, Team Leader, Employees)
    if (!isAssignedToCurrentUser) return false;
    
    // Apply role filter
    if (viewFilterRole && viewFilterRole.trim() !== '') {
      const assigneeUser = users.find(u => 
        u.id === taskAssigneeId || 
        u.name === taskAssigneeId || 
        u.email === taskAssigneeId
      );
      if (assigneeUser) {
        // Compare role - check both enum value and formatted string
        const assigneeRoleStr = String(assigneeUser.role).toUpperCase();
        const filterRoleStr = viewFilterRole.toUpperCase();
        if (assigneeRoleStr !== filterRoleStr && 
            assigneeRoleStr !== filterRoleStr.replace(/[_\s]+/g, '_') &&
            assigneeRoleStr !== filterRoleStr.replace(/_/g, ' ')) {
          return false;
        }
        
        // Apply designation filter if role matches
        if (viewFilterDesignation && viewFilterDesignation.trim() !== '') {
          const assigneeDesignation = assigneeUser.designation || '';
          if (assigneeDesignation !== viewFilterDesignation) {
            return false;
          }
        }
      } else {
        // If assignee not found in users list, skip role/designation filtering
        // (might be a user from API that's not in local users list)
      }
    }
    
    // Apply type filter
    if (filterType !== 'ALL' && task.type !== filterType) return false;
    // Apply status filter
    if (filterStatus !== 'ALL' && task.status !== filterStatus) return false;
    // Apply search filter - by task title or created by
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const titleMatch = (task.title || '').toLowerCase().includes(q);
      const createdByMatch = (task.createdByName || '').toLowerCase().includes(q);
      if (!titleMatch && !createdByMatch) return false;
    }
    // Apply date filter - match task due date
    if (assignedDateFilter && assignedDateFilter.trim() !== '') {
      const selectedYMD = assignedDateFilter.includes('T') ? assignedDateFilter.split('T')[0] : assignedDateFilter;
      const taskDue = task.dueDate || '';
      const taskYMD = taskDue.includes('T') ? taskDue.split('T')[0] : taskDue.substring(0, 10);
      if (taskYMD !== selectedYMD) return false;
    }
    // Apply branch filter - creator's branch must match (MD only)
    if (currentUser.role === UserRole.MD && branchFilter && branchFilter.trim() !== '') {
      const creatorBranch = getCreatorBranch(task);
      if (!creatorBranch || normalizeBranch(creatorBranch) !== normalizeBranch(branchFilter)) return false;
    }
    return true;
  });

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED: return 'bg-green-100 text-green-700 border-green-200';
      case TaskStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-700 border-blue-200';
      case TaskStatus.OVERDUE: return 'bg-red-100 text-red-700 border-red-200';
      case TaskStatus.PENDING: return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  // Helper function to get Employee_id from user (preserving leading zeros)
  const getEmployeeIdFromUser = (user: User | any): string | null => {
    // Priority 1: Check if user has Employee_id field (preserved from API)
    if (user?.Employee_id !== undefined && user?.Employee_id !== null) {
      return String(user.Employee_id).trim();
    }
    // Priority 2: Check if user has 'Employee ID' field (with space)
    if (user?.['Employee ID'] !== undefined && user?.['Employee ID'] !== null) {
      return String(user['Employee ID']).trim();
    }
    // Priority 3: Use user.id (which is already set to Employee_id in conversion)
    if (user?.id !== undefined && user?.id !== null) {
      return String(user.id).trim();
    }
    return null;
  };

  const handleCreateTask = async () => {
    // Validation
    if (!newTaskTitle.trim()) {
      alert("Please enter a task title.");
      return;
    }
    
    // If group task, ensure at least one person is selected
    if (newTaskType === TaskType.GROUP && newTaskAssigneeIds.length === 0) {
        alert("Please select at least one person for the group task.");
        return;
    }

    setIsCreatingTask(true);
    setTaskError(null);

    try {
      // Map frontend TaskType enum or API string to backend type format
      // Handle both enum values (TaskType.ONE_DAY) and API string values ("1 Day")
      let backendType: string;
      
      // If newTaskType is already a string (from API), use it directly
      if (typeof newTaskType === 'string' && newTaskType !== '') {
        backendType = newTaskType;
      } else {
        // Otherwise, map from TaskType enum to backend format
        const typeMap: Record<TaskType, string> = {
          [TaskType.SOS]: 'SOS',
          [TaskType.ONE_DAY]: '1 Day',
          [TaskType.TEN_DAYS]: '10 Day',
          [TaskType.MONTHLY]: 'Monthly',
          [TaskType.Quaterly]: 'Quaterly',
          [TaskType.GROUP]: 'Group',
          [TaskType.INDIVIDUAL]: 'Individual',
        };
        backendType = typeMap[newTaskType as TaskType] || 'Individual';
      }
      
      // Collect all employee IDs from assignees (role-specific: MD/TL Assign To vs TL Reporting By vs Employee vs Intern)
      const usersForDropdown = availableUsers.length > 0 ? availableUsers : users;
      const employeeIds: string[] = [];
      
      const isTlReportingBy = currentUser.role === UserRole.TEAM_LEADER && tlCreateTaskMode === 'REPORTING_BY';
      const isEmployee = currentUser.role === UserRole.EMPLOYEE;
      const isIntern = currentUser.role === UserRole.INTERN;
      
      if (isTlReportingBy || isEmployee || isIntern) {
        // TL (Reporting By), Employee (Reporting By), or Intern (Reporting To): use multiple Role/Designation/User rows
        const rowsWithUser = multipleReportingBy.filter(r => r.userId && r.userId.trim() !== '');
        if (isEmployee && rowsWithUser.length === 0) {
          const meId = currentUser.id;
          const assigneeUser = usersForDropdown.find(u => u.id === meId || u.name === meId);
          if (assigneeUser) {
            const empId = getEmployeeIdFromUser(assigneeUser);
            if (empId) employeeIds.push(empId);
          } else {
            employeeIds.push(String(meId).trim());
          }
        } else {
          if (rowsWithUser.length === 0 && isIntern) {
            alert("Please select the person you report to (Role, Designation, User).");
            setIsCreatingTask(false);
            return;
          }
          for (const row of rowsWithUser) {
            const selectedUserId = row.userId;
            const assigneeUser = usersForDropdown.find(u => u.id === selectedUserId || u.name === selectedUserId);
            if (assigneeUser) {
              const empId = getEmployeeIdFromUser(assigneeUser);
              if (empId) employeeIds.push(empId);
            } else {
              employeeIds.push(String(selectedUserId).trim());
            }
          }
        }
      } else if (newTaskType === TaskType.GROUP) {
        // For GROUP tasks, use newTaskAssigneeIds
        for (const assigneeId of newTaskAssigneeIds) {
          const assigneeUser = usersForDropdown.find(u => u.id === assigneeId || u.name === assigneeId);
          if (assigneeUser) {
            const empId = getEmployeeIdFromUser(assigneeUser);
            if (empId) employeeIds.push(empId);
          } else {
            employeeIds.push(String(assigneeId).trim());
          }
        }
      } else {
        const allAssignees = multipleAssignees.filter(a => a.assigneeId && a.assigneeId.trim() !== '');
        
        if (allAssignees.length === 0) {
          alert("Please select at least one assignee.");
          setIsCreatingTask(false);
          return;
        }
        
        for (const assignee of allAssignees) {
          const assigneeUser = usersForDropdown.find(u => u.id === assignee.assigneeId || u.name === assignee.assigneeId);
          if (assigneeUser) {
            const empId = getEmployeeIdFromUser(assigneeUser);
            if (empId) employeeIds.push(empId);
          } else {
            // If not found in users, try to use the ID directly (might already be an employee ID)
            employeeIds.push(String(assignee.assigneeId).trim());
          }
        }
      }
      
      if (employeeIds.length === 0) {
        alert("Please select at least one assignee with a valid Employee ID.");
        setIsCreatingTask(false);
        return;
      }
      
      // Prepare API request data - backend expects assigned_to as array of employee IDs
      const taskData = {
        title: newTaskTitle,
        description: newTaskDesc,
        type: backendType,
        due_date: newTaskDate,
        assigned_to: employeeIds,
      };
      // Create task with all assignees in a single API call
      await apiCreateTask(taskData);
      
      setShowAddModal(false);
      
      // Reset form
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskAssigneeIds([]);
      setNewTaskDate(new Date().toISOString().split('T')[0]);
      setSelectedRole('');
      setSelectedDesignation('');
      setNewTaskType(''); // Reset to empty - will be populated from API
      setNewTaskAssignee(currentUser.id);
      setMultipleAssignees([{ role: '', designation: '', assigneeId: currentUser.id }]); // Reset multiple assignees
      setAssigneeFilteredNames({});
      setIsLoadingAssigneeNames({});
      setAssigneeDesignations({});
      setMultipleReportingBy([{ role: '', designation: '', userId: '' }]);
      setReportingByNamesByIndex({});
      setReportingByDesignationsByIndex({});
      setIsLoadingReportingByByIndex({});
      
      // Refresh tasks from API to get the actual task with server-generated ID
      // Don't add locally first to avoid duplicates
      setTimeout(async () => {
        try {
          let apiTasks: any[];
          const isMD = currentUser.role === UserRole.MD;
          if (viewMode === 'reporting') {
            apiTasks = isMD ? await apiViewAssignedTasks() : await apiViewTasks();
          } else {
            apiTasks = isMD ? await apiViewTasks() : await apiViewAssignedTasks();
          }
          apiTasks = Array.isArray(apiTasks) ? apiTasks : (apiTasks && typeof apiTasks === 'object' ? [apiTasks] : []);
          // Map backend type to frontend TaskType enum (reuse same logic)
          // Accept both new format (capitalized with spaces) and old formats (lowercase/underscores) for backward compatibility
          const typeMap: Record<string, TaskType> = {
            'sos': TaskType.SOS, 'SOS': TaskType.SOS,
            '1 day': TaskType.ONE_DAY, '1 Day': TaskType.ONE_DAY, '1day': TaskType.ONE_DAY, 'one day': TaskType.ONE_DAY,
            '10 day': TaskType.TEN_DAYS, '10 Day': TaskType.TEN_DAYS, '10day': TaskType.TEN_DAYS, 'ten day': TaskType.TEN_DAYS,
            'monthly': TaskType.MONTHLY, 'Monthly': TaskType.MONTHLY,
            'quaterly': TaskType.Quaterly, 'Quaterly': TaskType.Quaterly, 'quarterly': TaskType.Quaterly, 'Quarterly': TaskType.Quaterly,
            'group': TaskType.GROUP, 'Group': TaskType.GROUP,
            'individual': TaskType.INDIVIDUAL, 'Individual': TaskType.INDIVIDUAL,
            'one_day': TaskType.ONE_DAY, 'ten_days': TaskType.TEN_DAYS,
          };
          const statusMap: Record<string, TaskStatus> = {
            'pending': TaskStatus.PENDING,
            'in_progress': TaskStatus.IN_PROGRESS,
            'completed': TaskStatus.COMPLETED,
            'overdue': TaskStatus.OVERDUE,
          };
          
          const convertedTasks: Task[] = apiTasks.map((apiTask: any) => {
            const rawApiType = (apiTask.task_type || apiTask.type || apiTask['task_type'] || apiTask['type'] || 'Individual').trim();
            const apiTypeLower = rawApiType.toLowerCase();
            const apiStatus = (apiTask.status || apiTask['status'] || 'pending').toLowerCase();
            // Extract assignee: API may have assigned_to as array [{ assignee: "Name" }]
            let rawAssignedTo: string | number = currentUser.id;
            const at = apiTask.assigned_to ?? apiTask['assigned_to'];
            if (Array.isArray(at) && at.length > 0 && at[0]?.assignee) {
              const assigneeName = String(at[0].assignee).trim();
              const found = users.find(u => u.name === assigneeName || u.name?.toLowerCase() === assigneeName.toLowerCase() || u.email === assigneeName);
              rawAssignedTo = found?.id ?? assigneeName;
            } else if (typeof at === 'string' || typeof at === 'number') {
              rawAssignedTo = at;
            } else if (apiTask.assigned || apiTask.assigneeId || apiTask.assignee_id) {
              rawAssignedTo = apiTask.assigned || apiTask.assigneeId || apiTask.assignee_id;
            }
            const rawReporterId = apiTask.reporterId || apiTask['reporterId'] || apiTask.created_by || apiTask['created_by'] || apiTask.reporter_id || apiTask.created_by_id || apiTask.created_by_name || apiTask['created_by_name'] || apiTask.assigner || apiTask['assigner'] || apiTask.assigned_by || apiTask['assigned_by'] || undefined;
            const backendId = apiTask.task_id ?? apiTask['task_id'] ?? apiTask.id ?? apiTask['id'] ?? apiTask['task-id'];
            return {
              id: backendId ? String(backendId) : `t${Date.now()}-${Math.random()}`,
              title: apiTask.title || apiTask['title'] || 'Untitled Task',
              description: apiTask.description || apiTask['description'] || '',
              type: typeMap[rawApiType] || typeMap[apiTypeLower] || TaskType.INDIVIDUAL,
              status: statusMap[apiStatus] || TaskStatus.PENDING,
              assigneeId: String(rawAssignedTo),
              reporterId: rawReporterId,
              dueDate: (() => {
                const raw = apiTask.due_date || apiTask['due_date'] || apiTask['due-date'] || apiTask.dueDate || new Date().toISOString().split('T')[0];
                if (!raw) return new Date().toISOString().split('T')[0];
                const str = String(raw).trim();
                const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,'0')}-${ddmmyyyy[1].padStart(2,'0')}`;
                return str;
              })(),
              createdAt: apiTask.created_at || apiTask['created_at'] || apiTask.createdAt || new Date().toISOString(),
              comments: apiTask.comments || apiTask['comments'] || [],
              priority: (apiTask.priority || apiTask['priority'] || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
              projectId: apiTask.projectId || apiTask['projectId'] || apiTask.project_id || undefined,
            };
          });
          
          // Remove duplicates based on task ID (in case API returns duplicates)
          const uniqueTasks = convertedTasks.filter((task, index, self) => 
            index === self.findIndex(t => t.id === task.id)
          );
          
          setTasks(uniqueTasks);
        } catch (err) {
          // Error handling - no console logs
        }
      }, 500);
      
    } catch (err: any) {
      setTaskError(err.message || 'Failed to create task. Please try again.');
      alert(`Failed to create task: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Function to refresh tasks from API
  const refreshTasks = async () => {
    try {
      setIsLoadingTasks(true);
      setTaskError(null);
      let apiTasks: any[];
      const isMD = currentUser.role === UserRole.MD;
      if (viewMode === 'reporting') {
        apiTasks = isMD ? await apiViewAssignedTasks() : await apiViewTasks();
      } else {
        apiTasks = isMD ? await apiViewTasks() : await apiViewAssignedTasks();
      }
      apiTasks = Array.isArray(apiTasks) ? apiTasks : (apiTasks && typeof apiTasks === 'object' ? [apiTasks] : []);

      // Convert API tasks to frontend Task format (handles Task_id, Title, Assigned_to, etc.)
      const convertedTasks = convertApiTasksToTasks(apiTasks, users, currentUser);
      const uniqueTasks = convertedTasks.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );
      setTasks(uniqueTasks);
    } catch (err: any) {
      console.error('❌ [REFRESH TASKS ERROR]', err);
      setTaskError(err.message || 'Failed to refresh tasks');
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    // Prevent multiple clicks
    if (changingStatusTaskId === taskId) {
      return;
    }
    
    try {
      setChangingStatusTaskId(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      // Get the actual backend task ID from the task object
      // Check if task has _backendTaskId property (stored when task was converted from API)
      // This should be the task_id from the backend response
      const taskWithBackendId = task as any;
      const actualBackendId = taskWithBackendId?._backendTaskId || task?.id;
      // Validate task ID - check if it's a generated fallback ID (starts with 't')
      // If it is, try to use the stored backend ID, otherwise we can't use it with the backend API
      let backendTaskIdToUse = actualBackendId;
      
      if (typeof taskId === 'string' && taskId.startsWith('t') && taskId.includes('-')) {
        // This is a fallback ID - check if we have the actual backend ID stored
        if (actualBackendId && !actualBackendId.startsWith('t')) {
          backendTaskIdToUse = actualBackendId;
        } else {
          console.error('❌ [STATUS CHANGE] Invalid task ID - appears to be a generated fallback ID:', taskId);
          console.error('❌ [STATUS CHANGE] No backend ID found. Available tasks:', tasks.map(t => ({ 
            id: t.id, 
            title: t.title,
            backendId: (t as any)._backendTaskId || 'N/A'
          })));
          // Provide user-friendly error message
          const errorMessage = 
            '⚠️ Cannot Change Task Status\n\n' +
            'The task does not have a valid ID from the backend server.\n\n' +
            'This happens because the backend API is not returning task IDs.\n\n' +
            'Please contact your backend developer to:\n' +
            '• Update the /tasks/viewTasks/ API to include task IDs\n' +
            '• The API response should include an "id" field for each task\n\n' +
            'Status changes will work once the backend is updated.';
          
          alert(errorMessage);
          setChangingStatusTaskId(null);
          return; // Exit early instead of throwing
        }
      }
      
      // Map frontend TaskStatus to backend API status format
      // Backend expects: "PENDING", "INPROCESS" (no space), or "COMPLETED"
      const statusMap: Record<TaskStatus, "PENDING" | "INPROCESS" | "COMPLETED"> = {
        [TaskStatus.PENDING]: "PENDING",
        [TaskStatus.IN_PROGRESS]: "INPROCESS", // Backend uses "INPROCESS" (no space)
        [TaskStatus.COMPLETED]: "COMPLETED",
        [TaskStatus.OVERDUE]: "PENDING", // Map OVERDUE to PENDING for API
      };
      
      const apiStatus = statusMap[newStatus] || "PENDING";
      await apiChangeTaskStatus(backendTaskIdToUse, apiStatus);
      await refreshTasks();
    } catch (error: any) {
      console.error('❌ [STATUS CHANGE ERROR]', error);
      console.error('❌ [STATUS CHANGE ERROR] Task ID that failed:', taskId);
      console.error('❌ [STATUS CHANGE ERROR] All available task IDs:', tasks.map(t => t.id));
      alert(`Failed to change task status: ${error.message || 'Unknown error'}`);
      // Optionally refresh tasks anyway to show current state
      await refreshTasks();
    } finally {
      setChangingStatusTaskId(null);
    }
  };

  const toggleAssignee = (userId: string) => {
      if (newTaskAssigneeIds.includes(userId)) {
          setNewTaskAssigneeIds(newTaskAssigneeIds.filter(id => id !== userId));
      } else {
          setNewTaskAssigneeIds([...newTaskAssigneeIds, userId]);
      }
  };

  // Fetch designations for a specific assignee based on their role
  const fetchDesignationsForAssignee = async (index: number, role: string) => {
    try {
      if (role && role.trim() !== '' && role.toLowerCase() !== 'all roles') {
        const designations = await apiGetDesignations(role);
        setAssigneeDesignations(prev => ({ ...prev, [index]: designations || [] }));
      } else {
        // If "All Roles", get all designations
        const designations = await apiGetDesignations();
        setAssigneeDesignations(prev => ({ ...prev, [index]: designations || [] }));
      }
    } catch (err: any) {
      console.error(`Failed to fetch designations for assignee ${index}:`, err);
      setAssigneeDesignations(prev => ({ ...prev, [index]: [] }));
    }
  };

  const fetchDesignationsForReportingBy = async (role: string) => {
    setIsLoadingReportingByDesignations(true);
    try {
      if (role && role.trim() !== '' && role.toLowerCase() !== 'all roles') {
        const designations = await apiGetDesignations(role);
        setReportingByDesignations(designations || []);
      } else {
        const designations = await apiGetDesignations();
        setReportingByDesignations(designations || []);
      }
    } catch {
      setReportingByDesignations([]);
    } finally {
      setIsLoadingReportingByDesignations(false);
    }
  };

  // Fetch names for a specific assignee based on their role and designation
  const fetchNamesForAssignee = async (index: number, role: string, designation?: string) => {
    setIsLoadingAssigneeNames(prev => ({ ...prev, [index]: true }));
    try {
      const roleParam = role && role.trim() !== '' && role.toLowerCase() !== 'all roles' ? role : '';
      const designationParam = designation && designation.trim() !== '' && designation.toLowerCase() !== 'all designations' ? designation : '';
      
      const names = await apiGetNamesFromRoleAndDesignation(roleParam, designationParam);
      setAssigneeFilteredNames(prev => ({ ...prev, [index]: names || [] }));
    } catch (err: any) {
      console.error(`Failed to fetch names for assignee ${index}:`, err);
      setAssigneeFilteredNames(prev => ({ ...prev, [index]: [] }));
    } finally {
      setIsLoadingAssigneeNames(prev => ({ ...prev, [index]: false }));
    }
  };

  const fetchNamesForReportingBy = async (role: string, designation?: string) => {
    setIsLoadingReportingByNames(true);
    try {
      const roleParam = role && role.trim() !== '' && role.toLowerCase() !== 'all roles' ? role : '';
      const designationParam =
        designation && designation.trim() !== '' && designation.toLowerCase() !== 'all designations' ? designation : '';
      const names = await apiGetNamesFromRoleAndDesignation(roleParam, designationParam);
      setReportingByNames(names || []);
    } catch {
      setReportingByNames([]);
    } finally {
      setIsLoadingReportingByNames(false);
    }
  };

  const fetchDesignationsForReportingByRow = async (index: number, role: string) => {
    try {
      if (role && role.trim() !== '' && role.toLowerCase() !== 'all roles') {
        const designations = await apiGetDesignations(role);
        setReportingByDesignationsByIndex(prev => ({ ...prev, [index]: designations || [] }));
      } else {
        const designations = await apiGetDesignations();
        setReportingByDesignationsByIndex(prev => ({ ...prev, [index]: designations || [] }));
      }
    } catch {
      setReportingByDesignationsByIndex(prev => ({ ...prev, [index]: [] }));
    }
  };

  const fetchNamesForReportingByRow = async (index: number, role: string, designation?: string) => {
    setIsLoadingReportingByByIndex(prev => ({ ...prev, [index]: true }));
    try {
      const roleParam = role && role.trim() !== '' && role.toLowerCase() !== 'all roles' ? role : '';
      const designationParam =
        designation && designation.trim() !== '' && designation.toLowerCase() !== 'all designations' ? designation : '';
      const names = await apiGetNamesFromRoleAndDesignation(roleParam, designationParam);
      setReportingByNamesByIndex(prev => ({ ...prev, [index]: names || [] }));
    } catch {
      setReportingByNamesByIndex(prev => ({ ...prev, [index]: [] }));
    } finally {
      setIsLoadingReportingByByIndex(prev => ({ ...prev, [index]: false }));
    }
  };

  // Handle role change for a specific assignee
  const handleAssigneeRoleChange = async (index: number, newRole: string) => {
    const updated = [...multipleAssignees];
    updated[index] = { ...updated[index], role: newRole, designation: '', assigneeId: '' }; // Reset designation and assignee when role changes
    setMultipleAssignees(updated);
    
    // Fetch designations for this role
    await fetchDesignationsForAssignee(index, newRole);
    
    // Fetch names for this role (without designation filter initially)
    if (newRole && newRole.trim() !== '' && newRole.toLowerCase() !== 'all roles') {
      await fetchNamesForAssignee(index, newRole, '');
    } else {
      // If "All Roles" selected, fetch all names
      await fetchNamesForAssignee(index, '', '');
    }
  };

  // Handle designation change for a specific assignee
  const handleAssigneeDesignationChange = async (index: number, newDesignation: string) => {
    const updated = [...multipleAssignees];
    updated[index] = { ...updated[index], designation: newDesignation, assigneeId: '' }; // Reset assignee when designation changes
    setMultipleAssignees(updated);
    
    // Fetch names for this role and designation
    const role = updated[index].role;
    if (newDesignation && newDesignation.trim() !== '' && newDesignation.toLowerCase() !== 'all designations') {
      await fetchNamesForAssignee(index, role, newDesignation);
    } else {
      await fetchNamesForAssignee(index, role, '');
    }
  };

  // Only MD role can assign/create tasks
  const canAssignTask = currentUser.role === UserRole.MD;
  const isIntern = currentUser.role === UserRole.INTERN;

  // Use only API users for dropdown (no dummy users)
  const usersForDropdown = availableUsers; // Only use API users, no fallback to dummy users
  
  // Get unique designations dynamically from API users
  const uniqueDesignations = ['All', ...Array.from(new Set(usersForDropdown.map(u => u.designation).filter(Boolean)))];
  
  // Filter users by role and designation
  // If no filters are selected, show ALL users
  const filteredUsersForAssign = usersForDropdown.filter(u => {
    // Filter by role if selected (and not "All Roles")
    if (selectedRole && selectedRole.trim() !== '' && selectedRole.trim() !== 'All Roles') {
      const userRoleUpper = String(u.role || '').toUpperCase();
      const selectedRoleUpper = String(selectedRole).toUpperCase();
      // Map role enum to string for comparison
      const roleMap: Record<UserRole, string> = {
        [UserRole.MD]: 'MD',
        [UserRole.ADMIN]: 'ADMIN',
        [UserRole.TEAM_LEADER]: 'TEAM_LEADER',
        [UserRole.EMPLOYEE]: 'EMPLOYEE',
        [UserRole.INTERN]: 'INTERN',
      };
      const userRoleString = roleMap[u.role] || String(u.role).toUpperCase();
      if (userRoleString !== selectedRoleUpper && userRoleUpper !== selectedRoleUpper) {
        return false;
      }
    }
    
    // Filter by designation if selected (and not "All Designations")
    if (selectedDesignation && selectedDesignation.trim() !== '' && selectedDesignation.trim() !== 'All Designations') {
      const userDesignation = String(u.designation || '').trim();
      const selectedDesignationTrimmed = String(selectedDesignation).trim();
      if (userDesignation !== selectedDesignationTrimmed) {
        return false;
      }
    }
    
    // If no filters are selected, show all users
    return true;
  });
  
  // Original filteredUsersForAssign logic (keeping for backward compatibility)
  const filteredUsersForAssignOriginal = usersForDropdown.filter(u => {
      if (designationFilter === 'All') return true;
      return u.designation === designationFilter;
  });

  // Helper to get task counts for a user
  const getTaskStats = (userId: string, type: TaskType) => {
    const userTasks = tasks.filter(t => 
      (t.assigneeId === userId || t.assigneeIds?.includes(userId)) && 
      t.type === type
    );
    return {
      pending: userTasks.filter(t => t.status !== TaskStatus.COMPLETED).length,
      completed: userTasks.filter(t => t.status === TaskStatus.COMPLETED).length
    };
  };

  // If reporting mode, show reporting view with task cards
  if (viewMode === 'reporting') {
    const reportingTasks = tasks;
    
    let filteredReportingTasks = filterType === 'ALL'
      ? reportingTasks
      : reportingTasks.filter(t => t.type === filterType);
    // Apply status filter
    if (filterStatus !== 'ALL') {
      filteredReportingTasks = filteredReportingTasks.filter(t => t.status === filterStatus);
    }
    // Apply date filter - match task due date to selected date
    if (reportingDateFilter && reportingDateFilter.trim() !== '') {
      const selectedYMD = reportingDateFilter.includes('T') ? reportingDateFilter.split('T')[0] : reportingDateFilter;
      filteredReportingTasks = filteredReportingTasks.filter(t => {
        const taskDue = t.dueDate || '';
        const taskYMD = taskDue.includes('T') ? taskDue.split('T')[0] : taskDue.substring(0, 10);
        return taskYMD === selectedYMD;
      });
    }
    // Apply role and designation filters
    if (viewFilterRole && viewFilterRole.trim() !== '') {
      filteredReportingTasks = filteredReportingTasks.filter(task => {
        const taskAssigneeId = String(task.assigneeId || '').trim();
        const assigneeUser = users.find(u => 
          u.id === taskAssigneeId || 
          u.name === taskAssigneeId || 
          u.email === taskAssigneeId
        );
        if (assigneeUser) {
          // Compare role - check both enum value and formatted string
          const assigneeRoleStr = String(assigneeUser.role).toUpperCase();
          const filterRoleStr = viewFilterRole.toUpperCase();
          if (assigneeRoleStr !== filterRoleStr && 
              assigneeRoleStr !== filterRoleStr.replace(/[_\s]+/g, '_') &&
              assigneeRoleStr !== filterRoleStr.replace(/_/g, ' ')) {
            return false;
          }
          
          // Apply designation filter if role matches
          if (viewFilterDesignation && viewFilterDesignation.trim() !== '') {
            const assigneeDesignation = assigneeUser.designation || '';
            if (assigneeDesignation !== viewFilterDesignation) {
              return false;
            }
          }
        }
        return true;
      });
    }
    // Apply search filter - by task title or created by
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filteredReportingTasks = filteredReportingTasks.filter(task => {
        const titleMatch = (task.title || '').toLowerCase().includes(q);
        const createdByMatch = (task.createdByName || '').toLowerCase().includes(q);
        return titleMatch || createdByMatch;
      });
    }
    // Apply branch filter - creator's branch must match (MD only)
    if (currentUser.role === UserRole.MD && branchFilter && branchFilter.trim() !== '') {
      filteredReportingTasks = filteredReportingTasks.filter(task => {
        const creatorBranch = getCreatorBranch(task);
        return creatorBranch && normalizeBranch(creatorBranch) === normalizeBranch(branchFilter);
      });
    }

    return (
      <div className="space-y-6">
        {/* Task page header: Reporting Task | Assigned Task tabs + Create Task button on right */}
        {setActiveTab && (
          <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('reportingTask')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-brand-600 text-white"
              >
                Reporting Task
              </button>
              <button
                onClick={() => setActiveTab('assignTask')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Assigned Task
              </button>
            </div>
            <div className="flex items-center gap-2">
              {/* Reporting Task page: show Create Task only for non-MD (user roles). MD does not see button here. */}
              {currentUser.role !== UserRole.MD && currentUser.role !== UserRole.ADMIN && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white shadow-sm transition-transform hover:scale-105 bg-brand-600 hover:bg-brand-700"
                >
                  <Plus size={18} />
                  <span>Create Task</span>
                </button>
              )}
            </div>
          </div>
        )}
        {/* Reporting Tasks title with inline calendar date picker and search */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar size={28} className="text-brand-600" />
              Reporting Tasks
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by title or created by..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              {currentUser.role === UserRole.MD && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-w-[140px]"
                >
                  <option value="">All branches</option>
                  {availableBranches.map((b) => (
                    <option key={b} value={b}>{String(b).replace(/_/g, ' ')}</option>
                  ))}
                </select>
              )}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-w-[100px]"
              >
                <option value="ALL">All types</option>
                <option value={TaskType.SOS}>SOS</option>
                <option value={TaskType.ONE_DAY}>1 Day</option>
                <option value={TaskType.TEN_DAYS}>10 Day</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-w-[120px]"
              >
                <option value="ALL">All status</option>
                <option value={TaskStatus.COMPLETED}>Completed</option>
                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                <option value={TaskStatus.PENDING}>Pending</option>
              </select>
              <input
                type="date"
                value={reportingDateFilter || ''}
                onChange={(e) => setReportingDateFilter(e.target.value || null)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              {reportingDateFilter && (
                <button
                  onClick={() => setReportingDateFilter(null)}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  All dates
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Task Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoadingTasks ? (
            <div className="col-span-full text-center py-20 text-gray-400">
              <Clock size={48} className="mx-auto mb-4 opacity-50 animate-spin" />
              <p>Loading tasks...</p>
            </div>
          ) : filteredReportingTasks.length === 0 ? (
            <div className="col-span-full text-center py-20 text-gray-400">
              <CheckCircle2 size={48} className="mx-auto mb-4 opacity-50" />
              <p>No tasks found.</p>
            </div>
          ) : (
            filteredReportingTasks.map(task => {
              const assignee = users.find(u => u.id === task.assigneeId);
              // Find reporter - try to find by ID, name, or email
              const reporter = task.reporterId ? users.find(u => 
                u.id === task.reporterId || 
                u.name === task.reporterId ||
                u.email === task.reporterId ||
                String(u.id).toLowerCase() === String(task.reporterId).toLowerCase()
              ) : null;
              const isOverdue = new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
              
              const typeLabels: Record<TaskType, string> = {
                [TaskType.SOS]: 'SOS',
                [TaskType.ONE_DAY]: '1 Day',
                [TaskType.TEN_DAYS]: '10 Day',
                [TaskType.MONTHLY]: 'Monthly',
                [TaskType.Quaterly]: 'Quaterly',
                [TaskType.GROUP]: 'Group',
                [TaskType.INDIVIDUAL]: 'Individual',
              };

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow ${task.type === TaskType.SOS ? 'border-red-400 shadow-red-100 ring-2 ring-red-100' : 'border-gray-200'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${task.type === TaskType.SOS ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {typeLabels[task.type]}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-800 mb-1.5 text-sm">{task.title}</h3>
                  <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>

                  <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-3">
                    <Clock size={14} className={isOverdue ? 'text-red-500' : 'text-gray-400'} />
                    <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                      Due: {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Display assigner and assignee names */}
                  {/* For MD: show Created by from API (created_by); else show Assigned by if reporter exists */}
                  {currentUser.role === UserRole.MD && (task.createdByName || reporter?.name) && (
                    <div className="text-xs text-gray-500 mb-1.5">
                      Created by: <strong className="text-brand-600">{task.createdByName || reporter?.name}</strong>
                    </div>
                  )}
                  {currentUser.role !== UserRole.MD && reporter && (
                    <div className="text-xs text-gray-500 mb-1.5">
                      Assigned by: <strong className="text-brand-600">{reporter.name}</strong>
                    </div>
                  )}
                  {assignee && (
                    <div className="text-xs text-gray-500 mb-2">
                      Reporting to: <strong className="text-brand-600">{assignee.name}</strong>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setSelectedTask(task)}
                      className="text-brand-600 hover:text-brand-700 text-xs font-medium"
                    >
                      View Details
                    </button>
                    {/* Status Dropdown - Show on ALL task cards */}
                    <div className="relative status-dropdown-container">
                      {(() => {
                        const taskWithBackendId = task as any;
                        const hasBackendId = !!(taskWithBackendId?._backendTaskId);
                        const isDisabled = changingStatusTaskId === task.id || !hasBackendId;
                        
                        return (
                          <>
                            <button
                              onClick={() => {
                                if (!hasBackendId) {
                                  alert('⚠️ Cannot Change Status\n\nThis task does not have a valid ID from the backend.\n\nStatus changes are temporarily unavailable. Please contact support.');
                                  return;
                                }
                                setOpenStatusDropdown(openStatusDropdown === task.id ? null : task.id);
                              }}
                              disabled={isDisabled}
                              title={!hasBackendId ? 'Status change unavailable - task missing backend ID' : ''}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                                task.status === TaskStatus.COMPLETED
                                  ? 'bg-green-100 text-green-700 border-green-300'
                                  : task.status === TaskStatus.IN_PROGRESS
                                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                                  : 'bg-red-100 text-red-700 border-red-300'
                              } ${
                                isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
                              }`}
                            >
                              {changingStatusTaskId === task.id ? (
                                'Updating...'
                              ) : (
                                <>
                                  {task.status === TaskStatus.COMPLETED ? 'COMPLETED' : 
                                   task.status === TaskStatus.IN_PROGRESS ? 'IN PROGRESS' : 'PENDING'}
                                  <ChevronDown size={12} className={openStatusDropdown === task.id ? 'rotate-180' : ''} />
                                </>
                              )}
                            </button>
                            
                            {/* Dropdown Menu */}
                            {openStatusDropdown === task.id && hasBackendId && changingStatusTaskId !== task.id && (
                        <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                          <button
                            onClick={() => {
                              handleStatusChange(task.id, TaskStatus.PENDING);
                              setOpenStatusDropdown(null);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-red-50 first:rounded-t-lg ${
                              task.status === TaskStatus.PENDING ? 'bg-red-100 font-semibold text-red-700' : 'text-gray-700'
                            }`}
                          >
                            PENDING
                          </button>
                          <button
                            onClick={() => {
                              handleStatusChange(task.id, TaskStatus.IN_PROGRESS);
                              setOpenStatusDropdown(null);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${
                              task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 font-semibold text-blue-700' : 'text-gray-700'
                            }`}
                          >
                            IN PROGRESS
                          </button>
                          <button
                            onClick={() => {
                              handleStatusChange(task.id, TaskStatus.COMPLETED);
                              setOpenStatusDropdown(null);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-green-50 last:rounded-b-lg ${
                              task.status === TaskStatus.COMPLETED ? 'bg-green-100 font-semibold text-green-700' : 'text-gray-700'
                            }`}
                          >
                            COMPLETED
                          </button>
                        </div>
                      )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Task Detail Modal */}
        {selectedTask && (
          <TaskDetailModal 
            task={selectedTask} 
            onClose={() => setSelectedTask(null)} 
            currentUser={currentUser}
          />
        )}

        {/* Create Task Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
              <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">
                Create Task
              </h3>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      placeholder="Task Title"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                    />
                 </div>
                 
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none h-24"
                      placeholder="Describe the task..."
                      value={newTaskDesc}
                      onChange={e => setNewTaskDesc(e.target.value)}
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
                       <select
                         className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                         value={newTaskType === TaskType.GROUP ? 'Group' : (typeof newTaskType === 'string' ? newTaskType : (newTaskType === TaskType.SOS ? 'SOS' : newTaskType === TaskType.ONE_DAY ? '1 Day' : newTaskType === TaskType.TEN_DAYS ? '10 Day' : newTaskType === TaskType.MONTHLY ? 'Monthly' : newTaskType === TaskType.Quaterly ? 'Quaterly' : newTaskType === TaskType.INDIVIDUAL ? 'Individual' : ''))}
                         onChange={e => {
                           const v = e.target.value;
                           if (v === 'Group') setNewTaskType(TaskType.GROUP);
                           else setNewTaskType(v || '');
                         }}
                       >
                         <option value="">Select Type</option>
                         <option value="SOS">SOS</option>
                         <option value="1 Day">1 Day</option>
                         <option value="10 Day">10 Day</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                       <input 
                          type="date"
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                          value={newTaskDate}
                          onChange={e => setNewTaskDate(e.target.value)}
                       />
                    </div>
                 </div>

                 {/* Assignee / Reporting section - role based: TL = Assigned To + Reporting By, Intern = Reporting To only, Employee = Reporting By only, MD = Assigned To only */}
                 <div className="space-y-3">
                   {/* Team Leader: choose what to configure first */}
                   {currentUser.role === UserRole.TEAM_LEADER && (
                     <div>
                       <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Select</label>
                       <select
                         className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                         value={tlCreateTaskMode}
                         onChange={(e) => setTlCreateTaskMode(e.target.value as any)}
                       >
                         <option value="ASSIGN_TO">Assigned To</option>
                         <option value="REPORTING_BY">Reporting By</option>
                       </select>
                     </div>
                   )}

                   {/* MD: always show Assigned To. Team Leader: show Assigned To only if selected */}
                   {(currentUser.role === UserRole.MD || (currentUser.role === UserRole.TEAM_LEADER && tlCreateTaskMode === 'ASSIGN_TO')) && (
                    <>{newTaskType === TaskType.GROUP ? (
                        <>
                            <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2 bg-white">
                                {filteredUsersForAssign.map(u => (
                                    <label key={u.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={newTaskAssigneeIds.includes(u.id)}
                                            onChange={() => {
                                              if (newTaskAssigneeIds.includes(u.id)) {
                                                setNewTaskAssigneeIds(newTaskAssigneeIds.filter(id => id !== u.id));
                                              } else {
                                                setNewTaskAssigneeIds([...newTaskAssigneeIds, u.id]);
                                              }
                                            }}
                                            className="rounded text-brand-600 focus:ring-brand-500"
                                        />
                                        <div className="flex items-center space-x-2">
                                            <img src={u.avatar} className="w-6 h-6 rounded-full" alt=""/>
                                            <div className="text-sm">
                                                <p className="font-medium text-gray-800">{u.name}</p>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                                {filteredUsersForAssign.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No users found for this filter.</p>}
                            </div>
                            
                            {/* Group Selection Task Count Info */}
                            {newTaskAssigneeIds.length > 0 && (
                                <div className="mt-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center">
                                        <Info size={10} className="mr-1"/> 
                                        {newTaskType} Workload Summary
                                    </p>
                                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                                        {newTaskAssigneeIds.map(id => {
                                            const usersForDropdown = availableUsers.length > 0 ? availableUsers : users;
                                            const u = usersForDropdown.find(x => x.id === id);
                                            const stats = getTaskStats(id, newTaskType);
                                            return (
                                                <div key={id} className="text-xs flex justify-between text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                                    <span className="truncate max-w-[100px]">{u?.name}</span>
                                                    <span className="font-mono">
                                                        <span className="text-blue-600 font-bold">{stats.pending}</span> P / 
                                                        <span className="text-green-600 font-bold ml-1">{stats.completed}</span> C
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Assign To</label>
                            {multipleAssignees.map((assignee, index) => {
                              const assigneeNames = assigneeFilteredNames[index] || [];
                              const isLoading = isLoadingAssigneeNames[index] || false;
                              
                              const assigneeDesignationsList = assigneeDesignations[index] || [];
                              
                              return (
                                <div key={index} className="space-y-2">
                                  {/* Labels Row */}
                                  <div className="flex items-center gap-2">
                                    <div className="w-32">
                                      <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                                    </div>
                                    <div className="w-40">
                                      <label className="block text-sm font-bold text-gray-700 mb-1">Designation</label>
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-sm font-bold text-gray-700 mb-1">User</label>
                                    </div>
                                    <div className="w-10"></div>
                                    {multipleAssignees.length > 1 && <div className="w-10"></div>}
                                  </div>
                                  
                                  {/* Dropdowns Row */}
                                  <div className="flex items-center gap-2">
                                    {/* Role Dropdown */}
                                    <div className="w-32">
                                      <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                        value={assignee.role || ''}
                                        onChange={e => handleAssigneeRoleChange(index, e.target.value)}
                                      >
                                        <option value="">All Roles</option>
                                        {availableRoles.map(role => (
                                          <option key={role} value={role}>{role}</option>
                                        ))}
                                      </select>
                                    </div>
                                    
                                    {/* Designation Dropdown */}
                                    <div className="w-40">
                                      <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                        value={assignee.designation || ''}
                                        onChange={e => handleAssigneeDesignationChange(index, e.target.value)}
                                        disabled={!assignee.role || assignee.role === ''}
                                      >
                                        <option value="">{assignee.role ? 'All Designations' : 'Select role first'}</option>
                                        {assigneeDesignationsList.map(designation => (
                                          <option key={designation} value={designation}>{designation}</option>
                                        ))}
                                      </select>
                                    </div>
                                    
                                    {/* User Dropdown */}
                                    <div className="flex-1">
                                      <select 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                        value={assignee.assigneeId || ''}
                                        onChange={e => {
                                          const updated = [...multipleAssignees];
                                          updated[index] = { ...updated[index], assigneeId: e.target.value };
                                          setMultipleAssignees(updated);
                                        }}
                                        disabled={isLoading || assigneeNames.length === 0}
                                      >
                                        {isLoading ? (
                                          <option value="">Loading users...</option>
                                        ) : assigneeNames.length === 0 ? (
                                          <option value="">{assignee.role ? (assignee.designation ? `No users found` : 'Select designation') : 'Select role first'}</option>
                                        ) : (
                                          <>
                                            <option value="">Select User</option>
                                            {assigneeNames.map((nameItem, nameIndex) => {
                                              const name = typeof nameItem === 'string' 
                                                ? nameItem 
                                                : (nameItem?.name || nameItem?.Name || nameItem?.fullName || nameItem?.employee_name || 'Unknown');
                                              const id = nameItem?.id || nameItem?.Employee_id || nameItem?.employee_id || name || `name-${nameIndex}`;
                                              const usersForDropdown = availableUsers.length > 0 ? availableUsers : users;
                                              const user = usersForDropdown.find(u => u.name === name || u.id === id || u.id === name);
                                              const userId = user?.id || id || name;
                                              return (
                                                <option key={`${id}-${nameIndex}`} value={userId}>{name}</option>
                                              );
                                            })}
                                          </>
                                        )}
                                      </select>
                                    </div>
                                    
                                    {/* Add Button - only on last item */}
                                    {index === multipleAssignees.length - 1 && (
                                      <div className="w-10">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setMultipleAssignees([...multipleAssignees, { role: '', designation: '', assigneeId: '' }]);
                                          }}
                                          className="flex items-center justify-center w-10 h-10 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm"
                                          title="Add another assignee"
                                        >
                                          <Plus size={18} />
                                        </button>
                                      </div>
                                    )}
                                    
                                    {/* Remove Button - show if more than one */}
                                    {multipleAssignees.length > 1 && (
                                      <div className="w-10">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = multipleAssignees.filter((_, i) => i !== index);
                                            const updatedNames = { ...assigneeFilteredNames };
                                            const updatedLoading = { ...isLoadingAssigneeNames };
                                            const updatedDesignations = { ...assigneeDesignations };
                                            delete updatedNames[index];
                                            delete updatedLoading[index];
                                            delete updatedDesignations[index];
                                            // Reindex
                                            const reindexedNames: Record<number, any[]> = {};
                                            const reindexedLoading: Record<number, boolean> = {};
                                            const reindexedDesignations: Record<number, string[]> = {};
                                            Object.keys(updatedNames).forEach(key => {
                                              const oldIdx = parseInt(key);
                                              if (oldIdx > index) {
                                                reindexedNames[oldIdx - 1] = updatedNames[oldIdx];
                                                reindexedLoading[oldIdx - 1] = updatedLoading[oldIdx];
                                                reindexedDesignations[oldIdx - 1] = updatedDesignations[oldIdx];
                                              } else {
                                                reindexedNames[oldIdx] = updatedNames[oldIdx];
                                                reindexedLoading[oldIdx] = updatedLoading[oldIdx];
                                                reindexedDesignations[oldIdx] = updatedDesignations[oldIdx];
                                              }
                                            });
                                            setMultipleAssignees(updated);
                                            setAssigneeFilteredNames(reindexedNames);
                                            setIsLoadingAssigneeNames(reindexedLoading);
                                            setAssigneeDesignations(reindexedDesignations);
                                          }}
                                          className="flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
                                          title="Remove this assignee"
                                        >
                                          <span className="text-lg leading-none">×</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                    )}
                   </>)}
                   {/* TL Reporting By / Employee Reporting By / Intern Reporting To: multiple Role/Designation/User rows with + button */}
                   {((currentUser.role === UserRole.TEAM_LEADER && tlCreateTaskMode === 'REPORTING_BY') || currentUser.role === UserRole.EMPLOYEE || currentUser.role === UserRole.INTERN) && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">
                        {currentUser.role === UserRole.INTERN ? 'Reporting To' : 'Reporting By'}
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="w-32">
                          <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                        </div>
                        <div className="w-40">
                          <label className="block text-sm font-bold text-gray-700 mb-1">Designation</label>
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-bold text-gray-700 mb-1">User</label>
                        </div>
                        <div className="w-10" />
                        {multipleReportingBy.length > 1 && <div className="w-10" />}
                      </div>
                      {multipleReportingBy.map((row, index) => {
                        const names = reportingByNamesByIndex[index] ?? [];
                        const designations = reportingByDesignationsByIndex[index] ?? [];
                        const loading = isLoadingReportingByByIndex[index];
                        const isEmployee = currentUser.role === UserRole.EMPLOYEE;
                        return (
                          <div key={`reporting-by-row-${index}`} className="flex items-start gap-2">
                            <div className="flex flex-1 items-center gap-2">
                              <div className="w-32">
                                <select
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                  value={row.role}
                                  onChange={async (e) => {
                                    const role = e.target.value;
                                    const updated = [...multipleReportingBy];
                                    updated[index] = { ...updated[index], role, designation: '', userId: '' };
                                    setMultipleReportingBy(updated);
                                    if (index === 0) {
                                      setReportingByRole(role);
                                      setReportingByDesignation('');
                                      setReportingByUserId('');
                                      setReportingById('');
                                      setReportingToId('');
                                    }
                                    await fetchDesignationsForReportingByRow(index, role);
                                    await fetchNamesForReportingByRow(index, role, '');
                                  }}
                                >
                                  <option value="">All Roles</option>
                                  {availableRoles.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="w-40">
                                <select
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                  value={row.designation}
                                  onChange={async (e) => {
                                    const des = e.target.value;
                                    const updated = [...multipleReportingBy];
                                    updated[index] = { ...updated[index], designation: des, userId: '' };
                                    setMultipleReportingBy(updated);
                                    if (index === 0) {
                                      setReportingByDesignation(des);
                                      setReportingByUserId('');
                                      setReportingById('');
                                      setReportingToId('');
                                    }
                                    await fetchNamesForReportingByRow(index, row.role, des);
                                  }}
                                  disabled={!row.role}
                                >
                                  <option value="">{row.role ? 'All Designations' : 'Select role first'}</option>
                                  {designations.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex-1">
                                <select
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                  value={row.userId || (isEmployee && names.length === 0 && !row.role ? currentUser.id : '')}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const updated = [...multipleReportingBy];
                                    updated[index] = { ...updated[index], userId: v };
                                    setMultipleReportingBy(updated);
                                    if (index === 0) {
                                      setReportingByUserId(v);
                                      setReportingById(v);
                                      setReportingToId(v);
                                    }
                                  }}
                                  disabled={loading || (names.length === 0 && row.role !== '')}
                                >
                                  {loading ? (
                                    <option value="">Loading users...</option>
                                  ) : names.length === 0 && row.role ? (
                                    <option value="">{row.designation ? 'No users found' : 'Select designation'}</option>
                                  ) : names.length === 0 && !row.role && isEmployee ? (
                                    <>
                                      <option value={currentUser.id}>{currentUser.name} (me)</option>
                                      {(availableUsers.length > 0 ? availableUsers : users).filter(u => u.id !== currentUser.id).map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                      ))}
                                    </>
                                  ) : names.length === 0 ? (
                                    <option value="">Select role first</option>
                                  ) : (
                                    <>
                                      <option value="">Select User</option>
                                      {isEmployee && <option value={currentUser.id}>{currentUser.name} (me)</option>}
                                      {names.map((nameItem: any, nameIndex: number) => {
                                        const name = typeof nameItem === 'string'
                                          ? nameItem
                                          : (nameItem?.name || nameItem?.Name || nameItem?.fullName || nameItem?.employee_name || 'Unknown');
                                        const id = nameItem?.id || nameItem?.Employee_id || nameItem?.employee_id || name || `rb-${index}-${nameIndex}`;
                                        const usersForDropdown = availableUsers.length > 0 ? availableUsers : users;
                                        const user = usersForDropdown.find(u => u.name === name || u.id === id || u.id === name);
                                        const userId = user?.id || id || name;
                                        if (isEmployee && userId === currentUser.id) return null;
                                        return (
                                          <option key={`${id}-${index}-${nameIndex}`} value={userId}>{name}</option>
                                        );
                                      })}
                                    </>
                                  )}
                                </select>
                              </div>
                              {index === multipleReportingBy.length - 1 && (
                                <div className="w-10">
                                  <button
                                    type="button"
                                    onClick={() => setMultipleReportingBy([...multipleReportingBy, { role: '', designation: '', userId: '' }])}
                                    className="flex items-center justify-center w-10 h-10 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm"
                                    title="Add another (Role, Designation, User)"
                                  >
                                    <Plus size={18} />
                                  </button>
                                </div>
                              )}
                              {multipleReportingBy.length > 1 && (
                                <div className="w-10">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = multipleReportingBy.filter((_, i) => i !== index);
                                      const updatedNames = { ...reportingByNamesByIndex };
                                      const updatedDes = { ...reportingByDesignationsByIndex };
                                      const updatedLoading = { ...isLoadingReportingByByIndex };
                                      delete updatedNames[index];
                                      delete updatedDes[index];
                                      delete updatedLoading[index];
                                      const reindexedNames: Record<number, any[]> = {};
                                      const reindexedDes: Record<number, string[]> = {};
                                      const reindexedLoading: Record<number, boolean> = {};
                                      Object.keys(updatedNames).forEach(k => {
                                        const oldIdx = parseInt(k);
                                        const newIdx = oldIdx > index ? oldIdx - 1 : oldIdx;
                                        reindexedNames[newIdx] = updatedNames[oldIdx];
                                        reindexedDes[newIdx] = updatedDes[oldIdx];
                                        reindexedLoading[newIdx] = updatedLoading[oldIdx];
                                      });
                                      setMultipleReportingBy(updated);
                                      setReportingByNamesByIndex(reindexedNames);
                                      setReportingByDesignationsByIndex(reindexedDes);
                                      setIsLoadingReportingByByIndex(reindexedLoading);
                                      if (index === 0 && updated[0]) {
                                        setReportingByRole(updated[0].role);
                                        setReportingByDesignation(updated[0].designation);
                                        setReportingByUserId(updated[0].userId);
                                        setReportingById(updated[0].userId);
                                        setReportingToId(updated[0].userId);
                                      }
                                    }}
                                    className="flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
                                    title="Remove this row"
                                  >
                                    <span className="text-lg leading-none">×</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                   )}
                 </div>
              </div>

              <div className="flex justify-end space-x-3 mt-8">
                <button 
                  onClick={() => setShowAddModal(false)} 
                  disabled={isCreatingTask}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateTask} 
                  disabled={isCreatingTask}
                  className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isCreatingTask ? (
                    <>
                      <Clock size={16} className="mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Task'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: Assign Task view (current implementation)
  return (
    <div className="space-y-6">
      {/* Task page header: Reporting Task | Assigned Task tabs + Create Task button on right */}
      {setActiveTab && (
        <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('reportingTask')}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Reporting Task
            </button>
            <button
              onClick={() => setActiveTab('assignTask')}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-brand-600 text-white"
            >
              Assigned Task
            </button>
          </div>
          <div className="flex items-center gap-2">
            {currentUser.role === UserRole.MD && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white shadow-sm transition-transform hover:scale-105 bg-brand-600 hover:bg-brand-700"
              >
                <Plus size={18} />
                <span>Assign Task</span>
              </button>
            )}
            {/* On Assigned Task page, hide Create Task button for Employee, Intern, and Team Leader. */}
            {currentUser.role !== UserRole.MD &&
             currentUser.role !== UserRole.ADMIN &&
             currentUser.role !== UserRole.EMPLOYEE &&
             currentUser.role !== UserRole.INTERN &&
             currentUser.role !== UserRole.TEAM_LEADER && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white shadow-sm transition-transform hover:scale-105 bg-brand-600 hover:bg-brand-700"
              >
                <Plus size={18} />
                <span>Create Task</span>
              </button>
            )}
          </div>
        </div>
      )}
      {/* Assigned Tasks title with search and date filter */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar size={28} className="text-brand-600" />
              Assigned Tasks
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by title or created by..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              {currentUser.role === UserRole.MD && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-w-[140px]"
                >
                  <option value="">All branches</option>
                  {availableBranches.map((b) => (
                    <option key={b} value={b}>{String(b).replace(/_/g, ' ')}</option>
                  ))}
                </select>
              )}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-w-[100px]"
              >
                <option value="ALL">All types</option>
                <option value={TaskType.SOS}>SOS</option>
                <option value={TaskType.ONE_DAY}>1 Day</option>
                <option value={TaskType.TEN_DAYS}>10 Day</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 min-w-[120px]"
              >
                <option value="ALL">All status</option>
                <option value={TaskStatus.COMPLETED}>Completed</option>
                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                <option value={TaskStatus.PENDING}>Pending</option>
              </select>
              <input
                type="date"
                value={assignedDateFilter || ''}
                onChange={(e) => setAssignedDateFilter(e.target.value || null)}
                className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              {assignedDateFilter && (
                <button
                  onClick={() => setAssignedDateFilter(null)}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  All dates
                </button>
              )}
            </div>
          </div>
        </div>

      {/* Task Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingTasks ? (
          <div className="col-span-full text-center py-20 text-gray-400">
            <Clock size={48} className="mx-auto mb-4 opacity-50 animate-spin" />
            <p>Loading tasks...</p>
          </div>
        ) : taskError ? (
          <div className="col-span-full text-center py-20">
            <AlertCircle size={48} className="mx-auto mb-4 text-red-400" />
            <p className="text-red-500 mb-2">Error loading tasks: {taskError}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="text-sm text-brand-600 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : filteredTasks.length === 0 ? (
           <div className="col-span-full text-center py-20 text-gray-400">
             <CheckCircle2 size={48} className="mx-auto mb-4 opacity-50" />
             <p>No tasks assigned to you yet.</p>
             <p className="text-sm mt-2">Tasks assigned to you will appear here.</p>
           </div>
        ) : (
          filteredTasks.map(task => {
            // Resolve assignee by id, name, email, or Employee_id so "Assigned to" shows correct name for MD/TL
            const assignee = users.find(u =>
              u.id === task.assigneeId ||
              u.name === task.assigneeId ||
              (typeof task.assigneeId === 'string' && u.email === task.assigneeId) ||
              String(u.id).toLowerCase() === String(task.assigneeId).toLowerCase() ||
              String((u as any).Employee_id) === String(task.assigneeId) ||
              String((u as any)['Employee ID']) === String(task.assigneeId)
            );
            // Find reporter - try to find by ID, name, or email
            const reporter = task.reporterId ? users.find(u => 
              u.id === task.reporterId || 
              u.name === task.reporterId ||
              u.email === task.reporterId ||
              String(u.id).toLowerCase() === String(task.reporterId).toLowerCase()
            ) : null;
            const isOverdue = new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
            
            // Handle multiple assignees for display (match by id, name, or Employee_id)
            const allAssignees = task.assigneeIds
              ? users.filter(u => task.assigneeIds?.some(id =>
                  u.id === id || u.name === id || String((u as any).Employee_id) === String(id) || String((u as any)['Employee ID']) === String(id)
                ))
              : (assignee ? [assignee] : []);
            const assigneeDisplayName = allAssignees.length > 0
              ? allAssignees.map(a => a.name).join(', ')
              : (assignee?.name || (typeof task.assigneeId === 'string' ? String(task.assigneeId).trim() : '') || 'Unknown');

            const typeLabels: Record<string, string> = {
              [TaskType.SOS]: 'SOS',
              [TaskType.ONE_DAY]: '1 Day',
              [TaskType.TEN_DAYS]: '10 Day',
              [TaskType.MONTHLY]: 'Monthly',
              [TaskType.Quaterly]: 'Quaterly',
              [TaskType.GROUP]: 'Group',
              [TaskType.INDIVIDUAL]: 'Individual',
            };
            return (
              <div key={task.id} className={`bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow ${task.type === TaskType.SOS ? 'border-red-400 shadow-red-100 ring-2 ring-red-100' : 'border-gray-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${task.type === TaskType.SOS ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {typeLabels[task.type] || task.type}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 mb-1.5 text-sm">{task.title}</h3>
                <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>

                <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-3">
                  <Clock size={14} className={isOverdue ? 'text-red-500' : 'text-gray-400'} />
                  <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                    Due: {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </div>

                {currentUser.role === UserRole.MD && (task.createdByName || reporter?.name) && (
                  <div className="text-xs text-gray-500 mb-1.5">
                    Created by: <strong className="text-brand-600">{task.createdByName || reporter?.name}</strong>
                  </div>
                )}
                {currentUser.role !== UserRole.MD && reporter && (
                  <div className="text-xs text-gray-500 mb-1.5">
                    Assigned by: <strong className="text-brand-600">{reporter.name}</strong>
                  </div>
                )}
                <div className="text-xs text-gray-500 mb-2">
                  Assigned to: <strong className="text-brand-600">{assigneeDisplayName}</strong>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <button onClick={() => setSelectedTask(task)} className="text-brand-600 hover:text-brand-700 text-xs font-medium">
                    View Details
                  </button>

                  {/* Status Dropdown */}
                  <div className="relative status-dropdown-container">
                    <button
                      onClick={() => setOpenStatusDropdown(openStatusDropdown === task.id ? null : task.id)}
                      disabled={changingStatusTaskId === task.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                         task.status === TaskStatus.COMPLETED
                           ? 'bg-green-100 text-green-700 border-green-300'
                           : task.status === TaskStatus.IN_PROGRESS
                           ? 'bg-blue-100 text-blue-700 border-blue-300'
                           : 'bg-red-100 text-red-700 border-red-300'
                       } ${changingStatusTaskId === task.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
                    >
                      {changingStatusTaskId === task.id ? (
                        'Updating...'
                      ) : (
                        <>
                          {task.status === TaskStatus.COMPLETED ? 'COMPLETED' : 
                           task.status === TaskStatus.IN_PROGRESS ? 'IN PROGRESS' : 'PENDING'}
                          <ChevronDown size={12} className={openStatusDropdown === task.id ? 'rotate-180' : ''} />
                        </>
                      )}
                    </button>

                    {openStatusDropdown === task.id && changingStatusTaskId !== task.id && (
                      <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                        <button
                          onClick={() => {
                            handleStatusChange(task.id, TaskStatus.PENDING);
                            setOpenStatusDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-red-50 first:rounded-t-lg ${
                              task.status === TaskStatus.PENDING ? 'bg-red-100 font-semibold text-red-700' : 'text-gray-700'
                          }`}
                        >
                          PENDING
                        </button>
                        <button
                          onClick={() => {
                            handleStatusChange(task.id, TaskStatus.IN_PROGRESS);
                            setOpenStatusDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${
                            task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 font-semibold text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          IN PROGRESS
                        </button>
                        <button
                          onClick={() => {
                            handleStatusChange(task.id, TaskStatus.COMPLETED);
                            setOpenStatusDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-green-50 last:rounded-b-lg ${
                            task.status === TaskStatus.COMPLETED ? 'bg-green-100 font-semibold text-green-700' : 'text-gray-700'
                          }`}
                        >
                          COMPLETED
                        </button>
                      </div>
                    )}
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)} 
          currentUser={currentUser}
        />
      )}

      {/* Create Task / Assign Task Modal - do not show Create Task card for Employee/Intern/Team Leader on Assigned Task page */}
      {showAddModal && (currentUser.role === UserRole.MD || (currentUser.role !== UserRole.EMPLOYEE && currentUser.role !== UserRole.INTERN && currentUser.role !== UserRole.TEAM_LEADER)) && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-2">
              {currentUser.role === UserRole.MD ? 'Assign New Task' : 'Create Task'}
            </h3>
            
            <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    placeholder="Task Title"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                  />
               </div>
               
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none h-24"
                    placeholder="Describe the task..."
                    value={newTaskDesc}
                    onChange={e => setNewTaskDesc(e.target.value)}
                  />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Task Type</label>
                     <select
                       className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                       value={newTaskType === TaskType.GROUP ? 'Group' : (typeof newTaskType === 'string' ? newTaskType : (newTaskType === TaskType.SOS ? 'SOS' : newTaskType === TaskType.ONE_DAY ? '1 Day' : newTaskType === TaskType.TEN_DAYS ? '10 Day' : newTaskType === TaskType.MONTHLY ? 'Monthly' : newTaskType === TaskType.Quaterly ? 'Quaterly' : newTaskType === TaskType.INDIVIDUAL ? 'Individual' : ''))}
                       onChange={e => {
                         const v = e.target.value;
                         if (v === 'Group') setNewTaskType(TaskType.GROUP);
                         else setNewTaskType(v || '');
                       }}
                     >
                       <option value="">Select Type</option>
                       <option value="SOS">SOS</option>
                       <option value="1 Day">1 Day</option>
                       <option value="10 Day">10 Day</option>
                     </select>
                  </div>
                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                     <input 
                        type="date"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        value={newTaskDate}
                        onChange={e => setNewTaskDate(e.target.value)}
                     />
                  </div>
               </div>

               {canAssignTask && (
                 <div className="space-y-3">
                    {newTaskType === TaskType.GROUP ? (
                        <>
                            <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-2 bg-white">
                                {filteredUsersForAssign.map(u => (
                                    <label key={u.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={newTaskAssigneeIds.includes(u.id)}
                                            onChange={() => toggleAssignee(u.id)}
                                            className="rounded text-brand-600 focus:ring-brand-500"
                                        />
                                        <div className="flex items-center space-x-2">
                                            <img src={u.avatar} className="w-6 h-6 rounded-full" alt=""/>
                                            <div className="text-sm">
                                                <p className="font-medium text-gray-800">{u.name}</p>
                                                {/* <p className="text-xs text-gray-500">{u.designation}</p> */}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                                {filteredUsersForAssign.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No users found for this filter.</p>}
                            </div>
                            
                            {/* Group Selection Task Count Info */}
                            {newTaskAssigneeIds.length > 0 && (
                                <div className="mt-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                    <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center">
                                        <Info size={10} className="mr-1"/> 
                                        {newTaskType} Workload Summary
                                    </p>
                                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                                        {newTaskAssigneeIds.map(id => {
                                            const usersForDropdown = availableUsers.length > 0 ? availableUsers : users;
                                            const u = usersForDropdown.find(x => x.id === id);
                                            const stats = getTaskStats(id, newTaskType);
                                            return (
                                                <div key={id} className="text-xs flex justify-between text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                                    <span className="truncate max-w-[100px]">{u?.name}</span>
                                                    <span className="font-mono">
                                                        <span className="text-blue-600 font-bold">{stats.pending}</span> P / 
                                                        <span className="text-green-600 font-bold ml-1">{stats.completed}</span> C
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-3">
                            {multipleAssignees.map((assignee, index) => {
                              const assigneeNames = assigneeFilteredNames[index] || [];
                              const isLoading = isLoadingAssigneeNames[index] || false;
                              const assigneeDesignationsList = assigneeDesignations[index] || [];
                              
                              return (
                                <div key={index} className="space-y-2">
                                  {/* Labels Row */}
                                  <div className="flex items-center gap-2">
                                    <div className="w-32">
                                      <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                                    </div>
                                    <div className="w-40">
                                      <label className="block text-sm font-bold text-gray-700 mb-1">Designation</label>
                                    </div>
                                    <div className="flex-1">
                                      <label className="block text-sm font-bold text-gray-700 mb-1">User</label>
                                    </div>
                                    <div className="w-10"></div>
                                    {multipleAssignees.length > 1 && <div className="w-10"></div>}
                                  </div>
                                  
                                  {/* Dropdowns Row */}
                                  <div className="flex items-center gap-2">
                                    {/* Role Dropdown */}
                                    <div className="w-32">
                                      <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                        value={assignee.role || ''}
                                        onChange={e => handleAssigneeRoleChange(index, e.target.value)}
                                      >
                                        <option value="">All Roles</option>
                                        {availableRoles.map(role => (
                                          <option key={role} value={role}>{role}</option>
                                        ))}
                                      </select>
                                    </div>
                                    
                                    {/* Designation Dropdown */}
                                    <div className="w-40">
                                      <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                        value={assignee.designation || ''}
                                        onChange={e => handleAssigneeDesignationChange(index, e.target.value)}
                                        disabled={!assignee.role || assignee.role === ''}
                                      >
                                        <option value="">{assignee.role ? 'All Designations' : 'Select role first'}</option>
                                        {assigneeDesignationsList.map(designation => (
                                          <option key={designation} value={designation}>{designation}</option>
                                        ))}
                                      </select>
                                    </div>
                                    
                                    {/* User Dropdown */}
                                    <div className="flex-1">
                                      <select 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 focus:outline-none"
                                        value={assignee.assigneeId || ''}
                                        onChange={e => {
                                          const updated = [...multipleAssignees];
                                          updated[index] = { ...updated[index], assigneeId: e.target.value };
                                          setMultipleAssignees(updated);
                                        }}
                                        disabled={isLoading || assigneeNames.length === 0}
                                      >
                                        {isLoading ? (
                                          <option value="">Loading users...</option>
                                        ) : assigneeNames.length === 0 ? (
                                          <option value="">{assignee.role ? (assignee.designation ? `No users found` : 'Select designation') : 'Select role first'}</option>
                                        ) : (
                                          <>
                                            <option value="">Select User</option>
                                            {assigneeNames.map((nameItem, nameIndex) => {
                                              const name = typeof nameItem === 'string' 
                                                ? nameItem 
                                                : (nameItem?.name || nameItem?.Name || nameItem?.fullName || nameItem?.employee_name || 'Unknown');
                                              const id = nameItem?.id || nameItem?.Employee_id || nameItem?.employee_id || name || `name-${nameIndex}`;
                                              const usersForDropdown = availableUsers.length > 0 ? availableUsers : users;
                                              const user = usersForDropdown.find(u => u.name === name || u.id === id || u.id === name);
                                              const userId = user?.id || id || name;
                                              return (
                                                <option key={`${id}-${nameIndex}`} value={userId}>{name}</option>
                                              );
                                            })}
                                          </>
                                        )}
                                      </select>
                                    </div>
                                    
                                    {/* Add Button - only on last item */}
                                    {index === multipleAssignees.length - 1 && (
                                      <div className="w-10">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setMultipleAssignees([...multipleAssignees, { role: '', designation: '', assigneeId: '' }]);
                                          }}
                                          className="flex items-center justify-center w-10 h-10 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm"
                                          title="Add another assignee"
                                        >
                                          <Plus size={18} />
                                        </button>
                                      </div>
                                    )}
                                    
                                    {/* Remove Button - show if more than one */}
                                    {multipleAssignees.length > 1 && (
                                      <div className="w-10">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = multipleAssignees.filter((_, i) => i !== index);
                                            const updatedNames = { ...assigneeFilteredNames };
                                            const updatedLoading = { ...isLoadingAssigneeNames };
                                            const updatedDesignations = { ...assigneeDesignations };
                                            delete updatedNames[index];
                                            delete updatedLoading[index];
                                            delete updatedDesignations[index];
                                            // Reindex
                                            const reindexedNames: Record<number, any[]> = {};
                                            const reindexedLoading: Record<number, boolean> = {};
                                            const reindexedDesignations: Record<number, string[]> = {};
                                            Object.keys(updatedNames).forEach(key => {
                                              const oldIdx = parseInt(key);
                                              if (oldIdx > index) {
                                                reindexedNames[oldIdx - 1] = updatedNames[oldIdx];
                                                reindexedLoading[oldIdx - 1] = updatedLoading[oldIdx];
                                                reindexedDesignations[oldIdx - 1] = updatedDesignations[oldIdx];
                                              } else {
                                                reindexedNames[oldIdx] = updatedNames[oldIdx];
                                                reindexedLoading[oldIdx] = updatedLoading[oldIdx];
                                                reindexedDesignations[oldIdx] = updatedDesignations[oldIdx];
                                              }
                                            });
                                            setMultipleAssignees(updated);
                                            setAssigneeFilteredNames(reindexedNames);
                                            setIsLoadingAssigneeNames(reindexedLoading);
                                            setAssigneeDesignations(reindexedDesignations);
                                          }}
                                          className="flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
                                          title="Remove this assignee"
                                        >
                                          <span className="text-lg leading-none">×</span>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                    )}
                 </div>
               )}
            </div>

            <div className="flex justify-end space-x-3 mt-8">
              <button 
                onClick={() => setShowAddModal(false)} 
                disabled={isCreatingTask}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateTask} 
                disabled={isCreatingTask}
                className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isCreatingTask ? (
                  <>
                    <Clock size={16} className="mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Task'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TaskDetailModal: React.FC<{ task: Task; onClose: () => void; currentUser: User }> = ({ task, onClose, currentUser }) => {
  const [aiHelp, setAiHelp] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: string; message: string; date: string; time: string }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Fetch messages when modal opens
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        // Extract numeric ID from task ID (backend expects integer)
        let taskIdToFetch: string | number = task.id;
        if (typeof task.id === 'string' && task.id.startsWith('t')) {
          // Extract number from string like "t1767789989844-0.11216026287831349"
          const match = task.id.match(/\d+/);
          if (match) {
            taskIdToFetch = parseInt(match[0], 10);
          }
        }
        const taskMessages = await apiGetTaskMessages(taskIdToFetch);
        setMessages(taskMessages);
      } catch (err: any) {
        console.error('Error fetching messages:', err);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    fetchMessages();
  }, [task.id]);

  const handleAiAssist = async () => {
    setLoadingAi(true);
    const help = await getTaskAssistance(task.description);
    setAiHelp(help);
    setLoadingAi(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setIsSendingMessage(true);
    try {
      await apiSendTaskMessage(task.id, newMessage.trim());
      setNewMessage('');
      // Refresh messages after sending
      const updatedMessages = await apiGetTaskMessages(task.id);
      setMessages(updatedMessages);
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert(`Failed to send message: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-float">
        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
          <div>
             <h2 className="text-2xl font-bold text-gray-800 leading-tight">{task.title}</h2>
             <div className="flex items-center space-x-2 mt-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${task.type === TaskType.SOS ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                  {task.type === TaskType.ONE_DAY ? '1 Day' :
                   task.type === TaskType.TEN_DAYS ? '10 Day' :
                   task.type === TaskType.MONTHLY ? 'Monthly' :
                   task.type === TaskType.Quaterly ? 'Quaterly' :
                   task.type === TaskType.GROUP ? 'Group' :
                   task.type === TaskType.INDIVIDUAL ? 'Individual' :
                   task.type}
                </span>
                <span className="text-xs text-gray-500">ID: #{task.id}</span>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-2 shadow-sm">
            <div className="text-xl leading-none">&times;</div>
          </button>
        </div>
        
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="prose prose-sm max-w-none">
             <h4 className="text-gray-900 font-semibold mb-2 flex items-center"><CheckSquare className="w-4 h-4 mr-2"/> Description</h4>
            <p className="text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">{task.description}</p>
          </div>

          {/* AI Helper Section */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-100">
             <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-purple-800 flex items-center"><Sparkles size={16} className="mr-2"/> AI Assistant</h4>
                <button 
                  onClick={handleAiAssist} 
                  disabled={loadingAi}
                  className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition shadow-sm"
                >
                  {loadingAi ? 'Thinking...' : 'Get Suggestions'}
                </button>
             </div>
             {aiHelp ? (
               <div className="text-sm text-gray-700 whitespace-pre-line bg-white/50 p-3 rounded-lg">
                 {aiHelp}
               </div>
             ) : (
               <p className="text-xs text-purple-400 italic">Need help starting? Ask AI for a breakdown.</p>
             )}
          </div>

          <div>
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
              <Send className="w-4 h-4 mr-2" /> Messages
            </h4>
            <div className="space-y-4 mb-4 max-h-64 overflow-y-auto">
              {isLoadingMessages ? (
                <p className="text-sm text-gray-400 italic">Loading messages...</p>
              ) : messages.length > 0 ? (
                messages.map((msg, index) => {
                  const isCurrentUser = msg.sender === currentUser.id || msg.sender === String(currentUser.id);
                  return (
                    <div key={index} className={`flex space-x-3 ${isCurrentUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isCurrentUser ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {msg.sender ? String(msg.sender).charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className={`p-3 rounded-lg border ${
                        isCurrentUser 
                          ? 'bg-brand-50 border-brand-200 rounded-tr-none' 
                          : 'bg-gray-50 border-gray-100 rounded-tl-none'
                      }`}>
                        <p className="text-xs text-gray-500 mb-1">
                          {msg.date} {msg.time}
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {msg.message.replace(/^"|"$/g, '')}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-400 italic">No messages yet. Start the conversation!</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-gray-200">
              <input 
                type="text" 
                placeholder="Type a message..." 
                className="flex-1 bg-transparent px-3 py-2 focus:outline-none text-sm border border-gray-200 rounded-lg focus:border-brand-500" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isSendingMessage}
              />
              <button 
                onClick={handleSendMessage}
                disabled={isSendingMessage || !newMessage.trim()}
                className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSendingMessage ? (
                  <Clock size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Quick Icon
function CheckSquare(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
}
