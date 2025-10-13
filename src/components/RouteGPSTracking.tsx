import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { RouteGPSTrackingService, RouteProgressState } from '../services/routeGPSTrackingService';
import { Route, User } from '../types';
import { 
  Play, 
  Square, 
  MapPin, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  Truck,
  AlertCircle,
  Navigation
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface RouteGPSTrackingProps {
  route: Route;
  driver: User;
}

const RouteGPSTracking: React.FC<RouteGPSTrackingProps> = ({ route, driver }) => {
  const { state } = useAppContext();
  const [trackingState, setTrackingState] = useState<RouteProgressState | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Загружаем состояние отслеживания при монтировании
  useEffect(() => {
    const currentState = RouteGPSTrackingService.getTrackingState(route.id, driver.id);
    setTrackingState(currentState);
    setIsTracking(!!currentState && currentState.status !== 'completed');
  }, [route.id, driver.id]);

  // Обновляем состояние каждые 10 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = RouteGPSTrackingService.getTrackingState(route.id, driver.id);
      setTrackingState(currentState);
      setIsTracking(!!currentState && currentState.status !== 'completed');
    }, 10000);

    return () => clearInterval(interval);
  }, [route.id, driver.id]);

  const handleStartTracking = () => {
    RouteGPSTrackingService.startRouteTracking(route, driver, state.warehouses);
    setIsTracking(true);
  };

  const handleStopTracking = () => {
    RouteGPSTrackingService.stopRouteTracking(route.id, driver.id);
    setIsTracking(false);
    setTrackingState(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'at_stop':
        return <MapPin className="h-4 w-4 text-blue-500" />;
      case 'in_transit':
        return <Truck className="h-4 w-4 text-orange-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'Не начат';
      case 'at_stop':
        return 'На складе';
      case 'in_transit':
        return 'В пути';
      case 'completed':
        return 'Завершен';
      default:
        return 'Неизвестно';
    }
  };

  const getWarehouseName = (warehouseId: string) => {
    const warehouse = state.warehouses.find(w => w.id === warehouseId);
    return warehouse?.name || 'Неизвестный склад';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Navigation className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">GPS Отслеживание Маршрута</h3>
            <p className="text-sm text-gray-600">
              Водитель: {driver.firstName} {driver.lastName}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {!isTracking ? (
            <button
              onClick={handleStartTracking}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play className="h-4 w-4" />
              <span>Начать отслеживание</span>
            </button>
          ) : (
            <button
              onClick={handleStopTracking}
              className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Square className="h-4 w-4" />
              <span>Остановить</span>
            </button>
          )}
        </div>
      </div>

      {trackingState && (
        <div className="space-y-6">
          {/* Текущий статус */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon(trackingState.status)}
                <span className="font-medium text-gray-900">
                  Статус: {getStatusText(trackingState.status)}
                </span>
              </div>
              
              {trackingState.lastGPSUpdate && (
                <span className="text-sm text-gray-500">
                  Обновлено: {format(new Date(trackingState.lastGPSUpdate), 'HH:mm:ss', { locale: ru })}
                </span>
              )}
            </div>

            {trackingState.status !== 'completed' && (
              <div className="text-sm text-gray-600">
                <p>Текущая остановка: {getWarehouseName(trackingState.currentStopId)}</p>
                <p>Остановка {trackingState.currentStopIndex + 1} из {route.stops.length}</p>
                
                {trackingState.lastPosition.latitude !== 0 && (
                  <p className="mt-2">
                    Координаты: {trackingState.lastPosition.latitude.toFixed(6)}, {trackingState.lastPosition.longitude.toFixed(6)}
                  </p>
                )}
              </div>
            )}

            {trackingState.confirmationPending && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    Подтверждение {trackingState.confirmationPending.type === 'arrival' ? 'прибытия' : 'отъезда'}
                  </span>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  {trackingState.confirmationPending.type === 'arrival' 
                    ? 'Водитель въехал в геозону. Подтверждение через 30 секунд...'
                    : 'Водитель покинул геозону. Подтверждение через 30 секунд...'
                  }
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Первое обнаружение: {format(new Date(trackingState.confirmationPending.firstCheckTime), 'HH:mm:ss', { locale: ru })}
                </p>
              </div>
            )}
          </div>

          {/* Прогресс по остановкам */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4">Прогресс маршрута</h4>
            <div className="space-y-3">
              {route.stops.map((stop, index) => {
                const warehouse = state.warehouses.find(w => w.id === stop.warehouseId);
                const stopTimes = trackingState.stopTimes[stop.warehouseId];
                const isCurrent = index === trackingState.currentStopIndex;
                const isPassed = index < trackingState.currentStopIndex;
                const isCompleted = trackingState.status === 'completed';
                
                return (
                  <div
                    key={stop.warehouseId}
                    className={`flex items-center space-x-4 p-3 rounded-lg border-2 ${
                      isCurrent && !isCompleted
                        ? 'border-blue-300 bg-blue-50'
                        : isPassed || isCompleted
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {isPassed || isCompleted ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : isCurrent ? (
                        <div className="h-6 w-6 rounded-full border-2 border-blue-600 bg-blue-100 flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300 bg-gray-100"></div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-gray-900">
                          {warehouse?.name || 'Неизвестный склад'}
                        </h5>
                        <span className="text-sm text-gray-500">
                          Остановка {index + 1}
                        </span>
                      </div>
                      
                      {warehouse?.fullAddress && (
                        <p className="text-sm text-gray-600 mt-1">
                          {warehouse.fullAddress}
                        </p>
                      )}

                      {/* Времена прибытия и отъезда */}
                      <div className="flex space-x-6 mt-2">
                        {stopTimes?.arrivalTime && (
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3 text-green-600" />
                            <span className="text-xs text-gray-600">
                              Прибытие: {format(new Date(stopTimes.arrivalTime), 'HH:mm', { locale: ru })}
                            </span>
                          </div>
                        )}
                        
                        {stopTimes?.departureTime && (
                          <div className="flex items-center space-x-1">
                            <ArrowRight className="h-3 w-3 text-blue-600" />
                            <span className="text-xs text-gray-600">
                              Отъезд: {format(new Date(stopTimes.departureTime), 'HH:mm', { locale: ru })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Информация о настройках */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-2">Настройки отслеживания</h5>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Радиус геозоны: 0.1 мили от центра склада</p>
              <p>• Интервал опроса GPS: 1 минута</p>
              <p>• Задержка подтверждения: 30 секунд</p>
              <p>• Автоматическое обновление статуса маршрута и заказов</p>
            </div>
          </div>
        </div>
      )}

      {!trackingState && !isTracking && (
        <div className="text-center py-8">
          <Navigation className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            GPS отслеживание не активно
          </h4>
          <p className="text-gray-600 mb-4">
            Нажмите "Начать отслеживание" для автоматического мониторинга прогресса маршрута
          </p>
        </div>
      )}
    </div>
  );
};

export default RouteGPSTracking;
