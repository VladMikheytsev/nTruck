import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { Trak4GPSService, VehicleGPSData } from '../services/trak4GPSService';
import { isWithinRadius, GPSPosition } from '../utils/distanceCalculator';
import { Warehouse, TransferRequest } from '../types';

export interface DriverGPSStatus {
  isWithinWarehouseRadius: boolean;
  distanceToWarehouse: number;
  gpsData: VehicleGPSData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

/**
 * Хук для проверки GPS статуса водителя относительно склада отправителя заявки
 */
export function useDriverGPSStatus(
  transferRequest: TransferRequest | null,
  refreshInterval: number = 30000 // 30 секунд по умолчанию
): DriverGPSStatus {
  const { state } = useAppContext();
  const [gpsData, setGpsData] = useState<VehicleGPSData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Получаем транспорт водителя
  const getDriverVehicle = useCallback(() => {
    if (!state.currentUser || state.currentUser.role !== 'driver') {
      return null;
    }

    // Ищем транспорт по разным полям
    const vehicle = state.vehicles.find(vehicle => {
      const driverFullName = `${state.currentUser?.firstName} ${state.currentUser?.lastName}`;
      return vehicle.driverId === state.currentUser?.id || 
             vehicle.assignedDriver === state.currentUser?.id ||
             vehicle.assignedDriver === driverFullName;
    });

    console.log('🔍 Поиск транспорта для водителя:', {
      driverId: state.currentUser?.id,
      driverName: `${state.currentUser?.firstName} ${state.currentUser?.lastName}`,
      vehiclesCount: state.vehicles.length,
      foundVehicle: vehicle ? vehicle.name : 'НЕ НАЙДЕН',
      vehicleGPS: vehicle ? {
        hasApiKey: !!vehicle.gpsApiKey,
        hasDeviceId: !!vehicle.gpsDeviceId,
        hasTrak4DeviceId: !!vehicle.trak4DeviceId
      } : null
    });

    return vehicle;
  }, [state.currentUser, state.vehicles]);

  // Получаем склад отправителя
  const getSourceWarehouse = useCallback(() => {
    if (!transferRequest) return null;
    return state.warehouses.find(w => w.id === transferRequest.sourceWarehouse);
  }, [transferRequest, state.warehouses]);

  // Получаем склад получателя
  const getDestinationWarehouse = useCallback(() => {
    if (!transferRequest) return null;
    return state.warehouses.find(w => w.id === transferRequest.destinationWarehouse);
  }, [transferRequest, state.warehouses]);

  // Проверяем GPS статус
  const checkGPSStatus = useCallback(async () => {
    const vehicle = getDriverVehicle();
    
    // Для заявок в статусе "получено водителем" проверяем склад получателя
    // Для остальных - склад отправителя
    const warehouse = transferRequest?.status === 'received_by_driver' 
      ? getDestinationWarehouse() 
      : getSourceWarehouse();

    console.log('🔍 Проверка GPS статуса:', {
      hasVehicle: !!vehicle,
      hasWarehouse: !!warehouse,
      hasWarehouseCoords: !!warehouse?.coordinates,
      vehicleName: vehicle?.name,
      warehouseName: warehouse?.name,
      requestStatus: transferRequest?.status,
      checkingDestination: transferRequest?.status === 'received_by_driver'
    });

    if (!vehicle) {
      setError('Транспорт не назначен водителю');
      return;
    }

    if (!warehouse) {
      setError(transferRequest?.status === 'received_by_driver' 
        ? 'Склад получателя не найден' 
        : 'Склад отправителя не найден');
      return;
    }

    if (!warehouse.coordinates) {
      setError(transferRequest?.status === 'received_by_driver'
        ? 'Координаты склада получателя не настроены'
        : 'Координаты склада отправителя не настроены');
      return;
    }

    if (!vehicle.gpsApiKey) {
      setError('GPS API ключ не настроен в транспорте');
      return;
    }

    if (!vehicle.gpsDeviceId && !vehicle.trak4DeviceId) {
      setError('GPS Device ID не настроен в транспорте');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const deviceId = vehicle.gpsDeviceId || vehicle.trak4DeviceId;
      console.log('📡 Запрос GPS данных:', {
        vehicleId: vehicle.id,
        deviceId: deviceId,
        hasApiKey: !!vehicle.gpsApiKey
      });

      const gpsData = await Trak4GPSService.getDeviceByIdWithKey(
        vehicle.id,
        vehicle.gpsApiKey,
        parseInt(String(deviceId)),
        false // Используем кэш
      );

      if (!gpsData) {
        setError('GPS данные недоступны от Trak-4 API');
        return;
      }

      console.log('✅ GPS данные получены:', {
        position: gpsData.position,
        status: gpsData.status
      });

      setGpsData(gpsData);
      setLastUpdate(new Date());

    } catch (err) {
      console.error('❌ Ошибка получения GPS данных:', err);
      setError(`Ошибка GPS: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsLoading(false);
    }
  }, [getDriverVehicle, getSourceWarehouse, getDestinationWarehouse, transferRequest]);

  // Проверяем, находится ли водитель в радиусе склада
  const isWithinWarehouseRadius = useCallback(() => {
    if (!gpsData) {
      return false;
    }

    // Для заявок в статусе "получено водителем" проверяем склад получателя
    // Для остальных - склад отправителя
    const warehouse = transferRequest?.status === 'received_by_driver' 
      ? getDestinationWarehouse() 
      : getSourceWarehouse();

    if (!warehouse?.coordinates) {
      return false;
    }

    const driverPosition: GPSPosition = {
      latitude: gpsData.position.latitude,
      longitude: gpsData.position.longitude
    };

    const warehousePosition: GPSPosition = {
      latitude: warehouse.coordinates.lat,
      longitude: warehouse.coordinates.lng
    };

    return isWithinRadius(driverPosition, warehousePosition, 0.1);
  }, [gpsData, transferRequest, getSourceWarehouse, getDestinationWarehouse]);

  // Вычисляем расстояние до склада
  const distanceToWarehouse = useCallback(() => {
    if (!gpsData) {
      return Infinity;
    }

    // Для заявок в статусе "получено водителем" проверяем склад получателя
    // Для остальных - склад отправителя
    const warehouse = transferRequest?.status === 'received_by_driver' 
      ? getDestinationWarehouse() 
      : getSourceWarehouse();

    if (!warehouse?.coordinates) {
      return Infinity;
    }

    const driverPosition: GPSPosition = {
      latitude: gpsData.position.latitude,
      longitude: gpsData.position.longitude
    };

    const warehousePosition: GPSPosition = {
      latitude: warehouse.coordinates.lat,
      longitude: warehouse.coordinates.lng
    };

    const distance = Math.sqrt(
      Math.pow(driverPosition.latitude - warehousePosition.latitude, 2) +
      Math.pow(driverPosition.longitude - warehousePosition.longitude, 2)
    ) * 69; // Примерное преобразование в мили

    return distance;
  }, [gpsData, transferRequest, getSourceWarehouse, getDestinationWarehouse]);

  // Автоматическое обновление GPS данных
  useEffect(() => {
    if (!transferRequest || state.currentUser?.role !== 'driver') {
      return;
    }

    // Первоначальная проверка
    checkGPSStatus();

    // Устанавливаем интервал обновления
    const interval = setInterval(checkGPSStatus, refreshInterval);

    return () => clearInterval(interval);
  }, [transferRequest, state.currentUser, checkGPSStatus, refreshInterval]);

  return {
    isWithinWarehouseRadius: isWithinWarehouseRadius(),
    distanceToWarehouse: distanceToWarehouse(),
    gpsData,
    isLoading,
    error,
    lastUpdate
  };
}
