import axios from 'axios';

// Environment-aware backend destination configuration anchor
const API_BASE_URL = 'http://localhost:5162/api'; // Matches your local .NET run port

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =========================================================================
// AUTOMATED CRYPTOGRAPHIC BEARER TOKEN INTERCEPTOR
// =========================================================================
apiClient.interceptors.request.use(
  (config) => {
    // Pull the active identity token out of local browser storage
    const token = localStorage.getItem('global_academy_jwt_token');
    
    if (token && config.headers) {
      // Clean injection forces your backend query filters to identify the tenant owner automatically
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Unified global error interceptor helper
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('⚠️ Session expired or invalid token detected. Clearing local context.');
      localStorage.removeItem('global_academy_jwt_token');
    }
    return Promise.reject(error);
  }
);
