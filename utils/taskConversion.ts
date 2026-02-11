import type { Task, User } from '../types';
import { TaskType, TaskStatus } from '../types';

/**
 * Convert API task objects to frontend Task format.
 * Used by TaskBoard and for prefetch.
 */
export function convertApiTasksToTasks(
  apiTasks: any[],
  users: User[],
  currentUser: User
): (Task & { _backendTaskId?: string | null })[] {
  const tasks = apiTasks.map((apiTask: any) => {
    const rawApiType = (apiTask.Task_type || apiTask.task_type || apiTask.type || apiTask['Task_type'] || apiTask['task_type'] || apiTask['type'] || 'Individual').trim();
    const apiTypeLower = rawApiType.toLowerCase();
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
    const mappedType = typeMap[rawApiType] || typeMap[apiTypeLower] || TaskType.INDIVIDUAL;

    const apiStatus = (apiTask.current_status || apiTask.Status || apiTask.status || apiTask['current_status'] || apiTask['Status'] || apiTask['status'] || 'pending').toLowerCase();
    const statusMap: Record<string, TaskStatus> = {
      'pending': TaskStatus.PENDING, 'in_progress': TaskStatus.IN_PROGRESS, 'inprocess': TaskStatus.IN_PROGRESS,
      'completed': TaskStatus.COMPLETED, 'overdue': TaskStatus.OVERDUE,
    };
    const mappedStatus = statusMap[apiStatus] || TaskStatus.PENDING;

    let rawAssignedTo: string | number | undefined = apiTask.assigned || apiTask.assigneeId || apiTask.assignee_id;
    if (rawAssignedTo === undefined) {
      const at = apiTask.assigned_to ?? apiTask['assigned_to'];
      if (Array.isArray(at) && at.length > 0 && at[0]?.assignee) {
        rawAssignedTo = undefined;
      } else if (typeof at === 'string' || typeof at === 'number') {
        rawAssignedTo = at;
      }
    }
    const assigneeArray = Array.isArray(apiTask.Assigned_to) ? apiTask.Assigned_to : (Array.isArray(apiTask.assigned_to) ? apiTask.assigned_to : apiTask.assignees);
    let assigneeIds: string[] | undefined;
    if ((!rawAssignedTo || typeof rawAssignedTo !== 'string') && Array.isArray(assigneeArray) && assigneeArray.length > 0) {
      const resolvedIds: string[] = [];
      for (const item of assigneeArray) {
        if (typeof item === 'number' || (typeof item === 'string' && /^\d+$/.test(item))) {
          resolvedIds.push(String(item));
          continue;
        }
        const assigneeName = typeof item === 'string' ? item.trim() : (item?.assignee ? String(item.assignee).trim() : '');
        if (assigneeName) {
          const foundUser = users.find(u =>
            u.name === assigneeName ||
            u.name?.toLowerCase() === assigneeName.toLowerCase() ||
            u.email === assigneeName ||
            String((u as any).Employee_id) === assigneeName
          );
          const resolved = foundUser?.id ?? (foundUser ? (foundUser as any).Employee_id : null) ?? assigneeName;
          resolvedIds.push(String(resolved));
        }
      }
      if (resolvedIds.length > 0) {
        rawAssignedTo = resolvedIds[0];
        if (resolvedIds.length > 1) assigneeIds = resolvedIds;
      }
    }
    if (!rawAssignedTo) rawAssignedTo = currentUser.id;

    const rawReporterId = apiTask.reporterId || apiTask['reporterId'] || apiTask.Report_to || apiTask.Created_by ||
      apiTask.created_by || apiTask['Report_to'] || apiTask['Created_by'] || apiTask['created_by'] ||
      apiTask.reporter_id || apiTask.created_by_id || apiTask.created_by_name || apiTask['created_by_name'] ||
      apiTask.assigner || apiTask['assigner'] || apiTask.assigned_by || apiTask['assigned_by'] || undefined;

    let reporterId = rawReporterId;
    if (rawReporterId && typeof rawReporterId === 'string' && !rawReporterId.includes('-') && !rawReporterId.match(/^\d+$/)) {
      const foundReporter = users.find(u =>
        u.name === rawReporterId ||
        u.name.toLowerCase() === rawReporterId.toLowerCase() ||
        u.email === rawReporterId
      );
      if (foundReporter) reporterId = foundReporter.id;
    }

      const rawDescription = apiTask.Description || apiTask.description || apiTask['Description'] || apiTask['description'] || '';
    const cleanDescription = rawDescription
      .replace(/\n\n\[ExcludeFromMDReporting:\w+\]/g, '')
      .replace(/\n\[ExcludeFromMDReporting:\w+\]/g, '')
      .replace(/\[ExcludeFromMDReporting:\w+\]/g, '')
      .trim();

    let backendTaskId = apiTask.Task_id || apiTask.task_id || apiTask['Task_id'] || apiTask['task_id'] || apiTask.id || apiTask['id'] || apiTask['task-id'] ||
      apiTask.pk || apiTask['pk'] || apiTask.taskId || apiTask['taskId'] || apiTask._id || apiTask['_id'];

    if (!backendTaskId && Array.isArray(apiTask.assignees) && apiTask.assignees.length > 0) {
      const firstAssignee = apiTask.assignees[0];
      if (firstAssignee?.task_id || firstAssignee?.id) {
        backendTaskId = firstAssignee.task_id || firstAssignee.id;
      }
    }
    if (!backendTaskId && apiTask.task && (apiTask.task.id || apiTask.task.task_id || apiTask.task.pk)) {
      backendTaskId = apiTask.task.id || apiTask.task.task_id || apiTask.task.pk;
    }

    const taskIdString = backendTaskId ? String(backendTaskId) : `t${Date.now()}-${Math.random()}`;
    const createdByName = apiTask.Created_by ?? apiTask.created_by ?? apiTask['Created_by'] ?? apiTask['created_by'] ?? undefined;

    const raw = apiTask.Due_date || apiTask.due_date || apiTask['Due_date'] || apiTask['due_date'] || apiTask['due-date'] || apiTask.dueDate || new Date().toISOString().split('T')[0];
    let dueDate = new Date().toISOString().split('T')[0];
    if (raw) {
      const str = String(raw).trim();
      const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      dueDate = ddmmyyyy ? `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}` : str;
    }

    return {
      id: taskIdString,
      _backendTaskId: backendTaskId ? String(backendTaskId) : null,
      title: apiTask.Title || apiTask.title || apiTask['Title'] || apiTask['title'] || 'Untitled Task',
      description: cleanDescription,
      type: mappedType,
      status: mappedStatus,
      assigneeId: String(rawAssignedTo),
      assigneeIds: assigneeIds,
      reporterId: (reporterId && String(reporterId).trim()) || (rawReporterId && String(rawReporterId).trim()) || '',
      createdByName: typeof createdByName === 'string' ? createdByName : undefined,
      dueDate,
      createdAt: apiTask.Created_at || apiTask.created_at || apiTask['Created_at'] || apiTask['created_at'] || apiTask.createdAt || new Date().toISOString(),
      comments: apiTask.comments || apiTask['comments'] || [],
      priority: (apiTask.priority || apiTask['priority'] || 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
      projectId: apiTask.projectId || apiTask['projectId'] || apiTask.project_id || undefined,
    };
  });

  return tasks.filter((task, index, self) => index === self.findIndex(t => t.id === task.id));
}
