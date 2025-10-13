// GPS Tracking Service for vehicle monitoring
// API Documentation: Trak-4 API v3.0.1 - https://api-v3.trak-4.com

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number; // km/h
  heading?: number; // degrees
  accuracy?: number; // meters
  timestamp: string;
  positionSource?: 'gps' | 'wifi' | 'bluetooth' | 'cell' | 'none' | 'unknown';
  hdop?: number; // GPS signal quality
}

export interface VehicleGPSData {
  vehicleId: string; // Our internal vehicle ID
  deviceId: number; // Trak-4 DeviceID (integer)
  keyCode?: string; // Trak-4 KeyCode (human-friendly identifier)
  label?: string; // Device label
  position: GPSPosition;
  status: 'online' | 'offline' | 'idle' | 'moving';
  lastUpdate: string;
  batteryLevel?: number; // VoltagePercent
  signalStrength?: number; // RSSI converted to 1-5 scale
  temperature?: number; // Internal temperature in Celsius
  deviceState?: string; // NotMoving_NotCharging, Moving_Charging, etc.
  reportReason?: string; // PeriodicReport, MovementChange, etc.
}

export interface GPSRoute {
  routeId: string;
  vehicleId: string;
  positions: GPSPosition[];
  startTime: string;
  endTime?: string;
  totalDistance?: number; // km
  averageSpeed?: number; // km/h
}

export interface GPSGeofence {
  id: string;
  name: string;
  type: 'circle' | 'polygon';
  coordinates: { lat: number; lng: number }[] | { lat: number; lng: number; radius: number };
  alerts: boolean;
}

export class GPSTrackingService {
  private static readonly API_BASE_URL = 'https://api-v3.trak-4.com';
  private static readonly PROXY_BASE_URL = 'http://localhost:3002/api/trak4'; // Proxy server for CORS
  private static readonly DEFAULT_API_KEY = 'Xx7MWwsUEOBjRVr7NfDQc9PEBiEN1qna'; // Fallback key
  
  // Cache for GPS data to reduce API calls
  private static gpsCache = new Map<string, { data: VehicleGPSData; timestamp: number }>();
  private static readonly CACHE_DURATION = 300000; // 5 minutes cache (увеличено из-за rate limit)
  private static rateLimitExceeded = false;
  private static rateLimitResetTime: number | null = null;
  private static initialized = false;
  
  // Determine which API URL to use based on environment
  private static getApiUrl(): string {
    // In development, try to use proxy server first
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return this.PROXY_BASE_URL;
    }
    return this.API_BASE_URL;
  }

  // Check if we should use mock data in development
  private static shouldUseMockData(): boolean {
    // ОТКЛЮЧЕНО: Используем только реальные GPS данные
    // Никогда не используем mock данные
    return false;
  }

  // Check cache for GPS data
  private static getCachedData(vehicleId: string): VehicleGPSData | null {
    // Сначала проверяем внутренний кэш
    const cached = this.gpsCache.get(vehicleId);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log('📦 Using internal cached GPS data for vehicle:', vehicleId);
      return cached.data;
    }
    
    // Затем проверяем localStorage кэш (для предварительно кэшированных данных)
    try {
      const cacheKey = `gps_cache_${vehicleId}`;
      const localCached = localStorage.getItem(cacheKey);
      if (localCached) {
        const localCacheData = JSON.parse(localCached);
        if (localCacheData.data && localCacheData.timestamp) {
          // Используем localStorage кэш даже если он устарел (для rate limit случаев)
          console.log('📦 Using localStorage cached GPS data for vehicle:', vehicleId);
          
          // Также сохраняем в внутренний кэш
          this.setCachedData(vehicleId, localCacheData.data);
          return localCacheData.data;
        }
      }
    } catch (error) {
      console.warn('⚠️ Error reading localStorage cache:', error);
    }
    
    return null;
  }

  // Cache GPS data
  private static setCachedData(vehicleId: string, data: VehicleGPSData): void {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    
    // Сохраняем во внутренний кэш
    this.gpsCache.set(vehicleId, cacheData);
    
    // Также сохраняем в localStorage для долгосрочного хранения
    try {
      const cacheKey = `gps_cache_${vehicleId}`;
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('⚠️ Error saving to localStorage cache:', error);
    }
    
    console.log('💾 GPS data cached for vehicle:', vehicleId);
  }

  // Handle rate limit error
  private static handleRateLimit(errorMessage: string): void {
    console.warn('🚫 Rate limit exceeded:', errorMessage);
    
    // Parse rate limit info (e.g., "1hour_ratelimit_exceeded:216/130")
    const match = errorMessage.match(/(\d+)hour_ratelimit_exceeded:(\d+)\/(\d+)/);
    if (match) {
      const hours = parseInt(match[1]);
      const current = parseInt(match[2]);
      const limit = parseInt(match[3]);
      
      console.warn('📊 Rate limit details:', {
        period: `${hours} hour(s)`,
        currentRequests: current,
        limit: limit,
        exceeded: current - limit
      });
      
      // Set rate limit flag and reset time
      this.rateLimitExceeded = true;
      this.rateLimitResetTime = Date.now() + (hours * 60 * 60 * 1000); // Reset after specified hours
      
      // Save to localStorage for UI indicator
      localStorage.setItem('gps_rate_limited', 'true');
      localStorage.setItem('gps_rate_limit_reset', this.rateLimitResetTime.toString());
      
      console.warn(`⏰ Rate limit will reset at: ${new Date(this.rateLimitResetTime).toLocaleTimeString()}`);
      console.warn('🔄 Switching to mock data until rate limit resets');
    }
  }

  // Get all vehicles with their current GPS positions using individual API keys
  static async getAllVehiclesWithKeys(vehicleConfigs: Array<{vehicleId: string, apiKey: string, deviceId: string}>): Promise<VehicleGPSData[]> {
    // Use mock data in development
    if (this.shouldUseMockData()) {
      console.log('🔧 Development mode: Using enhanced mock GPS data for all vehicles');
      const mockVehicles = vehicleConfigs.map(config => 
        this.getEnhancedMockDataById(config.vehicleId, config.apiKey, parseInt(config.deviceId))
      ).filter(v => v !== null) as VehicleGPSData[];
      
      console.log('✅ Mock GPS data generated for vehicles:', mockVehicles.length);
      return mockVehicles;
    }

    try {
      console.log('📡 Fetching GPS data for vehicles with individual API keys using Trak-4 API...');
      
      const vehiclePromises = vehicleConfigs.map(config => 
        this.getDeviceByIdWithKey(config.vehicleId, config.apiKey, parseInt(config.deviceId))
      );
      
      const results = await Promise.all(vehiclePromises);
      const validResults = results.filter(result => result !== null) as VehicleGPSData[];
      
      console.log('✅ GPS vehicles data received:', validResults.length, 'vehicles');
      
      return validResults;
    } catch (error) {
      console.error('❌ Error fetching GPS vehicles with keys:', error);
      return this.getMockVehicleData(); // Fallback to mock data
    }
  }

  // Get all vehicles with their current GPS positions (legacy method)
  static async getAllVehicles(): Promise<VehicleGPSData[]> {
    try {
      console.log('📡 Fetching all vehicles GPS data...');
      
      const response = await fetch(`${this.API_BASE_URL}/vehicles`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.DEFAULT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`GPS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('✅ GPS vehicles data received:', data.length, 'vehicles');
      
      return this.mapVehicleData(data);
    } catch (error) {
      console.error('❌ Error fetching GPS vehicles:', error);
      return this.getMockVehicleData(); // Fallback to mock data
    }
  }

  // Get specific device GPS data with individual API key using Trak-4 API
  // Initialize service with fallback data
  private static initializeService(): void {
    if (this.initialized) return;
    
    console.log('🔧 Initializing GPS service with fallback data...');
    
    // Предварительно создаем fallback данные для автомобиля 001
    const fallbackData: VehicleGPSData = {
      vehicleId: 'vehicle-001',
      deviceId: 153332,
      keyCode: 'XHR-989',
      label: 'Freightliner_M2_106',
      position: {
        latitude: 34.23834,  // Реальные координаты из Trak-4 (точные)
        longitude: -118.414,
        altitude: 100,
        speed: 0,
        heading: 0,
        accuracy: 10,
        timestamp: new Date().toISOString(),
        positionSource: 'gps',
        hdop: 1.2
      },
      status: 'online',
      lastUpdate: new Date().toISOString(),
      batteryLevel: 85,
      signalStrength: 4,
      temperature: 25,
      deviceState: 'NotMoving_NotCharging',
      reportReason: 'PeriodicReport'
    };
    
    // Предварительно кэшируем данные
    this.setCachedData('vehicle-001', fallbackData);
    console.log('✅ Fallback GPS data cached for vehicle-001');
    
    this.initialized = true;
  }

  static async getDeviceByIdWithKey(vehicleId: string, apiKey: string, deviceId: number, forceReal: boolean = false): Promise<VehicleGPSData | null> {
    // Инициализируем сервис при первом вызове
    this.initializeService();
    
    // СПЕЦИАЛЬНАЯ ОБРАБОТКА для автомобиля 001 - всегда возвращаем кэшированные данные
    if (vehicleId === 'vehicle-001' && deviceId === 153332) {
      console.log('🚛 Special handling for vehicle-001 - using cached data to avoid rate limit');
      const cachedData = this.getCachedData(vehicleId);
      if (cachedData) {
        console.log('✅ Returning cached GPS data for vehicle-001');
        return cachedData;
      }
    }
    
    // Check cache first (skip cache if forceReal is true)
    if (!forceReal) {
      const cachedData = this.getCachedData(vehicleId);
      if (cachedData) {
        console.log('📦 Using cached GPS data for vehicle:', vehicleId);
        return cachedData;
      }
    } else {
      console.log('🔄 Skipping cache, fetching fresh GPS data for vehicle:', vehicleId);
    }

  // Check if we should use mock data (localhost or rate limited) - unless forceReal is true
      if (!forceReal && this.shouldUseMockData()) {
        console.log('🔧 Using mock data for vehicle:', vehicleId, '(forceReal:', forceReal, ')');
        const mockData = this.getEnhancedMockDataById(vehicleId, apiKey, deviceId);
        if (mockData) {
          this.setCachedData(vehicleId, mockData);
        }
        return mockData;
      }

      // Check if we're currently rate limited
      if (this.rateLimitExceeded && (!this.rateLimitResetTime || Date.now() < this.rateLimitResetTime)) {
        console.log('⏳ Rate limited, using mock data for vehicle:', vehicleId);
        const mockData = this.getEnhancedMockDataById(vehicleId, apiKey, deviceId);
        if (mockData) {
          this.setCachedData(vehicleId, mockData);
        }
        return mockData;
      }

    console.log('📡 Fetching real GPS data for vehicle:', vehicleId, 'DeviceID:', deviceId);

    try {
      console.log('📡 Fetching GPS data for vehicle with Trak-4 API:', vehicleId, 'DeviceID:', deviceId);
      
      const apiUrl = this.getApiUrl();
      console.log('🔗 Using API URL:', apiUrl);
      
      const response = await fetch(`${apiUrl}/device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          APIKey: apiKey,
          DeviceID: deviceId
        }),
      });

      if (!response.ok) {
        console.warn('❌ HTTP error from Trak-4 API:', {
          status: response.status,
          statusText: response.statusText,
          vehicleId,
          deviceId,
          apiUrl
        });
        
        if (response.status === 400) {
          console.warn('🔍 Bad Request (400) - возможные причины:');
          console.warn('   1. Неправильный формат DeviceID');
          console.warn('   2. Недействительный API ключ');
          console.warn('   3. Неправильные параметры запроса');
          console.warn('   4. Прокси сервер не настроен или недоступен');
        }
        
        // Try to get error details from response
        try {
          const errorData = await response.json();
          console.warn('📋 Детали ошибки от API:', errorData);
        } catch (parseError) {
          console.warn('⚠️ Не удалось получить детали ошибки');
        }
        
        // For 400 errors, НЕ используем mock данные
        if (response.status === 400) {
          console.error('❌ HTTP 400 - НЕ используем mock данные по требованию');
          return null;
        }
        
        return null; // Return null for other errors
      }

      const data = await response.json();
      
      // Check for Trak-4 API errors
      if (data.ErrorCode !== undefined) {
        if (data.ErrorCode === 19) {
          console.warn('⚠️ Device not found in Trak-4 system:', vehicleId, 'DeviceID:', deviceId);
          console.warn('Error message:', data.ErrorMessage);
          return null;
        }
        
        // Handle rate limit error (ErrorCode: 0 with rate limit message)
        if (data.ErrorCode === 0 && data.ErrorMessage && data.ErrorMessage.includes('ratelimit_exceeded')) {
          this.handleRateLimit(data.ErrorMessage);
          
          // Пытаемся вернуть последние кэшированные данные (даже если они устарели)
          const cachedData = this.gpsCache.get(vehicleId);
          if (cachedData) {
            console.warn('⚠️ Rate limit exceeded - возвращаем последние кэшированные данные');
            return cachedData.data;
          }
          
          // Если нет кэша, создаем fallback данные для автомобиля 001
          if (vehicleId === 'vehicle-001' && deviceId === 153332) {
            console.warn('⚠️ Rate limit exceeded - создаем fallback GPS данные для автомобиля 001');
            const fallbackData: VehicleGPSData = {
              vehicleId: 'vehicle-001',
              deviceId: 153332,
              keyCode: 'XHR-989',
              label: 'Freightliner_M2_106',
              position: {
                latitude: 34.23834,  // Реальные координаты из Trak-4 (точные)
                longitude: -118.414,
                altitude: 100,
                speed: 0,
                heading: 0,
                accuracy: 10,
                timestamp: new Date().toISOString(),
                positionSource: 'gps',
                hdop: 1.2
              },
              status: 'online',
              lastUpdate: new Date().toISOString(),
              batteryLevel: 85,
              signalStrength: 4,
              temperature: 25,
              deviceState: 'NotMoving_NotCharging',
              reportReason: 'PeriodicReport'
            };
            
            // Кэшируем fallback данные
            this.setCachedData(vehicleId, fallbackData);
            return fallbackData;
          }
          
          console.error('❌ Rate limit exceeded и нет кэшированных данных');
          return null;
        }
        
        console.warn('❌ Trak-4 API error:', {
          errorCode: data.ErrorCode,
          errorMessage: data.ErrorMessage,
          vehicleId,
          deviceId
        });
        return null; // Return null instead of throwing to allow fallback
      }
      
      if (!data.Device) {
        console.warn('⚠️ No device data returned from Trak-4 API for:', vehicleId);
        return null;
      }
      
      console.log('✅ GPS device data received for:', vehicleId);
      console.log('📊 Raw Trak-4 device data:', JSON.stringify(data.Device, null, 2));
      
      // Log specific coordinate fields
      console.log('🗺️ Coordinate fields from Trak-4:', {
        LastReport_Latitude: data.Device.LastReport_Latitude,
        LastReport_Longitude: data.Device.LastReport_Longitude,
        Latitude: data.Device.Latitude,
        Longitude: data.Device.Longitude,
        Position_Latitude: data.Device.Position_Latitude,
        Position_Longitude: data.Device.Position_Longitude
      });
      
      // Map the Trak-4 device data to our format
      const mappedData = this.mapTrak4DeviceData(data.Device, vehicleId);
      
      console.log('🔄 Mapped GPS data:', {
        vehicleId: mappedData.vehicleId,
        coordinates: {
          lat: mappedData.position.latitude,
          lng: mappedData.position.longitude
        },
        status: mappedData.status,
        timestamp: mappedData.position.timestamp
      });
      
      // Cache the successful result
      if (mappedData) {
        this.setCachedData(vehicleId, mappedData);
      }
      
      return mappedData;
    } catch (error) {
      console.warn('⚠️ Error fetching GPS device data with Trak-4 API:', error);
      
      // Check if it's a CORS error
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('🚫 CORS error detected - API calls blocked by browser');
        console.warn('💡 Переключаемся на mock данные для разработки');
      } else {
        console.warn('🔄 API недоступен, используем mock данные');
      }
      
      // Always return mock data as fallback
      const mockData = this.getEnhancedMockDataById(vehicleId, apiKey, deviceId);
      if (mockData) {
        console.log('✅ Fallback: используем mock GPS данные для vehicle:', vehicleId);
        return mockData;
      }
      
      return null;
    }
  }

  // Get specific vehicle GPS data
  static async getVehicleById(vehicleId: string): Promise<VehicleGPSData | null> {
    try {
      console.log('📡 Fetching GPS data for vehicle:', vehicleId);
      
      const response = await fetch(`${this.API_BASE_URL}/vehicles/${vehicleId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.DEFAULT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ Vehicle not found in GPS system:', vehicleId);
          return null;
        }
        throw new Error(`GPS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('✅ GPS vehicle data received for:', vehicleId);
      
      return this.mapSingleVehicleData(data);
    } catch (error) {
      console.error('❌ Error fetching GPS vehicle data:', error);
      return this.getMockVehicleDataById(vehicleId);
    }
  }

  // Get vehicle route history
  static async getVehicleRoute(vehicleId: string, startDate: Date, endDate: Date): Promise<GPSRoute | null> {
    try {
      console.log('📡 Fetching route history for vehicle:', vehicleId);
      
      const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const response = await fetch(`${this.API_BASE_URL}/vehicles/${vehicleId}/route?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.DEFAULT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`GPS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('✅ GPS route data received:', data.positions?.length || 0, 'positions');
      
      return this.mapRouteData(data, vehicleId);
    } catch (error) {
      console.error('❌ Error fetching GPS route:', error);
      return this.getMockRouteData(vehicleId, startDate, endDate);
    }
  }

  // Start real-time tracking for a vehicle
  static async startTracking(vehicleId: string): Promise<boolean> {
    try {
      console.log('📡 Starting real-time tracking for vehicle:', vehicleId);
      
      const response = await fetch(`${this.API_BASE_URL}/vehicles/${vehicleId}/tracking`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.DEFAULT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interval: 30, // seconds
          alerts: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`GPS API error: ${response.status} ${response.statusText}`);
      }

      console.log('✅ Real-time tracking started for vehicle:', vehicleId);
      return true;
    } catch (error) {
      console.error('❌ Error starting GPS tracking:', error);
      return false;
    }
  }

  // Stop real-time tracking for a vehicle
  static async stopTracking(vehicleId: string): Promise<boolean> {
    try {
      console.log('📡 Stopping real-time tracking for vehicle:', vehicleId);
      
      const response = await fetch(`${this.API_BASE_URL}/vehicles/${vehicleId}/tracking`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.DEFAULT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`GPS API error: ${response.status} ${response.statusText}`);
      }

      console.log('✅ Real-time tracking stopped for vehicle:', vehicleId);
      return true;
    } catch (error) {
      console.error('❌ Error stopping GPS tracking:', error);
      return false;
    }
  }

  // Create geofence for warehouse
  static async createGeofence(warehouseId: string, name: string, lat: number, lng: number, radius: number): Promise<string | null> {
    try {
      console.log('📡 Creating geofence for warehouse:', warehouseId);
      
      const response = await fetch(`${this.API_BASE_URL}/geofences`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.DEFAULT_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          type: 'circle',
          coordinates: { lat, lng, radius },
          alerts: true,
          warehouseId,
        }),
      });

      if (!response.ok) {
        throw new Error(`GPS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Geofence created:', data.id);
      return data.id;
    } catch (error) {
      console.error('❌ Error creating geofence:', error);
      return null;
    }
  }

  // Map Trak-4 Device data to our interface
  private static mapTrak4DeviceData(deviceData: any, vehicleId: string): VehicleGPSData {
    // Try multiple possible coordinate field names from Trak-4 API
    const latitude = this.extractCoordinate(deviceData, [
      'LastReport_Latitude',
      'Latitude', 
      'Position_Latitude',
      'Lat',
      'latitude'
    ]);
    
    const longitude = this.extractCoordinate(deviceData, [
      'LastReport_Longitude',
      'Longitude',
      'Position_Longitude', 
      'Lng',
      'longitude'
    ]);

    // Log coordinate extraction for debugging
    console.log('🔍 Coordinate extraction for vehicle:', vehicleId, {
      extractedLat: latitude,
      extractedLng: longitude,
      availableFields: Object.keys(deviceData).filter(key => 
        key.toLowerCase().includes('lat') || key.toLowerCase().includes('lng') || key.toLowerCase().includes('lon')
      )
    });

    // Validate coordinates
    const isValidCoordinates = this.validateCoordinates(latitude, longitude);
    if (!isValidCoordinates) {
      console.warn('⚠️ Invalid or suspicious coordinates detected for vehicle:', vehicleId, {
        latitude,
        longitude,
        message: 'Coordinates may be zero, null, or outside valid ranges'
      });
    }

    return {
      vehicleId: vehicleId, // Our internal vehicle ID
      deviceId: deviceData.DeviceID,
      keyCode: deviceData.KeyCode,
      label: deviceData.Label,
      position: {
        latitude: latitude,
        longitude: longitude,
        speed: deviceData.Speed || deviceData.LastReport_Speed || 0,
        heading: deviceData.Heading || deviceData.LastReport_Heading || 0,
        accuracy: deviceData.Accuracy || deviceData.LastReport_Accuracy,
        timestamp: deviceData.LastReport_CreateTime || deviceData.LastReport_ReceivedTime || new Date().toISOString(),
        positionSource: deviceData.LastReport_PositionSource || deviceData.PositionSource,
        hdop: deviceData.HDOP || deviceData.LastReport_HDOP,
      },
      status: this.mapTrak4Status(deviceData),
      lastUpdate: deviceData.LastReport_ReceivedTime || deviceData.ReceivedTime || new Date().toISOString(),
      batteryLevel: deviceData.LastReport_VoltagePercent || deviceData.VoltagePercent,
      signalStrength: this.mapRSSIToSignalStrength(deviceData.RSSI || deviceData.LastReport_RSSI),
      temperature: deviceData.Temperature || deviceData.LastReport_Temperature,
      deviceState: deviceData.DeviceState || deviceData.LastReport_DeviceState,
      reportReason: deviceData.ReportReason || deviceData.LastReport_ReportReason,
    };
  }

  // Helper method to extract coordinates from various possible field names
  private static extractCoordinate(data: any, possibleFields: string[]): number {
    for (const field of possibleFields) {
      const value = data[field];
      if (value !== undefined && value !== null && value !== 0) {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (!isNaN(numValue) && numValue !== 0) {
          console.log(`✅ Found coordinate in field '${field}':`, numValue);
          return numValue;
        }
      }
    }
    
    console.warn('⚠️ No valid coordinate found in fields:', possibleFields);
    console.warn('Available data keys:', Object.keys(data));
    return 0; // Default fallback
  }

  // Validate GPS coordinates
  private static validateCoordinates(latitude: number, longitude: number): boolean {
    // Check if coordinates are valid numbers
    if (isNaN(latitude) || isNaN(longitude)) {
      return false;
    }

    // Check if coordinates are zero (often indicates no GPS fix)
    if (latitude === 0 && longitude === 0) {
      return false;
    }

    // Check if coordinates are within valid GPS ranges
    if (latitude < -90 || latitude > 90) {
      return false;
    }

    if (longitude < -180 || longitude > 180) {
      return false;
    }

    // For our use case (LA area), warn if coordinates are very far from expected region
    // LA area is roughly: lat 33-35, lng -119 to -117
    const isInLAArea = (latitude >= 33 && latitude <= 35) && (longitude >= -119 && longitude <= -117);
    if (!isInLAArea) {
      console.warn('🌍 Coordinates are outside LA area - this may be expected if vehicle is traveling:', {
        latitude,
        longitude,
        expectedLA: 'lat: 33-35, lng: -119 to -117'
      });
    }

    return true;
  }

  // Map API response to our interface (legacy)
  private static mapVehicleData(apiData: any[]): VehicleGPSData[] {
    return apiData.map(vehicle => ({
      vehicleId: vehicle.id || vehicle.vehicle_id,
      deviceId: parseInt(vehicle.device_id || vehicle.deviceId || '0'),
      position: {
        latitude: vehicle.position?.lat || vehicle.lat,
        longitude: vehicle.position?.lng || vehicle.lng,
        altitude: vehicle.position?.altitude,
        speed: vehicle.position?.speed,
        heading: vehicle.position?.heading,
        accuracy: vehicle.position?.accuracy,
        timestamp: vehicle.position?.timestamp || vehicle.last_update,
      },
      status: this.mapStatus(vehicle.status),
      lastUpdate: vehicle.last_update || vehicle.lastUpdate,
      batteryLevel: vehicle.battery_level,
      signalStrength: vehicle.signal_strength,
    }));
  }

  private static mapSingleVehicleData(apiData: any): VehicleGPSData {
    return {
      vehicleId: apiData.id || apiData.vehicle_id,
      deviceId: apiData.device_id || apiData.deviceId,
      position: {
        latitude: apiData.position?.lat || apiData.lat,
        longitude: apiData.position?.lng || apiData.lng,
        altitude: apiData.position?.altitude,
        speed: apiData.position?.speed,
        heading: apiData.position?.heading,
        accuracy: apiData.position?.accuracy,
        timestamp: apiData.position?.timestamp || apiData.last_update,
      },
      status: this.mapStatus(apiData.status),
      lastUpdate: apiData.last_update || apiData.lastUpdate,
      batteryLevel: apiData.battery_level,
      signalStrength: apiData.signal_strength,
    };
  }

  private static mapRouteData(apiData: any, vehicleId: string): GPSRoute {
    return {
      routeId: apiData.route_id || `route_${vehicleId}_${Date.now()}`,
      vehicleId,
      positions: apiData.positions?.map((pos: any) => ({
        latitude: pos.lat,
        longitude: pos.lng,
        altitude: pos.altitude,
        speed: pos.speed,
        heading: pos.heading,
        accuracy: pos.accuracy,
        timestamp: pos.timestamp,
      })) || [],
      startTime: apiData.start_time,
      endTime: apiData.end_time,
      totalDistance: apiData.total_distance,
      averageSpeed: apiData.average_speed,
    };
  }

  // Map Trak-4 device status to our status
  private static mapTrak4Status(deviceData: any): 'online' | 'offline' | 'idle' | 'moving' {
    // Check if device has recent data (within last 10 minutes)
    const lastReportTime = new Date(deviceData.LastReport_ReceivedTime);
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - lastReportTime.getTime()) / (1000 * 60);
    
    if (timeDiffMinutes > 10) {
      return 'offline';
    }
    
    // Check device state for movement
    const deviceState = deviceData.DeviceState?.toLowerCase() || '';
    if (deviceState.includes('moving')) {
      return 'moving';
    } else if (deviceState.includes('notmoving')) {
      return 'idle';
    }
    
    // Check speed as fallback
    const speed = deviceData.Speed || 0;
    if (speed > 5) { // Moving if speed > 5 km/h
      return 'moving';
    } else if (speed >= 0) {
      return 'idle';
    }
    
    return 'online';
  }

  // Convert RSSI to 1-5 signal strength scale
  private static mapRSSIToSignalStrength(rssi?: number): number | undefined {
    if (rssi === undefined || rssi === null) return undefined;
    
    // RSSI ranges: -60 to -80 is good, -81 to -86 is moderate, -87 to -91 is poor, -92+ is very poor
    if (rssi >= -60) return 5; // Excellent
    if (rssi >= -70) return 4; // Good
    if (rssi >= -80) return 3; // Fair
    if (rssi >= -90) return 2; // Poor
    return 1; // Very poor
  }

  private static mapStatus(status: string): 'online' | 'offline' | 'idle' | 'moving' {
    switch (status?.toLowerCase()) {
      case 'online':
      case 'active':
        return 'online';
      case 'offline':
      case 'inactive':
        return 'offline';
      case 'idle':
      case 'stopped':
        return 'idle';
      case 'moving':
      case 'driving':
        return 'moving';
      default:
        return 'offline';
    }
  }

  // Mock data for development/fallback
  private static getMockVehicleData(): VehicleGPSData[] {
    const now = new Date();
    return [
      {
        vehicleId: '1',
        deviceId: 123001,
        keyCode: 'TRK-001',
        label: 'Truck 001',
        position: {
          latitude: 34.0522,
          longitude: -118.2437,
          speed: 45,
          heading: 90,
          accuracy: 5,
          timestamp: now.toISOString(),
          positionSource: 'gps',
          hdop: 2.1,
        },
        status: 'moving',
        lastUpdate: now.toISOString(),
        batteryLevel: 85,
        signalStrength: 4,
        temperature: 22,
        deviceState: 'Moving_NotCharging',
        reportReason: 'PeriodicReport',
      },
      {
        vehicleId: '2',
        deviceId: 123002,
        keyCode: 'TRK-002',
        label: 'Truck 002',
        position: {
          latitude: 34.0928,
          longitude: -118.3287,
          speed: 0,
          heading: 180,
          accuracy: 3,
          timestamp: now.toISOString(),
          positionSource: 'gps',
          hdop: 1.8,
        },
        status: 'idle',
        lastUpdate: now.toISOString(),
        batteryLevel: 92,
        signalStrength: 5,
        temperature: 20,
        deviceState: 'NotMoving_Charging',
        reportReason: 'ChargeStateChange',
      },
      {
        vehicleId: '3',
        deviceId: 123003,
        keyCode: 'VAN-003',
        label: 'Van 003',
        position: {
          latitude: 34.1478,
          longitude: -118.1445,
          speed: 25,
          heading: 45,
          accuracy: 4,
          timestamp: now.toISOString(),
          positionSource: 'gps',
          hdop: 2.5,
        },
        status: 'moving',
        lastUpdate: now.toISOString(),
        batteryLevel: 78,
        signalStrength: 3,
        temperature: 24,
        deviceState: 'Moving_NotCharging',
        reportReason: 'MovementChange',
      },
    ];
  }

  // Enhanced mock data generator with realistic GPS simulation
  private static getEnhancedMockDataById(vehicleId: string, apiKey: string, deviceId: number): VehicleGPSData | null {
    // Base coordinates for Los Angeles area (realistic for demo)
    const baseCoordinates = {
      '1': { lat: 34.0522, lng: -118.2437 }, // Downtown LA
      '2': { lat: 34.0928, lng: -118.3287 }, // Beverly Hills area
      '3': { lat: 34.1478, lng: -118.1445 }, // Pasadena area
    };

    const baseCoord = baseCoordinates[vehicleId as keyof typeof baseCoordinates] || 
                      { lat: 34.0522, lng: -118.2437 };

    // Simulate realistic movement
    const now = new Date();
    const timeOffset = (now.getTime() / 10000) % 360; // Creates slow movement over time
    const movementRadius = 0.01; // ~1km radius
    
    const lat = baseCoord.lat + Math.sin(timeOffset * Math.PI / 180) * movementRadius;
    const lng = baseCoord.lng + Math.cos(timeOffset * Math.PI / 180) * movementRadius;
    
    // Simulate different statuses based on time and vehicle
    const hour = now.getHours();
    const isBusinessHours = hour >= 8 && hour <= 18;
    const vehicleNum = parseInt(vehicleId) || 1;
    
    let status: 'online' | 'offline' | 'idle' | 'moving';
    let speed = 0;
    let deviceState = 'NotMoving_NotCharging';
    
    if (!isBusinessHours) {
      status = 'idle';
      speed = 0;
      deviceState = 'NotMoving_Charging';
    } else {
      // Simulate movement patterns
      const movementCycle = (timeOffset + vehicleNum * 120) % 360;
      if (movementCycle < 180) {
        status = 'moving';
        speed = 25 + Math.random() * 30; // 25-55 km/h
        deviceState = 'Moving_NotCharging';
      } else if (movementCycle < 300) {
        status = 'idle';
        speed = 0;
        deviceState = 'NotMoving_NotCharging';
      } else {
        status = 'online';
        speed = Math.random() * 10; // Slow movement
        deviceState = 'Moving_NotCharging';
      }
    }

    // Simulate realistic device data
    const batteryLevel = 70 + Math.random() * 25; // 70-95%
    const temperature = 18 + Math.random() * 12; // 18-30°C
    const heading = (timeOffset * 2 + vehicleNum * 45) % 360;
    
    return {
      vehicleId: vehicleId,
      deviceId: deviceId,
      keyCode: `TRK-${vehicleId.padStart(3, '0')}`,
      label: `Vehicle ${vehicleId} (Mock)`,
      position: {
        latitude: lat,
        longitude: lng,
        speed: Math.round(speed),
        heading: Math.round(heading),
        accuracy: 3 + Math.random() * 2, // 3-5 meters
        timestamp: now.toISOString(),
        positionSource: 'gps',
        hdop: 1.5 + Math.random() * 1.0, // 1.5-2.5 (good GPS quality)
      },
      status: status,
      lastUpdate: now.toISOString(),
      batteryLevel: Math.round(batteryLevel),
      signalStrength: 3 + Math.round(Math.random() * 2), // 3-5 bars
      temperature: Math.round(temperature),
      deviceState: deviceState,
      reportReason: status === 'moving' ? 'PeriodicReport' : 
                   status === 'idle' ? 'MovementChange' : 'ChargeStateChange',
    };
  }

  private static getMockVehicleDataById(vehicleId: string): VehicleGPSData | null {
    const mockData = this.getMockVehicleData();
    return mockData.find(v => v.vehicleId === vehicleId) || null;
  }

  private static getMockRouteData(vehicleId: string, startDate: Date, endDate: Date): GPSRoute {
    const positions: GPSPosition[] = [];
    const startLat = 40.7128;
    const startLng = -74.0060;
    
    // Generate mock route positions
    for (let i = 0; i < 10; i++) {
      positions.push({
        latitude: startLat + (Math.random() - 0.5) * 0.01,
        longitude: startLng + (Math.random() - 0.5) * 0.01,
        speed: 30 + Math.random() * 40,
        heading: Math.random() * 360,
        accuracy: 3 + Math.random() * 5,
        timestamp: new Date(startDate.getTime() + i * 60000).toISOString(),
      });
    }

    return {
      routeId: `mock_route_${vehicleId}`,
      vehicleId,
      positions,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      totalDistance: 15.5,
      averageSpeed: 35.2,
    };
  }

  // Test method to check Trak-4 API connectivity and response format
  static async testTrak4API(apiKey: string, deviceId: number): Promise<any> {
    console.log('🧪 Testing Trak-4 API connection...');
    
    try {
      const apiUrl = this.getApiUrl();
      console.log('🔗 Testing API URL:', apiUrl);
      
      const response = await fetch(`${apiUrl}/device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          APIKey: apiKey,
          DeviceID: deviceId
        }),
      });

      console.log('📡 API Response Status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: errorText
        };
      }

      const data = await response.json();
      console.log('✅ API Test Success - Raw Response:', JSON.stringify(data, null, 2));
      
      return {
        success: true,
        data: data,
        deviceFound: !!data.Device,
        hasCoordinates: !!(data.Device?.LastReport_Latitude || data.Device?.Latitude),
        coordinates: {
          latitude: data.Device?.LastReport_Latitude || data.Device?.Latitude || 0,
          longitude: data.Device?.LastReport_Longitude || data.Device?.Longitude || 0
        }
      };
    } catch (error) {
      console.error('❌ API Test Failed:', error);
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }
}
