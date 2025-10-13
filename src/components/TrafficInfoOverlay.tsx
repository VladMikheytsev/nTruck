import React, { useState, useEffect } from 'react';
import { useGoogleMaps } from '../hooks/useGoogleMaps';

interface TrafficInfo {
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  score: number; // 0-100
  description: string;
  color: string;
  icon: string;
}

interface TrafficInfoOverlayProps {
  map: google.maps.Map | null;
  routes: Array<{
    id: string;
    name: string;
    stops: Array<{
      warehouseId: string;
      coordinates?: { lat: number; lng: number };
    }>;
  }>;
  warehouses: Array<{
    id: string;
    name: string;
    coordinates?: { lat: number; lng: number };
  }>;
  className?: string;
}

const TrafficInfoOverlay: React.FC<TrafficInfoOverlayProps> = ({
  map,
  routes,
  warehouses,
  className = ''
}) => {
  const { isLoaded: isGoogleMapsLoaded } = useGoogleMaps();
  const [trafficData, setTrafficData] = useState<Map<string, TrafficInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  // Traffic level configurations
  const trafficLevels: Record<string, Omit<TrafficInfo, 'score'>> = {
    LOW: {
      level: 'LOW',
      description: 'Свободно',
      color: '#10B981', // Green
      icon: '🟢'
    },
    MODERATE: {
      level: 'MODERATE',
      description: 'Умеренно',
      color: '#F59E0B', // Yellow
      icon: '🟡'
    },
    HIGH: {
      level: 'HIGH',
      description: 'Загружено',
      color: '#EF4444', // Red
      icon: '🔴'
    },
    SEVERE: {
      level: 'SEVERE',
      description: 'Пробки',
      color: '#7C2D12', // Dark red
      icon: '🚫'
    }
  };

  // Simulate traffic data for demonstration
  const generateTrafficData = (routeId: string): TrafficInfo => {
    const random = Math.random();
    let level: keyof typeof trafficLevels;
    
    if (random < 0.3) level = 'LOW';
    else if (random < 0.6) level = 'MODERATE';
    else if (random < 0.85) level = 'HIGH';
    else level = 'SEVERE';
    
    const baseLevel = trafficLevels[level];
    const score = Math.floor(Math.random() * 40) + (level === 'LOW' ? 0 : level === 'MODERATE' ? 30 : level === 'HIGH' ? 60 : 80);
    
    return {
      ...baseLevel,
      score: Math.min(100, score)
    };
  };

  // Load traffic data for all routes
  useEffect(() => {
    if (!isGoogleMapsLoaded || routes.length === 0) return;

    setIsLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const newTrafficData = new Map<string, TrafficInfo>();
      
      routes.forEach(route => {
        newTrafficData.set(route.id, generateTrafficData(route.id));
      });
      
      setTrafficData(newTrafficData);
      setIsLoading(false);
    }, 1000);
  }, [isGoogleMapsLoaded, routes]);

  // Auto-refresh traffic data every 5 minutes
  useEffect(() => {
    if (!isGoogleMapsLoaded) return;

    const interval = setInterval(() => {
      const newTrafficData = new Map<string, TrafficInfo>();
      
      routes.forEach(route => {
        newTrafficData.set(route.id, generateTrafficData(route.id));
      });
      
      setTrafficData(newTrafficData);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isGoogleMapsLoaded, routes]);

  const getTrafficScoreColor = (score: number) => {
    if (score < 30) return 'text-green-600';
    if (score < 60) return 'text-yellow-600';
    if (score < 80) return 'text-red-600';
    return 'text-red-800';
  };

  const getTrafficScoreBg = (score: number) => {
    if (score < 30) return 'bg-green-100';
    if (score < 60) return 'bg-yellow-100';
    if (score < 80) return 'bg-red-100';
    return 'bg-red-200';
  };

  if (!isGoogleMapsLoaded || routes.length === 0) {
    return null;
  }

  return (
    <div className={`absolute top-4 right-4 z-10 ${className}`}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Пробки на дорогах</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-500">Обновлено</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Загрузка данных о пробках...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(trafficData.entries()).map(([routeId, traffic]) => {
              const route = routes.find(r => r.id === routeId);
              if (!route) return null;

              return (
                <div
                  key={routeId}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    selectedRoute === routeId ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-gray-50'
                  }`}
                  onClick={() => setSelectedRoute(selectedRoute === routeId ? null : routeId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{traffic.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">
                          {route.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {traffic.description}
                        </div>
                      </div>
                    </div>
                    
                    <div className={`px-2 py-1 rounded-full text-xs font-bold ${getTrafficScoreBg(traffic.score)} ${getTrafficScoreColor(traffic.score)}`}>
                      {traffic.score}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${traffic.score}%`,
                        backgroundColor: traffic.color
                      }}
                    />
                  </div>

                  {/* Route details when expanded */}
                  {selectedRoute === routeId && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Остановок:</span>
                          <span className="font-medium">{route.stops.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Склады:</span>
                          <span className="font-medium">
                            {route.stops.filter(stop => 
                              warehouses.find(w => w.id === stop.warehouseId)?.coordinates
                            ).length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Время в пути:</span>
                          <span className="font-medium">
                            {traffic.score < 30 ? '~30 мин' : 
                             traffic.score < 60 ? '~45 мин' : 
                             traffic.score < 80 ? '~60 мин' : '~90 мин'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600 mb-2">Уровень загруженности:</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(trafficLevels).map((level) => (
              <div key={level.level} className="flex items-center space-x-1">
                <span>{level.icon}</span>
                <span className="text-xs">{level.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficInfoOverlay;

