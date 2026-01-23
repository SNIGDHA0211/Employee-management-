// Authentication utility functions for token management

const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Get authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Set authentication token in localStorage
 */
export const setAuthToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

/**
 * Get refresh token from localStorage
 */
export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Set refresh token in localStorage
 */
export const setRefreshToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
};

/**
 * Check if token is valid (not expired)
 * For JWT tokens, you can decode and check expiration
 * For now, we'll just check if token exists
 */
export const isValidToken = (token: string | null): boolean => {
  if (!token) return false;
  
  try {
    // If it's a JWT token, decode and check expiration
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp;
      if (exp) {
        return Date.now() < exp * 1000;
      }
    }
    // If not JWT or no expiration, assume valid
    return true;
  } catch {
    // If parsing fails, assume valid (might be a simple token)
    return true;
  }
};

/**
 * Clear all authentication data
 */
export const clearAuthData = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};


