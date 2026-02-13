import axios from "axios";
import {
  getAuthToken,
  setAuthToken as setAuthTokenUtil,
  isValidToken,
  getRefreshToken,
  setRefreshToken,
  clearAuthData,
} from "./utils/auth";

// Production backend URL
const PRODUCTION_BACKEND_URL = 'https://employee-management-system-tmrl.onrender.com';
//https://employee-management-system-tmrl.onrender.com
// Use proxy in development to bypass CORS, direct URL in production
const isDevelopment = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.startsWith('192.168.') ||
   window.location.hostname.startsWith('10.') ||
   window.location.hostname.startsWith('172.'));

const API_BASE_URL = isDevelopment
  ? '/api'  // Vite proxy forwards to PRODUCTION_BACKEND_URL
  : PRODUCTION_BACKEND_URL;
  
// Create axios instance for authenticated requests
 const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include cookies for session-based auth
  timeout: 60000, // 60 second timeout (eventsapi can be slow with large datasets)
});

// Create axios instance for public endpoints (no auth required)
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
  timeout: 30000, // 30 second timeout
});

// Add auth token if available
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Token refresh flag to prevent infinite loops
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add response interceptor to handle authentication errors and token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // Handle network errors (CORS, connection refused, etc.)
    if (
      error.code === "ERR_NETWORK" ||
      error.code === "ERR_CONNECTION_REFUSED" ||
      error.message?.includes("Network Error") ||
      error.message?.includes("Failed to fetch") ||
      (error.name === "TypeError" && error.message?.includes("fetch"))
    ) {
      const backendUrl = PRODUCTION_BACKEND_URL;
      const networkError = new Error(
        `Network Error: Unable to connect to the backend server at ${backendUrl}.\n\nPlease check:\n1. Backend server is running on ${backendUrl}\n2. Network connectivity\n3. Firewall settings\n\n${isDevelopment ? 'Note: Using Vite proxy (/api) to reach production backend.' : 'Please check CORS configuration and network connectivity.'}`
      );
      return Promise.reject(networkError);
    }

    const originalRequest = error.config;

    // Suppress console errors for silent errors
    if (error.isSilent) {
      return Promise.reject(error);
    }

    // Handle 501 Not Implemented Error globally
    if (error.response?.status === 501) {
      const errorData = error.response?.data;
      const requestUrl = originalRequest?.url || error.config?.url || 'Unknown';
      const requestMethod = originalRequest?.method?.toUpperCase() || error.config?.method?.toUpperCase() || 'Unknown';
      
      console.error("❌ [GLOBAL 501 ERROR] Not Implemented (501)");
      console.error("❌ [GLOBAL 501 ERROR] Request:", `${requestMethod} ${requestUrl}`);
      console.error("❌ [GLOBAL 501 ERROR] Error Data:", errorData);
      
      let errorMessage = "Server error (501): The requested functionality is not implemented on the server.";
      
      if (errorData?.detail) {
        errorMessage = errorData.detail;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.error) {
        errorMessage = errorData.error;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      }
      
      const enhancedError = new Error(
        `Server Error (501) on ${requestMethod} ${requestUrl}: ${errorMessage}\n\n` +
        `This means the backend endpoint is not implemented or the HTTP method is not supported.\n` +
        `Please check:\n` +
        `1. Backend endpoint ${requestUrl} exists and is implemented\n` +
        `2. Backend supports ${requestMethod} method for this endpoint\n` +
        `3. Backend server is running the latest version\n` +
        `4. Contact backend developer to implement this endpoint\n\n` +
        `Error details logged to browser console.`
      );
      
      (enhancedError as any).originalError = error;
      (enhancedError as any).requestUrl = requestUrl;
      (enhancedError as any).requestMethod = requestMethod;
      
      return Promise.reject(enhancedError);
    }

    // Handle token refresh for 401 errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Check if it's a token validation error
      const errorData = error.response?.data;
      const isTokenError =
        errorData?.code === "token_not_valid" ||
        errorData?.detail?.includes("token") ||
        errorData?.messages;

      if (isTokenError) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;
        const refreshToken = getRefreshToken();

        if (refreshToken) {
          try {
            // Try to refresh the token
            const response = await axios.post(
              `${API_BASE_URL}/token/refresh/`,
              {
                refresh: refreshToken,
              }
            );

            const { access } = response.data;
            if (access) {
              setAuthTokenUtil(access);
              originalRequest.headers.Authorization = `Bearer ${access}`;

              // Process queued requests
              processQueue(null, access);
              isRefreshing = false;
              return api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed - clear auth and redirect to login
            processQueue(refreshError, null);
            isRefreshing = false;
            clearAuthData();

            // Redirect to login page
            if (window.location.pathname !== "/login") {
              window.location.href = "/login";
            }
            return Promise.reject(refreshError);
          }
        } else {
          // No refresh token - clear auth and redirect
          processQueue(error, null);
          isRefreshing = false;
          clearAuthData();

          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      }
    }

    // Handle 500 Internal Server Error globally
    if (error.response?.status === 500) {
      const errorData = error.response?.data;
      const requestUrl = originalRequest?.url || error.config?.url || 'Unknown';
      const requestMethod = originalRequest?.method?.toUpperCase() || error.config?.method?.toUpperCase() || 'Unknown';
      const fullUrl = `${API_BASE_URL}${requestUrl}`;
      const requestData = originalRequest?.data || error.config?.data;
      const requestHeaders = originalRequest?.headers || error.config?.headers;
      
      // Enhanced logging for debugging
      console.error("═══════════════════════════════════════════════════════════");
      console.error("❌ [GLOBAL 500 ERROR] Server Error (500)");
      console.error("═══════════════════════════════════════════════════════════");
      console.error("📍 Request Details:");
      console.error("   Method:", requestMethod);
      console.error("   URL:", requestUrl);
      console.error("   Full URL:", fullUrl);
      console.error("   Base URL:", API_BASE_URL);
      console.error("   Headers:", requestHeaders);
      if (requestData) {
        try {
          // Try to parse and display request data nicely
          if (typeof requestData === 'string') {
            try {
              const parsed = JSON.parse(requestData);
              console.error("   Request Data:", JSON.stringify(parsed, null, 2));
            } catch {
              console.error("   Request Data (raw):", requestData);
            }
          } else if (requestData instanceof FormData) {
            console.error("   Request Data: FormData (file upload)");
            // Log FormData entries if possible
            if (requestData.entries) {
              const entries: any[] = [];
              for (const [key, value] of requestData.entries()) {
                entries.push({ [key]: value instanceof File ? `File: ${value.name}` : value });
              }
              console.error("   FormData entries:", entries);
            }
          } else {
            console.error("   Request Data:", JSON.stringify(requestData, null, 2));
          }
        } catch (e) {
          console.error("   Request Data:", requestData);
        }
      }
      console.error("📥 Response Details:");
      console.error("   Status:", error.response?.status);
      console.error("   Status Text:", error.response?.statusText);
      console.error("   Response Headers:", error.response?.headers);
      console.error("   Response Data:", errorData);
      console.error("═══════════════════════════════════════════════════════════");
      
      // Extract error message
      let errorMessage = "Server error (500): The backend encountered an error while processing your request.";
      
      if (errorData?.detail) {
        errorMessage = errorData.detail;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.error) {
        errorMessage = errorData.error;
      } else if (typeof errorData === 'string') {
        // Check if it's HTML error page
        if (errorData.includes('<!DOCTYPE') || errorData.includes('<html')) {
          errorMessage = "Backend returned HTML error page. This usually means:\n" +
                        "1. The endpoint doesn't exist or is misconfigured\n" +
                        "2. There's a server-side routing error\n" +
                        "3. The backend is returning a default error page";
        } else {
          errorMessage = errorData.substring(0, 500); // Limit length
        }
      } else if (errorData && typeof errorData === 'object') {
        const errorText = JSON.stringify(errorData);
        
        // Check for Photo_link error
        if (errorText.includes("Photo_link") && (errorText.includes("no file associated") || errorText.includes("has no file"))) {
          errorMessage = "Backend Error: Some employees have invalid profile pictures (Photo_link field has no file associated). The backend Django serializer needs to handle null/empty Photo_link fields.";
        } else if (errorText.includes("ValueError")) {
          // Extract ValueError message
          const valueErrorMatch = errorText.match(/ValueError[^"]*"([^"]+)"/) || 
                                 errorText.match(/ValueError:\s*(.+?)(?:"|$)/i) ||
                                 errorText.match(/The '([^']+)' attribute has no file associated with it/);
          if (valueErrorMatch && valueErrorMatch[1]) {
            errorMessage = `Backend Error: ${valueErrorMatch[1]}`;
          }
        } else {
          // Try to stringify
          try {
            const errorStr = JSON.stringify(errorData, null, 2);
            if (errorStr && errorStr !== '{}' && errorStr.length < 500) {
              errorMessage = `Backend Error: ${errorStr}`;
            } else if (errorStr.length >= 500) {
              errorMessage = `Backend Error: ${errorStr.substring(0, 500)}...`;
            }
          } catch (e) {
            // Keep default message
          }
        }
      }
      
      // Create enhanced error with context
      const enhancedError = new Error(
        `Server Error (500) on ${requestMethod} ${requestUrl}\n\n` +
        `Error: ${errorMessage}\n\n` +
        `This is a backend server error. Please check:\n` +
        `1. Backend server logs for detailed error\n` +
        `2. Database connection\n` +
        `3. Backend endpoint implementation at: ${fullUrl}\n` +
        `4. Request data format (see console for details)\n` +
        `5. Backend server is running and accessible\n\n` +
        `Full error details logged to browser console above.`
      );
      
      // Attach original error for debugging
      (enhancedError as any).originalError = error;
      (enhancedError as any).requestUrl = requestUrl;
      (enhancedError as any).requestMethod = requestMethod;
      (enhancedError as any).fullUrl = fullUrl;
      (enhancedError as any).requestData = requestData;
      
      return Promise.reject(enhancedError);
    }

    // Only log non-silent errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Authentication errors are expected in some cases, don't log them as errors
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// ==================== INTERFACES ====================

interface LoginResponse {
  messege: string;
  username: string;
  Role: string;
}

interface CreateEmployeeResponse {
  message: string;
}

interface UpdateProfileResponse {
  messege: string;
}

interface Employee {
  Employee_id?: string;
  "Employee ID"?: string; // Backward compatibility
  Name?: string;
  "Full Name"?: string; // Backward compatibility
  Email_id?: string;
  "Email Address"?: string; // Backward compatibility
  Role: string;
  Designation: string;
  Branch: string;
  Date_of_join?: string;
  "Joining Date"?: string; // Backward compatibility
  Date_of_birth?: string;
  "Date of Birth"?: string; // Backward compatibility
  Photo_link?: string;
  "Profile Picture"?: string; // Backward compatibility
  "Initial Password"?: string;
  password?: string;
}

interface GetEmployeesResponse {
  employees?: Employee[];
  users?: Employee[];
  data?: Employee[];
}

// ==================== AUTHENTICATION API ====================

/**
 * Login function - POST method
 * Tries multiple field names to handle backend variations
 * @param username - Employee ID, Email, or Full Name
 * @param password - User password
 * @param useAdminEndpoint - Whether to use admin endpoint
 * @endpoint POST /accounts/login/ or POST /admin/
 */
function extractServerMessage(error: any, status?: number): Error & { response?: any } {
  const data = error.response?.data;
  let serverMsg = "";
  if (data) {
    if (typeof data === "string") serverMsg = data;
    else if (data.message) serverMsg = data.message;
    else if (data.detail) serverMsg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    else if (data.error) serverMsg = data.error;
    else if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0)
      serverMsg = data.non_field_errors.join(" ");
    else if (typeof data === "object" && Object.keys(data).length > 0) {
      const firstVal = Object.values(data)[0];
      serverMsg = Array.isArray(firstVal) ? (firstVal as string[]).join(" ") : String(firstVal);
    }
  }
  const fallback =
    status === 403 ? "Access forbidden. You do not have permission." : "Invalid credentials. Please check your username and password.";
  const err = new Error(serverMsg || fallback) as Error & { response?: any };
  err.response = error.response; // Preserve so App can check status
  return err;
}

export const login = async (
  username: string,
  password: string,
  useAdminEndpoint: boolean = false
): Promise<LoginResponse> => {
  // Validate inputs
  if (!username || username.trim() === "") {
    throw new Error(
      "Username is required. Please enter your Employee ID, Email, or Full Name."
    );
  }
  if (!password || password.trim() === "") {
    throw new Error("Password is required.");
  }

  // Trim whitespace (keep original case)
  const trimmedUsername = username.trim();
  const trimmedPassword = password.trim();

  // Use admin endpoint if useAdminEndpoint is true, otherwise use regular login
  const loginEndpoint = useAdminEndpoint ? "/admin/" : "/accounts/login/";

  // Try multiple field names - backend might expect Employee_id, Email_id, Email, email, or username
  const fieldNames = ["username", "Employee_id", "Email_id", "Email", "email"];

  for (const fieldName of fieldNames) {
    try {
      // Try form-data format first (most common for Django)
      try {
        const formData = new URLSearchParams();
        formData.append(fieldName, trimmedUsername);
        formData.append("password", trimmedPassword);

        const response = await publicApi.post(loginEndpoint, formData.toString(), {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });

        // If successful, check for token in response (JWT) or use session cookies
        if (response.status === 200 || response.status === 201) {
          const data = response.data as LoginResponse;
          
          // Check if backend returns JWT token in response
          // Some backends return: { access: "...", refresh: "..." }
          // Others use session cookies (no token needed)
          if ((data as any).access) {
            setAuthTokenUtil((data as any).access);
          } else if ((data as any).token) {
            setAuthTokenUtil((data as any).token);
          } else if (response.headers['authorization']) {
            const authHeader = response.headers['authorization'];
            const token = authHeader.replace('Bearer ', '');
            if (token) setAuthTokenUtil(token);
          }
          return data;
        }
      } catch (formError: any) {
        const status = formError.response?.status;
        if (status === 406) {
          try {
            const requestBody: any = {};
            requestBody[fieldName] = trimmedUsername;
            requestBody.password = trimmedPassword;

            const response = await publicApi.post(loginEndpoint, requestBody);

            if (response.status === 200 || response.status === 201) {
              const data = response.data as LoginResponse;
              if ((data as any).access) {
                setAuthTokenUtil((data as any).access);
              } else if ((data as any).token) {
                setAuthTokenUtil((data as any).token);
              } else if (response.headers['authorization']) {
                const authHeader = response.headers['authorization'];
                const token = authHeader.replace('Bearer ', '');
                if (token) setAuthTokenUtil(token);
              }
              return data;
            }
          } catch (jsonError: any) {
            if (jsonError.response?.status === 401 || jsonError.response?.status === 403) {
              throw extractServerMessage(jsonError, jsonError.response?.status);
            }
            throw jsonError;
          }
        } else if (status === 401 || status === 403) {
          // Don't retry with other field names - 403/401 means forbidden/unauthorized
          throw extractServerMessage(formError, status);
        } else {
          throw formError;
        }
      }
    } catch (error: any) {
      if (error.response?.status === 400) {
        throw extractServerMessage(error, 400);
      }
      // Check if it's a network error (CORS or connection issue)
      // Axios network errors have code 'ERR_NETWORK' or 'ERR_CONNECTION_REFUSED'
      if (
        error.code === "ERR_NETWORK" ||
        error.code === "ERR_CONNECTION_REFUSED" ||
        error.code === "ECONNREFUSED" ||
        error.code === "ETIMEDOUT" ||
        error.message?.includes("Network Error") ||
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("timeout") ||
        (error.name === "TypeError" && error.message?.includes("fetch"))
      ) {
        const backendUrl = PRODUCTION_BACKEND_URL;
        const corsErrorMsg = `Network Error: Unable to connect to the backend server at ${backendUrl}. 

This could be due to:
1. Backend server is not running or unreachable
2. Network connectivity issues
3. Firewall blocking the connection

${isDevelopment ? 'Note: Using Vite proxy (/api) to bypass CORS. Make sure:\n- Backend server is running on ' + backendUrl + '\n- Vite dev server is running\n- Proxy is configured correctly in vite.config.ts' : 'Please check:\n- Backend server is running\n- CORS is configured correctly\n- Network connectivity'} `;

        throw new Error(corsErrorMsg);
      }
      throw error;
    }
  }

  throw new Error(
    "Login failed: Unable to authenticate with any field name. Please check your credentials."
  );
};

/**
 * Logout function
 */
export const logout = async (): Promise<void> => {
  try {
    // Call backend logout endpoint to invalidate server-side session
    await api.get("/accounts/logout/");
  } catch (error: any) {
    // If network/server error, still clear local auth so user is signed out on frontend
    console.error("❌ [LOGOUT] Error calling /accounts/Logout/ endpoint:", error);
  } finally {
    // Always clear local auth data
    clearAuthData();
  }
};

/**
 * Set authentication token for API calls
 */
export const setAuthToken = (token: string) => {
  setAuthTokenUtil(token);
};

/**
 * Token refresh function
 */
export const refreshToken = (refresh: string) => {
  return axios.post(`${API_BASE_URL}/token/refresh/`, { refresh });
};

// ==================== EMPLOYEE MANAGEMENT API ====================

/**
 * Get employee dashboard data (for logged-in user)
 * Uses cache-busting to avoid stale data when switching users (especially on local dev server)
 */
export const getEmployeeDashboard = async (): Promise<Employee> => {
  try {
    const response = await api.get("/accounts/employee/dashboard/", {
      params: { _t: Date.now() },
    });

    const data = response.data;

    // Handle different response formats
    let employeeData: any;

    if (data.employee) {
      employeeData = data.employee;
    } else if (data.data) {
      employeeData = data.data;
    } else if (data.user) {
      employeeData = data.user;
    } else if (data["Employee ID"] || data["Full Name"]) {
      // Already in Employee format
      employeeData = data;
    } else {
      // Try to find employee data in any key
      const keys = Object.keys(data);
      if (keys.length > 0) {
        employeeData = data[keys[0]];
      } else {
        throw new Error("Unable to parse employee dashboard response");
      }
    }

    // Log Photo_link for debugging
    if (employeeData?.Photo_link) {} else if (employeeData?.["Profile Picture"]) {} else {}

    return employeeData as Employee;
  } catch (error: any) {
    if (
      error.name === "TypeError" &&
      (error.message.includes("fetch") ||
        error.message.includes("Failed to fetch"))
    ) {
      throw new Error(
        "Network error: Unable to fetch employee dashboard. Please check server connection."
      );
    }
    throw error;
  }
};

/**
 * Create employee - POST method (Admin and MD access only)
 * Creates a new employee with login credentials
 * @endpoint POST /accounts/admin/createEmployeeLogin/
 */
export const createEmployee = async (employeeData: {
  employeeId: string;
  password: string;
  fullName: string;
  role: string;
  designation: string;
  branch: string;
  department: string;
  function?: string;
  teamLead?: string; // Team Lead Employee_id
  joiningDate: string;
  dateOfBirth: string;
  profilePicture: File | string | null;
  emailAddress: string;
}): Promise<CreateEmployeeResponse> => {
  // Create FormData for multipart/form-data upload
  const formData = new FormData();

  // Add all text fields - using backend's expected field names
  formData.append("Employee_id", employeeData.employeeId);
  formData.append("password", employeeData.password);
  formData.append("Name", employeeData.fullName);
  formData.append("Role", employeeData.role);
  formData.append("Email_id", employeeData.emailAddress);
  formData.append("Designation", employeeData.designation);
  formData.append("Date_of_join", employeeData.joiningDate);
  formData.append("Date_of_birth", employeeData.dateOfBirth);
  formData.append("Branch", employeeData.branch);
  formData.append("Department", employeeData.department);
  if (employeeData.function) {
    formData.append("Function", employeeData.function);
  }
  if (employeeData.teamLead) {
    formData.append("Team_Lead", employeeData.teamLead);
  }

  // Add image file if it's a File object
  if (employeeData.profilePicture instanceof File) {
    formData.append("Photo_link", employeeData.profilePicture);
  } else if (employeeData.profilePicture) {
    // If it's a base64 string (fallback), send as is
    formData.append("Photo_link", employeeData.profilePicture);
  }

  const response = await api.post(
    "/accounts/admin/createEmployeeLogin/",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};

/**
 * Get all employees from accounts API (includes department, function for NMRHI filtering)
 * Tries: GET /accounts/employees/ then /accounts/accounts/employees/ as fallback
 */
export const getEmployeesFromAccounts = async (): Promise<any[]> => {
  const parseResponse = (data: any) => {
    if (Array.isArray(data)) return data;
    if (data?.employees && Array.isArray(data.employees)) return data.employees;
    if (data?.users && Array.isArray(data.users)) return data.users;
    if (data?.data && Array.isArray(data.data)) return data.data;
    return [];
  };
  for (const path of ['/accounts/employees/', '/accounts/accounts/employees/']) {
    try {
      const response = await api.get(path, { headers: { 'Accept': 'application/json' } });
      return parseResponse(response.data);
    } catch (error: any) {
      if (error?.response?.status === 404) continue;
      console.error(`❌ [GET EMPLOYEES FROM ACCOUNTS] ${path}:`, error?.response?.data || error);
    }
  }
  return [];
};

/**
 * Get all employees (Admin and MD access only)
 */
export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const token = getAuthToken();const response = await api.get("/accounts/employees/", {
      headers: {
        'Accept': 'application/json',
      }
    });const data: GetEmployeesResponse = response.data;

    // Handle different response formats - check for Employee_id/Name first (matching createEmployee field names)
    let employees: Employee[] = [];

    if (data.employees && Array.isArray(data.employees)) {
      employees = data.employees;
    } else if (data.users && Array.isArray(data.users)) {
      employees = data.users;
    } else if (data.data && Array.isArray(data.data)) {
      employees = data.data;
    } else if (Array.isArray(data)) {
      employees = data;
    } else {
      return [];
    }

    // Check if any Employee_id values are numbers (which would lose leading zeros)
    const numericEmployeeIds = employees.filter((emp: any) => {
      const empId = emp['Employee_id'] || emp['Employee ID'] || emp.id;
      return typeof empId === 'number';
    });

    return employees;
  } catch (error: any) {
    const status = error.response?.status;
    const respData = error.response?.data;
    const isHtmlError = typeof respData === 'string' && respData.includes('<!DOCTYPE');
    console.error("❌ [GET EMPLOYEES] Error:", error.message, "| Status:", status ?? "no response");
    if (respData && !isHtmlError) {
      console.error("❌ [GET EMPLOYEES] Response:", typeof respData === 'object' ? JSON.stringify(respData).slice(0, 200) : respData);
    }
    
    // Handle 500 Internal Server Error
    if (error.response?.status === 500) {
      // Try to extract detailed error message from backend
      const errorData = error.response?.data;
      let errorMessage = "Server error (500): The backend encountered an error while processing your request.";
      
      // Extract error message from various possible formats
      if (errorData?.detail) {
        errorMessage = errorData.detail;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.error) {
        errorMessage = errorData.error;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData.includes('<!DOCTYPE') || errorData.includes('SessionInterrupted')
          ? 'Session expired or server error. Please refresh and login again.'
          : errorData.length > 300 ? errorData.slice(0, 300) + '...' : errorData;
      } else if (errorData && typeof errorData === 'object') {
        // Try to extract Django error message
        const errorText = JSON.stringify(errorData);
        
        // Check for specific Django errors - Photo_link file field error
        if (errorText.includes("Photo_link") && (errorText.includes("no file associated") || errorText.includes("has no file"))) {
          errorMessage = "Backend Error: Some employees have invalid profile pictures (Photo_link field has no file associated). The backend Django serializer is trying to serialize a FileField that has no file. This needs to be fixed in the backend serializer.";
        } else if (errorText.includes("ValueError")) {
          // Extract ValueError message - try multiple patterns
          let valueErrorMatch = errorText.match(/ValueError[^"]*"([^"]+)"/) || 
                               errorText.match(/ValueError:\s*(.+?)(?:"|$)/i) ||
                               errorText.match(/The '([^']+)' attribute has no file associated with it/);
          
          if (valueErrorMatch && valueErrorMatch[1]) {
            errorMessage = `Backend Error: ${valueErrorMatch[1]}`;
          } else {
            // Try to extract the error message after ValueError
            const afterValueError = errorText.split("ValueError")[1];
            if (afterValueError) {
              const cleanError = afterValueError.substring(0, 300).replace(/[{}"]/g, '').trim();
              if (cleanError) {
                errorMessage = `Backend Error: ${cleanError}`;
              } else {
                errorMessage = `Backend Error: ${errorText.substring(0, 200)}`;
              }
            } else {
              errorMessage = `Backend Error: ${errorText.substring(0, 200)}`;
            }
          }
        } else {
          // Try to stringify the error object
          try {
            const errorStr = JSON.stringify(errorData, null, 2);
            if (errorStr && errorStr !== '{}' && errorStr.length < 500) {
              errorMessage = `Backend Error:\n${errorStr}`;
            } else if (errorStr.length >= 500) {
              errorMessage = `Backend Error: ${errorStr.substring(0, 500)}...`;
            }
          } catch (e) {
            // If stringify fails, use default message
          }
        }
      }
      
      // Provide helpful guidance based on error type
      let guidance = "";
      if (errorMessage.includes("Photo_link") || errorMessage.includes("no file associated") || errorMessage.includes("has no file")) {
        guidance = "\n\n🔧 Backend Fix Required:\nThe Django serializer is trying to serialize a Photo_link FileField that has no file. The backend developer needs to:\n\n1. Update the serializer to handle null/empty Photo_link fields\n2. Use a SerializerMethodField for Photo_link:\n   photo_link = serializers.SerializerMethodField()\n   def get_photo_link(self, obj):\n       return obj.Photo_link.url if obj.Photo_link else None\n\n3. Or exclude Photo_link from serialization if it's empty\n\nThis is a backend code issue, not a frontend issue.";
      } else {
        guidance = "\n\nPlease check:\n1. Backend server logs for detailed error\n2. Database connection\n3. Backend endpoint implementation\n4. Authentication token validity";
      }
      
      throw new Error(`Server Error (500): ${errorMessage}${guidance}`);
    }
    
    // Handle 401/403 Authentication errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error("Authentication failed. Please login again to fetch employees.");
    }
    
    // Handle network errors
    if (
      error.name === "TypeError" &&
      (error.message.includes("fetch") ||
        error.message.includes("Failed to fetch"))
    ) {
      throw new Error(
        "Network error: Unable to fetch employees. Please check server connection."
      );
    }

    // Handle other HTTP errors
    if (error.response?.status) {
      const status = error.response.status;
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.message || 
                          error.message ||
                          `Request failed with status code ${status}`;
      throw new Error(`Error ${status}: ${errorMessage}`);
    }

    throw error;
  }
};

/**
 * Update employee profile
 * Uses FormData for file uploads (like createEmployee)
 */
export const updateProfile = async (employeeData: {
  employeeId: string;
  password?: string;
  fullName: string;
  role: string;
  designation: string;
  branch: string;
  department: string;
  joiningDate: string;
  dateOfBirth: string;
  profilePicture: File | string | null;
  emailAddress: string;
}): Promise<UpdateProfileResponse> => {
  // Create FormData for multipart/form-data upload (supports file uploads)
  const formData = new FormData();

  // Add all text fields - using backend's expected field names (matching createEmployee)
  formData.append("Employee_id", employeeData.employeeId);
  formData.append("Name", employeeData.fullName);
  formData.append("Role", employeeData.role);
  formData.append("Email_id", employeeData.emailAddress);
  formData.append("Designation", employeeData.designation);
  formData.append("Date_of_join", employeeData.joiningDate);
  formData.append("Date_of_birth", employeeData.dateOfBirth);
  formData.append("Branch", employeeData.branch);
  formData.append("Department", employeeData.department);

  // Add password if provided
  if (employeeData.password) {
    formData.append("password", employeeData.password);
  }

  // Only add Photo_link if it's a File instance (not a URL string)
  // Backend expects a file upload, not a URL string
  if (employeeData.profilePicture instanceof File) {
    formData.append("Photo_link", employeeData.profilePicture);
  }
  // If it's a URL string, don't send it - backend will keep existing photo
  // This prevents the error: "The 'Photo_link' attribute has no file associated with it"

  const response = await api.post(
    `/accounts/admin/updateProfile/${employeeData.employeeId}/`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
};

/**
 * Change employee photo
 * @endpoint POST /accounts/admin/changePhoto/{username}/
 * @body multipart/form-data, field: Photo_link (File)
 */
export const changePhoto = async (username: string, photoFile: File): Promise<{ messege?: string; message?: string }> => {
  const formData = new FormData();
  formData.append("Photo_link", photoFile);
  const response = await api.post(
    `/accounts/admin/changePhoto/${encodeURIComponent(username)}/`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
};

/**
 * Delete employee
 * @endpoint DELETE /accounts/admin/deleteEmployee/{Employee_id}/
 * @response { message: "user deleted successfully" }
 */
export const deleteEmployee = async (employeeId: string): Promise<{ message: string }> => {
  const response = await api.delete(`/accounts/admin/deleteEmployee/${encodeURIComponent(employeeId)}/`);
  return response.data;
};

// ==================== TASK MANAGEMENT API ====================

/**
 * Create a new task
 */
/**
 * Create a new task
 * @endpoint POST /tasks/createTask/
 * @required_fields title, description, due_date, assigned_to, type
 * @response {"message": "Task created"}
 * @note assigned_to should be an array of employee IDs: ["444", "20018"]
 */
export const createTask = async (taskData: {
  title: string;
  description: string;
  type: string;
  due_date: string;
  assigned_to: string | string[]; // Can be single string or array of employee IDs
}): Promise<{ message: string }> => {// Validate required fields
  if (!taskData.title || !taskData.description || !taskData.due_date || !taskData.assigned_to || !taskData.type) {
    throw new Error("Missing required fields: title, description, due_date, assigned_to, type are all required");
  }

  // Ensure assigned_to is an array
  const assignedToArray = Array.isArray(taskData.assigned_to) 
    ? taskData.assigned_to 
    : [taskData.assigned_to];

  // Validate that assigned_to array is not empty
  if (assignedToArray.length === 0) {
    throw new Error("assigned_to must contain at least one employee ID");
  }

  try {
    const requestBody = {
      title: taskData.title,
      description: taskData.description,
      due_date: taskData.due_date,
      assigned_to: assignedToArray, // Send as array of employee IDs
      type: taskData.type,
      task_type: taskData.type, // Some backends expect task_type; send both for compatibility
    };
    const response = await api.post("/tasks/createTask/", requestBody);
    return response.data;
  } catch (error: any) {
    console.error("❌ [CREATE TASK API] Exception:", error);
    console.error("❌ [CREATE TASK API] Error Response:", error.response?.data);
    console.error("❌ [CREATE TASK API] Error Message:", error.message);
    console.error("❌ [CREATE TASK API] Status Code:", error.response?.status);
    
    // Handle 501 Not Implemented
    if (error.response?.status === 501) {
      const errorMsg = error.response?.data?.message || 
                      error.response?.data?.detail || 
                      "The createTask endpoint is not implemented on the backend server.";
      throw new Error(
        `Server Error (501) on POST /tasks/createTask/:\n\n` +
        `${errorMsg}\n\n` +
        `This means the backend endpoint is not implemented or the HTTP method is not supported.\n\n` +
        `Please check:\n` +
        `1. Backend endpoint /tasks/createTask/ exists and is implemented\n` +
        `2. Backend supports POST method for this endpoint\n` +
        `3. Backend server is running the latest version\n` +
        `4. Contact backend developer to implement this endpoint`
      );
    }
    
    // Handle 400 Bad Request
    if (error.response?.status === 400) {
      const errorMsg = error.response?.data?.message || error.response?.data?.detail || "Invalid task data. Please check all required fields.";
      throw new Error(`Validation Error: ${errorMsg}`);
    }
    
    throw error;
  }
};

/**
 * View all tasks
 * @endpoint GET /tasks/viewTasks/
 * @returns Array of task objects
 */
export const viewTasks = async (): Promise<any[]> => {try {
    const response = await api.get("/tasks/viewTasks/");
    const data = response.data;

    let tasks: any[] = [];

    // Handle different response formats
    if (Array.isArray(data)) {
      tasks = data;
    } else if (data && typeof data === 'object') {
      const arr = data.tasks ?? data.data ?? data.results ?? data.view_tasks ?? data.viewTasks ??
        data['View Tasks Updated Response'];
      if (Array.isArray(arr)) tasks = arr;
      else {
        // Try any array value in the response
        const vals = Object.values(data);
        const found = vals.find(v => Array.isArray(v) && v.length > 0 && (v[0]?.Task_id != null || v[0]?.task_id != null || v[0]?.id != null || v[0]?.taskId != null));
        if (Array.isArray(found)) tasks = found;
      }
    }
    if (tasks.length === 0 && data && typeof data === 'object') {
      console.warn('[VIEW TASKS] No tasks array found. Keys:', Object.keys(data));
    }

    // Log task IDs for debugging
    if (tasks.length > 0) {
      const firstTask = tasks[0];
      const hasId = !!(firstTask.Task_id || firstTask.id || firstTask.task_id || firstTask.pk || firstTask.taskId);if (!hasId) {
        console.error("❌ [VIEW TASKS API] CRITICAL: Backend is not returning task IDs!");
        console.error("❌ [VIEW TASKS API] The API response must include one of: id, task_id, pk, or taskId");
        console.error("❌ [VIEW TASKS API] Without task IDs, status changes and other operations will fail.");
        console.error("❌ [VIEW TASKS API] Current response fields:", Object.keys(firstTask));
        console.error("❌ [VIEW TASKS API] Expected format: { id: 123, title: '...', description: '...', ... }");
      }
    }return tasks;
  } catch (error: any) {
    console.error("❌ [VIEW TASKS API] Exception caught:", error);
    console.error("❌ [VIEW TASKS API] Error Response:", error.response?.data);
    
    // Provide better error messages
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error("Authentication failed. Please login again to view tasks.");
    }
    
    throw error;
  }
};

/**
 * View assigned tasks for current user
 * Response format: { task_id, title, description, status, created_by, "due-date" } or array of such
 */
export const viewAssignedTasks = async (): Promise<any[]> => {
  try {
    const response = await api.get("/tasks/viewAssignedTasks/");
    const data = response?.data;
    console.log('[viewAssignedTasks] Raw response:', data);

    let tasks: any[] = [];

    if (Array.isArray(data)) {
      tasks = data;
    } else if (data && typeof data === 'object') {
      const arr = data.assigned_tasks ?? data.tasks ?? data.data ?? data.results ?? data.viewAssignedTasks ??
        data['View Tasks Updated Response'] ?? data['view_tasks'] ?? data['viewTasks'];
      if (Array.isArray(arr)) {
        tasks = arr;
      } else if (data.Task_id != null || data.task_id != null || data.id != null) {
        // Single task: { task_id, title, description, status, created_by, "due-date" }
        tasks = [data];
      } else {
        const vals = Object.values(data);
        const found = vals.find((v: any) => Array.isArray(v) && v.length > 0 && (v[0]?.Task_id != null || v[0]?.task_id != null || v[0]?.id != null));
        if (Array.isArray(found)) tasks = found;
        else {
          const single = vals.find((v: any) => v && typeof v === 'object' && (v.Task_id != null || v.task_id != null || v.id != null));
          if (single) tasks = [single];
        }
      }
    }

    console.log('[viewAssignedTasks] Extracted tasks:', tasks);
    return Array.isArray(tasks) ? tasks : [];
  } catch (error: any) {
    console.error("❌ [VIEW ASSIGNED TASKS API] Exception caught:", error);
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      throw new Error("Authentication failed. Please login again to view tasks.");
    }
    throw error;
  }
};

/**
 * Change task status
 * @endpoint PATCH /tasks/changeStatus/<int:task_id>/
 * @param taskId Task ID (integer) - from task_id field in API response
 * @param status New status: "PENDING", "INPROCESS", or "COMPLETED"
 * @returns Response with message: {"message": "Status Changed to COMPLETED"}
 * @note Field name is change_Status_to (with capital S)
 */
export const changeTaskStatus = async (
  taskId: string | number,
  status: "PENDING" | "INPROCESS" | "COMPLETED" | "IN PROGRESS" | "IN_PROGRESS"
): Promise<{ message: string }> => {
  try {
    // Extract numeric ID from task ID string if needed
    let numericTaskId: number;
    if (typeof taskId === 'number') {
      numericTaskId = taskId;
    } else {
      const taskIdStr = String(taskId).trim();
      
      // If it's already a numeric string, parse it directly
      if (/^\d+$/.test(taskIdStr)) {
        numericTaskId = parseInt(taskIdStr, 10);
      } else {
        // Try to extract number from string (for cases like "123" or fallback IDs)
        // For fallback IDs like "t1767789989844-0.11216026287831349", extract the first number
        const match = taskIdStr.match(/\d+/);
        if (match) {
          numericTaskId = parseInt(match[0], 10);} else {
          // Last resort: try to parse the whole string
          numericTaskId = parseInt(taskIdStr, 10);
          if (isNaN(numericTaskId)) {
            throw new Error(`Invalid task ID format: ${taskId}. Backend expects an integer task_id. The task may not have been properly saved to the backend.`);
          }
        }
      }
    }
    
    // Validate that we have a valid numeric ID
    if (isNaN(numericTaskId) || numericTaskId <= 0) {
      throw new Error(`Invalid task ID: ${taskId} (extracted as ${numericTaskId}). The task may not have been properly saved to the backend.`);
    }

    // Map status values - backend expects "INPROCESS" (no space), "PENDING", "COMPLETED"
    let backendStatus: "PENDING" | "INPROCESS" | "COMPLETED";
    if (status === "INPROCESS" || status === "IN PROGRESS" || status === "IN_PROGRESS") {
      backendStatus = "INPROCESS";
    } else if (status === "PENDING") {
      backendStatus = "PENDING";
    } else if (status === "COMPLETED") {
      backendStatus = "COMPLETED";
    } else {
      throw new Error(`Invalid status: ${status}. Must be one of: PENDING, INPROCESS, COMPLETED`);
    }// Correct endpoint format: PATCH /tasks/changeStatus/<int:task_id>/
    const endpoint = `/tasks/changeStatus/${numericTaskId}/`;
    const requestBody = {
      change_Status_to: backendStatus, // Field name with capital S as documented
    };const response = await api.patch(endpoint, requestBody);// Check if response contains error message even if status is 200
    // Backend may return 200 but with error in response body
    const responseData = response.data;
    
    // Handle case where response.data might be a string (error message)
    let responseMessage = '';
    if (typeof responseData === 'string') {
      responseMessage = responseData;
    } else if (responseData && typeof responseData === 'object') {
      responseMessage = responseData?.message || responseData?.error || responseData?.detail || responseData?.error_message || '';
    }
    
    // Convert to string for checking
    const responseStr = String(responseMessage || '');
    
    // Check for database errors or null value errors in response
    if (responseStr && (
      responseStr.includes('null value') || 
      responseStr.includes('column') ||
      responseStr.includes('constraint') ||
      responseStr.includes('violation') ||
      responseStr.includes('relation') ||
      (responseStr.toLowerCase().includes('error') && !responseStr.toLowerCase().includes('success')) ||
      responseStr.toLowerCase().includes('failed')
    )) {
      console.error("❌ [CHANGE TASK STATUS API] Backend returned error in response body (status 200):", responseStr);
      console.error("❌ [CHANGE TASK STATUS API] Full response data:", responseData);
      throw new Error(`Failed to change task status: ${responseStr}`);
    }
    
    // Check if response message indicates success
    if (responseStr && (
      responseStr.includes('Status Changed') || 
      responseStr.includes('success') ||
      responseStr.includes('updated') ||
      responseStr.includes('Success')
    )) {return response.data;
    }
    
    // If no clear success message but status is 200 and no error detected, assume success
    // But only if we didn't detect any error patterns above
    if (response.status === 200 && !responseStr.includes('null') && !responseStr.includes('error') && !responseStr.includes('column')) {return response.data;
    }
    
    // If we get here, something unexpected happened - log warning but don't throw
    // This allows the caller to handle it
    if (response.status === 200 && responseStr) {// If there's a message but we're not sure if it's success or error, throw to be safe
      throw new Error(`Unclear response from backend: ${responseStr}`);
    }
    
    return response.data;
  } catch (error: any) {
    console.error("❌ [CHANGE TASK STATUS API] Exception:", error);
    console.error("❌ [CHANGE TASK STATUS API] Error Response:", error.response?.data);
    console.error("❌ [CHANGE TASK STATUS API] Error Message:", error.message);
    console.error("❌ [CHANGE TASK STATUS API] Status Code:", error.response?.status);

    // Handle 400 Bad Request
    if (error.response?.status === 400) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Invalid request. Please check task_id and status.";
      throw new Error(`Bad Request (400): ${errorMsg}`);
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      const errorDetail = error.response?.data?.detail || error.response?.data?.message || '';
      
      if (errorDetail.includes("didn't match any of these") || errorDetail.includes("not found") || errorDetail.includes("No route matches")) {
        throw new Error(`Backend endpoint not found (404). The endpoint /tasks/changeStatus/ or /tasks/{id}/changeStatus/ may not be configured on the backend. Task ID used: ${taskId}. Please check your backend routes and ensure the changeStatus endpoint exists.`);
      }
      throw new Error(`Task not found (404). Task ID: ${taskId}. Error: ${errorDetail || 'Endpoint not found. Please verify the backend has the changeStatus endpoint configured.'}`);
    }

    // Handle 500 Server Error
    if (error.response?.status === 500) {
      const errorData = error.response?.data;
      let errorMessage = "Server error (500): The backend encountered an error while processing your request.";
      
      if (errorData?.message || errorData?.detail) {
        errorMessage = `Server Error (500): ${errorData.message || errorData.detail}`;
      }
      
      throw new Error(errorMessage);
    }

    // Re-throw if it's already a formatted error
    if (error.message && (error.message.includes('Invalid task ID format') || error.message.includes('Invalid status'))) {
      throw error;
    }

    throw error;
  }
};

// ==================== ROLES, DESIGNATIONS, BRANCHES API ====================

/**
 * Get available roles
 */
export const getRoles = async (): Promise<string[]> => {
  try {
    const response = await api.get("/accounts/getRoles/");
    const data = response.data;

    // Handle different response formats
    let resultArray: any[] = [];

    if (Array.isArray(data)) {
      resultArray = data;
    } else if (data.roles && Array.isArray(data.roles)) {
      resultArray = data.roles;
    } else if (data.role && Array.isArray(data.role)) {
      resultArray = data.role;
    } else if (data.data && Array.isArray(data.data)) {
      resultArray = data.data;
    } else {
      return [];
    }

    // Extract role values from objects if needed
    const extractedRoles = resultArray
      .map((item) => {
        if (typeof item === "string") {
          return item;
        } else if (item && typeof item === "object" && item.role_name) {
          return item.role_name;
        } else if (item && typeof item === "object" && item.role) {
          return item.role;
        } else if (item && typeof item === "object" && item.name) {
          return item.name;
        } else {
          return String(item);
        }
      })
      .filter((r) => r != null && r !== "");

    return extractedRoles;
  } catch (error: any) {
    if (
      error.name === "TypeError" &&
      (error.message.includes("fetch") ||
        error.message.includes("Failed to fetch"))
    ) {
      throw new Error(
        "Network error: Unable to fetch roles. Please check server connection."
      );
    }
    throw error;
  }
};

/**
 * Get designations (optionally filtered by role)
 */
export const getDesignations = async (role?: string): Promise<string[]> => {
  let endpoint = "/accounts/getDesignations/";
  // If role is provided, add it as query parameter
  if (role && role.trim() !== "") {
    endpoint = `/accounts/getDesignations/?Role=${encodeURIComponent(role)}`;
  }

  try {
    const response = await api.get(endpoint);
    const data = response.data;

    // Handle different response formats
    let resultArray: any[] = [];

    if (Array.isArray(data)) {
      resultArray = data;
    } else if (data.designations && Array.isArray(data.designations)) {
      resultArray = data.designations;
    } else if (data.data && Array.isArray(data.data)) {
      resultArray = data.data;
    } else {
      return [];
    }

    // Extract designation values from objects if needed
    const extractedDesignations = resultArray
      .map((item) => {
        if (typeof item === "string") {
          return item;
        } else if (item && typeof item === "object" && item.designation) {
          return item.designation;
        } else if (item && typeof item === "object" && item.name) {
          return item.name;
        } else {
          return String(item);
        }
      })
      .filter((d) => d != null && d !== "");

    return extractedDesignations;
  } catch (error: any) {
    if (
      error.name === "TypeError" &&
      (error.message.includes("fetch") ||
        error.message.includes("Failed to fetch"))
    ) {
      throw new Error(
        "Network error: Unable to fetch designations. Please check server connection."
      );
    }
    throw error;
  }
};

/**
 * Get branches
 */
export const getBranch = async (): Promise<string[]> => {
  try {
    const response = await api.get("/accounts/getBranch/");
    const data = response.data;

    // Handle different response formats
    let resultArray: any[] = [];

    if (Array.isArray(data)) {
      resultArray = data;
    } else if (data.branches && Array.isArray(data.branches)) {
      resultArray = data.branches;
    } else if (data.branch && Array.isArray(data.branch)) {
      resultArray = data.branch;
    } else if (data.data && Array.isArray(data.data)) {
      resultArray = data.data;
    } else {
      return [];
    }

    // Extract branch values from objects if needed
    const extractedBranches = resultArray
      .map((item) => {
        if (typeof item === "string") {
          return item;
        } else if (item && typeof item === "object" && item.branch_name) {
          return item.branch_name;
        } else if (item && typeof item === "object" && item.name) {
          return item.name;
        } else if (item && typeof item === "object" && item.branch) {
          return item.branch;
        } else {
          return String(item);
        }
      })
      .filter((b) => b != null && b !== "");

    return extractedBranches;
  } catch (error: any) {
    if (
      error.name === "TypeError" &&
      (error.message.includes("fetch") ||
        error.message.includes("Failed to fetch"))
    ) {
      throw new Error(
        "Network error: Unable to fetch branches. Please check server connection."
      );
    }
    throw error;
  }
};

/**
 * Get departments (optionally filtered by role)
 * @endpoint GET /accounts/getDepartments/?Role=
 * Returns empty array for Admin/MD roles, departments list for Employee/Intern/TeamLead
 */
export const getDepartments = async (role?: string): Promise<string[]> => {
  let endpoint = "/accounts/getDepartments/";
  // If role is provided, add it as query parameter
  if (role && role.trim() !== "") {
    endpoint = `/accounts/getDepartments/?Role=${encodeURIComponent(role)}`;
  }

  try {const response = await api.get(endpoint);
    const data = response.data;// Handle different response formats
    let resultArray: any[] = [];

    if (Array.isArray(data)) {
      resultArray = data;
    } else if (data.departments && Array.isArray(data.departments)) {
      resultArray = data.departments;
    } else if (data.data && Array.isArray(data.data)) {
      resultArray = data.data;
    } else {
      return [];
    }

    // Extract department values from objects if needed
    // API returns: [{"dept_name": "Accounts&Finance"}, ...]
    const extractedDepartments = resultArray
      .map((item) => {
        if (typeof item === "string") {
          return item;
        } else if (item && typeof item === "object" && item.dept_name) {
          return item.dept_name;
        } else if (item && typeof item === "object" && item.department) {
          return item.department;
        } else if (item && typeof item === "object" && item.name) {
          return item.name;
        } else {
          return String(item);
        }
      })
      .filter((d) => d != null && d !== "" && d !== "[object Object]");

    return extractedDepartments;
  } catch (error: any) {
    if (
      error.name === "TypeError" &&
      (error.message.includes("fetch") ||
        error.message.includes("Failed to fetch"))
    ) {
      throw new Error(
        "Network error: Unable to fetch departments. Please check server connection."
      );
    }
    throw error;
  }
};

/**
 * Get team leads for a specific role
 * @endpoint GET /accounts/getTeamleads/?Role= or GET /accounts/getTeamleads/ (no param)
 * @param role - Role context (Employee/Intern when fetching TLs for assignment). API may expect "TeamLead" or no param.
 * @returns Array of team lead objects with Name and Employee_id
 */
export const getTeamleads = async (role: string): Promise<Array<{ Name: string; Employee_id: string }>> => {
  const tryEndpoints = [
    `/accounts/getTeamleads/`,  // No Role param - backend may return all team leads
    `/accounts/getTeamleads/?Role=${encodeURIComponent('TeamLead')}`,
    `/accounts/getTeamleads/?Role=${encodeURIComponent(role)}`,
  ];

  for (const endpoint of tryEndpoints) {
    try {
      const response = await api.get(endpoint);
      const data = response.data;
      // Handle different response formats
      if (Array.isArray(data)) {
        const validTeamLeads = data.filter((tl: any) => tl && tl.Name && tl.Employee_id);
        return validTeamLeads;
      }
      if (data?.teamLeads && Array.isArray(data.teamLeads)) {
        return data.teamLeads.filter((tl: any) => tl && tl.Name && tl.Employee_id);
      }
      if (data?.data && Array.isArray(data.data)) {
        return data.data.filter((tl: any) => tl && tl.Name && tl.Employee_id);
      }
      return [];
    } catch (error: any) {
      const status = error.response?.status;
      const msg = error.response?.data?.message || error.response?.data?.detail || error.message;
      console.warn(`[GET TEAM LEADS] ${endpoint} failed (${status}):`, msg);
      // Continue to next endpoint
    }
  }
  console.error("❌ [GET TEAM LEADS] All endpoints failed");
  return [];
};

/**
 * Get departments and functions (optionally filtered by role)
 * @endpoint GET /accounts/getDepartmentsandFunctions/?Role=
 * @param role - Role filter (optional)
 * @returns Object with departments and functions arrays
 */
export const getDepartmentsandFunctions = async (role?: string): Promise<{ departments: string[]; functions: string[] }> => {
  let endpoint = "/accounts/getDepartmentsandFunctions/";
  // If role is provided, add it as query parameter
  if (role && role.trim() !== "") {
    endpoint = `/accounts/getDepartmentsandFunctions/?Role=${encodeURIComponent(role)}`;
  }

  try {const response = await api.get(endpoint);
    const data = response.data;// Handle different response formats
    let departmentsArray: any[] = [];
    let functionsArray: any[] = [];

    // If response is an object with departments and functions
    if (data && typeof data === 'object') {
      // Extract departments - check for both "Departments" (capital D) and "departments" (lowercase)
      if (data.Departments && Array.isArray(data.Departments)) {
        departmentsArray = data.Departments;
      } else if (data.departments && Array.isArray(data.departments)) {
        departmentsArray = data.departments;
      } else if (data.department && Array.isArray(data.department)) {
        departmentsArray = data.department;
      } else if (data.dept && Array.isArray(data.dept)) {
        departmentsArray = data.dept;
      }

      // Extract functions - check for both "functions" (lowercase) and "Functions" (capital F)
      if (data.functions && Array.isArray(data.functions)) {
        functionsArray = data.functions;
      } else if (data.Functions && Array.isArray(data.Functions)) {
        functionsArray = data.Functions;
      } else if (data.function && Array.isArray(data.function)) {
        functionsArray = data.function;
      } else if (data.func && Array.isArray(data.func)) {
        functionsArray = data.func;
      }
    } else if (Array.isArray(data)) {
      // If response is an array, try to extract from objects
      data.forEach((item: any) => {
        if (item && typeof item === 'object') {
          if (item.department || item.dept_name || item.dept) {
            departmentsArray.push(item.department || item.dept_name || item.dept);
          }
          if (item.function || item.func_name || item.func) {
            functionsArray.push(item.function || item.func_name || item.func);
          }
        }
      });
    }

    // Extract and clean department values
    const extractedDepartments = departmentsArray
      .map((item) => {
        if (typeof item === "string") {
          return item;
        } else if (item && typeof item === "object" && item.dept_name) {
          return item.dept_name;
        } else if (item && typeof item === "object" && item.department) {
          return item.department;
        } else if (item && typeof item === "object" && item.name) {
          return item.name;
        } else {
          return String(item);
        }
      })
      .filter((d) => d != null && d !== "" && d !== "[object Object]");

    // Extract and clean function values
    const extractedFunctions = functionsArray
      .map((item) => {
        if (typeof item === "string") {
          return item;
        } else if (item && typeof item === "object" && item.func_name) {
          return item.func_name;
        } else if (item && typeof item === "object" && item.function) {
          return item.function;
        } else if (item && typeof item === "object" && item.name) {
          return item.name;
        } else {
          return String(item);
        }
      })
      .filter((f) => f != null && f !== "" && f !== "[object Object]");return {
      departments: extractedDepartments,
      functions: extractedFunctions
    };
  } catch (error: any) {
    if (
      error.name === "TypeError" &&
      (error.message.includes("fetch") ||
        error.message.includes("Failed to fetch"))
    ) {
      throw new Error(
        "Network error: Unable to fetch departments and functions. Please check server connection."
      );
    }
    throw error;
  }
};

/**
 * Get monthly schedule for a user
 * @endpoint GET /getMonthlySchedule/{user_id}/
 * @param userId - User ID (Employee_id)
 * @returns Array of monthly schedule objects
 */
export const getMonthlySchedule = async (userId: string): Promise<Array<{
  quater: string;
  financial_year: string;
  month: number;
  actual_month: string;
  "Meeting-head": string;
  "Sub-Meeting-head": string;
  "sub-head-D1": string;
  "sub-head-D2": string;
  "sub-head-D3": string;

  month_quater_id?: number;
  id?: number;
}>> => {
  try {const endpoint = `/getMonthlySchedule/${encodeURIComponent(userId)}/`;const response = await api.get(endpoint);
    const data = response.data;// Handle different response formats
    let scheduleArray: any[] = [];

    if (Array.isArray(data)) {
      scheduleArray = data;
    } else if (data.schedule && Array.isArray(data.schedule)) {
      scheduleArray = data.schedule;
    } else if (data.data && Array.isArray(data.data)) {
      scheduleArray = data.data;
    } else if (data.monthly_schedule && Array.isArray(data.monthly_schedule)) {
      scheduleArray = data.monthly_schedule;
    } else {return [];
    }return scheduleArray;
  } catch (error: any) {
    if (
      error.name === "TypeError" &&
      (error.message.includes("fetch") ||
        error.message.includes("Failed to fetch"))
    ) {
      throw new Error(
        "Network error: Unable to fetch monthly schedule. Please check server connection."
      );
    }
    throw error;
  }
};

/**
 * Add day entries
 * @endpoint POST /addDayEntries/
 * @param entries - Array of entry objects with note and status
 * @param date - Date in format "YYYY-M-D"
 * @param month_quater_id - Month quarter ID
 * @returns Response with message and created_entry_ids
 */
export const addDayEntries = async (data: {
  entries: Array<{ note: string; status: 'PENDING' | 'INPROCESS' | 'COMPLETED' }>;
  date: string;
  month_quater_id: number;
}): Promise<{ message: string; created_entry_ids: number[] }> => {
  try {
    const response = await api.post("/addDayEntries/", data);
    return response.data;
  } catch (error: any) {
    console.error("❌ [ADD DAY ENTRIES] Error:", error);
    throw error;
  }
};

/**
 * Change entry status
 * @endpoint PATCH /changeStatus/{id}/
 * @param entryId - Entry ID
 * @param status - New status: "Completed", "PENDING", or "INPROCESS"
 * @returns Response with message
 */
export const changeEntryStatus = async (
  entryId: number,
  status: 'Completed' | 'PENDING' | 'INPROCESS'
): Promise<{ message: string }> => {
  try {const response = await api.patch(`/changeStatus/${entryId}/`, {
      change_Status_to: status
    });return response.data;
  } catch (error: any) {
    console.error("❌ [CHANGE ENTRY STATUS] Error:", error);
    throw error;
  }
};

/**
 * Get user entries
 * @endpoint GET /getUserEntries/?Date={}&username={}
 * @param date - Date filter (format: "YYYY-MM-DD" or "YYYY-M-D")
 * @param username - Username (Employee_id)
 * @returns Array of entry objects
 */
export const getUserEntries = async (
  date: string,
  username: string
): Promise<Array<{
  id?: number;
  Id?: number;
  entry_id?: number;
  pk?: number;
  note: string;
  meeting_head: string;
  meeting_sub_head: string;
  username: string;
  date: string;
  status: 'PENDING' | 'INPROCESS' | 'Completed';
  month_quater_id: string;
}>> => {
  try {
    const params: any = { Date: date, username: username };
    
    // Build query string
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/getUserEntries/?${queryString}`;const response = await api.get(endpoint);
    const data = response.data;// Handle different response formats
    let entriesArray: any[] = [];

    if (Array.isArray(data)) {
      entriesArray = data;
    } else if (data.entries && Array.isArray(data.entries)) {
      entriesArray = data.entries;
    } else if (data.data && Array.isArray(data.data)) {
      entriesArray = data.data;
    } else if (data.results && Array.isArray(data.results)) {
      entriesArray = data.results; // Handle paginated responses
    } else {return [];
    }return entriesArray;
  } catch (error: any) {
    if (error.response?.status === 404) {
      // No entries found - return empty arrayreturn [];
    }
    console.error("❌ [GET USER ENTRIES] Error:", error);
    throw error;
  }
};

/**
 * Get user entries by filters (for Report Review – display stored entries; note field shown in table).
 * @endpoint GET /getUserEntries/?quater=Q1&month=April&department=Sales&username=3001&date=2026-01-21&month_quater_id=...
 * @param params - Required: quater, month, department, username. Optional: date, month_quater_id (use for correct month id when backend supports it)
 * @returns Array of entries with id, note, meeting_head, meeting_sub_head, username, date, status, month_quater_id
 */
export const getUserEntriesByFilters = async (params: {
  quater: string;
  month: string;
  department: string;
  username: string;
  date?: string;
  month_quater_id?: string | number;
}): Promise<Array<{
  id: number;
  note: string;
  meeting_head: string;
  meeting_sub_head: string;
  username: string;
  date: string;
  status: string;
  month_quater_id: string;
}>> => {
  try {
    const qs = new URLSearchParams();
    qs.set("quater", params.quater);
    qs.set("month", params.month);
    qs.set("department", params.department);
    qs.set("username", params.username);
    if (params.date) qs.set("date", params.date);
    if (params.month_quater_id != null && params.month_quater_id !== '') qs.set("month_quater_id", String(params.month_quater_id));
    const endpoint = `/getUserEntries/?${qs.toString()}`;const response = await api.get(endpoint);
    const data = response.data;
    let entriesArray: any[] = [];
    if (data == null) {
      return [];
    }
    if (Array.isArray(data)) {
      entriesArray = data;
    } else if (typeof data === 'object') {
      if (Array.isArray(data.entries)) entriesArray = data.entries;
      else if (Array.isArray(data.data)) entriesArray = data.data;
      else if (Array.isArray(data.results)) entriesArray = data.results;
      else {
        const key = Object.keys(data).find(k => Array.isArray((data as any)[k]));
        if (key) entriesArray = (data as any)[key];
      }
    }
    return Array.isArray(entriesArray) ? entriesArray : [];
  } catch (error: any) {
    if (error?.response?.status === 404) {return [];
    }
    console.error("❌ [GET USER ENTRIES BY FILTERS] Error:", error);
    throw error;
  }
};

/**
 * Get names filtered by role and designation
 * @endpoint GET /tasks/getNamesfromRoleandDesignation/?role=&designation=
 * @param role - Role filter (optional, use empty string or "all" for all roles)
 * @param designation - Designation filter (optional, use empty string or "all" for all designations)
 * @returns Array of user names/objects
 */
export const getNamesFromRoleAndDesignation = async (
  role: string = "",
  designation: string = ""
): Promise<any[]> => {
  try {
    // Build query parameters
    const roleParam = role && role.trim() !== "" && role.toLowerCase() !== "all" ? role.trim() : "";
    const designationParam = designation && designation.trim() !== "" && designation.toLowerCase() !== "all" ? designation.trim() : "";
    
    const endpoint = `/tasks/getNamesfromRoleandDesignation/?role=${encodeURIComponent(roleParam)}&designation=${encodeURIComponent(designationParam)}`;const response = await api.get(endpoint);
    const data = response.data;

    // Handle different response formats
    let resultArray: any[] = [];

    if (Array.isArray(data)) {
      resultArray = data;
    } else if (data.names && Array.isArray(data.names)) {
      resultArray = data.names;
    } else if (data.users && Array.isArray(data.users)) {
      resultArray = data.users;
    } else if (data.data && Array.isArray(data.data)) {
      resultArray = data.data;
    } else if (data.employees && Array.isArray(data.employees)) {
      resultArray = data.employees;
    } else {return [];
    }return resultArray;
  } catch (error: any) {
    console.error("❌ [GET NAMES API] Exception caught:", error);
    console.error("❌ [GET NAMES API] Error Response:", error.response?.data);
    throw error;
  }
};

/**
 * Get asset types for Admin Ops Asset Manager (e.g. Hardware, Software).
 * @endpoint GET /assets/types/ (fallback to default list if not implemented)
 * @returns Array of { id, name } for dropdown
 */
export const getAssetTypes = async (): Promise<Array<{ id: string; name: string }>> => {
  const defaultTypes: Array<{ id: string; name: string }> = [
    { id: '1', name: 'Hardware' },
    { id: '2', name: 'Software' },
  ];
  try {
    const response = await api.get("/assets/types/");
    const data = response.data;
    if (Array.isArray(data)) {
      return data.map((item: any) =>
        typeof item === 'string'
          ? { id: String(item).toLowerCase().replace(/\s+/g, '_'), name: item }
          : { id: String(item?.id ?? item?.value ?? item?.name ?? ''), name: String(item?.name ?? item?.label ?? item ?? '') }
      ).filter((t: { id: string; name: string }) => t.name);
    }
    if (data?.types && Array.isArray(data.types)) {
      return data.types.map((item: any) =>
        typeof item === 'string'
          ? { id: String(item).toLowerCase().replace(/\s+/g, '_'), name: item }
          : { id: String(item?.id ?? item?.value ?? item?.name ?? ''), name: String(item?.name ?? item?.label ?? item ?? '') }
      ).filter((t: { id: string; name: string }) => t.name);
    }
    return defaultTypes;
  } catch (error: any) {
    if (error?.response?.status === 404 || error?.code === 'ERR_NETWORK') return defaultTypes;return defaultTypes;
  }
};

/** Room from events API (for calendar halls dropdown) */
export interface Room {
  id: number;
  name: string;
}

/**
 * Get rooms for calendar "Select Hall" dropdown.
 * @endpoint GET /eventsapi/rooms/
 * @returns Array of { id, name } e.g. Gateway, Horizon, Conference
 */
export const getRooms = async (): Promise<Room[]> => {
  try {
    const response = await api.get<Room[]>("/eventsapi/rooms/");
    const data = response.data;
    const list = Array.isArray(data) ? data : data ? [data] : [];
    return list.map((item: any) => ({
      id: Number(item.id),
      name: String(item.name ?? ""),
    }));
  } catch (error: any) {
    console.error("❌ [GET ROOMS] Error:", error);
    return [];
  }
};

/**
 * Create a holiday. POST /eventsapi/holidays/
 */
export const createHoliday = async (payload: {
  date: string;
  name: string;
  holiday_type?: 'fixed' | 'unfixed';
}): Promise<{ id: number; date: string; name: string; holiday_type?: string }> => {
  const body = { ...payload, holiday_type: payload.holiday_type ?? 'unfixed' };
  const response = await api.post("/eventsapi/holidays/", body);
  return response.data;
};

/**
 * Get holidays for calendar grid (all users).
 * @endpoint GET /eventsapi/holidays/
 * @returns Array of { id, date, name, type } e.g. Republic Day, Independence Day
 */
export const getHolidays = async (): Promise<Array<{ id: string; name: string; date: string; type: 'holiday' | 'event' }>> => {
  try {
    const response = await api.get("/eventsapi/holidays/", { timeout: 60000 });
    const data = response.data;
    const list = Array.isArray(data) ? data : data ? [data] : [];
    return list.map((item: any) => ({
      id: String(item.id),
      name: String(item.name ?? ""),
      date: String(item.date ?? ""),
      type: (item.holiday_type === "fixed" ? "holiday" : "event") as "holiday" | "event",
    }));
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 403 || status === 401) return [];
    console.error("❌ [GET HOLIDAYS] Error:", error);
    return [];
  }
};

/**
 * Update a holiday. PUT/PATCH /eventsapi/holidays/{id}/
 */
export const updateHoliday = async (
  id: string | number,
  payload: { date?: string; name?: string; holiday_type?: 'fixed' | 'unfixed' }
): Promise<{ id: number; date: string; name: string; holiday_type: string }> => {
  const response = await api.patch(`/eventsapi/holidays/${id}/`, payload);
  return response.data;
};

/**
 * Delete a holiday. DELETE /eventsapi/holidays/{id}/
 */
export const deleteHoliday = async (id: string | number): Promise<void> => {
  await api.delete(`/eventsapi/holidays/${id}/`);
};

/**
 * Get all events. GET /eventsapi/events/
 */
export const getEvents = async (): Promise<Array<{ id: number; title: string; motive: string; date: string; time: string }>> => {
  try {
    const response = await api.get("/eventsapi/events/", { timeout: 60000 });
    const data = response.data;
    const list = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
    return list;
  } catch (error: any) {
    if (error?.response?.status === 403 || error?.response?.status === 401) return [];
    console.error("❌ [GET EVENTS] Error:", error);
    return [];
  }
};

/**
 * Create an event. POST /eventsapi/events/
 */
export const createEvent = async (payload: {
  title: string;
  motive: string;
  date: string;
  time: string;
}): Promise<{ id: number; title: string; motive: string; date: string; time: string }> => {
  const response = await api.post("/eventsapi/events/", payload);
  return response.data;
};

/**
 * Update an event. PATCH /eventsapi/events/{id}/
 */
export const updateEvent = async (
  id: string | number,
  payload: Partial<{ title: string; motive: string; date: string; time: string }>
): Promise<{ id: number; title: string; motive: string; date: string; time: string }> => {
  const response = await api.patch(`/eventsapi/events/${id}/`, payload);
  return response.data;
};

/**
 * Delete an event. DELETE /eventsapi/events/{id}/
 */
export const deleteEvent = async (id: string | number): Promise<void> => {
  await api.delete(`/eventsapi/events/${id}/`);
};

/**
 * Create a tour. POST /eventsapi/tours/
 * Required: tour_name, location, starting_date, members
 */
export const createTour = async (payload: {
  tour_name: string;
  starting_date: string | null;
  location: string;
  duration_days: number;
  description?: string | null;
  members: string[];
}): Promise<any> => {
  const response = await api.post("/eventsapi/tours/", payload);
  return response.data;
};

/**
 * Update a tour. PATCH /eventsapi/tours/{id}/
 */
export const updateTour = async (
  id: string | number,
  payload: Partial<{
    tour_name: string;
    starting_date: string | null;
    location: string;
    duration_days: number;
    description: string | null;
    members: string[];
  }>
): Promise<any> => {
  const response = await api.patch(`/eventsapi/tours/${id}/`, payload);
  return response.data;
};

/**
 * Delete a tour. DELETE /eventsapi/tours/{id}/
 */
export const deleteTour = async (id: string | number): Promise<void> => {
  await api.delete(`/eventsapi/tours/${id}/`);
};

/**
 * Get all tours. GET /eventsapi/tours/
 */
export const getTours = async (): Promise<any[]> => {
  try {
    const response = await api.get("/eventsapi/tours/", { timeout: 60000 });
    const data = response.data;
    return Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
  } catch (error: any) {
    if (error?.response?.status === 403 || error?.response?.status === 401) return [];
    console.error("❌ [GET TOURS] Error:", error);
    return [];
  }
};

/**
 * Get book slots. GET /eventsapi/bookslots/
 * Optional month (1-12) and year filter for calendar month-based loading.
 * Optional signal for request cancellation (e.g. when switching months quickly).
 */
export const getBookSlots = async (month?: number, year?: number, signal?: AbortSignal): Promise<any[]> => {
  try {
    const params: Record<string, number> = {};
    if (month != null && month >= 1 && month <= 12) params.month = month;
    if (year != null) params.year = year;
    const config: { params?: Record<string, number>; timeout: number; signal?: AbortSignal } = { timeout: 60000 };
    if (Object.keys(params).length) config.params = params;
    if (signal) config.signal = signal;
    const response = await api.get("/eventsapi/bookslots/", config);
    const data = response.data;
    const list = Array.isArray(data) ? data : data?.data ?? data?.results ?? data?.slots ?? (data ? [data] : []);
    return Array.isArray(list) ? list : [];
  } catch (error: any) {
    const status = error?.response?.status;
    console.error("❌ [GET BOOK SLOTS] Error:", error);
    // Rethrow so caller can preserve existing data instead of clearing
    throw error;
  }
};

/**
 * Get meeting push list. GET /eventsapi/meetingpush/
 */
export const getMeetingPush = async (): Promise<any[]> => {
  const response = await api.get("/eventsapi/meetingpush/");
  const data = response.data;
  const list = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
  return Array.isArray(list) ? list : [];
};

/**
 * Create a meeting via meeting push. POST /eventsapi/meetingpush/
 * Body: { users, meeting_type, time (minutes), meeting_room }
 */
export const meetingPush = async (payload: {
  users: string[];
  meeting_type: 'individual' | 'group';
  time: number;
  meeting_room: string;
}): Promise<any> => {
  const response = await api.post("/eventsapi/meetingpush/", payload);
  return response.data;
};

/**
 * Create a book slot. POST /eventsapi/bookslots/
 * Required: meeting_title, date, room, status, members
 */
export const createBookSlot = async (payload: {
  meeting_title: string;
  date: string;
  start_time?: string;
  end_time?: string;
  room: string;
  description?: string | null;
  meeting_type: 'individual' | 'group';
  status: string;
  members: string[];
}): Promise<any> => {
  const response = await api.post("/eventsapi/bookslots/", payload);
  return response.data;
};

/**
 * Update a book slot. PATCH /eventsapi/bookslots/{id}/
 */
export const updateBookSlot = async (
  id: string | number,
  payload: Partial<{
    meeting_title: string;
    date: string;
    start_time: string;
    end_time: string;
    room: string;
    description: string | null;
    meeting_type: string;
    status: string;
    members: string[];
  }>
): Promise<any> => {
  const response = await api.patch(`/eventsapi/bookslots/${id}/`, payload);
  return response.data;
};

/**
 * Delete a book slot. DELETE /eventsapi/bookslots/{id}/
 */
export const deleteBookSlot = async (id: string | number): Promise<void> => {
  await api.delete(`/eventsapi/bookslots/${id}/`);
};

/**
 * Get available task types
 * @endpoint GET /tasks/getTaskTypes/
 * @returns Array of task type strings
 */
export const getTaskTypes = async (): Promise<string[]> => {
  try {const response = await api.get("/tasks/getTaskTypes/");const data = response.data;// Handle different response formats
    let resultArray: any[] = [];

    if (Array.isArray(data)) {
      resultArray = data;} else if (data && typeof data === 'object') {
      // Try common nested array formats
      if (data.task_types && Array.isArray(data.task_types)) {
        resultArray = data.task_types;} else if (data.types && Array.isArray(data.types)) {
        resultArray = data.types;} else if (data.data && Array.isArray(data.data)) {
        resultArray = data.data;} else if (data.results && Array.isArray(data.results)) {
        resultArray = data.results;} else {
        // Try to extract all string values from object
        const allValues = Object.values(data);
        const stringValues = allValues.filter(v => typeof v === 'string');
        if (stringValues.length > 0) {
          resultArray = stringValues;} else {return [];
        }
      }
    } else {return [];
    }

    // Extract type values from objects if needed
    const extractedTypes = resultArray
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          if (item.type_name) return item.type_name;
          if (item.type) return item.type;
          if (item.name) return item.name;
          return String(item);
        }
        return String(item);
      })
      .filter((t) => t != null && t !== "");
    return extractedTypes;
  } catch (error: any) {
    console.error("❌ [GET TASK TYPES API] Exception caught:", error);
    console.error("❌ [GET TASK TYPES API] Error Response:", error.response?.data);
    
    // Return empty array on error, fallback to default types
    return [];
  }
};

/**
 * Get available roles for task assignment
 */
export const getAvailableRoles = async (): Promise<string[]> => {
  try {
    const response = await api.get("/tasks/getAvailableRoles/");
    const data = response.data;

    // Handle different response formats
    let resultArray: any[] = [];

    if (Array.isArray(data)) {
      resultArray = data;
    } else if (data.roles && Array.isArray(data.roles)) {
      resultArray = data.roles;
    } else if (data.data && Array.isArray(data.data)) {
      resultArray = data.data;
    } else {
      return [];
    }

    // Extract role values from objects if needed
    const extractedRoles = resultArray
      .map((item) => {
        if (typeof item === "string") {
          return item;
        } else if (item && typeof item === "object" && item.role_name) {
          return item.role_name;
        } else if (item && typeof item === "object" && item.role) {
          return item.role;
        } else if (item && typeof item === "object" && item.name) {
          return item.name;
        } else {
          return String(item);
        }
      })
      .filter((r) => r != null && r !== "");

    return extractedRoles;
  } catch (error: any) {
    if (
      error.name === "TypeError" &&
      (error.message.includes("fetch") ||
        error.message.includes("Failed to fetch"))
    ) {
      throw new Error(
        "Network error: Unable to fetch available roles. Please check server connection."
      );
    }
    throw error;
  }
};

/**
 * Send a message to a task
 * @endpoint POST /tasks/sendMessage/
 * @param taskId Task ID
 * @param message Message text
 * @returns { status: "Message sent" }
 */
export const sendTaskMessage = async (
  taskId: string | number,
  message: string
): Promise<{ status: string }> => {
  try {
    // Extract numeric ID from task ID string (e.g., "t1767789989844-0.11216026287831349" -> extract number)
    let numericTaskId: number;
    if (typeof taskId === 'number') {
      numericTaskId = taskId;
    } else {
      // Try to extract number from string (look for first sequence of digits)
      const match = String(taskId).match(/\d+/);
      if (match) {
        numericTaskId = parseInt(match[0], 10);
      } else {
        // If no number found, try to parse the whole string
        numericTaskId = parseInt(String(taskId), 10);
        if (isNaN(numericTaskId)) {
          throw new Error(`Invalid task ID format: ${taskId}. Backend expects an integer task_id.`);
        }
      }
    }const response = await api.post("/tasks/sendMessage/", {
      task_id: numericTaskId,
      message: message,
    });return response.data;
  } catch (error: any) {
    console.error("❌ [SEND TASK MESSAGE API] Exception:", error);
    console.error("❌ [SEND TASK MESSAGE API] Error Response:", error.response?.data);
    console.error("❌ [SEND TASK MESSAGE API] Error Message:", error.message);
    console.error("❌ [SEND TASK MESSAGE API] Status Code:", error.response?.status);
    console.error("❌ [SEND TASK MESSAGE API] Full Error:", error);

    // Handle 500 Server Error
    if (error.response?.status === 500) {
      const errorData = error.response?.data;
      let errorMessage = "Server error (500): The backend encountered an error while processing your request.";
      
      // Try to extract error message from HTML response
      if (typeof errorData === 'string' && errorData.includes('<!DOCTYPE')) {
        errorMessage += "\n\nThe backend returned an HTML error page, which usually means:\n";
        errorMessage += "1. The endpoint /tasks/sendMessage/ might not exist\n";
        errorMessage += "2. There's a server-side error in the backend\n";
        errorMessage += "3. The task_id format might be incorrect\n\n";
        errorMessage += "Please check:\n";
        errorMessage += "- Backend endpoint is implemented and accessible\n";
        errorMessage += "- Task ID is a valid integer\n";
        errorMessage += "- Backend server logs for detailed error information";
      } else if (errorData?.message || errorData?.detail) {
        errorMessage = `Server Error (500): ${errorData.message || errorData.detail}`;
      }
      
      throw new Error(errorMessage);
    }

    if (error.response?.status === 400) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Invalid request. Please check task_id and message.";
      throw new Error(`Bad Request (400): ${errorMsg}`);
    }

    if (error.response?.status === 404) {
      throw new Error("Task not found. Please check the task ID.");
    }

    // Re-throw if it's already a formatted error
    if (error.message && error.message.includes('Invalid task ID format')) {
      throw error;
    }

    throw error;
  }
};

/**
 * Get messages for a task
 * @endpoint GET /tasks/getMessage/{task_id}
 * @param taskId Task ID (integer)
 * @returns Array of message objects with sender, message, date, time
 */
export const getTaskMessages = async (
  taskId: string | number
): Promise<
  Array<{
    sender: string;
    message: string;
    date: string;
    time: string;
  }>
> => {
  try {
    // Extract numeric ID from task ID string
    let numericTaskId: number;
    if (typeof taskId === 'number') {
      numericTaskId = taskId;
    } else {
      // Try to extract number from string
      const match = String(taskId).match(/\d+/);
      if (match) {
        numericTaskId = parseInt(match[0], 10);
      } else {
        numericTaskId = parseInt(String(taskId), 10);
        if (isNaN(numericTaskId)) {return [];
        }
      }
    }const response = await api.get(`/tasks/getMessage/${numericTaskId}/`);
    const data = response.data;

    // Handle different response formats
    let messages: any[] = [];

    if (Array.isArray(data)) {
      messages = data;
    } else if (data.messages && Array.isArray(data.messages)) {
      messages = data.messages;
    } else if (data.data && Array.isArray(data.data)) {
      messages = data.data;
    } else {return [];
    }return messages;
  } catch (error: any) {
    console.error("❌ [GET TASK MESSAGES API] Exception:", error);
    console.error("❌ [GET TASK MESSAGES API] Error Response:", error.response?.data);

    if (error.response?.status === 404) {
      // Task not found or no messages - return empty arrayreturn [];
    }

    throw error;
  }
};

/**
 * Create a new group
 * @endpoint POST /messaging/createGroup/
 * @param groupData Object with group_name, description, and participants
 * @returns Created group data
 */
export const createGroup = async (groupData: {
  group_name: string;
  description: string;
  participants: Record<string, string>; // e.g., {"sni":"852","slay":"753"}
}): Promise<any> => {
  try {
    // Check if auth token exists
    const token = getAuthToken();const response = await api.post("/messaging/createGroup/", {
      group_name: groupData.group_name,
      description: groupData.description,
      participants: groupData.participants,
    });return response.data;
  } catch (error: any) {
    console.error("❌ [CREATE GROUP API] Exception:", error);
    console.error("❌ [CREATE GROUP API] Error Response:", error.response?.data);
    console.error("❌ [CREATE GROUP API] Error Message:", error.message);
    console.error("❌ [CREATE GROUP API] Status Code:", error.response?.status);

    if (error.response?.status === 400) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "Invalid request. Please check group_name, description, and participants.";
      throw new Error(`Bad Request (400): ${errorMsg}`);
    }

    if (error.response?.status === 403) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        "You don't have permission to create groups.";
      
      // Extract the actual error message from backend
      let backendMessage = errorMsg;
      if (error.response?.data?.message) {
        backendMessage = error.response.data.message;
      } else if (error.response?.data?.detail) {
        backendMessage = error.response.data.detail;
      }
      
      throw new Error(
        `Permission Denied (403): ${backendMessage}\n\n` +
        `Note: MD, Admin, and Team Leader roles should have permission to create groups.\n\n` +
        `If you are one of these roles and still see this error:\n` +
        `1. Your authentication token may have expired - try logging out and back in\n` +
        `2. The backend may not recognize your role correctly\n` +
        `3. Please contact your administrator to verify your role permissions\n\n` +
        `Your current role: Check browser console for role details.`
      );
    }

    if (error.response?.status === 401) {
      throw new Error(
        `Authentication Failed (401): Your session may have expired. Please log out and log back in.`
      );
    }

    throw error;
  }
};

/**
 * Get all created groups
 * @endpoint GET /messaging/showCreatedGroups/
 * @returns Array of group objects with group_id, name, description, created_at
 */
export const showCreatedGroups = async (): Promise<
  Array<{
    group_id: number;
    name: string;
    description: string;
    created_at: string;
  }>
> => {
  try {const response = await api.get("/messaging/showCreatedGroups/");
    const data = response.data;

    // Handle different response formats
    let groups: any[] = [];

    if (Array.isArray(data)) {
      groups = data;
    } else if (data.groups && Array.isArray(data.groups)) {
      groups = data.groups;
    } else if (data.data && Array.isArray(data.data)) {
      groups = data.data;
    } else {return [];
    }return groups;
  } catch (error: any) {
    console.error("❌ [SHOW CREATED GROUPS API] Exception:", error);
    console.error("❌ [SHOW CREATED GROUPS API] Error Response:", error.response?.data);

    if (error.response?.status === 404) {return [];
    }

    throw error;
  }
};

/**
 * Get group members for a specific group
 * @endpoint GET /messaging/showGroupMembers/{group_id}/
 * @param groupId Group ID (integer)
 * @returns Array of participant objects with participant_name field
 */
export const showGroupMembers = async (
  groupId: number
): Promise<Array<{ participant_name: string }>> => {
  try {
    const response = await api.get(`/messaging/showGroupMembers/${groupId}/`);
    const data = response.data;

    // Handle different response formats
    let members: any[] = [];

    if (Array.isArray(data)) {
      members = data;
    } else if (data.members && Array.isArray(data.members)) {
      members = data.members;
    } else if (data.participants && Array.isArray(data.participants)) {
      members = data.participants;
    } else if (data.data && Array.isArray(data.data)) {
      members = data.data;
    } else {
      return [];
    }

    return members;
  } catch (error: any) {
    // Only log if it's not a 404 (expected for empty groups)
    if (error.response?.status !== 404) {
      // Minimal error logging to avoid console spam
      if (error.response?.status === 500) {
        throw new Error("Server error: Unable to fetch group members. Please try again later.");
      }
    }

    if (error.response?.status === 404) {
      return [];
    }

    throw error;
  }
};

/**
 * Start a chat with a participant (direct message)
 * @endpoint POST /messaging/startChat/
 * @param employeeId Employee ID of the participant
 * @returns Response: [{}] if new chat created, or loads existing chats
 * 
 * This API works for ALL roles: MD, Admin, TeamLead, Employee, Intern
 * Request format: {"participant": "employeeId"} - Employee_id as string directly
 * Response 1: [{}] - New chat created successfully
 * Response 2: Existing chat data - Chat already exists, loads existing chats
 */
export const startChat = async (
  employeeId: string
): Promise<any> => {
  // Declare variables at function scope so they're accessible in catch block
  let cleanEmployeeId: string | undefined;
  let requestBody: any;
  
  try {
    // Validate employeeId
    if (!employeeId || employeeId.trim() === '') {
      throw new Error("Employee ID is required to start a chat.");
    }

    // Ensure employeeId is a clean string (no extra whitespace)
    // CRITICAL: Preserve leading zeros (e.g., "00011" should stay "00011")
    // DO NOT convert to number - keep as string
    cleanEmployeeId = String(employeeId).trim();
    
    // Verify we're preserving the format (especially leading zeros)// Format: {"participant": "employeeId"} - Backend expects Employee_id as string directly, not nested object
    // This format works for ALL roles: MD, Admin, TeamLead, Employee, Intern
    // The Employee_id is sent as a STRING to preserve leading zeros (e.g., "00011")
    requestBody = {
      participant: cleanEmployeeId  // String value directly, preserves "00011" format
    };// CRITICAL: Check if auth token exists before making request
    // Note: Backend might use session-based auth (cookies) instead of JWT tokens
    // If using cookies, withCredentials: true will send them automatically
    const authToken = getAuthToken();// Warn if no token, but don't block - backend might use session cookies
    if (!authToken) {}

    let response;
    try {
      response = await api.post("/messaging/startChat/", requestBody);
    } catch (firstError: any) {
      // If we get a 404 and we're using the proxy, try direct URL as fallback
      if (firstError.response?.status === 404 && API_BASE_URL === '/api') {const directApi = axios.create({
          baseURL: PRODUCTION_BACKEND_URL,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAuthToken() || ''}`
          },
          withCredentials: true,
          timeout: 30000,
        });
        
        try {
          response = await directApi.post("/messaging/startChat/", requestBody);} catch (directError: any) {
          // If direct URL also fails, throw the original error
          console.error("❌ [START CHAT API] Direct URL also failed:", directError);
          throw firstError;
        }
      } else {
        throw firstError;
      }
    }// Handle success cases:
    // Response 1: [{}] - New chat created successfully
    // Response 2: If chat already exists - loads existing chat data
    if (response.status === 200 || response.status === 201) {
      const responseData = response.data;
      
      // Check if response is [{}] (new chat created - Response 1)
      if (Array.isArray(responseData) && responseData.length === 1 && Object.keys(responseData[0]).length === 0) {return { success: true, isNewChat: true, data: responseData };
      }
      
      // Response 2: If chat already exists, backend loads existing chat
      // This could be an array with chat data, or an object with chat info
      if (Array.isArray(responseData) && responseData.length > 0 && Object.keys(responseData[0]).length > 0) {return { success: true, isNewChat: false, data: responseData };
      }
      
      // Response 2: Object format with existing chat data
      if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {return { success: true, isNewChat: false, data: responseData };
      }
      
      // Default: return response datareturn { success: true, isNewChat: false, data: responseData };
    }

    return response.data;
    } catch (error: any) {
      console.error("❌ [START CHAT API] ====== ERROR DETAILS ======");
      console.error("❌ [START CHAT API] Error:", error);
      console.error("❌ [START CHAT API] Error Message:", error.message);
      console.error("❌ [START CHAT API] Error Response Data:", error.response?.data);
      console.error("❌ [START CHAT API] Error Response Status:", error.response?.status);
      console.error("❌ [START CHAT API] Error Response Headers:", error.response?.headers);
      
      console.error("❌ [START CHAT API] Request that failed:", {
        url: `${API_BASE_URL}/messaging/startChat/`,
        method: 'POST',
        body: requestBody || 'requestBody not defined (error occurred before request body was created)',
        employeeIdSent: cleanEmployeeId || employeeId || 'unknown',
        employeeIdType: typeof (cleanEmployeeId || employeeId),
        employeeIdLength: (cleanEmployeeId || employeeId || '').length
      });
      console.error("❌ [START CHAT API] Full Error Object:", JSON.stringify(error.response?.data || error.message, null, 2));
      
      // If it's a 404 with "Invalid User", provide more context
      if (error.response?.status === 404) {
        const errorData = error.response?.data;
        const errorMessage = typeof errorData === 'string' ? errorData : (errorData?.message || errorData?.detail || JSON.stringify(errorData));
        
        if (errorMessage?.toLowerCase().includes('invalid user') || errorMessage?.toLowerCase().includes('invalid')) {
          const empIdForLog = cleanEmployeeId || employeeId || 'unknown';
          console.error("❌ [START CHAT API] Backend returned 'Invalid User' error.");
          console.error("❌ [START CHAT API] This could mean:");
          console.error("   1. Employee_id '" + empIdForLog + "' doesn't exist in the backend database");
          console.error("   2. Backend converted Employee_id to number (lost leading zeros) - check backend logs");
          console.error("   3. Backend has permission restrictions for non-MD roles");
          console.error("   4. Backend endpoint validation is rejecting the Employee_id format");
          console.error("❌ [START CHAT API] Verify in backend:");
          console.error("   - Check if Employee_id '" + empIdForLog + "' exists in database");
          console.error("   - Check if backend is converting string to number (should stay as string)");
          console.error("   - Check backend permissions for role:", "current user role needed here");
        }
      }

    // Handle specific error cases
    if (error.response?.status === 400) {
      const errorData = error.response?.data;
      let errorMsg = "Invalid participant. Please check the employee ID.";
      
      // Check for "Invalid User" or similar messages
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (errorData.detail) {
          errorMsg = errorData.detail;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        } else if (errorData.non_field_errors) {
          // Handle Django REST framework non-field errors
          errorMsg = Array.isArray(errorData.non_field_errors) 
            ? errorData.non_field_errors.join(', ')
            : String(errorData.non_field_errors);
        }
      }
      
      // If error message contains "Invalid User" or similar, provide more context
      if (errorMsg.toLowerCase().includes('invalid user') || 
          errorMsg.toLowerCase().includes('invalid participant')) {
        errorMsg = `Invalid User: The Employee ID "${employeeId}" is not valid or the user does not exist in the system.\n\n` +
          `Please check:\n` +
          `1. The Employee ID "${employeeId}" is correct\n` +
          `2. The user exists in the employee database\n` +
          `3. You have permission to start chats with this user\n` +
          `4. Try refreshing the user list and selecting the user again`;
      }
      
      throw new Error(errorMsg);
    }

    if (error.response?.status === 403) {
      const errorData = error.response?.data;
      let errorMsg = "Permission denied. You don't have permission to start a chat.";
      
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (errorData.detail) {
          errorMsg = errorData.detail;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        }
      }
      
      // Provide more helpful context for 403 errors
      const enhancedErrorMsg = `Permission Denied (403): ${errorMsg}\n\n` +
        `This could mean:\n` +
        `1. Your authentication token may have expired - try logging out and back in\n` +
        `2. You may not have permission to start chats with this user\n` +
        `3. The Employee ID "${employeeId}" may be restricted\n` +
        `4. Please contact your administrator if you believe this is an error`;
      
      throw new Error(enhancedErrorMsg);
    }

    if (error.response?.status === 404) {
      const errorData = error.response?.data;
      let errorMsg = `Endpoint not found (404). The messaging endpoint may not be available.`;
      
      // Check if error data contains "Invalid User" or similar - backend might return 404 with this message
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (errorData.detail) {
          errorMsg = errorData.detail;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        }
      }
      
      // Check if auth token was missing (this could cause 404 with "Invalid User")
      // Note: Backend might use session cookies, so missing token doesn't always mean auth issue
      const currentToken = getAuthToken();
      const isAuthIssue = !currentToken || !isValidToken(currentToken);
      
      // If the error message is "Invalid User" or similar, provide context
      // This can happen when backend returns 404 for permission/validation issues
      if (errorMsg.toLowerCase().includes('invalid user') || 
          errorMsg.toLowerCase().includes('invalid participant') ||
          errorMsg.toLowerCase().includes('not found')) {
        
        // Show auth error only if it's a 401 (unauthorized) - otherwise focus on the actual issue
        if (error.response?.status === 401) {
          errorMsg = `Authentication Error: Unable to start chat.\n\n` +
            `Your session may have expired or authentication failed.\n\n` +
            `✅ Solution:\n` +
            `1. Log out of the application\n` +
            `2. Log back in to refresh your session\n` +
            `3. Try starting the chat again`;
        } else {
          // For 404 with "Invalid User", the most likely cause is the Employee_id doesn't exist
          // Also mention session expiration as a possibility
          errorMsg = `Invalid User: Unable to start chat with Employee ID "${employeeId}".\n\n` +
            `The backend returned "Invalid User" error. This usually means:\n` +
            `1. The Employee ID "${employeeId}" doesn't exist in the backend database\n` +
            `2. Your session may have expired (try logging out and back in)\n` +
            `3. The Employee ID format is incorrect\n\n` +
            `✅ Please try:\n` +
            `1. Verify the Employee ID "${employeeId}" exists in the system\n` +
            `2. Log out and log back in to refresh your session\n` +
            `3. Check if you're using the correct Employee ID\n` +
            `4. Contact backend developer to verify Employee_id "${employeeId}" exists in database\n\n` +
            `Note: This API should work for all roles (MD, Admin, TeamLead, Employee, Intern).`;
        }
      }
      
      throw new Error(errorMsg);
    }

    if (error.response?.status === 500) {
      const errorMsg = error.response?.data?.detail || 
                      error.response?.data?.message || 
                      "Server error. Please try again later.";
      throw new Error(errorMsg);
    }

    // Handle network errors
    if (error.code === "ERR_NETWORK" || error.message?.includes("Network Error")) {
      throw new Error("Network error: Unable to connect to the server. Please check your connection.");
    }

    // Re-throw if it's already a formatted error
    if (error.message) {
      throw error;
    }

    throw new Error("Failed to start chat. Please try again.");
  }
};

/**
 * Get all groups and chats the current user is a member of
 * @endpoint GET /messaging/loadChats/
 * @returns Object with Group_info (groups) and chats_info (direct messages)
 */
export const loadChats = async (): Promise<{
  Group_info: Array<{
    group_id: string | number;
    group_name: string;
    description: string;
  }>;
  chats_info: Array<{
    chat_id: string;
    with: string;
  }>;
}> => {
  try {const response = await api.get("/messaging/loadChats/");
    const data = response.data;

    // Handle new response format with Group_info and chats_info
    let groups: any[] = [];
    let chats: any[] = [];

    if (data.Group_info && Array.isArray(data.Group_info)) {
      groups = data.Group_info;
    } else if (Array.isArray(data)) {
      // Fallback: if response is just an array, treat as groups
      groups = data;
    } else if (data.groups && Array.isArray(data.groups)) {
      groups = data.groups;
    }

    if (data.chats_info && Array.isArray(data.chats_info)) {
      chats = data.chats_info;
    }return {
      Group_info: groups,
      chats_info: chats
    };
  } catch (error: any) {
    const respData = error.response?.data;
    const isHtmlError = typeof respData === 'string' && (respData.includes('<!DOCTYPE') || respData.includes('SessionInterrupted'));
    const status = error.response?.status;

    if (status === 404 || status === 403 || status === 500 || isHtmlError) {
      // Session expired, SessionInterrupted, or server error - return empty data gracefully
      if (isHtmlError || status === 500) {
        console.warn("❌ [LOAD CHATS API] Session or server error, returning empty chats. Status:", status);
      } else {
        console.error("❌ [LOAD CHATS API] Error:", status, error.message);
      }
      return { Group_info: [], chats_info: [] };
    }

    console.error("❌ [LOAD CHATS API] Exception:", error.message);
    if (respData && typeof respData !== 'string') {
      console.error("❌ [LOAD CHATS API] Error Response:", respData);
    }
    throw error;
  }
};

/**
 * Add a user to a messaging group
 * @endpoint POST /messaging/addUser/{group_id}/
 * @param groupId Group ID (integer)
 * @param employeeId Employee ID of the user to add
 * @returns Response with success message
 */
export const addUserToGroup = async (
  groupId: number,
  employeeId: string
): Promise<{ Message: string }> => {
  try {const response = await api.post(`/messaging/addUser/${groupId}/`, {
      participant: employeeId,
    });return response.data;
  } catch (error: any) {
    console.error("❌ [ADD USER TO GROUP API] Exception:", error);
    console.error("❌ [ADD USER TO GROUP API] Error Response:", error.response?.data);
    console.error("❌ [ADD USER TO GROUP API] Error Message:", error.message);
    console.error("❌ [ADD USER TO GROUP API] Status Code:", error.response?.status);

    // Handle 400 Bad Request
    if (error.response?.status === 400) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.response?.data?.error ||
        "Invalid request. Please check group ID and employee ID.";
      throw new Error(`Bad Request (400): ${errorMsg}`);
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      throw new Error("Group not found. Please check the group ID.");
    }

    // Handle 500 Server Error
    if (error.response?.status === 500) {
      const errorData = error.response?.data;
      let errorMessage = "Server error (500): The backend encountered an error while processing your request.";
      
      if (errorData?.message || errorData?.detail) {
        errorMessage = `Server Error (500): ${errorData.message || errorData.detail}`;
      }
      
      throw new Error(errorMessage);
    }

    throw error;
  }
};

/**
 * Delete a user from a messaging group
 * @endpoint DELETE /messaging/deleteUser/{group_id}/{user_id}/
 * @param groupId Group ID (integer)
 * @param userId User ID - must be Employee ID (numeric)
 * @returns Response with success message or error message
 */
export const deleteUserFromGroup = async (
  groupId: number,
  userId: string
): Promise<{ Message: string }> => {
  try {const response = await api.delete(`/messaging/deleteUser/${groupId}/${userId}/`);return response.data;
  } catch (error: any) {
    console.error("❌ [DELETE USER FROM GROUP API] Exception:", error);
    console.error("❌ [DELETE USER FROM GROUP API] Error Response:", error.response?.data);
    console.error("❌ [DELETE USER FROM GROUP API] Error Message:", error.message);
    console.error("❌ [DELETE USER FROM GROUP API] Status Code:", error.response?.status);

    // Handle different response messages from the API
    if (error.response?.data?.Message) {
      const message = error.response.data.Message;
      
      // Check for specific error messages
      if (message.includes("Cannot delete the Group Admin") || message.includes("Group Admin")) {
        throw new Error("Cannot delete the Group Admin");
      }
      
      if (message.includes("self deletion is prohibited") || message.includes("self deletion")) {
        throw new Error("Self deletion is prohibited");
      }
      
      // If it's a success message, return it
      if (message.includes("deleted Successfully") || message.includes("Successfully")) {
        return { Message: message };
      }
      
      throw new Error(message);
    }

    // Handle 400 Bad Request
    if (error.response?.status === 400) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.response?.data?.error ||
        "Invalid request. Please check group ID and user ID.";
      throw new Error(`Bad Request (400): ${errorMsg}`);
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      throw new Error("Group or user not found. Please check the IDs.");
    }

    // Handle 500 Server Error
    if (error.response?.status === 500) {
      const errorData = error.response?.data;
      let errorMessage = "Server error (500): The backend encountered an error while processing your request.";
      
      if (errorData?.message || errorData?.detail) {
        errorMessage = `Server Error (500): ${errorData.message || errorData.detail}`;
      }
      
      throw new Error(errorMessage);
    }

    throw error;
  }
};

/**
 * Delete a messaging group
 * @endpoint DELETE /messaging/deleteGroup/{group_id}/
 * @param groupId Group ID (integer)
 * @returns Response with success message
 */
export const deleteGroup = async (
  groupId: number
): Promise<{ message: string }> => {
  try {const response = await api.delete(`/messaging/deleteGroup/${groupId}/`);return response.data;
  } catch (error: any) {
    console.error("❌ [DELETE GROUP API] Exception:", error);
    console.error("❌ [DELETE GROUP API] Error Response:", error.response?.data);
    console.error("❌ [DELETE GROUP API] Error Message:", error.message);
    console.error("❌ [DELETE GROUP API] Status Code:", error.response?.status);

    // Handle 400 Bad Request
    if (error.response?.status === 400) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.response?.data?.error ||
        "Invalid request. Please check group ID.";
      throw new Error(`Bad Request (400): ${errorMsg}`);
    }

    // Handle 403 Forbidden (not authorized)
    if (error.response?.status === 403) {
      throw new Error("You do not have permission to delete this group. Only group creators can delete groups.");
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      throw new Error("Group not found. Please check the group ID.");
    }

    // Handle 500 Server Error
    if (error.response?.status === 500) {
      const errorData = error.response?.data;
      let errorMessage = "Server error (500): The backend encountered an error while processing your request.";
      
      if (errorData?.message || errorData?.detail) {
        errorMessage = `Server Error (500): ${errorData.message || errorData.detail}`;
      }
      
      throw new Error(errorMessage);
    }

    throw error;
  }
};

/**
 * Send a message to a chat
 * @endpoint POST /messaging/postMessages/{chat_id}/
 * @param chatId Chat ID (integer or string)
 * @param message Message text to send
 * @returns Success message
 */
export const postMessages = async (
  chatId: string | number,
  message: string
): Promise<{ message: string }> => {
  // Extract numeric ID first (needed for both API call and error messages)
  let numericChatId: number | undefined;
  const originalChatId = chatId;
  
  try {
    const chatIdStr = typeof chatId === 'string' ? chatId.trim() : String(chatId);
    
    // Always extract numeric ID for error messages and logging
    const numericMatch = chatIdStr.match(/\d+/);
    if (numericMatch) {
      numericChatId = parseInt(numericMatch[0], 10);
    } else if (typeof chatId === 'number') {
      numericChatId = chatId;
    }
    
    // Try the original format first (e.g., "C02569527") - backend might expect this format
    // If it fails, we'll try the numeric version
    let chatIdToUse: string | number = chatIdStr;
    
    // Check if it has a prefix like 'C' - try original format first
    if (typeof chatId === 'string' && /^[A-Za-z]/.test(chatIdStr)) {chatIdToUse = chatIdStr;
    } else if (typeof chatId === 'number') {
      chatIdToUse = chatId;
      numericChatId = chatId;
    } else {
      // Extract numeric part (preserving leading zeros if any)
      if (numericMatch) {
        // Try to preserve leading zeros by using the matched string directly
        const numericPart = numericMatch[0];
        
        // If original has prefix, try original first, otherwise use numeric
        if (/^[A-Za-z]/.test(chatIdStr)) {
          chatIdToUse = chatIdStr; // Try "C02569527" format
        } else {
          chatIdToUse = numericChatId!; // Use numeric
        }} else {
        if (isNaN(numericChatId!)) {
          throw new Error(`Invalid chat ID format: "${chatId}". Expected numeric ID or format like "C123".`);
        }
        chatIdToUse = numericChatId!;
      }
      
      // Validate
      if (numericChatId && (isNaN(numericChatId) || numericChatId <= 0)) {
        throw new Error(`Invalid chat ID: "${chatId}" (extracted as ${numericChatId}). Chat ID must be a positive number.`);
      }
    }// Determine chat type and use appropriate format:
    // - 'C' prefix (e.g., "C02569527") = IndividualChat - use ORIGINAL FORMAT with 'C' prefix ("C02569527")
    // - 'G' prefix (e.g., "G09381") = GroupChat - use original format with 'G' prefix ("G09381")
    // - Numeric = Legacy format - use numeric
    let finalChatId: string | number = chatIdToUse;
    
    if (typeof chatIdToUse === 'string') {
      if (/^C/i.test(chatIdToUse)) {
        // IndividualChat - use original format with 'C' prefix (e.g., "C02569527")finalChatId = chatIdToUse;
      } else if (/^G/i.test(chatIdToUse)) {
        // GroupChat - use "G09381" format (with 'G' prefix)finalChatId = chatIdToUse;
      } else {
        // No prefix - use as-is
        finalChatId = chatIdToUse;
      }
    } else if (typeof chatIdToUse === 'number') {
      // Numeric ID - legacy format
      finalChatId = chatIdToUse;} else {
      finalChatId = chatIdToUse;
    }// Backend expects: body_field-["Message"]
    // Try object format first: {"Message": "text"} (backend uses .get() method)
    // If that fails, we can try array format: ["text"]
    const messageString = String(message).trim();
    const requestBody = { Message: messageString };let response;
    try {
      response = await api.post(`/messaging/postMessages/${finalChatId}/`, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (firstError: any) {
      // If object format fails with 500, try array format as fallback
      if (firstError.response?.status === 500) {const arrayBody = [messageString];try {
          response = await api.post(`/messaging/postMessages/${finalChatId}/`, arrayBody, {
            headers: {
              'Content-Type': 'application/json'
            }
          });} catch (arrayError: any) {
          // If both fail, throw the original error
          throw firstError;
        }
      } else {
        throw firstError;
      }
    }return response.data;
  } catch (error: any) {
    console.error("❌ [POST MESSAGES API] Error:", error);
    console.error("❌ [POST MESSAGES API] Error Response:", error.response?.data);
    console.error("❌ [POST MESSAGES API] Original chat ID:", originalChatId);
    console.error("❌ [POST MESSAGES API] Extracted numeric ID:", numericChatId || 'undefined');
    
    // Ensure numericChatId is set for error messages
    if (!numericChatId && typeof originalChatId === 'string') {
      const match = originalChatId.match(/\d+/);
      if (match) {
        numericChatId = parseInt(match[0], 10);
      }
    }

    if (error.response?.status === 400) {
      throw new Error("Invalid message. Please check your input.");
    }

    if (error.response?.status === 404) {
      const errorData = error.response?.data;
      let errorMsg = `Chat not found.`;
      
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (errorData.detail) {
          errorMsg = errorData.detail;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        }
      }
      
      // Use the extracted numeric ID in error message
      const extractedNumericId = numericChatId || (typeof originalChatId === 'number' ? originalChatId : (parseInt(String(originalChatId).match(/\d+/)?.[0] || '0', 10) || 0));
      
      const enhancedErrorMsg = `${errorMsg}\n\n` +
        `This could mean:\n` +
        `1. The chat ID "${originalChatId}" (numeric: ${extractedNumericId}) does not exist in the database\n` +
        `2. The chat may not have been created yet - try starting the chat again by clicking on the user\n` +
        `3. You may not have permission to access this chat\n` +
        `4. The chat may have been deleted\n\n` +
        `Please try:\n` +
        `- Click on the user again to start/refresh the chat\n` +
        `- Wait a moment and try sending the message again\n` +
        `- Check if the chat appears in your chat list`;
      
      throw new Error(enhancedErrorMsg);
    }

    if (error.response?.status === 500) {
      const errorData = error.response?.data;
      let errorMsg = "Server error (500). Backend returned an error.";
      
      // Try to extract more details from the error response
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (errorData.detail) {
          errorMsg = errorData.detail;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        }
        
        // Log full error for debugging
        console.error("❌ [POST MESSAGES API] Full error response:", JSON.stringify(errorData, null, 2));
      }
      
      const enhancedErrorMsg = `${errorMsg}\n\n` +
        `This is a backend server error. Please check:\n` +
        `1. Backend server logs for detailed error\n` +
        `2. Database connection\n` +
        `3. The request body format matches backend expectations\n` +
        `4. The chat ID "${originalChatId}" is valid\n\n` +
        `Request details:\n` +
        `- Chat ID: ${originalChatId}\n` +
        `- Message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}\n` +
        `- Request body format: {"Message": "..."}`;
      
      throw new Error(enhancedErrorMsg);
    }

    throw error;
  }
};

/**
 * Get messages for a chat
 * @endpoint GET /messaging/getMessages/{chat_id}/
 * @param chatId Chat ID (integer or string)
 * @returns Array of message objects with sender, message, date, time
 */
export const getMessages = async (
  chatId: string | number
): Promise<
  Array<{
    sender: string;
    message: string;
    date: string;
    time: string;
  }>
> => {
  const originalChatId = chatId;
  
  try {
    const chatIdStr = typeof chatId === 'string' ? chatId.trim() : String(chatId);
    
    // Try the original format first (e.g., "C02569527") - backend might expect this format
    // If it fails, we'll try the numeric version
    let chatIdToUse: string | number = chatIdStr;
    let numericChatId: number | undefined;
    
    // Check if it has a prefix like 'C' - try original format first
    if (typeof chatId === 'string' && /^[A-Za-z]/.test(chatIdStr)) {chatIdToUse = chatIdStr;
      // Also extract numeric for fallback
      const numericMatch = chatIdStr.match(/\d+/);
      if (numericMatch) {
        numericChatId = parseInt(numericMatch[0], 10);
      }
    } else if (typeof chatId === 'number') {
      chatIdToUse = chatId;
      numericChatId = chatId;
    } else {
      // Extract numeric part
      const numericMatch = chatIdStr.match(/\d+/);
      if (numericMatch) {
        numericChatId = parseInt(numericMatch[0], 10);
        chatIdToUse = numericChatId;} else {
        numericChatId = parseInt(chatIdStr, 10);
        if (isNaN(numericChatId)) {return [];
        }
        chatIdToUse = numericChatId;
      }
      
      // Validate
      if (isNaN(numericChatId) || numericChatId <= 0) {return [];
      }
    }// Determine chat type and use appropriate format:
    // - 'C' prefix (e.g., "C02569527") = IndividualChat - use ORIGINAL FORMAT with 'C' prefix ("C02569527")
    // - 'G' prefix (e.g., "G09381") = GroupChat - use original format with 'G' prefix ("G09381")
    // - Numeric = Legacy format - use numeric
    let finalChatId: string | number = chatIdToUse;
    
    if (typeof chatIdToUse === 'string') {
      if (/^C/i.test(chatIdToUse)) {
        // IndividualChat - use original format with 'C' prefix (e.g., "C02569527")finalChatId = chatIdToUse;
      } else if (/^G/i.test(chatIdToUse)) {
        // GroupChat - use "G09381" format (with 'G' prefix)finalChatId = chatIdToUse;
      } else {
        // No prefix - use as-is
        finalChatId = chatIdToUse;
      }
    } else if (typeof chatIdToUse === 'number') {
      // Numeric ID - legacy format
      finalChatId = chatIdToUse;} else {
      finalChatId = chatIdToUse;
    }const response = await api.get(`/messaging/getMessages/${finalChatId}/`);
    
    const data = response.data;

    // Handle different response formats
    let messages: any[] = [];

    if (Array.isArray(data)) {
      messages = data;
    } else if (data.messages && Array.isArray(data.messages)) {
      messages = data.messages;
    } else if (data.data && Array.isArray(data.data)) {
      messages = data.data;
    } else {return [];
    }return messages;
  } catch (error: any) {
    console.error("❌ [GET MESSAGES API] Error:", error);
    console.error("❌ [GET MESSAGES API] Error Response:", error.response?.data);
    console.error("❌ [GET MESSAGES API] Error Status:", error.response?.status);
    console.error("❌ [GET MESSAGES API] Original chat ID:", originalChatId);

    // Handle 403 Forbidden - "No GroupChats matches the given query" or permission denied
    if (error.response?.status === 403) {
      const errorData = error.response?.data;
      const errorMsg = errorData?.message || errorData?.detail || errorData?.error || "Permission denied or chat not found";// Return empty array instead of throwing - allows UI to continue working
      return [];
    }

    if (error.response?.status === 404) {
      // Chat not found or no messages - return empty arrayreturn [];
    }

    if (error.response?.status === 500) {
      console.error("❌ [GET MESSAGES API] Server error (500)");
      return [];
    }

    // For other errors, return empty array to prevent UI crashes
    console.error("❌ [GET MESSAGES API] Unexpected error, returning empty array");
    return [];
  }
};

/** Fetch functional goals and actionable goals. GET /get_functions_and_actionable_goals/?function_name=NPD|MMR|RG|HC|IP */
export const getFunctionsAndActionableGoals = async (functionName: string) => {
  const response = await api.get('/get_functions_and_actionable_goals/', {
    params: { function_name: functionName },
  });
  return response.data;
};

/**
 * GET actionable entries
 * @endpoint GET /ActionableEntries/?username=&month=
 * @param username - Optional for own entries; mandatory when MD accesses another user's details
 * @param month - Optional (1-12); if omitted, fetches current month
 * @returns Array of entry objects { id, goal, Creator, date, time, status, note }
 */
export const getActionableEntries = async (params?: {
  username?: string;
  month?: number;
}): Promise<any[]> => {
  const q: Record<string, string> = {};
  q.username = params?.username ?? '';
  if (params?.month != null) q.month = String(params.month);
  const response = await api.get('/ActionableEntries/', { params: q });
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (data?.entries && Array.isArray(data.entries)) return data.entries;
  return [];
};

/**
 * POST actionable entry (create)
 * @endpoint POST /ActionableEntries/
 * @body { goal, status, date, note }
 * goal = actionable_id, status = PENDING|IN_PROGRESS|COMPLETED, date = YYYY-MM-DD
 */
export const createActionableEntry = async (payload: {
  goal: number;
  status: string;
  date: string;
  note: string;
}): Promise<any> => {
  const body = {
    goal: payload.goal,
    status: String(payload.status).toUpperCase().replace('-', '_'),
    date: payload.date,
    note: payload.note || '',
  };
  const response = await api.post('/ActionableEntries/', body);
  const data = response.data;
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (data?.data) return data.data;
  if (data?.entry) return data.entry;
  return data;
};

/**
 * PUT/PATCH actionable entry (update)
 * @endpoint PUT/PATCH /ActionableEntriesByID/{id}/
 * @body { status?, note? } - only pass fields to update
 */
export const updateActionableEntry = async (id: string | number, payload: { status?: string; note?: string }): Promise<any> => {
  const body: Record<string, string> = {};
  if (payload.status != null) body.status = String(payload.status).toUpperCase().replace('-', '_');
  if (payload.note != null) body.note = String(payload.note);
  const response = await api.patch(`/ActionableEntriesByID/${id}/`, body);
  const data = response.data;
  if (Array.isArray(data) && data.length > 0) return data[0];
  if (data?.data) return data.data;
  if (data?.entry) return data.entry;
  return data;
};

/**
 * DELETE actionable entry
 * @endpoint DELETE /ActionableEntriesByID/{id}/
 */
export const deleteActionableEntry = async (id: string | number): Promise<void> => {
  await api.delete(`/ActionableEntriesByID/${id}/`);
};

// Export default api instance
export default api;

// Export all functions as a named object for backward compatibility
export const apiFunctions = {
  login,
  logout,
  setAuthToken,
  refreshToken,
  getEmployeeDashboard,
  createEmployee,
  getEmployees,
  updateProfile,
  createTask,
  viewTasks,
  viewAssignedTasks,
  changeTaskStatus,
  getRoles,
  getDesignations,
  getBranch,
  getDepartmentsandFunctions,
  getTeamleads,
  getAvailableRoles,
  getTaskTypes,
  getNamesFromRoleAndDesignation,
  sendTaskMessage,
  getTaskMessages,
  createGroup,
  showCreatedGroups,
  showGroupMembers,
  loadChats,
  startChat,
  addUserToGroup,
  deleteUserFromGroup,
  deleteGroup,
  postMessages,
  getMessages,
  getMonthlySchedule,
  addDayEntries,
  changeEntryStatus,
  getUserEntries,
  getUserEntriesByFilters,
  getAssetTypes,
  getFunctionsAndActionableGoals,
  getActionableEntries,
  createActionableEntry,
  updateActionableEntry,
  deleteActionableEntry,
};
