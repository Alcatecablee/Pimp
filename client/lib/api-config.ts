/**
 * API Configuration
 * 
 * In development: API calls go to the local Express server (relative URLs)
 * In production: API calls go to the VPS backend (absolute URL from env var)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Get the full API URL for a given endpoint
 * @param endpoint - The API endpoint path (e.g., '/api/videos')
 * @returns The full URL to call
 */
export function getApiUrl(endpoint: string): string {
  // In production with VITE_API_URL set, use absolute URL
  if (API_BASE_URL) {
    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${API_BASE_URL}/${cleanEndpoint}`;
  }
  
  // In development, use relative URL (Express plugin handles it)
  return endpoint;
}

/**
 * Enhanced fetch with automatic API URL resolution
 * @param endpoint - The API endpoint path
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(endpoint);
  return fetch(url, options);
}
