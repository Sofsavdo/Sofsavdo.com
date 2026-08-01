/**
 * API Client - Centralized HTTP client for all backend API calls
 * Uses fetch API with automatic token management and error handling
 */

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'https://api.sofsavdo.com';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('access_token');
    }
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options?: {
      body?: any;
      headers?: Record<string, string>;
      isFormData?: boolean;
    }
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options?.headers || {}),
    };

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Handle body
    if (options?.body) {
      if (options.isFormData) {
        // Don't set Content-Type for FormData - browser will set it with boundary
        fetchOptions.body = options.body;
      } else {
        headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(options.body);
      }
    }

    try {
      const response = await fetch(url, fetchOptions);

      // Handle 401 - token expired
      if (response.status === 401) {
        this.token = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          // Trigger logout/redirect in calling code
        }
        throw new Error('Unauthorized - please log in again');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      return {} as T;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  // Set auth token (call after login)
  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token);
    }
  }

  // GET request
  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', endpoint, { headers });
  }

  // POST request
  async post<T>(
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('POST', endpoint, { body, headers });
  }

  // POST FormData (for file uploads)
  async postFormData<T>(
    endpoint: string,
    formData: FormData,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('POST', endpoint, { body: formData, headers, isFormData: true });
  }

  // PUT request
  async put<T>(
    endpoint: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>('PUT', endpoint, { body, headers });
  }

  // DELETE request
  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', endpoint, { headers });
  }
}

// Export singleton instance
export const api = new ApiClient(baseURL);

