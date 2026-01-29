import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, Printer, Send, Plus, Calendar, Building2, User as UserIcon } from 'lucide-react';
import { Department, ViewType, ReviewRow, ImplementationRow, SalesOpsRow } from './types';
import { MONTH_TO_MEETING_MAP } from './constants';
import ReviewTable from './ReviewTable';
import ImplementationTable from './ImplementationTable';
import SalesOpsTable from './SalesOpsTable';
import { 
  getEmployeeDashboard, 
  getMonthlySchedule, 
  addDayEntries, 
  changeEntryStatus, 
  getUserEntries,
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
  
  // Refs to prevent duplicate fetches
  const hasFetchedEntries = useRef(false);
  const lastFetchKey = useRef<string>('');

  // Memoize the schedule month to prevent unnecessary re-renders
  const scheduleMonth = useMemo(() => currentSchedule?.month, [currentSchedule?.month]);

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
    
    // Default fallback
    console.warn(`⚠️ [REPORTS] Unknown department from API: "${apiDept}", defaulting to Sales`);
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
        
        if (employeeId) {
          setUserId(String(employeeId));
          console.log('✅ [REPORTS] User ID (Employee_id):', employeeId);
        }

        // Detect role (MD vs others)
        const apiRole = employeeData?.['Role'] || employeeData?.['role'] || employeeData?.ROLE;
        const normalizedRole = apiRole ? String(apiRole).trim().toUpperCase() : '';
        const userIsMD = normalizedRole === 'MD';
        setIsMD(userIsMD);
        
        // Try multiple possible field names for department
        const apiDepartment = employeeData?.['Department'] || 
                              employeeData?.['department'] || 
                              employeeData?.Department ||
                              employeeData?.department ||
                              currentUserDepartment ||
                              null;
        
        console.log('📋 [REPORTS] Fetched employee dashboard:', employeeData);
        console.log('📋 [REPORTS] Department from API:', apiDepartment);
        
        if (apiDepartment) {
          const mappedDept = mapApiDepartmentToEnum(apiDepartment);
          console.log('✅ [REPORTS] Mapped department:', apiDepartment, '→', mappedDept);
          setSelectedDept(mappedDept);
        } else {
          console.warn('⚠️ [REPORTS] No department found in API response, using default or prop value');
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
      if (!userId) {
        console.log('⚠️ [REPORTS] No user ID available, skipping schedule fetch');
        return;
      }

      setIsLoadingSchedule(true);
      try {
        console.log('📅 [REPORTS] Fetching monthly schedule for user_id:', userId);
        const schedule = await getMonthlySchedule(userId);
        console.log('📅 [REPORTS] Monthly schedule response:', schedule);
        
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
          console.log('✅ [REPORTS] Found matching schedule:', matchingSchedule);
          console.log('✅ [REPORTS] Schedule fields:', Object.keys(matchingSchedule));
          console.log('✅ [REPORTS] month_quater_id:', matchingSchedule.month_quater_id);
          console.log('✅ [REPORTS] id:', matchingSchedule.id);
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
          console.warn('⚠️ [REPORTS] No matching schedule found for month', currentMonthNum, 'year', currentYear);
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

  // When user changes quarter or month, update currentSchedule accordingly
  useEffect(() => {
    if (!monthlySchedule || monthlySchedule.length === 0) return;
    if (!selectedQuarter && !selectedMonth) return;

    const targetQuarterStr = selectedQuarter ? `Q${selectedQuarter}` : undefined;

    const candidate = monthlySchedule.find((s: any) => {
      const monthMatches = selectedMonth ? s.month === selectedMonth : true;
      const quarterMatches = targetQuarterStr
        ? String(s.quater || s.quarter || '').toUpperCase() === targetQuarterStr.toUpperCase()
        : true;
      return monthMatches && quarterMatches;
    });

    if (candidate) {
      setCurrentSchedule(candidate);
    }
  }, [monthlySchedule, selectedQuarter, selectedMonth]);

  // Fetch existing entries when schedule and user ID are available
  useEffect(() => {
    // Early return if dependencies are not ready
    if (!userId || !currentSchedule || !scheduleMonth) {
      return;
    }

    // Create a unique key for this fetch (userId + month)
    const fetchKey = `${userId}-${scheduleMonth}`;
    
    // STRICT CHECK: Prevent duplicate fetches for the same month/user
    if (hasFetchedEntries.current && lastFetchKey.current === fetchKey) {
      // Already fetched for this exact combination, skip completely - NO LOGGING
      return;
    }
    
    // Reset flag if the key changed (new month or user)
    if (lastFetchKey.current !== '' && lastFetchKey.current !== fetchKey) {
      hasFetchedEntries.current = false;
    }
    
    // Mark as fetching IMMEDIATELY before any async operations
    hasFetchedEntries.current = true;
    lastFetchKey.current = fetchKey;

    let isMounted = true;
    let isFetching = false;

    const fetchEntries = async () => {
      // Prevent multiple simultaneous fetches
      if (isFetching) {
        console.log('⚠️ [REPORTS] Fetch already in progress, skipping');
        return;
      }

      isFetching = true;

      try {
        // OPTIMIZED: Only fetch entries for today and last 3 days to reduce API calls
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const allEntries: any[] = [];
        
        // Only fetch last 4 days (today + 3 days back) to reduce API calls
        const daysToFetch = 4;
        
        console.log(`📖 [REPORTS] Fetching entries for last ${daysToFetch} days (including today)`);
        
        for (let i = 0; i < daysToFetch; i++) {
          // Check if component is still mounted
          if (!isMounted) {
            break;
          }

          const fetchDate = new Date(today);
          fetchDate.setDate(today.getDate() - i); // Go back i days
          
          const dateStr = `${fetchDate.getFullYear()}-${String(fetchDate.getMonth() + 1).padStart(2, '0')}-${String(fetchDate.getDate()).padStart(2, '0')}`;
          
          try {
            // Only log first fetch to reduce console spam
            if (i === 0) {
              console.log(`📖 [REPORTS] Fetching entries for date: ${dateStr}, username: ${userId}`);
            }
            const entries = await getUserEntries(dateStr, userId);
            if (entries && entries.length > 0) {
              allEntries.push(...entries);
              if (i === 0) {
                console.log(`✅ [REPORTS] Found ${entries.length} entries for ${dateStr}`);
              }
            }
            
            // Add delay between requests to prevent overwhelming the server
            if (i < daysToFetch - 1) {
              await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
            }
          } catch (error: any) {
            // Continue to next date if one fails
            if (error.name !== 'AbortError') {
              // Only log errors for today to reduce spam
              if (i === 0) {
                console.warn(`⚠️ [REPORTS] Error fetching entries for ${dateStr}:`, error.message);
              }
            }
          }
        }

        // Check if component is still mounted before updating state
        if (!isMounted) {
          return;
        }

        console.log(`📖 [REPORTS] All fetched entries: ${allEntries.length} total`);

        // Convert API entries to ReviewRow format
        const rowsByDate: Record<string, ReviewRow[]> = {};
        
        allEntries.forEach((entry: any) => {
          const entryDate = entry.date || entry.Date || entry.entry_date;
          if (!entryDate) {
            console.warn('⚠️ [REPORTS] Entry missing date:', entry);
            return;
          }

          // Convert API date format to ISO format for consistency
          let isoDate: string;
          try {
            // Handle different date formats: "2026-1-21" or "2026-01-21" or ISO format
            const dateParts = entryDate.split('-').map((p: string) => parseInt(p));
            if (dateParts.length === 3) {
              const [year, month, day] = dateParts;
              isoDate = new Date(year, month - 1, day).toISOString().split('T')[0];
            } else {
              isoDate = new Date(entryDate).toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn('⚠️ [REPORTS] Error parsing date:', entryDate, e);
            return;
          }

          if (!rowsByDate[isoDate]) {
            rowsByDate[isoDate] = [];
          }

          // Parse note to extract D1, D2, D3 content (separated by " | ")
          const note = entry.note || entry.Note || '';
          const parts = note.split(' | ').filter((p: string) => p.trim());
          const d1Content = parts[0] || '';
          const d2Content = parts[1] || '';
          const d3Content = parts[2] || '';

          // Get entry ID from API response - check multiple possible field names
          // The API should return an 'id' field that is a number
          let entryId: number | undefined = undefined;
          
          // Try to extract numeric ID from various possible fields
          if (entry.id !== undefined && entry.id !== null) {
            entryId = typeof entry.id === 'number' ? entry.id : parseInt(String(entry.id));
          } else if (entry.Id !== undefined && entry.Id !== null) {
            entryId = typeof entry.Id === 'number' ? entry.Id : parseInt(String(entry.Id));
          } else if (entry.entry_id !== undefined && entry.entry_id !== null) {
            entryId = typeof entry.entry_id === 'number' ? entry.entry_id : parseInt(String(entry.entry_id));
          } else if (entry.pk !== undefined && entry.pk !== null) {
            entryId = typeof entry.pk === 'number' ? entry.pk : parseInt(String(entry.pk));
          }
          
          // Validate that entryId is a valid number
          if (entryId !== undefined && (isNaN(entryId) || entryId <= 0)) {
            console.warn('⚠️ [REPORTS] Invalid entry_id found:', entryId, 'for entry:', entry);
            entryId = undefined;
          }

          // Create a unique row ID for React key
          const rowId = entryId 
            ? `entry-${isoDate}-${rowsByDate[isoDate].length}-${entryId}` 
            : `entry-${isoDate}-${rowsByDate[isoDate].length}-${Date.now()}-${Math.random()}`;

          // Determine tableType based on which column has content
          // Priority: D1 > D2 > D3 (if multiple columns have content, assign to D1)
          let tableType: 'D1' | 'D2' | 'D3' = 'D1';
          if (d1Content.trim()) {
            tableType = 'D1';
          } else if (d2Content.trim() && !d1Content.trim()) {
            tableType = 'D2';
          } else if (d3Content.trim() && !d1Content.trim() && !d2Content.trim()) {
            tableType = 'D3';
          }
          
          rowsByDate[isoDate].push({
            id: rowId,
            col1: isoDate,
            col2: d1Content,
            col3: d2Content,
            col4: d3Content,
            status: (entry.status || entry.Status || 'PENDING') as 'PENDING' | 'INPROCESS' | 'COMPLETED',
            entry_id: entryId, // Numeric ID for API calls (undefined if not available)
            tableType: tableType
          });
          
          if (entryId) {
            console.log(`✅ [REPORTS] Entry loaded with entry_id: ${entryId} for date ${isoDate}`);
          } else {
            console.warn(`⚠️ [REPORTS] Entry loaded without entry_id for date ${isoDate}. Status changes will not work until entry is saved.`);
          }
        });

        // Convert to array and sort by date
        const allRows: ReviewRow[] = [];
        Object.keys(rowsByDate).sort().forEach(date => {
          allRows.push(...rowsByDate[date]);
        });

        console.log(`✅ [REPORTS] Converted ${allRows.length} entries to rows`);
        
        // Update rows with fetched entries (only if component is still mounted)
        if (isMounted) {
          if (allRows.length > 0) {
            setReviewRows(allRows);
          } else {
            console.log('📖 [REPORTS] No entries found for this month');
          }
        }
      } catch (error: any) {
        if (isMounted) {
          console.error('❌ [REPORTS] Error fetching entries:', error);
          // Don't clear existing rows on error
        }
      } finally {
        isFetching = false;
      }
    };

    fetchEntries();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
      isFetching = false;
    };
  }, [userId, scheduleMonth]); // Only re-fetch if userId or schedule month changes


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
      console.warn('⚠️ [REPORTS] Cannot change status: row not found');
      alert('Error: Row not found. Please refresh the page.');
      return;
    }

    // Update local state immediately for better UX
    setReviewRows(prev => prev.map(r => 
      r.id === rowId ? { ...r, status: newStatus } : r
    ));

    // Check if entry_id is available and is a valid number
    if (!row.entry_id || typeof row.entry_id !== 'number' || row.entry_id <= 0) {
      console.log('📝 [REPORTS] Entry ID not available. Saving entry first to get entry_id...');
      
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
              console.log('✅ [REPORTS] Entry saved and status changed successfully');
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
      } else {
        console.warn('⚠️ [REPORTS] Entry has no content. Status will be saved when entry is submitted.');
        return;
      }
    }

    // If entry_id exists, change status directly
    try {
      console.log('🔄 [REPORTS] Changing status for entry:', {
        entry_id: row.entry_id,
        entry_id_type: typeof row.entry_id,
        newStatus: newStatus,
        rowId: rowId
      });
      
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
      console.log('✅ [REPORTS] Status changed successfully');
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
    if (!row) {
      console.warn('⚠️ [REPORTS] Cannot change status: Implementation row not found');
      return;
    }

    if (!row.entry_id) {
      console.warn('⚠️ [REPORTS] Cannot change status: entry_id not available. Entry may need to be saved first.');
      // Update local state only (won't persist to backend)
      setImplRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, status: newStatus === 'Completed' ? 'Completed' : newStatus === 'INPROCESS' ? 'In Progress' : 'Pending' } : r
      ));
      return;
    }

    try {
      console.log('🔄 [REPORTS] Changing Implementation status for entry:', row.entry_id, 'to:', newStatus);
      await changeEntryStatus(row.entry_id, newStatus);
      console.log('✅ [REPORTS] Implementation status changed successfully');
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
    if (!row) {
      console.warn('⚠️ [REPORTS] Cannot change status: Sales Ops row not found');
      return;
    }

    if (!row.entry_id) {
      console.warn('⚠️ [REPORTS] Cannot change status: entry_id not available. Entry may need to be saved first.');
      // Update local state only (won't persist to backend)
      setSalesOpsRows(prev => prev.map(r => 
        r.id === rowId ? { ...r, status: newStatus } : r
      ));
      return;
    }

    try {
      console.log('🔄 [REPORTS] Changing Sales Ops status for entry:', row.entry_id, 'to:', newStatus);
      await changeEntryStatus(row.entry_id, newStatus);
      console.log('✅ [REPORTS] Sales Ops status changed successfully');
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
    if (!currentSchedule?.month_quater_id && !currentSchedule?.id) {
      console.warn('⚠️ [REPORTS] Cannot save entries: month_quater_id not found in schedule');
      return;
    }

    const monthQuaterId = currentSchedule.month_quater_id || currentSchedule.id;
    if (!monthQuaterId) {
      console.warn('⚠️ [REPORTS] Cannot save entries: month_quater_id is missing');
      return;
    }

    // Filter entries for this date that have content
    const dateEntries = entries.filter(row => 
      row.col1 === date && (row.col2.trim() || row.col3.trim() || row.col4.trim())
    );

    if (dateEntries.length === 0) {
      console.log('📝 [REPORTS] No entries to save for date:', date);
      return;
    }

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
      
      console.log('📝 [REPORTS] Saving entries for date:', date, '→', apiDate);
      console.log('📝 [REPORTS] Entries:', apiEntries);
      console.log('📝 [REPORTS] Month Quarter ID:', monthQuaterId);
      
      const response = await addDayEntries({
        entries: apiEntries,
        date: apiDate,
        month_quater_id: monthQuaterId
      });

      console.log('✅ [REPORTS] Entries saved successfully:', response);
      
      // Update entry_ids in rows
      if (response.created_entry_ids && response.created_entry_ids.length > 0) {
        console.log('✅ [REPORTS] Updating entry_ids in rows (auto-save):', response.created_entry_ids);
        setReviewRows(prev => {
          const updated = [...prev];
          let entryIdIndex = 0;
          
          dateEntries.forEach(dateRow => {
            const rowIndex = updated.findIndex(r => r.id === dateRow.id);
            if (rowIndex !== -1 && entryIdIndex < response.created_entry_ids.length) {
              const newEntryId = response.created_entry_ids[entryIdIndex];
              // Ensure entry_id is a number
              const entryIdNum = typeof newEntryId === 'number' ? newEntryId : parseInt(String(newEntryId));
              if (!isNaN(entryIdNum) && entryIdNum > 0) {
                updated[rowIndex] = {
                  ...updated[rowIndex],
                  entry_id: entryIdNum
                };
                console.log(`✅ [REPORTS] Updated row ${rowIndex} with entry_id: ${entryIdNum} (auto-save)`);
              } else {
                console.warn(`⚠️ [REPORTS] Invalid entry_id received: ${newEntryId}`);
              }
              entryIdIndex++;
            }
          });
          
          return updated;
        });
      } else {
        console.warn('⚠️ [REPORTS] No created_entry_ids in response (auto-save). Status changes may not work.');
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

  // Auto-save entries when content changes (debounced)
  useEffect(() => {
    if (!currentSchedule?.month_quater_id && !currentSchedule?.id) {
      return; // Don't save if month_quater_id is not available
    }

    // Skip auto-save if rows are empty or only have empty rows
    const hasContent = reviewRows.some(row => row.col2.trim() || row.col3.trim() || row.col4.trim());
    if (!hasContent) {
      return;
    }

    const timeoutId = setTimeout(() => {
      console.log('💾 [REPORTS] Auto-saving entries...');
      
      // Group rows by date
      const rowsByDate = reviewRows.reduce((acc, row) => {
        if (!acc[row.col1]) {
          acc[row.col1] = [];
        }
        acc[row.col1].push(row);
        return acc;
      }, {} as Record<string, ReviewRow[]>);

      // Save entries for each date
      Object.keys(rowsByDate).forEach(date => {
        saveEntries(date, rowsByDate[date]);
      });
      
      console.log('✅ [REPORTS] Auto-save completed');
    }, 2000); // Debounce: save 2 seconds after last change

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewRows, currentSchedule]);

  const addRow = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (view === 'Review') {
      // Get the active table from ReviewTable
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

  const handlePrint = () => window.print();
  const handleSubmit = async () => {
    // Check if schedule is available
    if (!currentSchedule) {
      alert('Error: Schedule information not available. Please wait for the schedule to load or refresh the page.');
      console.error('❌ [REPORTS] Current schedule:', currentSchedule);
      return;
    }

    // Check for month_quater_id in various possible field names
    // Note: The schedule API response may not include month_quater_id
    // We need to check all possible field names
    const monthQuaterId = currentSchedule.month_quater_id || 
                          currentSchedule.month_quater_id || 
                          currentSchedule.id || 
                          currentSchedule.Id ||
                          currentSchedule.month_quarter_id ||
                          currentSchedule.monthQuarterId ||
                          currentSchedule.pk ||
                          currentSchedule.pk_id;
    
    console.log('📋 [REPORTS] ===== SUBMIT BUTTON CLICKED =====');
    console.log('📋 [REPORTS] Checking for month_quater_id...');
    console.log('📋 [REPORTS] Schedule object:', JSON.stringify(currentSchedule, null, 2));
    console.log('📋 [REPORTS] Available fields:', Object.keys(currentSchedule));
    console.log('📋 [REPORTS] Extracted month_quater_id:', monthQuaterId);
    
    // TEMPORARY: If month_quater_id is not found, try to use schedule index or a default
    // TODO: Get month_quater_id from backend or use proper identifier
    let finalMonthQuaterId = monthQuaterId;
    
    if (!finalMonthQuaterId) {
      // Try to find the schedule index in monthlySchedule array
      const scheduleIndex = monthlySchedule.findIndex(s => 
        s.month === currentSchedule.month && 
        s.financial_year === currentSchedule.financial_year
      );
      
      if (scheduleIndex !== -1) {
        // Use index + 1 as fallback (assuming IDs start from 1)
        finalMonthQuaterId = scheduleIndex + 1;
        console.warn('⚠️ [REPORTS] Using schedule index as month_quater_id fallback:', finalMonthQuaterId);
      } else {
        // TEMPORARY FIX: Use a default value to allow API call to proceed
        // TODO: Backend should include month_quater_id in schedule response
        // For now, we'll use month number as a temporary identifier
        finalMonthQuaterId = currentSchedule.month || 1;
        console.warn('⚠️ [REPORTS] month_quater_id not found, using month as fallback:', finalMonthQuaterId);
        console.warn('⚠️ [REPORTS] This is a temporary fix. Backend should include month_quater_id in schedule response.');
        // Don't return - proceed with API call using fallback value
      }
    }
    
    console.log('✅ [REPORTS] Using month_quater_id:', finalMonthQuaterId);

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
        
        console.log('📝 [REPORTS] Prepared API entries:', JSON.stringify(apiEntries, null, 2));

        // Convert date from ISO format (YYYY-MM-DD) to API format (YYYY-M-D)
        const dateObj = new Date(date);
        const apiDate = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
        
        console.log('📝 [REPORTS] ===== CALLING addDayEntries API =====');
        console.log('📝 [REPORTS] Submitting entries for date:', date, '→', apiDate);
        console.log('📝 [REPORTS] Number of entries:', apiEntries.length);
        console.log('📝 [REPORTS] Entries:', JSON.stringify(apiEntries, null, 2));
        console.log('📝 [REPORTS] Month Quarter ID:', finalMonthQuaterId);
        console.log('📝 [REPORTS] Full API Request payload:', JSON.stringify({
          entries: apiEntries,
          date: apiDate,
          month_quater_id: finalMonthQuaterId
        }, null, 2));
        
        // Call the API
        console.log('🚀 [REPORTS] About to call addDayEntries API...');
        const response = await addDayEntries({
          entries: apiEntries,
          date: apiDate,
          month_quater_id: finalMonthQuaterId
        });
        
        console.log('✅ [REPORTS] API Response received:', JSON.stringify(response, null, 2));
        console.log('✅ [REPORTS] Response message:', response.message);
        console.log('✅ [REPORTS] Created entry IDs:', response.created_entry_ids);

        console.log('✅ [REPORTS] Entries saved successfully:', response);
        
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
          console.log('✅ [REPORTS] Updating entry_ids in rows:', response.created_entry_ids);
          setReviewRows(prev => {
            const updated = [...prev];
            let entryIdIndex = 0;
            
            entries.forEach(dateRow => {
              const rowIndex = updated.findIndex(r => r.id === dateRow.id);
              if (rowIndex !== -1 && entryIdIndex < response.created_entry_ids.length) {
                const newEntryId = response.created_entry_ids[entryIdIndex];
                // Ensure entry_id is a number
                const entryIdNum = typeof newEntryId === 'number' ? newEntryId : parseInt(String(newEntryId));
                if (!isNaN(entryIdNum) && entryIdNum > 0) {
                  updated[rowIndex] = {
                    ...updated[rowIndex],
                    entry_id: entryIdNum
                  };
                  console.log(`✅ [REPORTS] Updated row ${rowIndex} with entry_id: ${entryIdNum}`);
                } else {
                  console.warn(`⚠️ [REPORTS] Invalid entry_id received: ${newEntryId}`);
                }
                entryIdIndex++;
              }
            });
            
            return updated;
          });
        } else {
          console.warn('⚠️ [REPORTS] No created_entry_ids in response. Status changes may not work.');
        }
      }

      // Show success message from backend
      const successMessage = lastResponseMessage || `Entries created successfully! ${totalSaved} entry/entries saved.`;
      alert(successMessage);
    } catch (error: any) {
      console.error('❌ [REPORTS] Error submitting entries:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit entries. Please try again.';
      alert(`Error: ${errorMessage}`);
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
        </div>

        {/* Main Form Container */}
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 relative">
          
          {/* Top Right Actions */}
          <div className="absolute top-6 right-6 no-print flex space-x-2 z-10">
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
                SUBMIT REPORT
            </button>
          </div>

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
                  {getMonthsForQuarter(selectedQuarter || quarter)
                    .map((m) => ({
                      value: m,
                      label: monthNames[m - 1],
                    }))
                    .map(({ value, label }) => (
                      <option key={value} value={value}>
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
                {isLoadingEmployees ? (
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
                )}
                <span className="hidden print:block text-slate-800 font-semibold border-b border-slate-200 py-2">{attendee || '____________________'}</span>
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
              />
            )}
            {view === 'Implementation' && (
                <ImplementationTable 
                    rows={implRows}
                    setRows={setImplRows}
                    onStatusChange={handleImplementationStatusChange}
                />
            )}
            {view === 'SalesOps' && (
                <SalesOpsTable 
                    rows={salesOpsRows}
                    setRows={setSalesOpsRows}
                    onStatusChange={handleSalesOpsStatusChange}
                />
            )}
          </div>

          {/* Table Actions */}
          <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center no-print">
            <button 
                onClick={addRow}
                className="group flex items-center px-6 py-3 text-sm font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
                <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
                ADD ENTRY
            </button>
            <div className="text-right">
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
