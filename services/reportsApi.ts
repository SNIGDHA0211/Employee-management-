/**
 * Centralized API for Reports / Strategic Meeting module.
 * Re-exports report-related API functions from api.
 */
import {
  getEmployeeDashboard,
  getMonthlySchedule,
  addDayEntries,
  changeEntryStatus,
  getDepartmentsandFunctions,
  getEmployeesFromAccounts,
  getUserEntries,
  getUserEntriesByFilters,
  getProducts,
} from './api';

export const reportsApi = {
  getEmployeeDashboard,
  getMonthlySchedule,
  addDayEntries,
  changeEntryStatus,
  getDepartmentsandFunctions,
  getEmployeesFromAccounts,
  getUserEntries,
  getUserEntriesByFilters,
  getProducts,
};

export {
  getEmployeeDashboard,
  getMonthlySchedule,
  addDayEntries,
  changeEntryStatus,
  getDepartmentsandFunctions,
  getEmployeesFromAccounts,
  getUserEntries,
  getUserEntriesByFilters,
  getProducts,
};
