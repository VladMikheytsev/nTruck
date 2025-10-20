// Trak-4 GPS Service based on official API documentation v3.0.1
// API Documentation: https://api-v3.trak-4.com
// OpenAPI Spec: API_Config_Trak4.yaml

export interface Trak4Device {
  DeviceID: number;
  DeviceGroupID?: number;
  DeviceGroupName?: string;
  Firmware: string;
  Generation: number;
  ImageURL?: string;
  IMEI: string;
  KeyCode: string;
  Label: string;
  LastReport_CreateTime: string;
  LastReport_PositionSource: 'gps' | 'wifi' | 'bluetooth' | 'cell' | 'none';
  LastReport_ReceivedTime: string;
  LastReport_Latitude: number;
  LastReport_Longitude: number;
  LastReport_Voltage: number;
  LastReport_VoltagePercent: number;
  Note: string;
  ProductID: number;
  ProductName: string;
  ReportingFrequencyID_Current: number;
  ReportingFrequency_Current: string;
  ReportingFrequencyID_Pending?: number;
  ReportingFrequency_Pending?: string;
  SerialDictionary?: string;
}

export interface Trak4RequestInfo {
  APIVersion: string;
  Message?: string;
  RateLimit10sec: string;
  RateLimit1min: string;
  RateLimit1hour: string;
}

export interface Trak4APIResponse {
  Device: Trak4Device;
  RequestInfo: Trak4RequestInfo;
}

export interface Trak4Error {
  ErrorCode: number;
  ErrorMessage: string;
}

export interface VehicleGPSPosition {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number; // km/h
  heading?: number; // degrees
  accuracy?: number; // meters
  timestamp: string;
  positionSource: 'gps' | 'wifi' | 'bluetooth' | 'cell' | 'none';
  hdop?: number; // GPS signal quality
}

export interface VehicleGPSData {
  vehicleId: string; // Our internal vehicle ID
  deviceId: number; // Trak-4 DeviceID
  keyCode: string; // Trak-4 KeyCode (human-friendly identifier)
  label: string; // Device label
  imei: string; // Device IMEI
  position: VehicleGPSPosition;
  status: 'online' | 'offline' | 'idle' | 'moving';
  lastUpdate: string;
  batteryLevel: number; // VoltagePercent
  voltage: number; // Voltage in millivolts
  signalStrength?: number; // RSSI converted to 1-5 scale
  temperature?: number; // Internal temperature in Celsius
  deviceState?: string; // NotMoving_NotCharging, Moving_Charging, etc.
  reportReason?: string; // PeriodicReport, MovementChange, etc.
  firmware: string;
  generation: number;
  productName: string;
  reportingFrequency: string;
}

export class Trak4GPSService {
  private static readonly API_BASE_URL = 'https://api-v3.trak-4.com';
  private static readonly PROXY_URL = 'http://localhost:3002/api/trak4/device'; // Development proxy
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static readonly RATE_LIMIT_CACHE_DURATION = 60 * 1000; // 1 minute for rate limit fallback

  private static gpsCache = new Map<string, VehicleGPSData>();
  private static rateLimitCache = new Map<string, { timestamp: number; data: VehicleGPSData }>();

  /**
   * Get GPS data for a specific vehicle using Trak-4 API
   * @param vehicleId - Internal vehicle ID
   * @param apiKey - Trak-4 API key
   * @param deviceId - Trak-4 Device ID
   * @param forceReal - Force real API call (bypass cache)
   * @returns Promise<VehicleGPSData | null>
   */
  public static async getDeviceByIdWithKey(
    vehicleId: string,
    apiKey: string,
    deviceId: number,
    forceReal: boolean = false
  ): Promise<VehicleGPSData | null> {
    try {
      // Check cache first (unless forced)
      if (!forceReal) {
        const cachedData = this.getCachedData(vehicleId);
        if (cachedData) {
          console.log(`📦 Using cached GPS data for vehicle: ${vehicleId}`);
          return cachedData;
        }
      }

      console.log(`📡 Fetching GPS data for vehicle: ${vehicleId}, DeviceID: ${deviceId}`);

      // Make API request through proxy
      const response = await fetch(this.PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          APIKey: apiKey,
          DeviceID: deviceId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ Trak-4 API Error: ${response.status} ${response.statusText}`, errorData);
        
        // Handle rate limit with fallback
        if (response.status === 400 && errorData.details?.includes('ratelimit_exceeded')) {
          console.warn('⚠️ Rate limit exceeded, using cached data');
          return this.getRateLimitFallback(vehicleId);
        }
        
        return null;
      }

      const data: Trak4APIResponse = await response.json();
      
      if (!data.Device) {
        console.error('❌ No device data in response');
        return null;
      }

      // Map Trak-4 data to our format
      const mappedData = this.mapTrak4DeviceToVehicleGPS(data.Device, vehicleId);
      
      // Cache the data
      this.cacheData(vehicleId, mappedData);
      
      console.log(`✅ GPS data received for vehicle: ${vehicleId}`, {
        coordinates: `${mappedData.position.latitude}, ${mappedData.position.longitude}`,
        battery: `${mappedData.batteryLevel}%`,
        source: mappedData.position.positionSource
      });

      return mappedData;

    } catch (error) {
      console.error(`❌ Error fetching GPS data for vehicle ${vehicleId}:`, error);
      
      // Try to return cached data as fallback
      const cachedData = this.getCachedData(vehicleId);
      if (cachedData) {
        console.log(`📦 Using cached data as fallback for vehicle: ${vehicleId}`);
        return cachedData;
      }
      
      return null;
    }
  }

  /**
   * Map Trak-4 Device data to our VehicleGPSData interface
   */
  private static mapTrak4DeviceToVehicleGPS(device: Trak4Device, vehicleId: string): VehicleGPSData {
    const now = new Date().toISOString();
    const lastReportTime = new Date(device.LastReport_CreateTime);
    const timeDiff = Date.now() - lastReportTime.getTime();
    
    // Determine status based on time since last report
    let status: 'online' | 'offline' | 'idle' | 'moving' = 'offline';
    if (timeDiff < 5 * 60 * 1000) { // Less than 5 minutes
      status = 'online';
    } else if (timeDiff < 30 * 60 * 1000) { // Less than 30 minutes
      status = 'idle';
    }

    return {
      vehicleId,
      deviceId: device.DeviceID,
      keyCode: device.KeyCode,
      label: device.Label,
      imei: device.IMEI,
      position: {
        latitude: device.LastReport_Latitude,
        longitude: device.LastReport_Longitude,
        timestamp: device.LastReport_CreateTime,
        positionSource: device.LastReport_PositionSource,
        accuracy: this.getAccuracyFromPositionSource(device.LastReport_PositionSource)
      },
      status,
      lastUpdate: device.LastReport_ReceivedTime,
      batteryLevel: device.LastReport_VoltagePercent,
      voltage: device.LastReport_Voltage,
      firmware: device.Firmware,
      generation: device.Generation,
      productName: device.ProductName,
      reportingFrequency: device.ReportingFrequency_Current
    };
  }

  /**
   * Get accuracy estimate based on position source
   */
  private static getAccuracyFromPositionSource(source: string): number {
    switch (source) {
      case 'gps': return 3; // GPS: ~3 meters
      case 'wifi': return 10; // WiFi: ~10 meters
      case 'bluetooth': return 20; // Bluetooth: ~20 meters
      case 'cell': return 100; // Cell tower: ~100 meters
      default: return 1000; // Unknown: ~1km
    }
  }

  /**
   * Cache GPS data
   */
  private static cacheData(vehicleId: string, data: VehicleGPSData): void {
    this.gpsCache.set(vehicleId, {
      ...data,
      lastUpdate: new Date().toISOString()
    });
  }

  /**
   * Get cached GPS data
   */
  private static getCachedData(vehicleId: string): VehicleGPSData | null {
    const cached = this.gpsCache.get(vehicleId);
    if (!cached) return null;

    const now = Date.now();
    const cacheTime = new Date(cached.lastUpdate).getTime();
    
    if (now - cacheTime > this.CACHE_DURATION) {
      this.gpsCache.delete(vehicleId);
      return null;
    }

    return cached;
  }

  /**
   * Get rate limit fallback data
   */
  private static getRateLimitFallback(vehicleId: string): VehicleGPSData | null {
    const cached = this.rateLimitCache.get(vehicleId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.RATE_LIMIT_CACHE_DURATION) {
      this.rateLimitCache.delete(vehicleId);
      return null;
    }

    return cached.data;
  }

  /**
   * Test API connection with specific device
   */
  public static async testAPIConnection(apiKey: string, deviceId: number): Promise<{
    success: boolean;
    data?: Trak4APIResponse;
    error?: string;
  }> {
    try {
      console.log(`🧪 Testing Trak-4 API connection: DeviceID ${deviceId}`);
      
      const response = await fetch(this.PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          APIKey: apiKey,
          DeviceID: deviceId
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Trak-4 API Test Success - Raw Response:', data);
        return {
          success: true,
          data: data as Trak4APIResponse
        };
      } else {
        console.error('❌ Trak-4 API Test Failed:', data);
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      console.error('❌ Trak-4 API Test Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all cached vehicles
   */
  public static getCachedVehicles(): VehicleGPSData[] {
    return Array.from(this.gpsCache.values());
  }

  /**
   * Clear cache for specific vehicle
   */
  public static clearVehicleCache(vehicleId: string): void {
    this.gpsCache.delete(vehicleId);
    this.rateLimitCache.delete(vehicleId);
  }

  /**
   * Clear all cache
   */
  public static clearAllCache(): void {
    this.gpsCache.clear();
    this.rateLimitCache.clear();
  }

  /**
   * Get cache statistics
   */
  public static getCacheStats(): {
    totalVehicles: number;
    cacheSize: number;
    rateLimitCacheSize: number;
  } {
    return {
      totalVehicles: this.gpsCache.size,
      cacheSize: this.gpsCache.size,
      rateLimitCacheSize: this.rateLimitCache.size
    };
  }
}
