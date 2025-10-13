import React, { useRef, useEffect, useState } from 'react';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import TrafficInfoOverlay from './TrafficInfoOverlay';

interface Route {
  id: string;
  name: string;
  stops: Array<{
    warehouseId: string;
    coordinates?: { lat: number; lng: number };
  }>;
}

interface Warehouse {
  id: string;
  name: string;
  coordinates?: { lat: number; lng: number };
}

interface TrafficAwareRouteMapProps {
  routes: Route[];
  warehouses: Warehouse[];
  selectedDate: Date;
  className?: string;
  height?: string;
}

const TrafficAwareRouteMap: React.FC<TrafficAwareRouteMapProps> = ({
  routes,
  warehouses,
  selectedDate,
  className = '',
  height = '500px'
}) => {
  const { isLoaded: isGoogleMapsLoaded, error: googleMapsError } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const [isTrafficEnabled, setIsTrafficEnabled] = useState(true);
  const [mapCenter, setMapCenter] = useState({ lat: 34.0522, lng: -118.2437 });

  // Initialize map with traffic layer
  useEffect(() => {
    if (!isGoogleMapsLoaded || !mapRef.current || mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      zoom: 11,
      center: mapCenter,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapId: 'DEMO_MAP_ID',
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        },
        {
          featureType: 'transit',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    // Add traffic layer
    const trafficLayer = new google.maps.TrafficLayer({
      autoRefresh: true
    });
    
    if (isTrafficEnabled) {
      trafficLayer.setMap(map);
    }

    mapInstanceRef.current = map;
    trafficLayerRef.current = trafficLayer;

    console.log('🗺️ TrafficAwareRouteMap initialized with traffic layer');
  }, [isGoogleMapsLoaded, isTrafficEnabled]);

  // Update traffic layer visibility
  useEffect(() => {
    if (!trafficLayerRef.current) return;

    if (isTrafficEnabled) {
      trafficLayerRef.current.setMap(mapInstanceRef.current);
    } else {
      trafficLayerRef.current.setMap(null);
    }
  }, [isTrafficEnabled]);

  // Calculate map center based on routes
  useEffect(() => {
    if (!routes.length || !warehouses.length) return;

    const validCoordinates = routes
      .flatMap(route => route.stops)
      .map(stop => {
        const warehouse = warehouses.find(w => w.id === stop.warehouseId);
        return warehouse?.coordinates;
      })
      .filter((coord): coord is { lat: number; lng: number } => coord !== undefined);

    if (validCoordinates.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      validCoordinates.forEach(coord => bounds.extend(coord));
      
      const center = bounds.getCenter();
      setMapCenter({ lat: center.lat(), lng: center.lng() });
      
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter(center);
        mapInstanceRef.current.fitBounds(bounds);
      }
    }
  }, [routes, warehouses]);

  // Add warehouse markers and route polylines
  useEffect(() => {
    if (!mapInstanceRef.current || !routes.length) return;

    // Clear existing markers and polylines
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];

    const map = mapInstanceRef.current;
    const bounds = new google.maps.LatLngBounds();

    // Route colors
    const routeColors = [
      '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
    ];

    routes.forEach((route, routeIndex) => {
      const routeColor = routeColors[routeIndex % routeColors.length];
      const validStops = route.stops
        .map(stop => {
          const warehouse = warehouses.find(w => w.id === stop.warehouseId);
          return warehouse?.coordinates ? { ...stop, coordinates: warehouse.coordinates } : null;
        })
        .filter((stop): stop is NonNullable<typeof stop> => stop !== null);

      if (validStops.length < 2) return;

      // Add warehouse markers
      validStops.forEach((stop, stopIndex) => {
        const marker = new google.maps.Marker({
          position: stop.coordinates,
          map,
          title: `${route.name} - Остановка ${stopIndex + 1}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: routeColor,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          label: {
            text: (stopIndex + 1).toString(),
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '12px'
          }
        });

        markersRef.current.push(marker);
        bounds.extend(stop.coordinates);
      });

      // Add route polyline
      const path = validStops.map(stop => stop.coordinates);
      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: routeColor,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map
      });

      polylinesRef.current.push(polyline);
    });

    // Fit map to show all routes
    if (bounds.isEmpty() === false) {
      map.fitBounds(bounds);
    }
  }, [routes, warehouses]);

  if (googleMapsError) {
    return (
      <div className="flex items-center justify-center h-64 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-2">Ошибка загрузки карты</div>
          <div className="text-red-500 text-sm">{googleMapsError}</div>
        </div>
      </div>
    );
  }

  if (!isGoogleMapsLoaded) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Загрузка карты...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div
        ref={mapRef}
        style={{ height }}
        className="w-full rounded-lg border border-gray-200"
      />

      {/* Traffic Controls */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsTrafficEnabled(!isTrafficEnabled)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isTrafficEnabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{isTrafficEnabled ? '🚫' : '🚦'}</span>
              <span>{isTrafficEnabled ? 'Скрыть пробки' : 'Показать пробки'}</span>
            </button>
            
            <div className="text-xs text-gray-500">
              {isTrafficEnabled ? 'Пробки включены' : 'Пробки отключены'}
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Info Overlay */}
      <TrafficInfoOverlay
        map={mapInstanceRef.current}
        routes={routes}
        warehouses={warehouses}
      />

      {/* Map Info */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-600 space-y-1">
            <div className="font-medium">Информация о карте</div>
            <div>Маршрутов: {routes.length}</div>
            <div>Складов: {warehouses.length}</div>
            <div>Дата: {selectedDate.toLocaleDateString('ru-RU')}</div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Данные актуальны</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficAwareRouteMap;

