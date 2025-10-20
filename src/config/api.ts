/**
 * API Configuration для development и production
 */

const isDevelopment = import.meta.env.DEV;
const rawApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3002').replace(/\/$/, '');

export const API_CONFIG = {
  // Base URL для прокси сервера
  PROXY_BASE_URL: `${rawApiUrl}/api/trak4`,
  
  // URL для получения данных устройства
  PROXY_DEVICE_URL: `${rawApiUrl}/api/trak4/device`,
  
  // Health check endpoint
  HEALTH_CHECK_URL: `${rawApiUrl}/health`,
  
  // Trak-4 API (прямой доступ, не используется в production)
  TRAK4_API_URL: 'https://api-v3.trak-4.com',
  
  // Development mode
  IS_DEVELOPMENT: isDevelopment,
  
  // Full API URL
  API_URL: rawApiUrl,
};

// Логируем конфигурацию в development
if (isDevelopment) {
  console.log('🔧 API Configuration:', API_CONFIG);
}

export default API_CONFIG;

