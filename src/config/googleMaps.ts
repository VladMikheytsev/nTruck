// Google Maps API Configuration
export const GOOGLE_MAPS_CONFIG = {
  // Основной API ключ
  apiKey: 'AIzaSyAosU8ZdGQQqwIsyKRaAr4bX_UnMsrw-MI',
  version: 'weekly' as const,
  libraries: ['places', 'geometry', 'marker'] as any, // Добавляем 'marker' для AdvancedMarkerElement
  language: 'en' as const,
  region: 'US' as const,
};

// Routes API and Roads API Configuration
export const ROUTES_API_CONFIG = {
  baseUrl: 'https://routes.googleapis.com',
  version: 'v2',
  endpoints: {
    computeRoutes: '/directions/v2:computeRoutes',
  },
  fieldMask: 'routes.duration,routes.durationInTraffic,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.localizedValues,routes.travelAdvisory'
};

export const ROADS_API_CONFIG = {
  baseUrl: 'https://roads.googleapis.com',
  version: 'v1',
  endpoints: {
    speedLimits: '/v1/speedLimits',
    snapToRoads: '/v1/snapToRoads',
  }
};
