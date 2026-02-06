import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 responses (redirect to login)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only logout if this is an authentication endpoint or token validation
      // For other 401s (e.g., insufficient permissions on specific endpoint), let the component handle it
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/') || url.includes('/me');

      if (isAuthEndpoint) {
        // Clear token and redirect to login only for auth failures
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      }
      // For non-auth 401s (e.g., RBAC failures on specific endpoints), just pass the error to the component
      // Component can show "Access Denied" instead of forcing logout
    }
    return Promise.reject(error);
  }
);
