
import React, { useState, useEffect } from 'react';
import { Task, TaskType, TaskStatus, User, UserRole, Project } from '../types';
import { AlertCircle, Calendar, CheckCircle2, Clock, MoreVertical, Plus, Send, Upload, Sparkles, User as UserIcon, Users as UsersIcon, Filter, Info, ChevronDown } from 'lucide-react';
import { getTaskAssistance } from '../services/gemini';
import api, { 
  getRoles as apiGetRoles,
  getDesignations as apiGetDesignations,
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

interface TaskBoardProps {
  currentUser: User;
  tasks: Task[];
  users: User[];
  projects: Project[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  viewMode?: 'assign' | 'reporting'; // New prop to control view mode
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ currentUser, tasks, users, projects, setTasks, viewMode = 'assign' }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
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
  
  // Filtered Names from API (based on role and designation)
  const [filteredNames, setFilteredNames] = useState<any[]>([]);
  const [isLoadingNames, setIsLoadingNames] = useState(false);
  
  // Task Types from API
  const [availableTaskTypes, setAvailableTaskTypes] = useState<string[]>([]);
  const [isLoadingTaskTypes, setIsLoadingTaskTypes] = useState(false);

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
        // Fetch task types from API - this is the PRIMARY and ONLY source
        console.log('🔄 [TASK BOARD] Modal opened - Fetching task types from API endpoint: /tasks/getTaskTypes/');
        console.log('🔄 [TASK BOARD] Current availableTaskTypes:', availableTaskTypes);
        
        const taskTypes = await apiGetTaskTypes();
        console.log('📋 [TASK BOARD] API Response - Raw task types:', taskTypes);
        console.log('📋 [TASK BOARD] API Response - Type:', typeof taskTypes, 'Is Array:', Array.isArray(taskTypes));
        
        // Ensure taskTypes is an array of strings
        const validTaskTypes = Array.isArray(taskTypes) 
          ? taskTypes.filter(t => t != null && typeof t === 'string' && t.trim() !== '')
          : [];
        
        console.log('✅ [TASK BOARD] Valid task types after filtering:', validTaskTypes);
        console.log('✅ [TASK BOARD] Number of valid types:', validTaskTypes.length);
        
        if (validTaskTypes.length > 0) {
          setAvailableTaskTypes(validTaskTypes);
          console.log('✅ [TASK BOARD] Successfully set', validTaskTypes.length, 'task types in state');
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
    const fetchTasks = async () => {
      setIsLoadingTasks(true);
      setTaskError(null);
      
      try {
        let apiTasks;
        if (viewMode === 'reporting') {
          console.log('🔍 [API CALL] Calling /tasks/viewTasks/ for reporting page');
          apiTasks = await apiViewTasks();
          console.log('📋 [API RESPONSE] /tasks/viewTasks/ returned:', apiTasks);
        } else {
          console.log('🔍 [API CALL] Calling /tasks/viewAssignedTasks/ for assign page');
          apiTasks = await apiViewAssignedTasks();
          console.log('📋 [API RESPONSE] /tasks/viewAssignedTasks/ returned:', apiTasks);
        }
        
        // Convert API tasks to frontend Task format
        const convertedTasks: Task[] = apiTasks.map((apiTask: any) => {
          // Handle different field names: task_type, type, current_status, status, assigned, assigned_to
          const rawApiType = (apiTask.task_type || apiTask.type || apiTask['task_type'] || apiTask['type'] || 'Individual').trim();
          const apiTypeLower = rawApiType.toLowerCase();
          const typeMap: Record<string, TaskType> = {
            'sos': TaskType.SOS, 'SOS': TaskType.SOS,
            '1 day': TaskType.ONE_DAY, '1 Day': TaskType.ONE_DAY,
            '10 day': TaskType.TEN_DAYS, '10 Day': TaskType.TEN_DAYS,
            'monthly': TaskType.MONTHLY, 'Monthly': TaskType.MONTHLY,
            'quaterly': TaskType.Quaterly, 'Quaterly': TaskType.Quaterly,
            'group': TaskType.GROUP, 'Group': TaskType.GROUP,
            'individual': TaskType.INDIVIDUAL, 'Individual': TaskType.INDIVIDUAL,
            'one_day': TaskType.ONE_DAY, 'ten_days': TaskType.TEN_DAYS,
          };
          const mappedType = typeMap[rawApiType] || typeMap[apiTypeLower] || TaskType.INDIVIDUAL;
          
          // Handle different status field names: current_status, status
          const apiStatus = (apiTask.current_status || apiTask.status || apiTask['current_status'] || apiTask['status'] || 'pending').toLowerCase();
          const statusMap: Record<string, TaskStatus> = {
            'pending': TaskStatus.PENDING, 'in_progress': TaskStatus.IN_PROGRESS, 'inprocess': TaskStatus.IN_PROGRESS,
            'completed': TaskStatus.COMPLETED, 'overdue': TaskStatus.OVERDUE,
          };
          const mappedStatus = statusMap[apiStatus] || TaskStatus.PENDING;
          
          // Handle different assigned field names: assigned, assigned_to, assigneeId
          // For viewTasks API: assignees is an array like [{ assignee: "Rohit P" }, { assignee: "kamu " }]
          // For viewAssignedTasks API: no assignees array, task is already filtered for current user
          let rawAssignedTo = apiTask.assigned || apiTask.assigned_to || apiTask['assigned'] || apiTask['assigned_to'] || apiTask.assigneeId || apiTask.assignee_id;
          
          // If assignees array exists (from viewTasks), extract first assignee name
          if (!rawAssignedTo && Array.isArray(apiTask.assignees) && apiTask.assignees.length > 0) {
            const firstAssignee = apiTask.assignees[0];
            if (firstAssignee?.assignee) {
              // Try to find user by name from the assignee name
              const assigneeName = firstAssignee.assignee.trim();
              const foundUser = users.find(u => 
                u.name === assigneeName || 
                u.name.toLowerCase() === assigneeName.toLowerCase() ||
                u.email === assigneeName
              );
              rawAssignedTo = foundUser?.id || assigneeName; // Use ID if found, otherwise use name as fallback
            }
          }
          
          // Fallback to current user if still not found
          if (!rawAssignedTo) {
            rawAssignedTo = currentUser.id;
          }
          
          // Get reporter/assigner - the person who created/assigned the task
          // Backend returns created_by as a name string (e.g., "mayur shinde")
          const rawReporterId = apiTask.reporterId || 
                                apiTask['reporterId'] || 
                                apiTask.created_by || 
                                apiTask['created_by'] || 
                                apiTask.reporter_id || 
                                apiTask.created_by_id || 
                                apiTask.created_by_name || 
                                apiTask['created_by_name'] || 
                                apiTask.assigner || 
                                apiTask['assigner'] || 
                                apiTask.assigned_by || 
                                apiTask['assigned_by'] || 
                                undefined;
          
          // If created_by is a name string, try to find the user ID
          let reporterId = rawReporterId;
          if (rawReporterId && typeof rawReporterId === 'string' && !rawReporterId.includes('-') && !rawReporterId.match(/^\d+$/)) {
            // Looks like a name, try to find user
            const foundReporter = users.find(u => 
              u.name === rawReporterId || 
              u.name.toLowerCase() === rawReporterId.toLowerCase() ||
              u.email === rawReporterId
            );
            if (foundReporter) {
              reporterId = foundReporter.id;
            }
          }
          
          // Debug logging to see what reporter field we're getting from API
          if (!rawReporterId) {
            console.warn('⚠️ [TASK] No reporter/assigner found in API response:', {
              taskId: apiTask.task_id || apiTask.id,
              taskTitle: apiTask.title,
              availableFields: Object.keys(apiTask),
              apiTask: apiTask
            });
          }
          
          // Clean description - remove [ExcludeFromMDReporting:true] markers
          let rawDescription = apiTask.description || apiTask['description'] || '';
          const cleanDescription = rawDescription
            .replace(/\n\n\[ExcludeFromMDReporting:\w+\]/g, '')
            .replace(/\n\[ExcludeFromMDReporting:\w+\]/g, '')
            .replace(/\[ExcludeFromMDReporting:\w+\]/g, '')
            .trim();
          
          // Extract task ID - prioritize task_id from backend (new format)
          // Backend returns task_id as the primary identifier
          let backendTaskId = apiTask.task_id || 
                              apiTask['task_id'] || 
                              apiTask.id || 
                              apiTask['id'] || 
                              apiTask['task-id'] ||
                              apiTask.pk || 
                              apiTask['pk'] ||
                              apiTask.taskId ||
                              apiTask['taskId'] ||
                              apiTask._id ||
                              apiTask['_id'];
          
          // If not found at top level, check nested structures
          if (!backendTaskId) {
            // Check if ID is in assignees array (sometimes tasks have ID in nested objects)
            if (Array.isArray(apiTask.assignees) && apiTask.assignees.length > 0) {
              const firstAssignee = apiTask.assignees[0];
              if (firstAssignee?.task_id || firstAssignee?.id) {
                backendTaskId = firstAssignee.task_id || firstAssignee.id;
              }
            }
            
            // Check if there's a nested task object
            if (apiTask.task && (apiTask.task.id || apiTask.task.task_id || apiTask.task.pk)) {
              backendTaskId = apiTask.task.id || apiTask.task.task_id || apiTask.task.pk;
            }
          }
          
          // Log the task ID extraction for debugging
          if (backendTaskId) {
            console.log('✅ [TASK CONVERSION] Task ID extracted:', {
              taskTitle: apiTask.title || apiTask['title'],
              extractedId: backendTaskId,
              idType: typeof backendTaskId,
              task_id: apiTask.task_id,
              id: apiTask.id,
              source: apiTask.task_id ? 'task_id' : apiTask.id ? 'id' : 'other'
            });
          } else {
            // Log all available fields to help debug
            console.error('❌ [TASK CONVERSION] No backend task ID found in API response:', {
              taskTitle: apiTask.title || apiTask['title'],
              availableFields: Object.keys(apiTask),
              allFields: JSON.stringify(apiTask, null, 2), // Full object for debugging
              sampleFields: {
                id: apiTask.id,
                task_id: apiTask.task_id,
                'task-id': apiTask['task-id'],
                pk: apiTask.pk,
                taskId: apiTask.taskId,
                _id: apiTask._id
              }
            });
            console.warn('⚠️ [TASK CONVERSION] Using fallback ID - status changes will not work until backend returns task IDs');
          }
          
          // Convert to string for Task.id (which is typed as string)
          // Store the backend ID separately if we have it, otherwise use fallback
          const taskIdString = backendTaskId ? String(backendTaskId) : `t${Date.now()}-${Math.random()}`;
          
          const task: Task & { _backendTaskId?: string | null } = {
            id: taskIdString,
            _backendTaskId: backendTaskId ? String(backendTaskId) : null, // Store actual backend ID for API calls
            title: apiTask.title || apiTask['title'] || 'Untitled Task',
            description: cleanDescription,
            type: mappedType,
            status: mappedStatus,
            assigneeId: rawAssignedTo,
            reporterId: reporterId || undefined,
            dueDate: apiTask.due_date || apiTask['due_date'] || apiTask['due-date'] || apiTask.dueDate || new Date().toISOString().split('T')[0],
            createdAt: apiTask.created_at || apiTask['created_at'] || apiTask.createdAt || new Date().toISOString(),
            comments: apiTask.comments || apiTask['comments'] || [],
            priority: (apiTask.priority || apiTask['priority'] || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
            projectId: apiTask.projectId || apiTask['projectId'] || apiTask.project_id || undefined,
          };
          
          return task;
        });
        
        const uniqueTasks = convertedTasks.filter((task, index, self) => 
          index === self.findIndex(t => t.id === task.id)
        );
        
        console.log('✅ [FINAL TASKS] Converted tasks count:', uniqueTasks.length);
        setTasks(uniqueTasks);
      } catch (err: any) {
        console.error('❌ [FETCH ERROR]', err);
        setTaskError(err.message || 'Failed to fetch tasks from server');
      } finally {
        setIsLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [currentUser, setTasks, viewMode]);

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

  // Filtering logic for Assign Task Page
  const filteredTasks = tasks.filter(task => {
    // Extract assignee information from task
    const taskAssigneeId = String(task.assigneeId || '').trim();
    const userId = String(currentUser.id || '').trim();
    const userName = String(currentUser.name || '').trim();
    const userEmail = String(currentUser.email || '').trim();
    
    // Check if task is assigned to current user (by ID, name, or email)
    const isAssignedToCurrentUser = 
      taskAssigneeId === userId || 
      taskAssigneeId === userName ||
      taskAssigneeId === userEmail ||
      taskAssigneeId.toLowerCase() === userId.toLowerCase() ||
      taskAssigneeId.toLowerCase() === userName.toLowerCase() ||
      taskAssigneeId.toLowerCase() === userEmail.toLowerCase() ||
      // Also check if any user in the users list matches
      users.some(u => {
        const uId = String(u.id).trim();
        const uName = String(u.name).trim();
        const uEmail = String(u.email).trim();
        return (
          (uId === taskAssigneeId || uId.toLowerCase() === taskAssigneeId.toLowerCase()) ||
          (uName === taskAssigneeId || uName.toLowerCase() === taskAssigneeId.toLowerCase()) ||
          (uEmail === taskAssigneeId || uEmail.toLowerCase() === taskAssigneeId.toLowerCase())
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
    if (filterType === 'ALL') return true;
    return task.type === filterType;
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
      
      // Collect all employee IDs from assignees
      const usersForDropdown = availableUsers.length > 0 ? availableUsers : users;
      const employeeIds: string[] = [];
      
      if (newTaskType === TaskType.GROUP) {
        // For GROUP tasks, use newTaskAssigneeIds
        for (const assigneeId of newTaskAssigneeIds) {
          const assigneeUser = usersForDropdown.find(u => u.id === assigneeId || u.name === assigneeId);
          if (assigneeUser) {
            const empId = getEmployeeIdFromUser(assigneeUser);
            if (empId) {
              employeeIds.push(empId);
            } else {
              console.warn(`⚠️ [CREATE TASK] Could not find Employee_id for user: ${assigneeUser.name}`);
            }
          } else {
            // If not found in users, try to use the ID directly (might already be an employee ID)
            employeeIds.push(String(assigneeId).trim());
          }
        }
      } else {
        // For individual tasks, use multipleAssignees
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
            if (empId) {
              employeeIds.push(empId);
            } else {
              console.warn(`⚠️ [CREATE TASK] Could not find Employee_id for user: ${assigneeUser.name}`);
            }
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
        assigned_to: employeeIds, // Array of employee IDs: ["444", "20018"]
      };
      
      console.log("📝 [CREATE TASK] Sending task data:", taskData);
      console.log("📝 [CREATE TASK] Employee IDs array:", employeeIds);
      
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
      
      // Refresh tasks from API to get the actual task with server-generated ID
      // Don't add locally first to avoid duplicates
      setTimeout(async () => {
        try {
          // Use the same endpoint as initial fetch (based on view mode)
          let apiTasks;
          if (viewMode === 'reporting') {
            // Reporting Page: Use /tasks/viewTasks/ to fetch all tasks
            apiTasks = await apiViewTasks();
          } else {
            // Assign Task Page: Use /tasks/viewAssignedTasks/ to fetch assigned tasks
            apiTasks = await apiViewAssignedTasks();
          }
          // Map backend type to frontend TaskType enum (reuse same logic)
          // Accept both new format (capitalized with spaces) and old formats (lowercase/underscores) for backward compatibility
          const typeMap: Record<string, TaskType> = {
            // New format (capitalized with spaces)
            'sos': TaskType.SOS,
            'SOS': TaskType.SOS,
            '1 day': TaskType.ONE_DAY,
            '1 Day': TaskType.ONE_DAY,
            '10 day': TaskType.TEN_DAYS,
            '10 Day': TaskType.TEN_DAYS,
            'monthly': TaskType.MONTHLY,
            'Monthly': TaskType.MONTHLY,
            'quaterly': TaskType.Quaterly,
            'Quaterly': TaskType.Quaterly,
            'group': TaskType.GROUP,
            'Group': TaskType.GROUP,
            'individual': TaskType.INDIVIDUAL,
            'Individual': TaskType.INDIVIDUAL,
            // Old format (for backward compatibility)
            'one_day': TaskType.ONE_DAY,
            'ten_days': TaskType.TEN_DAYS,
          };
          const statusMap: Record<string, TaskStatus> = {
            'pending': TaskStatus.PENDING,
            'in_progress': TaskStatus.IN_PROGRESS,
            'completed': TaskStatus.COMPLETED,
            'overdue': TaskStatus.OVERDUE,
          };
          
          const convertedTasks: Task[] = apiTasks.map((apiTask: any) => {
            const rawApiType = (apiTask.type || apiTask['type'] || 'Individual').trim();
            const apiTypeLower = rawApiType.toLowerCase();
            const apiStatus = (apiTask.status || apiTask['status'] || 'pending').toLowerCase();
            
            // Map API field names - check multiple possible field names for assignee and reporter
            const rawAssignedTo = apiTask.assigned_to || apiTask['assigned_to'] || apiTask.assigneeId || apiTask.assignee_id || currentUser.id;
            // Get reporter/assigner - the person who created/assigned the task (who was logged in when task was created)
            // Don't fallback to currentUser.id - use actual creator from backend
            const rawReporterId = apiTask.reporterId || apiTask['reporterId'] || apiTask.created_by || apiTask['created_by'] || apiTask.reporter_id || apiTask.created_by_id || apiTask.created_by_name || apiTask['created_by_name'] || apiTask.assigner || apiTask['assigner'] || apiTask.assigned_by || apiTask['assigned_by'] || undefined;
            
            return {
              id: apiTask.id || apiTask['id'] || `t${Date.now()}-${Math.random()}`,
              title: apiTask.title || apiTask['title'] || 'Untitled Task',
              description: apiTask.description || apiTask['description'] || '',
              type: typeMap[rawApiType] || typeMap[apiTypeLower] || TaskType.INDIVIDUAL,
              status: statusMap[apiStatus] || TaskStatus.PENDING,
              assigneeId: rawAssignedTo,
              reporterId: rawReporterId, // This will be set by backend to current user
              dueDate: apiTask.due_date || apiTask['due_date'] || apiTask.dueDate || new Date().toISOString().split('T')[0],
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
      let apiTasks;
      if (viewMode === 'reporting') {
        apiTasks = await apiViewTasks();
      } else {
        apiTasks = await apiViewAssignedTasks();
      }
      
      // Convert API tasks to frontend Task format (same logic as in useEffect)
      const convertedTasks: Task[] = apiTasks.map((apiTask: any) => {
        const rawApiType = (apiTask.task_type || apiTask.type || apiTask['task_type'] || apiTask['type'] || 'Individual').trim();
        const apiTypeLower = rawApiType.toLowerCase();
        const typeMap: Record<string, TaskType> = {
          'sos': TaskType.SOS, 'SOS': TaskType.SOS,
          '1 day': TaskType.ONE_DAY, '1 Day': TaskType.ONE_DAY,
          '10 day': TaskType.TEN_DAYS, '10 Day': TaskType.TEN_DAYS,
          'monthly': TaskType.MONTHLY, 'Monthly': TaskType.MONTHLY,
          'quaterly': TaskType.Quaterly, 'Quaterly': TaskType.Quaterly,
          'group': TaskType.GROUP, 'Group': TaskType.GROUP,
          'individual': TaskType.INDIVIDUAL, 'Individual': TaskType.INDIVIDUAL,
          'one_day': TaskType.ONE_DAY, 'ten_days': TaskType.TEN_DAYS,
        };
        const mappedType = typeMap[rawApiType] || typeMap[apiTypeLower] || TaskType.INDIVIDUAL;
        
        const apiStatus = (apiTask.current_status || apiTask.status || apiTask['current_status'] || apiTask['status'] || 'pending').toLowerCase();
        const statusMap: Record<string, TaskStatus> = {
          'pending': TaskStatus.PENDING, 'in_progress': TaskStatus.IN_PROGRESS, 'inprocess': TaskStatus.IN_PROGRESS,
          'completed': TaskStatus.COMPLETED, 'overdue': TaskStatus.OVERDUE,
        };
        const mappedStatus = statusMap[apiStatus] || TaskStatus.PENDING;
        
        // Handle assignees array format (from viewTasks API)
        let rawAssignedTo = apiTask.assigned || apiTask.assigned_to || apiTask['assigned'] || apiTask['assigned_to'] || apiTask.assigneeId || apiTask.assignee_id;
        
        // If assignees array exists (from viewTasks), extract first assignee name
        if (!rawAssignedTo && Array.isArray(apiTask.assignees) && apiTask.assignees.length > 0) {
          const firstAssignee = apiTask.assignees[0];
          if (firstAssignee?.assignee) {
            const assigneeName = firstAssignee.assignee.trim();
            const foundUser = users.find(u => 
              u.name === assigneeName || 
              u.name.toLowerCase() === assigneeName.toLowerCase() ||
              u.email === assigneeName
            );
            rawAssignedTo = foundUser?.id || assigneeName;
          }
        }
        
        if (!rawAssignedTo) {
          rawAssignedTo = currentUser.id;
        }
        
        // Get reporter/assigner - backend returns created_by as a name string
        const rawReporterId = apiTask.reporterId || 
                              apiTask['reporterId'] || 
                              apiTask.created_by || 
                              apiTask['created_by'] || 
                              apiTask.reporter_id || 
                              apiTask.created_by_id || 
                              apiTask.created_by_name || 
                              apiTask['created_by_name'] || 
                              apiTask.assigner || 
                              apiTask['assigner'] || 
                              apiTask.assigned_by || 
                              apiTask['assigned_by'] || 
                              undefined;
        
        // If created_by is a name string, try to find the user ID
        let reporterId = rawReporterId;
        if (rawReporterId && typeof rawReporterId === 'string' && !rawReporterId.includes('-') && !rawReporterId.match(/^\d+$/)) {
          const foundReporter = users.find(u => 
            u.name === rawReporterId || 
            u.name.toLowerCase() === rawReporterId.toLowerCase() ||
            u.email === rawReporterId
          );
          if (foundReporter) {
            reporterId = foundReporter.id;
          }
        }
        
        let rawDescription = apiTask.description || apiTask['description'] || '';
        const cleanDescription = rawDescription
          .replace(/\n\n\[ExcludeFromMDReporting:\w+\]/g, '')
          .replace(/\n\[ExcludeFromMDReporting:\w+\]/g, '')
          .replace(/\[ExcludeFromMDReporting:\w+\]/g, '')
          .trim();
        
        // Extract task ID - prioritize task_id from backend (new format)
        let backendTaskId = apiTask.task_id || 
                            apiTask['task_id'] || 
                            apiTask.id || 
                            apiTask['id'] || 
                            apiTask['task-id'] ||
                            apiTask.pk || 
                            apiTask['pk'] ||
                            apiTask.taskId ||
                            apiTask['taskId'] ||
                            apiTask._id ||
                            apiTask['_id'];
        
        // If not found at top level, check nested structures
        if (!backendTaskId) {
          // Check if ID is in assignees array (sometimes tasks have ID in nested objects)
          if (Array.isArray(apiTask.assignees) && apiTask.assignees.length > 0) {
            const firstAssignee = apiTask.assignees[0];
            if (firstAssignee?.task_id || firstAssignee?.id) {
              backendTaskId = firstAssignee.task_id || firstAssignee.id;
            }
          }
          
          // Check if there's a nested task object
          if (apiTask.task && (apiTask.task.id || apiTask.task.task_id || apiTask.task.pk)) {
            backendTaskId = apiTask.task.id || apiTask.task.task_id || apiTask.task.pk;
          }
        }
        
        // Log the task ID extraction for debugging
        if (backendTaskId) {
          console.log('✅ [REFRESH TASKS] Task ID extracted:', {
            taskTitle: apiTask.title || apiTask['title'],
            extractedId: backendTaskId,
            idType: typeof backendTaskId
          });
        } else {
          // Log all available fields to help debug
          console.error('❌ [REFRESH TASKS] No backend task ID found in API response:', {
            taskTitle: apiTask.title || apiTask['title'],
            availableFields: Object.keys(apiTask),
            allFields: JSON.stringify(apiTask, null, 2), // Full object for debugging
            sampleFields: {
              id: apiTask.id,
              task_id: apiTask.task_id,
              'task-id': apiTask['task-id'],
              pk: apiTask.pk,
              taskId: apiTask.taskId,
              _id: apiTask._id
            }
          });
          
          // If still no ID, try to use index or hash as fallback (but warn user)
          console.warn('⚠️ [REFRESH TASKS] Using fallback ID - status changes will not work until backend returns task IDs');
        }
        
        // Convert to string for Task.id (which is typed as string)
        // Store the backend ID separately if we have it, otherwise use fallback
        const taskIdString = backendTaskId ? String(backendTaskId) : `t${Date.now()}-${Math.random()}`;
        
        const task: Task & { _backendTaskId?: string | null } = {
          id: taskIdString,
          _backendTaskId: backendTaskId ? String(backendTaskId) : null, // Store actual backend ID for API calls
          title: apiTask.title || apiTask['title'] || 'Untitled Task',
          description: cleanDescription,
          type: mappedType,
          status: mappedStatus,
          assigneeId: rawAssignedTo,
          reporterId: reporterId || undefined,
          dueDate: apiTask.due_date || apiTask['due_date'] || apiTask['due-date'] || apiTask.dueDate || new Date().toISOString().split('T')[0],
          createdAt: apiTask.created_at || apiTask['created_at'] || apiTask.createdAt || new Date().toISOString(),
          comments: apiTask.comments || apiTask['comments'] || [],
          priority: (apiTask.priority || apiTask['priority'] || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
          projectId: apiTask.projectId || apiTask['projectId'] || apiTask.project_id || undefined,
        };
        
        return task;
      });
      
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
      
      // Find the task to get more info for debugging
      const task = tasks.find(t => t.id === taskId);
      console.log('🔄 [STATUS CHANGE] Task found:', task ? {
        id: task.id,
        title: task.title,
        currentStatus: task.status,
        backendTaskId: (task as any)?._backendTaskId || 'N/A'
      } : 'NOT FOUND');
      
      // Get the actual backend task ID from the task object
      // Check if task has _backendTaskId property (stored when task was converted from API)
      // This should be the task_id from the backend response
      const taskWithBackendId = task as any;
      const actualBackendId = taskWithBackendId?._backendTaskId || task?.id;
      
      console.log('🔄 [STATUS CHANGE] Backend Task ID extraction:', {
        frontendTaskId: taskId,
        backendTaskId: actualBackendId,
        hasBackendId: !!taskWithBackendId?._backendTaskId
      });
      
      // Validate task ID - check if it's a generated fallback ID (starts with 't')
      // If it is, try to use the stored backend ID, otherwise we can't use it with the backend API
      let backendTaskIdToUse = actualBackendId;
      
      if (typeof taskId === 'string' && taskId.startsWith('t') && taskId.includes('-')) {
        // This is a fallback ID - check if we have the actual backend ID stored
        if (actualBackendId && !actualBackendId.startsWith('t')) {
          console.warn('⚠️ [STATUS CHANGE] Using stored backend ID instead of fallback ID:', {
            fallbackId: taskId,
            backendId: actualBackendId
          });
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
      
      console.log('🔄 [STATUS CHANGE] Changing task status:', { 
        originalTaskId: taskId, 
        taskIdType: typeof taskId,
        taskIdValue: taskId,
        backendTaskIdToUse: backendTaskIdToUse,
        backendTaskIdType: typeof backendTaskIdToUse,
        newStatus, 
        apiStatus,
        taskTitle: task?.title
      });
      
      // Call API to change status using the actual backend ID (task_id from backend)
      // backendTaskIdToUse should be the numeric task_id from the backend response
      console.log('🔄 [STATUS CHANGE] Calling API with backend task_id:', backendTaskIdToUse);
      await apiChangeTaskStatus(backendTaskIdToUse, apiStatus);
      
      console.log('✅ [STATUS CHANGE] Status changed successfully, refreshing tasks...');
      
      // Refresh tasks from API to get updated status (visible to both assigned user and reporting user)
      await refreshTasks();
      
      // Show success message
      console.log('✅ [STATUS CHANGE] Task status updated successfully');
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
      : reportingTasks.filter(t => {
          const typeLabels: Record<TaskType, string> = {
            [TaskType.SOS]: 'SOS',
            [TaskType.ONE_DAY]: '1 Day',
            [TaskType.TEN_DAYS]: '10 Day',
            [TaskType.MONTHLY]: 'Monthly',
            [TaskType.Quaterly]: 'Quaterly',
            [TaskType.GROUP]: 'Group',
            [TaskType.INDIVIDUAL]: 'Individual',
          };
          return typeLabels[t.type] === filterType;
        });
    
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

    return (
      <div className="space-y-6">
        {/* Header with Create Task Button (for all roles except MD and Admin) */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800">
            Task Reporting - All Tasks
          </h2>
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

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          {['ALL', 'SOS', '1 Day', '10 Day', 'Monthly', 'Quaterly'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === type
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Task Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoadingTasks ? (
            <div className="col-span-full text-center py-8 text-gray-500">Loading tasks...</div>
          ) : filteredReportingTasks.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              No tasks found.
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
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase bg-gray-100 px-1.5 py-0.5 rounded">
                      {typeLabels[task.type]}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      {isOverdue && (
                        <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                          <AlertCircle size={12} />
                          OVERDUE
                        </span>
                      )}
                    </div>
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
                  {/* Always show "Assigned by" if reporter exists - this is who created/assigned the task */}
                  {reporter && (
                    <div className="text-xs text-gray-500 mb-1.5">
                      Assigned by: <strong className="text-brand-600">{reporter.name}</strong>
                    </div>
                  )}
                  {assignee && (
                    <div className="text-xs text-gray-500 mb-2">
                      Assigned to: <strong className="text-brand-600">{assignee.name}</strong>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select 
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                        value={typeof newTaskType === 'string' ? newTaskType : String(newTaskType)}
                        onChange={e => {
                          const selectedValue = e.target.value;
                          // If API types are available and selected value is in API types, store as string
                          if (availableTaskTypes.length > 0 && availableTaskTypes.includes(selectedValue)) {
                            setNewTaskType(selectedValue);
                          } else {
                            // Otherwise, convert to TaskType enum
                            setNewTaskType(selectedValue as TaskType);
                          }
                        }}
                        disabled={isLoadingTaskTypes}
                      >
                        {isLoadingTaskTypes ? (
                          <option value="">Loading types from API...</option>
                        ) : availableTaskTypes.length > 0 ? (
                          <>
                            <option value="">Select Type</option>
                            {availableTaskTypes.map((type, index) => (
                              <option key={`type-api-${type}-${index}`} value={type}>
                                {type}
                              </option>
                            ))}
                          </>
                        ) : (
                          <option value="">No types available - Check API connection</option>
                        )}
                      </select>
                      {isLoadingTaskTypes && <p className="text-xs text-blue-600 mt-1">🔄 Fetching task types from API...</p>}
                      {!isLoadingTaskTypes && availableTaskTypes.length === 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ Failed to load task types from API. Please check console for errors.
                        </p>
                      )}
                      {/* {!isLoadingTaskTypes && availableTaskTypes.length > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          ✅ Loaded {availableTaskTypes.length} task type(s) from API
                        </p>
                      )} */}
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

                 {/* Assignee Selection Section */}
                 <div className="space-y-3">
                    {newTaskType === TaskType.GROUP ? (
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
      {/* Controls */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {viewMode === 'assign' ? 'Reporting Tasks' : 'Assigned Tasks'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {['ALL', TaskType.SOS, TaskType.ONE_DAY, TaskType.TEN_DAYS, TaskType.MONTHLY, TaskType.Quaterly].map(type => {
                const typeLabels: Record<string, string> = {
                  'ALL': 'All',
                  [TaskType.SOS]: 'SOS',
                  [TaskType.ONE_DAY]: '1 Day',
                  [TaskType.TEN_DAYS]: '10 Day',
                  [TaskType.MONTHLY]: 'Monthly',
                  [TaskType.Quaterly]: 'Quaterly',
                };
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterType === type ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {typeLabels[type] || type.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="flex gap-2">
             {canAssignTask && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white shadow-sm transition-transform hover:scale-105 bg-brand-600 hover:bg-brand-700"
              >
                <Plus size={18} />
                <span>Assign Task</span>
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
            const assignee = users.find(u => u.id === task.assigneeId);
            // Find reporter - try to find by ID, name, or email
            const reporter = task.reporterId ? users.find(u => 
              u.id === task.reporterId || 
              u.name === task.reporterId ||
              u.email === task.reporterId ||
              String(u.id).toLowerCase() === String(task.reporterId).toLowerCase()
            ) : null;
            const isOverdue = new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
            
            // Handle multiple assignees for display
            const allAssignees = task.assigneeIds ? users.filter(u => task.assigneeIds?.includes(u.id)) : (assignee ? [assignee] : []);

            return (
              <div key={task.id} className={`bg-white rounded-xl border ${task.type === TaskType.SOS ? 'border-red-400 shadow-red-100 ring-2 ring-red-100' : 'border-gray-200'} shadow-sm hover:shadow-lg transition-all p-3 flex flex-col justify-between h-full relative group`}>
                 {isOverdue && (
                   <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-pulse flex items-center">
                     <AlertCircle size={10} className="mr-1"/> OVERDUE
                   </div>
                 )}

                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${task.type === TaskType.SOS ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {task.type === TaskType.ONE_DAY ? '1 Day' :
                       task.type === TaskType.TEN_DAYS ? '10 Day' :
                       task.type === TaskType.MONTHLY ? 'Monthly' :
                       task.type === TaskType.Quaterly ? 'Quaterly' :
                       task.type === TaskType.GROUP ? 'Group' :
                       task.type === TaskType.INDIVIDUAL ? 'Individual' :
                       task.type}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-gray-800 text-sm mb-1.5 leading-tight">{task.title}</h3>
                  <p className="text-gray-500 text-xs mb-3 line-clamp-2">{task.description}</p>
                  
                  {/* Meta info */}
                  <div className="space-y-1.5 text-[10px] text-gray-500 mt-auto">
                    <div className="flex items-center space-x-1.5">
                      <Clock size={12} className={isOverdue ? "text-red-500" : ""} />
                      <span className={isOverdue ? "text-red-500 font-bold" : ""}>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                    </div>
                    
                    {/* Display assigner and assignee names */}
                    {/* Always show "Assigned by" if reporter exists - this is who created/assigned the task */}
                    {reporter && (
                      <div className="flex items-center space-x-1 text-gray-500">
                        <span className="text-[10px]">Assigned by: <strong className="text-brand-600">{reporter.name}</strong></span>
                      </div>
                    )}
                    {allAssignees.length > 0 && (
                      <div className="flex items-center space-x-1 text-gray-500">
                        {allAssignees.length === 1 ? (
                          <span className="text-[10px]">Assigned to: <strong className="text-brand-600">{allAssignees[0].name}</strong></span>
                        ) : (
                          <span className="text-[10px]">Assigned to: <strong className="text-brand-600">{allAssignees.map(a => a.name).join(', ')}</strong></span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                   <button onClick={() => setSelectedTask(task)} className="text-brand-600 text-xs font-medium hover:underline">
                     View Details
                   </button>
                   
                   {/* Status Dropdown - Show on ALL task cards */}
                   <div className="relative status-dropdown-container">
                     <button
                       onClick={() => setOpenStatusDropdown(openStatusDropdown === task.id ? null : task.id)}
                       disabled={changingStatusTaskId === task.id}
                       className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-colors ${
                         task.status === TaskStatus.COMPLETED
                           ? 'bg-green-100 text-green-700 border-green-300'
                           : task.status === TaskStatus.IN_PROGRESS
                           ? 'bg-blue-100 text-blue-700 border-blue-300'
                           : 'bg-red-100 text-red-700 border-red-300'
                       } ${
                         changingStatusTaskId === task.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
                       }`}
                     >
                       {changingStatusTaskId === task.id ? (
                         'Updating...'
                       ) : (
                         <>
                           {task.status === TaskStatus.COMPLETED ? 'COMPLETED' : 
                            task.status === TaskStatus.IN_PROGRESS ? 'IN PROGRESS' : 'PENDING'}
                           <ChevronDown size={10} className={openStatusDropdown === task.id ? 'rotate-180' : ''} />
                         </>
                       )}
                     </button>
                     
                     {/* Dropdown Menu */}
                     {openStatusDropdown === task.id && changingStatusTaskId !== task.id && (
                       <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                         <button
                           onClick={() => {
                             handleStatusChange(task.id, TaskStatus.PENDING);
                             setOpenStatusDropdown(null);
                           }}
                           className={`w-full text-left px-2.5 py-1.5 text-[10px] hover:bg-red-50 first:rounded-t-lg ${
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
                           className={`w-full text-left px-2.5 py-1.5 text-[10px] hover:bg-blue-50 ${
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
                           className={`w-full text-left px-2.5 py-1.5 text-[10px] hover:bg-green-50 last:rounded-b-lg ${
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

      {/* Create Task Modal */}
      {showAddModal && (
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select 
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      value={typeof newTaskType === 'string' ? newTaskType : String(newTaskType)}
                      onChange={e => {
                        const selectedValue = e.target.value;
                        // If API types are available and selected value is in API types, store as string
                        if (availableTaskTypes.length > 0 && availableTaskTypes.includes(selectedValue)) {
                          setNewTaskType(selectedValue);
                        } else {
                          // Otherwise, convert to TaskType enum
                          setNewTaskType(selectedValue as TaskType);
                        }
                      }}
                      disabled={isLoadingTaskTypes}
                    >
                      {isLoadingTaskTypes ? (
                        <option value="">Loading types from API...</option>
                      ) : availableTaskTypes.length > 0 ? (
                        <>
                          <option value="">Select Type</option>
                          {availableTaskTypes.map((type, index) => (
                            <option key={`type-api-${type}-${index}`} value={type}>
                              {type}
                            </option>
                          ))}
                        </>
                      ) : (
                        <option value="">No types available - Check API connection</option>
                      )}
                    </select>
                    {isLoadingTaskTypes && <p className="text-xs text-blue-600 mt-1">🔄 Fetching task types from API...</p>}
                    {!isLoadingTaskTypes && availableTaskTypes.length === 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        ⚠️ Failed to load task types from API. Please check console for errors.
                      </p>
                    )}
                    {/* {!isLoadingTaskTypes && availableTaskTypes.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        ✅ Loaded {availableTaskTypes.length} task type(s) from API
                      </p>
                    )} */}
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
        let taskIdToFetch = task.id;
        if (typeof task.id === 'string' && task.id.startsWith('t')) {
          // Extract number from string like "t1767789989844-0.11216026287831349"
          const match = task.id.match(/\d+/);
          if (match) {
            taskIdToFetch = parseInt(match[0], 10);
          }
        }
        
        console.log('📥 [FETCH MESSAGES] Task ID:', task.id, '→ Numeric ID:', taskIdToFetch);
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
