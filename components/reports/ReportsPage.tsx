import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Printer, Send, Plus, Calendar, Building2, User as UserIcon } from 'lucide-react';
import { Department, ViewType, ReviewRow, ImplementationRow, SalesOpsRow } from './types';
import { MONTH_TO_MEETING_MAP, MONTH_NAMES } from './constants';
import ReviewTable from './ReviewTable';
import ImplementationTable from './ImplementationTable';
import SalesOpsTable from './SalesOpsTable';
import { 
  getEmployeeDashboard, 
  getMonthlySchedule, 
  addDayEntries, 
  changeEntryStatus, 
  getUserEntries,
  getUserEntriesByFilters,
  getDepartmentsandFunctions,
  getEmployees,
} from '../../services/api';

interface ReportsPageProps {
  currentUserName: string;
  currentUserDepartment?: string;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ currentUserName, currentUserDepartment }) => {
  const [currentDate] = useState(new Date());
  const [selectedDept, setSelectedDept] = useState<Department>(
    currentUserDepartment ? (currentUserDepartment as Department) : Department.SALES
  );
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [isLoadingDeptList, setIsLoadingDeptList] = useState(false);
  const [isMD, setIsMD] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // 1-12
  const [view, setView] = useState<ViewType>('Review');
  const [attendee, setAttendee] = useState(currentUserName || '');
  const [businessName] = useState('Planeteye AI');
  const [isLoadingDept, setIsLoadingDept] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [monthlySchedule, setMonthlySchedule] = useState<any[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<any | null>(null);
  const [allEmployees, setAllEmployees] = useState<Array<{ id: string; name: string; department?: string }>>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [refreshEntriesKey, setRefreshEntriesKey] = useState(0); // Bump after save to refetch and display stored entries
  const [mdAttendeeSchedule, setMdAttendeeSchedule] = useState<any[]>([]);
  const [isLoadingMDSchedule, setIsLoadingMDSchedule] = useState(false);

  // Refs to prevent duplicate fetches
  const hasFetchedEntries = useRef(false);
  const lastFetchKey = useRef<string>('');
  // Ref to avoid auto-save loop: after we save we update entry_id in rows → reviewRows changes → effect runs again. Skip save when content unchanged.
  const lastAutoSaveContentRef = useRef<string>('');

  // Memoize the schedule month to prevent unnecessary re-renders
  const scheduleMonth = useMemo(() => currentSchedule?.month, [currentSchedule?.month]);

  // For MD: selected attendee → user id for API (username param). For non-MD: current user id. MD never uses userId for entries – only matched attendee id.
  const scheduleUserId = useMemo(() => {
    if (isMD) {
      if (attendee && typeof attendee === 'string' && attendee.trim()) {
        const normalized = attendee.trim().toLowerCase();
        const emp = allEmployees.find(
          (e) => e.name && String(e.name).trim().toLowerCase() === normalized
        );
        return emp?.id ?? undefined;
      }
      return undefined;
    }
    return userId ?? undefined;
  }, [isMD, attendee, allEmployees, userId]);

  // Helper: map quarter number to months (financial year: Q4 = Jan–Mar, Q1 = Apr–Jun, etc.)
  const getMonthsForQuarter = (quarterNum: number): number[] => {
    switch (quarterNum) {
      case 1:
        return [4, 5, 6]; // April, May, June
      case 2:
        return [7, 8, 9]; // July, August, September
      case 3:
        return [10, 11, 12]; // October, November, December
      case 4:
      default:
        return [1, 2, 3]; // January, February, March
    }
  };

  // Helper function to map API department string to Department enum
  const mapApiDepartmentToEnum = (apiDept: string | null | undefined): Department => {
    if (!apiDept) return Department.SALES;
    
    const deptStr = String(apiDept).trim();
    
    // Direct matches
    if (deptStr === 'Sales' || deptStr === 'SALES') return Department.SALES;
    if (deptStr === 'Marketing' || deptStr === 'MARKETING') return Department.MARKETING;
    if (deptStr === 'Production' || deptStr === 'PRODUCTION') return Department.PRODUCTION;
    if (deptStr === 'Vigil' || deptStr === 'VIGIL') return Department.VIGIL;
    if (deptStr === 'HR' || deptStr === 'hr') return Department.HR;
    if (deptStr === 'R&D' || deptStr === 'R_AND_D' || deptStr === 'R and D' || deptStr === 'Research & Development') return Department.R_AND_D;
    if (deptStr === 'NPC' || deptStr === 'npb') return Department.NPC;
    if (deptStr === 'Business Strategy' || deptStr === 'BUSINESS_STRATEGY' || deptStr === 'Business Strategy') return Department.BUSINESS_STRATEGY;
    if (deptStr === 'Account & Finance' || deptStr === 'ACCOUNT_FINANCE' || deptStr === 'Account and Finance' || deptStr === 'Accounts & Finance') return Department.ACCOUNT_FINANCE;
    if (deptStr === 'Purchase' || deptStr === 'PURCHASE') return Department.PURCHASE;
    if (deptStr === 'Legal' || deptStr === 'LEGAL') return Department.LEGAL;
    
    // Try to find partial match
    const normalizedDept = deptStr.toLowerCase().replace(/[_\s&]/g, '');
    if (normalizedDept.includes('sales')) return Department.SALES;
    if (normalizedDept.includes('marketing')) return Department.MARKETING;
    if (normalizedDept.includes('production')) return Department.PRODUCTION;
    if (normalizedDept.includes('vigil')) return Department.VIGIL;
    if (normalizedDept.includes('hr') || normalizedDept.includes('human')) return Department.HR;
    if (normalizedDept.includes('r&d') || normalizedDept.includes('research')) return Department.R_AND_D;
    if (normalizedDept.includes('npc')) return Department.NPC;
    if (normalizedDept.includes('business') && normalizedDept.includes('strategy')) return Department.BUSINESS_STRATEGY;
    if ((normalizedDept.includes('account') || normalizedDept.includes('finance')) && !normalizedDept.includes('business')) return Department.ACCOUNT_FINANCE;
    if (normalizedDept.includes('purchase')) return Department.PURCHASE;
    if (normalizedDept.includes('legal')) return Department.LEGAL;
    
    return Department.SALES;
  };

  // Fetch departments list for MD role (used for dropdown)
  const fetchDepartmentsForMD = async () => {
    setIsLoadingDeptList(true);
    try {
      const data = await getDepartmentsandFunctions('MD');
      const validDepartments = Array.isArray(data.departments)
        ? data.departments.filter(d => d != null && typeof d === 'string' && d.trim() !== '')
        : [];
      setAvailableDepartments(validDepartments);
    } catch (error) {
      console.error('❌ [REPORTS] Error fetching departments list for MD:', error);
      setAvailableDepartments([]);
    } finally {
      setIsLoadingDeptList(false);
    }
  };

  // Ensure departments list is fetched whenever user is MD
  useEffect(() => {
    if (isMD) {
      fetchDepartmentsForMD();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMD]);

  // Fetch all employees for attendee dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const employees = await getEmployees();
        const mapped = employees.map((emp: any) => ({
          id: String(emp['Employee_id'] || emp['Employee ID'] || emp.id || ''),
          name: String(emp['Name'] || emp['Full Name'] || emp.name || 'Unknown'),
          department: String(emp['Department'] || emp['department'] || '').trim() || undefined,
        }));
        setAllEmployees(mapped);
      } catch (error) {
        console.error('❌ [REPORTS] Error fetching employees for attendee dropdown:', error);
        setAllEmployees([]);
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  // Fetch department, role and user ID from API when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoadingDept(true);
      try {
        const employeeData = await getEmployeeDashboard();
        
        // Get user ID (Employee_id) for monthly schedule API
        const employeeId = employeeData?.['Employee_id'] || 
                          employeeData?.['Employee ID'] || 
                          employeeData?.id ||
                          null;
        
        if (employeeId) setUserId(String(employeeId));

        // Detect role (MD vs others) – support "MD", "Managing Director", etc.
        const apiRole = employeeData?.['Role'] || employeeData?.['role'] || employeeData?.ROLE;
        const normalizedRole = apiRole ? String(apiRole).trim().toUpperCase().replace(/\s+/g, ' ') : '';
        const userIsMD = normalizedRole === 'MD' ||
          normalizedRole === 'MANAGING DIRECTOR' ||
          normalizedRole === 'MANAGING_DIRECTOR' ||
          /^MD\b/.test(normalizedRole);
        setIsMD(userIsMD);
        
        // Try multiple possible field names for department
        const apiDepartment = employeeData?.['Department'] || 
                              employeeData?.['department'] || 
                              employeeData?.Department ||
                              employeeData?.department ||
                              currentUserDepartment ||
                              null;
        
        if (apiDepartment) {
          const mappedDept = mapApiDepartmentToEnum(apiDepartment);
          setSelectedDept(mappedDept);
        } else {
          if (currentUserDepartment) {
            setSelectedDept(mapApiDepartmentToEnum(currentUserDepartment));
          }
        }

      } catch (error: any) {
        console.error('❌ [REPORTS] Error fetching employee department:', error);
        // Fallback to prop or default
        if (currentUserDepartment) {
          setSelectedDept(mapApiDepartmentToEnum(currentUserDepartment));
        }
      } finally {
        setIsLoadingDept(false);
      }
    };
    
    fetchUserData();
  }, [currentUserDepartment]);

  // Fetch monthly schedule when user ID and month are available
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!userId) return;

      setIsLoadingSchedule(true);
      try {
        const schedule = await getMonthlySchedule(userId);
        setMonthlySchedule(schedule);
        
        // Find schedule for current month and year
        const currentYear = currentDate.getFullYear();
        const currentMonthNum = new Date().getMonth() + 1; // Current month (1-12)
        
        // Find matching schedule entry - prioritize current month, but also check if any schedule exists
        let matchingSchedule = schedule.find((s: any) => {
          const scheduleMonth = s.month || s.month_number || null;
          const scheduleYear = s.financial_year || s.year || null;
          
          // Check if month matches
          const monthMatches = scheduleMonth === currentMonthNum;
          
          // Check if year matches (handle financial year format like "2025-2026")
          let yearMatches = false;
          if (scheduleYear) {
            if (typeof scheduleYear === 'string' && scheduleYear.includes('-')) {
              // Financial year format: "2025-2026"
              const [startYear, endYear] = scheduleYear.split('-').map(y => parseInt(y.trim()));
              yearMatches = currentYear >= startYear && currentYear <= endYear;
            } else {
              yearMatches = parseInt(String(scheduleYear)) === currentYear;
            }
          } else {
            yearMatches = true; // If no year specified, assume it matches
          }
          
          return monthMatches && yearMatches;
        });
        
        // If no exact match, use the first schedule entry (fallback)
        if (!matchingSchedule && schedule.length > 0) {
          matchingSchedule = schedule[0];
        }
        
        if (matchingSchedule) {
          setCurrentSchedule(matchingSchedule);
          // Initialize selected quarter and month from schedule
          const detectedQuarter =
            typeof matchingSchedule.quater === 'string'
              ? parseInt(String(matchingSchedule.quater).replace(/[^0-9]/g, ''), 10) || undefined
              : undefined;
          if (detectedQuarter) {
            setSelectedQuarter(detectedQuarter);
          }
          if (matchingSchedule.month) {
            setSelectedMonth(matchingSchedule.month);
          }
        } else {
          setCurrentSchedule(null);
        }
      } catch (error: any) {
        console.error('❌ [REPORTS] Error fetching monthly schedule:', error);
        setMonthlySchedule([]);
        setCurrentSchedule(null);
      } finally {
        setIsLoadingSchedule(false);
      }
    };
    
    fetchSchedule();
  }, [userId, currentDate]);

  // MD: fetch getMonthlySchedule for selected attendee; populate Month/Quarter from API
  useEffect(() => {
    if (!isMD || !scheduleUserId) {
      setMdAttendeeSchedule([]);
      return;
    }
    let isMounted = true;
    const fetchMdSchedule = async () => {
      setIsLoadingMDSchedule(true);
      try {
        const schedule = await getMonthlySchedule(scheduleUserId);
        if (!isMounted) return;
        setMdAttendeeSchedule(Array.isArray(schedule) ? schedule : []);
        if (Array.isArray(schedule) && schedule.length > 0) {
          const first = schedule[0];
          // Only set quarter/month from first entry when user hasn't selected yet – don't overwrite Q4/January with first entry (e.g. Q1/April)
          setSelectedQuarter((prev) => {
            const qNum = typeof first.quater === 'string'
              ? parseInt(String(first.quater).replace(/[^0-9]/g, ''), 10) || undefined
              : undefined;
            return prev != null ? prev : (qNum ?? null);
          });
          setSelectedMonth((prev) => (prev != null ? prev : (first.month ?? null)));
          setCurrentSchedule(first);
        } else {
          setCurrentSchedule(null);
        }
      } catch (e) {
        if (isMounted) {
          setMdAttendeeSchedule([]);
          setCurrentSchedule(null);
        }
      } finally {
        if (isMounted) setIsLoadingMDSchedule(false);
      }
    };
    fetchMdSchedule();
    return () => { isMounted = false; };
  }, [isMD, scheduleUserId]);

  // Schedule source: for MD use attendee's schedule, else logged-in user's monthly schedule
  const scheduleSource = useMemo(() => {
    if (isMD && mdAttendeeSchedule?.length) return mdAttendeeSchedule;
    return monthlySchedule;
  }, [isMD, mdAttendeeSchedule, monthlySchedule]);

  // When user changes quarter or month, update currentSchedule accordingly
  useEffect(() => {
    if (!scheduleSource || scheduleSource.length === 0) return;
    if (!selectedQuarter && !selectedMonth) return;

    const targetQuarterStr = selectedQuarter ? `Q${selectedQuarter}` : undefined;

    const candidate = scheduleSource.find((s: any) => {
      const monthMatches = selectedMonth ? s.month === selectedMonth : true;
      const quarterMatches = targetQuarterStr
        ? String(s.quater || s.quarter || '').toUpperCase() === targetQuarterStr.toUpperCase()
        : true;
      return monthMatches && quarterMatches;
    });

    if (candidate) {
      setCurrentSchedule(candidate);
    }
  }, [scheduleSource, selectedQuarter, selectedMonth]);

  // Map GET getUserEntries response to Review table rows. Response: [{ id, note, meeting_head, meeting_sub_head, username, date, status, month_quater_id }]. note → col2 (or col2|col3|col4 if note contains " | ").
  const entriesToReviewRows = (entries: any[]): ReviewRow[] => {
    const rowsByDate: Record<string, ReviewRow[]> = {};
    (entries || []).forEach((entry: any) => {
      const entryDate = entry.date || entry.Date || entry.entry_date;
      if (!entryDate) return;
      let isoDate: string;
      try {
        const dateParts = String(entryDate).split('-').map((p: string) => parseInt(p));
        if (dateParts.length === 3) {
          isoDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).toISOString().split('T')[0];
        } else {
          isoDate = new Date(entryDate).toISOString().split('T')[0];
        }
      } catch {
        return;
      }
      if (!rowsByDate[isoDate]) rowsByDate[isoDate] = [];
      const note = String(entry.note ?? entry.Note ?? '').trim();
      const parts = note ? note.split(' | ').map((p: string) => p.trim()).filter(Boolean) : [];
      const d1Content = parts.length > 0 ? parts[0] : note;
      const d2Content = parts.length > 1 ? parts[1] : '';
      const d3Content = parts.length > 2 ? parts[2] : '';
      let entryId: number | undefined;
      if (entry.id != null) entryId = typeof entry.id === 'number' ? entry.id : parseInt(String(entry.id));
      else if (entry.Id != null) entryId = typeof entry.Id === 'number' ? entry.Id : parseInt(String(entry.Id));
      else if (entry.entry_id != null) entryId = typeof entry.entry_id === 'number' ? entry.entry_id : parseInt(String(entry.entry_id));
      if (entryId != null && (isNaN(entryId) || entryId <= 0)) entryId = undefined;
      const rowId = entryId ? `entry-${isoDate}-${rowsByDate[isoDate].length}-${entryId}` : `entry-${isoDate}-${rowsByDate[isoDate].length}-${Date.now()}-${Math.random()}`;
      let tableType: 'D1' | 'D2' | 'D3' = 'D1';
      if (d1Content.trim()) tableType = 'D1';
      else if (d2Content.trim()) tableType = 'D2';
      else if (d3Content.trim()) tableType = 'D3';
      rowsByDate[isoDate].push({
        id: rowId,
        col1: isoDate,
        col2: d1Content,
        col3: d2Content,
        col4: d3Content,
        status: (entry.status || entry.Status || 'PENDING') as 'PENDING' | 'INPROCESS' | 'COMPLETED',
        entry_id: entryId,
        tableType
      });
    });
    const allRows: ReviewRow[] = [];
    Object.keys(rowsByDate).sort().forEach((d) => allRows.push(...rowsByDate[d]));
    return allRows;
  };

  // Fetch entries via GET getUserEntries – depends on selected user, quarter, month, department. User = own entries; MD = selected attendee's entries.
  useEffect(() => {
    let isMounted = true;

    // MD without attendee: clear table
    if (isMD && !attendee) {
      setReviewRows([]);
      hasFetchedEntries.current = false;
      lastFetchKey.current = '';
      return () => { isMounted = false; };
    }

    // Who to fetch: MD with attendee → selected user (scheduleUserId); else current user (userId). MD entries only when attendee schedule is loaded so quarter/month are correct.
    if (isMD && scheduleUserId && isLoadingMDSchedule) {
      return () => { isMounted = false; };
    }
    const targetUsername = isMD && attendee ? scheduleUserId : userId;
    if (!targetUsername) {
      return () => { isMounted = false; };
    }

    const currentMonthNum = new Date().getMonth() + 1;
    // Use selected dropdown values so Q4 + January sends quater=Q4&month=January (not currentSchedule Q1/April)
    const q = selectedQuarter != null ? selectedQuarter : (currentSchedule?.quater ? parseInt(String(currentSchedule.quater).replace(/[^0-9]/g, ''), 10) : (currentMonthNum >= 4 && currentMonthNum <= 6 ? 1 : currentMonthNum >= 7 && currentMonthNum <= 9 ? 2 : currentMonthNum >= 10 ? 3 : 4));
    const m = selectedMonth != null ? selectedMonth : (currentSchedule?.month ?? currentMonthNum);
    const fetchKey = `${targetUsername}-Q${q}-${m}-${selectedDept}-${refreshEntriesKey}`;
    if (hasFetchedEntries.current && lastFetchKey.current === fetchKey) return () => { isMounted = false; };
    if (lastFetchKey.current !== '' && lastFetchKey.current !== fetchKey) hasFetchedEntries.current = false;
    hasFetchedEntries.current = true;
    lastFetchKey.current = fetchKey;

    const quaterStr = `Q${q}`;
    const monthStr = MONTH_NAMES[m - 1] ?? MONTH_NAMES[0];
    // Resolve month_quater_id from schedule so backend gets correct month id (fixes Q4/January sending wrong id)
    const matchingSchedule = scheduleSource?.find((s: any) =>
      s.month === m && String(s.quater || s.quarter || '').toUpperCase() === quaterStr
    );
    const monthQuaterId = matchingSchedule
      ? (matchingSchedule.month_quater_id ?? matchingSchedule.id)
      : (currentSchedule && currentSchedule.month === m && String(currentSchedule.quater || '').toUpperCase() === quaterStr ? (currentSchedule.month_quater_id ?? currentSchedule.id) : undefined);

    // GET {{baseurl}}/getUserEntries/?quater=Q4&month=January&department=Sales&username=20011&month_quater_id=... – use selected Q/M and month_quater_id when available
    getUserEntriesByFilters({
      quater: quaterStr,
      month: monthStr,
      department: selectedDept,
      username: targetUsername,
      ...(monthQuaterId != null && monthQuaterId !== '' ? { month_quater_id: monthQuaterId } : {}),
    })
      .then((entries) => {
        if (!isMounted) return;
        const rows = entriesToReviewRows(entries || []);
        setReviewRows(rows);
        // Mark as "already saved" so auto-save doesn't fire right after load
        const sig = JSON.stringify(
          rows.filter(r => (r.col2 || '').trim() || (r.col3 || '').trim() || (r.col4 || '').trim()).map(r => ({ date: r.col1, col2: r.col2, col3: r.col3, col4: r.col4 })).sort((a, b) => a.date.localeCompare(b.date))
        );
        lastAutoSaveContentRef.current = sig;
      })
      .catch((err) => {
        if (isMounted) {
          console.error('❌ [REPORTS] Error fetching entries:', err);
          setReviewRows([]);
        }
      });
    return () => { isMounted = false; };
  }, [userId, isMD, attendee, scheduleUserId, selectedQuarter, selectedMonth, selectedDept, currentSchedule, scheduleSource, refreshEntriesKey, isLoadingMDSchedule]);


  // Derive Quarter from schedule or calculate
  const quarter = useMemo(() => {
    if (currentSchedule?.quater) {
      // Extract quarter from schedule (e.g., "Q4" -> 4)
      const qMatch = String(currentSchedule.quater).match(/Q(\d+)/i);
      if (qMatch) {
        return parseInt(qMatch[1]);
      }
    }
    // Fallback: calculate from month
    const month = currentSchedule?.month || new Date().getMonth() + 1;
    return Math.ceil(month / 3);
  }, [currentSchedule]);
  
  const year = useMemo(() => {
    if (currentSchedule?.financial_year) {
      // Extract year from financial year (e.g., "2025-2026" -> 2025)
      const fyMatch = String(currentSchedule.financial_year).match(/(\d{4})/);
      if (fyMatch) {
        return parseInt(fyMatch[1]);
      }
    }
    return currentDate.getFullYear();
  }, [currentSchedule, currentDate]);

  // MD: Month options from getMonthlySchedule response (unique by month, label = actual_month)
  const mdMonthOptions = useMemo(() => {
    if (!isMD || !mdAttendeeSchedule?.length) return [];
    const byMonth: Record<number, { value: number; label: string }> = {};
    mdAttendeeSchedule.forEach((s: any) => {
      if (s.month == null) return;
      if (byMonth[s.month]) return;
      byMonth[s.month] = {
        value: s.month,
        label: s.actual_month || MONTH_NAMES[(s.month || 1) - 1] || `Month ${s.month}`,
      };
    });
    return Object.values(byMonth).sort((a, b) => a.value - b.value);
  }, [isMD, mdAttendeeSchedule]);

  // MD: Quarter options from getMonthlySchedule response (unique quarters, label with month range)
  const quarterLabelMap: Record<number, string> = { 1: 'Q1 (Apr–Jun)', 2: 'Q2 (Jul–Sep)', 3: 'Q3 (Oct–Dec)', 4: 'Q4 (Jan–Mar)' };
  const mdQuarterOptions = useMemo(() => {
    if (!isMD || !mdAttendeeSchedule?.length) return [];
    const seen = new Set<number>();
    return mdAttendeeSchedule
      .map((s: any) => {
        const qStr = String(s.quater || s.quarter || '').toUpperCase();
        const num = qStr ? parseInt(qStr.replace(/[^0-9]/g, ''), 10) : undefined;
        return num && (1 <= num && num <= 4) ? num : undefined;
      })
      .filter((num): num is number => num != null && !seen.has(num) && (seen.add(num), true))
      .sort((a, b) => a - b)
      .map((q) => ({ value: q, label: quarterLabelMap[q] || `Q${q}` }));
  }, [isMD, mdAttendeeSchedule]);

  // Review State
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  // Implementation State
  const [implRows, setImplRows] = useState<ImplementationRow[]>([]);
  // Sales Ops State
  const [salesOpsRows, setSalesOpsRows] = useState<SalesOpsRow[]>([]);

  // Get active config from API schedule or fallback to constants
  const config = useMemo(() => {
    // Use API schedule data if available
    if (currentSchedule) {
      return {
        head: currentSchedule['Meeting-head'] || currentSchedule['Meeting-head'] || 'General Review',
        subMeetingHead: currentSchedule['Sub-Meeting-head'] || currentSchedule['Sub-Meeting-head'] || '',
        subHeads: {
          d1: currentSchedule['sub-head-D1'] || currentSchedule['sub-head-D1'] || 'Objective 1',
          d2: currentSchedule['sub-head-D2'] || currentSchedule['sub-head-D2'] || 'Objective 2',
          d3: currentSchedule['sub-head-D3'] || currentSchedule['sub-head-D3'] || 'Objective 3'
        }
      };
    }
    
    // Fallback to constants if no schedule found
    const deptMap = MONTH_TO_MEETING_MAP[selectedDept];
    const month = currentSchedule?.month || 1;
    return deptMap?.[month] || deptMap?.[1] || {
      head: "General Review",
      subHeads: { d1: "Objective 1", d2: "Objective 2", d3: "Objective 3" }
    };
  }, [currentSchedule, selectedDept]);

  // Filter employees by selected department for Reporting Officer / Attendee dropdown
  const filteredEmployeesByDept = useMemo(() => {
    return allEmployees.filter((emp) => {
      if (!emp.department) return false;
      return mapApiDepartmentToEnum(emp.department) === selectedDept;
    });
  }, [allEmployees, selectedDept]);

  // Clear attendee when department changes and current selection is not in filtered list
  useEffect(() => {
    if (!attendee) return;
    const inList = filteredEmployeesByDept.some((e) => e.name === attendee);
    if (!inList) setAttendee('');
  }, [selectedDept, filteredEmployeesByDept]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle status change for Review rows
  const handleReviewStatusChange = async (rowId: string, newStatus: 'PENDING' | 'INPROCESS' | 'COMPLETED') => {
    const row = reviewRows.find(r => r.id === rowId);
    if (!row) {
      alert('Error: Row not found. Please refresh the page.');
      return;
    }

    // Update local state immediately for better UX
    setReviewRows(prev => prev.map(r => 
      r.id === rowId ? { ...r, status: newStatus } : r
    ));

    // Check if entry_id is available and is a valid number
    if (!row.entry_id || typeof row.entry_id !== 'number' || row.entry_id <= 0) {
      // If entry has content, save it first to get entry_id
      if (row.col2.trim() || row.col3.trim() || row.col4.trim()) {
        try {
          // Save the entry first to get entry_id
          await saveEntries(row.col1, [row]);
          
          // Wait a bit for state to update with entry_id
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get updated row with entry_id
          const updatedRows = reviewRows.map(r => r.id === rowId ? r : r);
          const updatedRow = updatedRows.find(r => r.id === rowId);
          
          if (updatedRow?.entry_id) {
            // Now change the status
            const entryIdNum = typeof updatedRow.entry_id === 'number' 
              ? updatedRow.entry_id 
              : parseInt(String(updatedRow.entry_id));
            
            if (!isNaN(entryIdNum) && entryIdNum > 0) {
              let normalizedStatus: 'PENDING' | 'INPROCESS' | 'Completed' = newStatus;
              if (newStatus === 'COMPLETED') {
                normalizedStatus = 'Completed';
              } else if (newStatus === 'INPROCESS') {
                normalizedStatus = 'INPROCESS';
              } else {
                normalizedStatus = 'PENDING';
              }
              
              await changeEntryStatus(entryIdNum, normalizedStatus);
              return;
            }
          }
        } catch (error: any) {
          console.error('❌ [REPORTS] Error saving entry or changing status:', error);
          // Revert status change on error
          setReviewRows(prev => prev.map(r => 
            r.id === rowId ? { ...r, status: row.status || 'PENDING' } : r
          ));
          alert(`Failed to save entry or change status: ${error.message || 'Unknown error'}. Please try again.`);
          return;
        }
      } else return;
    }

    try {
      // Ensure entry_id is a number
      const entryIdNum = typeof row.entry_id === 'number' ? row.entry_id : parseInt(String(row.entry_id));
      
      if (isNaN(entryIdNum) || entryIdNum <= 0) {
        throw new Error(`Invalid entry_id: ${row.entry_id}. Must be a positive number.`);
      }
      
      // Normalize status to match backend expectations
      let normalizedStatus: 'PENDING' | 'INPROCESS' | 'Completed' = newStatus;
      if (newStatus === 'COMPLETED') {
        normalizedStatus = 'Completed';
      } else if (newStatus === 'INPROCESS') {
        normalizedStatus = 'INPROCESS';
      } else {
        normalizedStatus = 'PENDING';
      }
      
      await changeEntryStatus(entryIdNum, normalizedStatus);
    } catch (error: any) {
      console.error('❌ [REPORTS] Error changing status:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      alert(`Failed to change status: ${errorMessage}. Please try again.`);
      // Revert status change on error
      setReviewRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, status: row.status || 'PENDING' } : r
      ));
    }
  };

  // Handle status change for Implementation rows
  const handleImplementationStatusChange = async (rowId: string, newStatus: 'PENDING' | 'INPROCESS' | 'Completed') => {
    const row = implRows.find(r => r.id === rowId);
    if (!row) return;

    if (!row.entry_id) {
      // Update local state only (won't persist to backend)
      setImplRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, status: newStatus === 'Completed' ? 'Completed' : newStatus === 'INPROCESS' ? 'In Progress' : 'Pending' } : r
      ));
      return;
    }

    try {
      await changeEntryStatus(row.entry_id, newStatus);
    } catch (error: any) {
      console.error('❌ [REPORTS] Error changing Implementation status:', error);
      // Revert status change on error
      setImplRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, status: row.status } : r
      ));
    }
  };

  // Handle status change for Sales Ops rows
  const handleSalesOpsStatusChange = async (rowId: string, newStatus: 'PENDING' | 'INPROCESS' | 'Completed') => {
    const row = salesOpsRows.find(r => r.id === rowId);
    if (!row) return;

    if (!row.entry_id) {
      // Update local state only (won't persist to backend)
      setSalesOpsRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, status: newStatus } : r
      ));
      return;
    }

    try {
      await changeEntryStatus(row.entry_id, newStatus);
    } catch (error: any) {
      console.error('❌ [REPORTS] Error changing Sales Ops status:', error);
      // Revert status change on error
      setSalesOpsRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, status: row.status } : r
      ));
    }
  };

  // Save entries when user adds/updates them
  const saveEntries = async (date: string, entries: ReviewRow[]) => {
    if (!currentSchedule?.month_quater_id && !currentSchedule?.id) return;

    const monthQuaterId = currentSchedule.month_quater_id || currentSchedule.id;
    if (!monthQuaterId) return;

    const dateEntries = entries.filter(row => 
      row.col1 === date && (row.col2.trim() || row.col3.trim() || row.col4.trim())
    );
    if (dateEntries.length === 0) return;

    // Prepare entries array for API
    const apiEntries = dateEntries.map(row => {
      // Combine all column content into note
      const note = [row.col2, row.col3, row.col4]
        .filter(col => col.trim())
        .join(' | ');
      
      // Normalize status value
      let statusValue = row.status || 'PENDING';
      if (statusValue === 'Completed' || statusValue === 'completed') {
        statusValue = 'COMPLETED';
      } else if (statusValue === 'INPROCESS' || statusValue === 'In Process' || statusValue === 'IN_PROGRESS') {
        statusValue = 'INPROCESS';
      } else if (statusValue === 'PENDING' || statusValue === 'Pending') {
        statusValue = 'PENDING';
      }
      
      return {
        note: note || 'Entry',
        status: statusValue as 'PENDING' | 'INPROCESS' | 'COMPLETED'
      };
    });

    try {
      // Convert date from ISO format (YYYY-MM-DD) to API format (YYYY-M-D)
      const dateObj = new Date(date);
      const apiDate = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
      
      const response = await addDayEntries({
        entries: apiEntries,
        date: apiDate,
        month_quater_id: monthQuaterId
      });

      // Update entry_ids in rows
      if (response.created_entry_ids && response.created_entry_ids.length > 0) {
        setReviewRows(prev => {
          const updated = [...prev];
          let entryIdIndex = 0;
          dateEntries.forEach(dateRow => {
            const rowIndex = updated.findIndex(r => r.id === dateRow.id);
            if (rowIndex !== -1 && entryIdIndex < response.created_entry_ids.length) {
              const newEntryId = response.created_entry_ids[entryIdIndex];
              const entryIdNum = typeof newEntryId === 'number' ? newEntryId : parseInt(String(newEntryId));
              if (!isNaN(entryIdNum) && entryIdNum > 0) {
                updated[rowIndex] = { ...updated[rowIndex], entry_id: entryIdNum };
              }
              entryIdIndex++;
            }
          });
          return updated;
        });
      }
    } catch (error: any) {
      console.error('❌ [REPORTS] Error saving entries:', error);
    }
  };

  // Initial empty rows for today (only if no entries are loaded)
  useEffect(() => {
    // Only set initial rows if reviewRows is empty (no entries loaded from API)
    if (reviewRows.length === 0) {
    const todayStr = new Date().toISOString().split('T')[0];

    const initialReview: ReviewRow[] = [
        { id: 't1', col1: todayStr, col2: '', col3: '', col4: '', status: 'PENDING', tableType: 'D1' },
        { id: 't2', col1: todayStr, col2: '', col3: '', col4: '', status: 'PENDING', tableType: 'D1' },
        { id: 't3', col1: todayStr, col2: '', col3: '', col4: '', status: 'PENDING', tableType: 'D1' }
    ];
    setReviewRows(initialReview);
    }

    // Initialize Implementation rows
    const initialImpl: ImplementationRow[] = [];
    ['D1', 'D2', 'D3'].forEach(group => {
      for (let i = 0; i < 3; i++) {
          initialImpl.push({
              id: Math.random().toString(36),
              no: (i + 1).toString(),
              action: '',
              deadline: '',
              assignedHelp: '',
              status: '',
              group: group as 'D1' | 'D2' | 'D3'
          });
      }
    });
    setImplRows(initialImpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Auto-save entries when content changes (debounced). Guard: skip when only entry_id changed to stop loop (save → setReviewRows(entry_id) → effect → save again).
  useEffect(() => {
    if (!currentSchedule?.month_quater_id && !currentSchedule?.id) {
      return;
    }

    const hasContent = reviewRows.some(row => row.col2.trim() || row.col3.trim() || row.col4.trim());
    if (!hasContent) {
      return;
    }

    // Content signature: only col1,col2,col3,col4 (not entry_id) so we don't re-save when we only updated entry_id
    const contentSignature = JSON.stringify(
      reviewRows
        .filter(row => (row.col2 || '').trim() || (row.col3 || '').trim() || (row.col4 || '').trim())
        .map(row => ({ date: row.col1, col2: row.col2, col3: row.col3, col4: row.col4 }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );

    const timeoutId = setTimeout(() => {
      if (lastAutoSaveContentRef.current === contentSignature) {
        return; // Content unchanged (e.g. we only updated entry_id) – don't save again
      }
      lastAutoSaveContentRef.current = contentSignature;

      const rowsByDate = reviewRows.reduce((acc, row) => {
        if (!acc[row.col1]) acc[row.col1] = [];
        acc[row.col1].push(row);
        return acc;
      }, {} as Record<string, ReviewRow[]>);

      Object.keys(rowsByDate).forEach(date => {
        saveEntries(date, rowsByDate[date]);
      });
    }, 2000);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewRows, currentSchedule]);

  const addRow = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (view === 'Review') {
      const activeTable = (window as any).__activeReviewTable || 'D1';
      setReviewRows(prev => [
        ...prev,
        { 
          id: Math.random().toString(36), 
          col1: todayStr, 
          col2: '', 
          col3: '', 
          col4: '', 
          status: 'PENDING',
          tableType: activeTable as 'D1' | 'D2' | 'D3'
        }
      ]);
    } else if (view === 'Implementation') {
      setImplRows(prev => [
        ...prev,
        { id: Math.random().toString(36), no: (prev.length + 1).toString(), action: '', deadline: '', assignedHelp: '', status: '', group: 'D1' }
      ]);
    }
  };

  const removeReviewRow = (rowId: string) => {
    setReviewRows(prev => prev.filter(r => r.id !== rowId));
  };

  const removeImplRow = (rowId: string) => {
    setImplRows(prev => prev.filter(r => r.id !== rowId));
  };

  const removeSalesOpsRow = (rowId: string) => {
    setSalesOpsRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handlePrint = () => window.print();
  const handleSubmit = async () => {
    // month_quater_id for POST addDayEntries – from schedule when available, else from selected month/quarter so entry is stored
    let finalMonthQuaterId: number;
    if (currentSchedule) {
      const monthQuaterId = currentSchedule.month_quater_id ?? currentSchedule.id ?? currentSchedule.Id ?? currentSchedule.month_quarter_id ?? currentSchedule.monthQuarterId ?? currentSchedule.pk ?? currentSchedule.pk_id;
      if (monthQuaterId != null && monthQuaterId !== '') {
        finalMonthQuaterId = typeof monthQuaterId === 'number' ? monthQuaterId : parseInt(String(monthQuaterId), 10);
      } else {
        const scheduleIndex = monthlySchedule.findIndex((s: any) => s.month === currentSchedule.month && s.financial_year === currentSchedule.financial_year);
        finalMonthQuaterId = scheduleIndex !== -1 ? scheduleIndex + 1 : (currentSchedule.month ?? 1);
      }
    } else {
      const monthNum = selectedMonth ?? new Date().getMonth() + 1;
      finalMonthQuaterId = Number(monthNum) || 1;
    }
    if (!Number.isFinite(finalMonthQuaterId) || finalMonthQuaterId <= 0) {
      alert('Unable to determine month/quarter. Please select Month and Quarter.');
      return;
    }
    // Group rows by date
    const rowsByDate: Record<string, ReviewRow[]> = {};
    reviewRows.forEach(row => {
      if (!rowsByDate[row.col1]) {
        rowsByDate[row.col1] = [];
      }
      rowsByDate[row.col1].push(row);
    });

    // Collect all entries to save
    const entriesToSave: Array<{ date: string; entries: ReviewRow[] }> = [];
    
    Object.keys(rowsByDate).forEach(date => {
      const dateRows = rowsByDate[date];
      // Filter rows that have at least one column with content
      const rowsWithContent = dateRows.filter(row => 
        row.col2.trim() || row.col3.trim() || row.col4.trim()
      );
      
      if (rowsWithContent.length > 0) {
        entriesToSave.push({ date, entries: rowsWithContent });
      }
    });

    if (entriesToSave.length === 0) {
      alert('No entries to submit. Please add some content before submitting.');
      return;
    }

    try {
      let totalSaved = 0;
      let allCreatedIds: number[] = [];
      let lastResponseMessage = '';

      // Save entries for each date
      for (const { date, entries } of entriesToSave) {
        // Prepare entries array for API
        const apiEntries = entries.map(row => {
          // Combine all column content into note
          const note = [row.col2, row.col3, row.col4]
            .filter(col => col.trim())
            .join(' | ');
          
          // Get status value and normalize it
          let statusValue = row.status || 'PENDING';
          
          // Normalize status to match backend expectations
          // Backend might expect "COMPLETED" (all caps) instead of "Completed"
          if (statusValue === 'Completed' || statusValue === 'completed') {
            statusValue = 'COMPLETED';
          } else if (statusValue === 'INPROCESS' || statusValue === 'In Process' || statusValue === 'IN_PROGRESS') {
            statusValue = 'INPROCESS';
          } else if (statusValue === 'PENDING' || statusValue === 'Pending') {
            statusValue = 'PENDING';
          }
          
          // Backend expects status string, but database needs status_id
          // The backend should map status string to status_id
          // If backend still fails, we may need to send status_id directly
          return {
            note: note || 'Entry',
            status: statusValue as 'PENDING' | 'INPROCESS' | 'COMPLETED'
          };
        });

        // Convert date from ISO format (YYYY-MM-DD) to API format (YYYY-M-D)
        const dateObj = new Date(date);
        const apiDate = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;

        const response = await addDayEntries({
          entries: apiEntries,
          date: apiDate,
          month_quater_id: finalMonthQuaterId
        });
        if ((response as any)?.error) {
          alert((response as any).error);
          return;
        }
        // Store the backend message
        if (response.message) {
          lastResponseMessage = response.message;
        }
        
        // Collect created entry IDs
        if (response.created_entry_ids && response.created_entry_ids.length > 0) {
          allCreatedIds.push(...response.created_entry_ids);
          totalSaved += response.created_entry_ids.length;
        }

        // Update entry_ids in rows
        if (response.created_entry_ids && response.created_entry_ids.length > 0) {
          setReviewRows(prev => {
            const updated = [...prev];
            let entryIdIndex = 0;
            entries.forEach(dateRow => {
              const rowIndex = updated.findIndex(r => r.id === dateRow.id);
              if (rowIndex !== -1 && entryIdIndex < response.created_entry_ids.length) {
                const newEntryId = response.created_entry_ids[entryIdIndex];
                const entryIdNum = typeof newEntryId === 'number' ? newEntryId : parseInt(String(newEntryId));
                if (!isNaN(entryIdNum) && entryIdNum > 0) {
                  updated[rowIndex] = { ...updated[rowIndex], entry_id: entryIdNum };
                }
                entryIdIndex++;
              }
            });
            return updated;
          });
        }
      }

      // Show success message from backend
      const successMessage = lastResponseMessage || `Entries created successfully! ${totalSaved} entry/entries saved.`;
      alert(successMessage);
      setRefreshEntriesKey((k) => k + 1); // Refetch entries so stored entries display in Review table
    } catch (error: any) {
      console.error('❌ [REPORTS] Error submitting entries:', error);
      const data = error.response?.data;
      const errorMessage = data?.error || data?.message || error.message || 'Failed to submit entries. Please try again.';
      alert(errorMessage);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="min-h-screen pb-12 bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              <p className="text-sm text-gray-500">Daily Entry & Strategic Review System</p>
            </div>
          </div>
          {!isMD && (
            <div className="no-print flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-all flex items-center"
              >
                <Printer className="w-4 h-4 mr-1" />
                PDF
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-brand-600 text-white text-xs font-black rounded-lg hover:bg-brand-700 transition-all flex items-center shadow-lg shadow-brand-100 uppercase tracking-widest"
              >
                <Send className="w-4 h-4 mr-1" />
                SAVE REPORT
              </button>
            </div>
          )}
        </div>

        {/* Main Form Container */}
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 relative">

          {/* Internal Doc Header */}
          <div className="bg-white p-10 border-b border-gray-100 text-center">
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{businessName}</h2>
            <p className="text-sm text-gray-500 mb-6">Corporate Strategic Meeting Document</p>
            
            {/* View Selector Tabs */}
            <div className="flex justify-center space-x-4 mb-8 no-print">
               <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                {(['Review', 'Implementation', 'SalesOps'] as ViewType[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`py-2 px-6 text-xs font-bold rounded-md transition-all ${view === v ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {v === 'SalesOps' ? 'Sales Ops' : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Meta Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left border-t border-b border-gray-100 py-6 text-sm">
              <div className="flex flex-col">
                <span className="text-gray-400 text-[10px] font-black uppercase tracking-tighter flex items-center">
                  <Building2 className="w-3 h-3 mr-1" />
                  Department
                </span>
                {isLoadingDept || (isMD && isLoadingDeptList) ? (
                  <span className="text-slate-500 font-bold mt-1 text-sm">Loading...</span>
                ) : isMD ? (
                  <select
                    value={selectedDept}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        setSelectedDept(mapApiDepartmentToEnum(value));
                      }
                    }}
                    className="mt-1 bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 no-print"
                  >
                    <option value="">Select Department</option>
                    {(availableDepartments.length > 0
                      ? availableDepartments
                      : Object.values(Department)
                    ).map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-800 font-bold mt-1">{selectedDept}</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-gray-400 text-[10px] font-black uppercase tracking-titter flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  Month
                </span>
                <select
                  value={selectedMonth || currentSchedule?.month || new Date().getMonth() + 1}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="mt-1 bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 no-print"
                >
                  {monthNames.map((label, i) => (
                    <option key={i + 1} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-400 text-[10px] font-black uppercase tracking-tighter">Quarter</span>
                <select
                  value={selectedQuarter || quarter}
                  onChange={(e) => {
                    const q = parseInt(e.target.value, 10);
                    setSelectedQuarter(q);
                    const months = getMonthsForQuarter(q);
                    if (!selectedMonth || !months.includes(selectedMonth)) {
                      setSelectedMonth(months[0]);
                    }
                  }}
                  className="mt-1 bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 no-print"
                >
                  <option value={1}>Q1 (Apr–Jun)</option>
                  <option value={2}>Q2 (Jul–Sep)</option>
                  <option value={3}>Q3 (Oct–Dec)</option>
                  <option value={4}>Q4 (Jan–Mar)</option>
                </select>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-400 text-[10px] font-black uppercase tracking-tighter">Year</span>
                <span className="text-slate-800 font-bold mt-1">
                  {currentSchedule?.financial_year || year}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-left text-sm">
              <div className="flex flex-col">
                <span className="text-gray-400 text-[10px] font-black uppercase tracking-tighter mb-1">Meeting Strategic Title</span>
                <span className="text-slate-800 font-semibold bg-brand-50/50 p-3 rounded border-l-4 border-brand-600 shadow-sm">
                  {config.head}
                  {config.subMeetingHead && (
                    <span className="block text-xs text-slate-600 mt-1 font-normal">
                      {config.subMeetingHead}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-400 text-[10px] font-black uppercase tracking-tighter mb-1 flex items-center">
                  <UserIcon className="w-3 h-3 mr-1" />
                  Reporting Officer / Attendee
                </span>
                {isMD ? (
                  isLoadingEmployees ? (
                    <span className="text-slate-500 font-semibold p-2 no-print">Loading...</span>
                  ) : (
                    <select
                      value={attendee}
                      onChange={(e) => setAttendee(e.target.value)}
                      className="bg-white border border-slate-200 rounded-md px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 no-print"
                    >
                      <option value="">Select reporting officer / attendee</option>
                      {filteredEmployeesByDept.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                  )
                ) : (
                  <span className="text-slate-800 font-semibold mt-1 no-print">{currentUserName || '—'}</span>
                )}
                <span className="hidden print:block text-slate-800 font-semibold border-b border-slate-200 py-2">{isMD ? (attendee || '____________________') : (currentUserName || '____________________')}</span>
              </div>
            </div>
          </div>

          {/* Dynamic Content */}
          <div className="p-4 sm:p-6 lg:p-8 bg-gray-50">
            {view === 'Review' && (
              <ReviewTable 
                config={config} 
                rows={reviewRows} 
                setRows={setReviewRows} 
                onStatusChange={handleReviewStatusChange}
                onAddRow={(tableType) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setReviewRows(prev => [
                    ...prev,
                    { 
                      id: Math.random().toString(36), 
                      col1: todayStr, 
                      col2: '', 
                      col3: '', 
                      col4: '', 
                      status: 'PENDING',
                      tableType: tableType
                    }
                  ]);
                }}
                onRemoveRow={removeReviewRow}
              />
            )}
            {view === 'Implementation' && (
                <ImplementationTable 
                    rows={implRows}
                    setRows={setImplRows}
                    onStatusChange={handleImplementationStatusChange}
                    onRemoveRow={removeImplRow}
                />
            )}
            {view === 'SalesOps' && (
                <SalesOpsTable 
                    rows={salesOpsRows}
                    setRows={setSalesOpsRows}
                    onStatusChange={handleSalesOpsStatusChange}
                    onRemoveRow={removeSalesOpsRow}
                />
            )}
          </div>

          {/* Table Actions – ADD ENTRY only for non-MD (MD only views entries) */}
          <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center no-print">
            {!isMD && (
              <button 
                onClick={addRow}
                className="group flex items-center px-6 py-3 text-sm font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                ADD ENTRY
              </button>
            )}
            <div className={`text-right ${isMD ? 'ml-auto' : ''}`}>
                <p className="text-xs text-slate-500 font-bold tracking-tight">System status: Secure & Operational</p>
                <p className="text-[10px] text-slate-400 font-medium">Daily data entry protocol v3.1</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 text-center text-slate-400 text-[10px] uppercase font-bold tracking-widest no-print pb-12">
        Planeteye AI Corporate Infrastructure &bull; Internal Use Only
      </footer>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

export default ReportsPage;
