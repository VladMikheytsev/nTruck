import React, { useState, useEffect, useRef } from 'react';
import { GPSTrackingService, VehicleGPSData, GPSRoute } from '../services/gpsTrackingService';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import { 
  Navigation, 
  MapPin, 
  Activity, 
  Battery, 
  Signal, 
  Clock,
  Route as RouteIcon,
  Play,
  Square,
  RefreshCw
} from 'lucide-react';

interface GPSTrackingMapProps {
  routeId?: string;
  vehicleIds?: string[];
  vehicleConfigs?: Array<{vehicleId: string, apiKey: string, deviceId: string}>;
  height?: string;
  showControls?: boolean;
}

const GPSTrackingMap: React.FC<GPSTrackingMapProps> = ({ 
  routeId, 
  vehicleIds = [], 
  vehicleConfigs = [],
  height = '400px',
  showControls = true 
}) => {
  const { isLoaded: isGoogleMapsLoaded, error: googleMapsError } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement | google.maps.Marker>>(new Map());
  const routeRenderersRef = useRef<Map<string, google.maps.DirectionsRenderer>>(new Map());

  const [vehiclesData, setVehiclesData] = useState<VehicleGPSData[]>([]);
  const [routesData, setRoutesData] = useState<Map<string, GPSRoute>>(new Map());
  const [isTracking, setIsTracking] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Initialize map
  useEffect(() => {
    if (!isGoogleMapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      zoom: 12,
      center: { lat: 34.0522, lng: -118.2437 }, // Default to LA
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapId: 'DEMO_MAP_ID',
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    mapInstanceRef.current = map;
    console.log('✅ GPS Tracking Map initialized');
  }, [isGoogleMapsLoaded]);

  // Load initial GPS data
  useEffect(() => {
    if (!isGoogleMapsLoaded) return;
    loadGPSData();
  }, [isGoogleMapsLoaded, vehicleIds]);

  // Auto-refresh GPS data
  useEffect(() => {
    if (!isGoogleMapsLoaded || vehicleIds.length === 0) return;

    const interval = setInterval(() => {
      loadGPSData();
    }, 60000); // Update every 60 seconds (reduced to avoid rate limits)

    return () => clearInterval(interval);
  }, [isGoogleMapsLoaded, vehicleIds]);

  const loadGPSData = async () => {
    setIsLoading(true);
    try {
      let vehicles: VehicleGPSData[] = [];

      if (vehicleConfigs.length > 0) {
        // Load vehicles using individual API keys
        vehicles = await GPSTrackingService.getAllVehiclesWithKeys(vehicleConfigs);
      } else if (vehicleIds.length > 0) {
        // Load specific vehicles using default API
        const vehiclePromises = vehicleIds.map(id => GPSTrackingService.getVehicleById(id));
        const vehicleResults = await Promise.all(vehiclePromises);
        vehicles = vehicleResults.filter(v => v !== null) as VehicleGPSData[];
      } else {
        // Load all vehicles using default API
        vehicles = await GPSTrackingService.getAllVehicles();
      }

      setVehiclesData(vehicles);
      setLastUpdate(new Date());
      updateMapMarkers(vehicles);

      console.log('✅ GPS data loaded:', vehicles.length, 'vehicles');
    } catch (error) {
      console.error('❌ Error loading GPS data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateMapMarkers = (vehicles: VehicleGPSData[]) => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const bounds = new google.maps.LatLngBounds();

    // Clear existing markers
    markersRef.current.forEach(marker => {
      if (marker instanceof google.maps.marker.AdvancedMarkerElement) {
        marker.map = null;
      } else {
        (marker as google.maps.Marker).setMap(null);
      }
    });
    markersRef.current.clear();

    // Add markers for each vehicle
    vehicles.forEach(vehicle => {
      const position = new google.maps.LatLng(
        vehicle.position.latitude,
        vehicle.position.longitude
      );

      // Create marker using modern AdvancedMarkerElement or fallback to legacy Marker
      let marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker;

      if (google.maps.marker?.AdvancedMarkerElement) {
        const pinElement = new google.maps.marker.PinElement({
          background: getStatusColor(vehicle.status),
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          glyph: '🚛',
          scale: 1.0
        });

        marker = new google.maps.marker.AdvancedMarkerElement({
          position,
          map,
          title: `Vehicle ${vehicle.vehicleId}`,
          content: pinElement.element
        });
      } else {
        marker = new google.maps.Marker({
          position,
          map,
          title: `Vehicle ${vehicle.vehicleId}`,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: getStatusColor(vehicle.status),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            rotation: vehicle.position.heading || 0,
          },
        });
      }

      // Info window
      const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(vehicle),
      });

      marker.addListener('click', () => {
        if (marker instanceof google.maps.marker.AdvancedMarkerElement) {
          infoWindow.open(map, marker);
        } else {
          infoWindow.open(map, marker as google.maps.Marker);
        }
      });

      markersRef.current.set(vehicle.vehicleId, marker);
      bounds.extend(position);
    });

    // Fit map to show all vehicles
    if (vehicles.length > 0) {
      if (vehicles.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(15);
      } else {
        map.fitBounds(bounds);
      }
    }
  };

  const createInfoWindowContent = (vehicle: VehicleGPSData): string => {
    const lastUpdateTime = new Date(vehicle.lastUpdate).toLocaleTimeString();
    const speed = vehicle.position.speed ? `${Math.round(vehicle.position.speed)} км/ч` : 'N/A';
    
    return `
      <div style="padding: 10px; min-width: 200px;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937;">Автомобиль ${vehicle.vehicleId}</h3>
        <div style="display: flex; flex-direction: column; gap: 5px; font-size: 14px;">
          <div><strong>Статус:</strong> <span style="color: ${getStatusColor(vehicle.status)};">${getStatusText(vehicle.status)}</span></div>
          <div><strong>Скорость:</strong> ${speed}</div>
          <div><strong>Последнее обновление:</strong> ${lastUpdateTime}</div>
          ${vehicle.batteryLevel ? `<div><strong>Батарея:</strong> ${vehicle.batteryLevel}%</div>` : ''}
          ${vehicle.signalStrength ? `<div><strong>Сигнал:</strong> ${vehicle.signalStrength}/5</div>` : ''}
        </div>
      </div>
    `;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'moving': return '#10b981'; // green
      case 'idle': return '#f59e0b'; // yellow
      case 'online': return '#3b82f6'; // blue
      case 'offline': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'moving': return 'В движении';
      case 'idle': return 'Простой';
      case 'online': return 'Онлайн';
      case 'offline': return 'Офлайн';
      default: return 'Неизвестно';
    }
  };

  const handleStartTracking = async (vehicleId: string) => {
    const success = await GPSTrackingService.startTracking(vehicleId);
    if (success) {
      setIsTracking(prev => new Map(prev).set(vehicleId, true));
    }
  };

  const handleStopTracking = async (vehicleId: string) => {
    const success = await GPSTrackingService.stopTracking(vehicleId);
    if (success) {
      setIsTracking(prev => new Map(prev).set(vehicleId, false));
    }
  };

  const handleShowRoute = async (vehicleId: string) => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    const route = await GPSTrackingService.getVehicleRoute(vehicleId, startDate, endDate);
    if (route && route.positions.length > 0) {
      setRoutesData(prev => new Map(prev).set(vehicleId, route));
      displayRouteOnMap(route);
    }
  };

  const displayRouteOnMap = (route: GPSRoute) => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    
    // Create polyline for the route
    const routePath = route.positions.map(pos => ({
      lat: pos.latitude,
      lng: pos.longitude
    }));

    const routePolyline = new google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: '#3b82f6',
      strokeOpacity: 1.0,
      strokeWeight: 3,
    });

    routePolyline.setMap(map);

    // Fit map to route
    const bounds = new google.maps.LatLngBounds();
    routePath.forEach(point => bounds.extend(point));
    map.fitBounds(bounds);
  };

  if (googleMapsError) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Ошибка загрузки карты: {googleMapsError}</p>
        </div>
      </div>
    );
  }

  if (!isGoogleMapsLoaded) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка карты...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Controls */}
      {showControls && (
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Navigation className="h-5 w-5 mr-2 text-blue-600" />
                GPS Отслеживание
              </h3>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                Обновлено: {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
            <button
              onClick={loadGPSData}
              disabled={isLoading}
              className="btn-secondary flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>

          {/* Vehicle Status Cards */}
          {vehiclesData.length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehiclesData.map(vehicle => (
                <div key={vehicle.vehicleId} className="bg-white rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: getStatusColor(vehicle.status) }}
                      />
                      <span className="font-medium">Автомобиль {vehicle.vehicleId}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {vehicle.batteryLevel && (
                        <div className="flex items-center text-xs text-gray-500">
                          <Battery className="h-3 w-3 mr-1" />
                          {vehicle.batteryLevel}%
                        </div>
                      )}
                      {vehicle.signalStrength && (
                        <div className="flex items-center text-xs text-gray-500">
                          <Signal className="h-3 w-3 mr-1" />
                          {vehicle.signalStrength}/5
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">
                    <div>Статус: {getStatusText(vehicle.status)}</div>
                    {vehicle.position.speed && (
                      <div>Скорость: {Math.round(vehicle.position.speed)} км/ч</div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleShowRoute(vehicle.vehicleId)}
                      className="flex-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                    >
                      <RouteIcon className="h-3 w-3 inline mr-1" />
                      Маршрут
                    </button>
                    {isTracking.get(vehicle.vehicleId) ? (
                      <button
                        onClick={() => handleStopTracking(vehicle.vehicleId)}
                        className="flex-1 text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100"
                      >
                        <Square className="h-3 w-3 inline mr-1" />
                        Стоп
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartTracking(vehicle.vehicleId)}
                        className="flex-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100"
                      >
                        <Play className="h-3 w-3 inline mr-1" />
                        Старт
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div 
        ref={mapRef} 
        style={{ height }}
        className="w-full"
      />
    </div>
  );
};

export default GPSTrackingMap;
