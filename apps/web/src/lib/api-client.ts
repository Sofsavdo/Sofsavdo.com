/**
 * API Client
 * 
 * Simple HTTP client for making API requests with authentication support
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiResponse<T> {
  data: T;
}

// Token storage helpers
const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
};

const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
};

const setTokens = (accessToken: string, refreshToken: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
};

const clearTokens = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Token refresh logic
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch (error) {
    clearTokens();
    throw error;
  }
};

// Main API client with authentication
export const api = {
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isAuthRequired = true
  ): Promise<T> {
    let token = getAccessToken();
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (isAuthRequired && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && isAuthRequired) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          token = await refreshAccessToken();
          onTokenRefreshed(token);
        } catch (error) {
          isRefreshing = false;
          throw new Error('Authentication failed');
        }
        isRefreshing = false;
      } else {
        // Wait for token refresh to complete
        await new Promise((resolve) => {
          subscribeTokenRefresh((newToken) => {
            token = newToken;
            resolve(newToken);
          });
        });
      }

      // Retry request with new token
      headers['Authorization'] = `Bearer ${token}`;
      response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: ApiResponse<T> = await response.json();
    return data.data;
  },

  async get<T>(path: string, isAuthRequired = true): Promise<T> {
    return this.request<T>('GET', path, undefined, isAuthRequired);
  },

  async post<T>(path: string, body: unknown, isAuthRequired = true): Promise<T> {
    return this.request<T>('POST', path, body, isAuthRequired);
  },

  async put<T>(path: string, body: unknown, isAuthRequired = true): Promise<T> {
    return this.request<T>('PUT', path, body, isAuthRequired);
  },

  async delete<T>(path: string, isAuthRequired = true): Promise<T> {
    return this.request<T>('DELETE', path, undefined, isAuthRequired);
  },
};

// Auth-specific methods
export const authApi = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async register(dto: { displayName: string; email?: string; phone?: string; password: string; referralCode?: string }) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      throw new Error(`Registration failed: ${response.status}`);
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return data;
  },

  async logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
    }
    clearTokens();
  },

  async getMe() {
    return api.get('/auth/me');
  },
};
