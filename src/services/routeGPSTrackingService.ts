// Сервис для автоматического отслеживания прогресса маршрута на основе GPS данных
import { GPSTrackingService, VehicleGPSData } from './gpsTrackingService';
import { Route, RouteStop, Warehouse, User, Vehicle } from '../types';

export interface RouteProgressState {
  routeId: string;
  driverId: string;
  currentStopIndex: number;
  currentStopId: string;
  status: 'not_started' | 'in_transit' | 'at_stop' | 'completed';
  lastGPSUpdate: string;
  lastPosition: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
  confirmationPending?: {
    type: 'arrival' | 'departure';
    stopId: string;
    firstCheckTime: string;
    position: {
      latitude: number;
      longitude: number;
    };
  };
  stopTimes: {
    [stopId: string]: {
      arrivalTime?: string;
      departureTime?: string;
    };
  };
}

export interface GeofenceCheck {
  isInside: boolean;
  distance: number; // в милях
  stopId: string;
  stopName: string;
}

export class RouteGPSTrackingService {
  private static readonly GEOFENCE_RADIUS_MILES = 0.1; // 0.1 мили радиус
  private static readonly CONFIRMATION_DELAY_MS = 30000; // 30 секунд задержка для подтверждения
  private static readonly GPS_POLL_INTERVAL_MS = 60000; // 1 минута интервал опроса
  
  private static activeTracking = new Map<string, RouteProgressState>();
  private static trackingIntervals = new Map<string, NodeJS.Timeout>();
  private static confirmationTimeouts = new Map<string, NodeJS.Timeout>();

  // Запуск отслеживания маршрута для водителя
  static startRouteTracking(
    route: Route,
    driver: User,
    warehouses: Warehouse[]
  ): void {
    const trackingKey = `${route.id}-${driver.id}`;
    
    console.log('🚛 Starting GPS route tracking for:', {
      route: route.name,
      driver: `${driver.firstName} ${driver.lastName}`,
      stops: route.stops.length
    });

    // Инициализируем состояние отслеживания
    const initialState: RouteProgressState = {
      routeId: route.id,
      driverId: driver.id,
      currentStopIndex: 0,
      currentStopId: route.stops[0].warehouseId,
      status: 'not_started',
      lastGPSUpdate: new Date().toISOString(),
      lastPosition: {
        latitude: 0,
        longitude: 0,
        timestamp: new Date().toISOString()
      },
      stopTimes: {}
    };

    this.activeTracking.set(trackingKey, initialState);

    // Запускаем периодический опрос GPS
    const interval = setInterval(() => {
      this.pollGPSAndUpdateProgress(route, driver, warehouses);
    }, this.GPS_POLL_INTERVAL_MS);

    this.trackingIntervals.set(trackingKey, interval);

    // Делаем первый опрос сразу
    this.pollGPSAndUpdateProgress(route, driver, warehouses);
  }

  // Остановка отслеживания маршрута
  static stopRouteTracking(routeId: string, driverId: string): void {
    const trackingKey = `${routeId}-${driverId}`;
    
    // Очищаем интервал
    const interval = this.trackingIntervals.get(trackingKey);
    if (interval) {
      clearInterval(interval);
      this.trackingIntervals.delete(trackingKey);
    }

    // Очищаем таймаут подтверждения
    const timeout = this.confirmationTimeouts.get(trackingKey);
    if (timeout) {
      clearTimeout(timeout);
      this.confirmationTimeouts.delete(trackingKey);
    }

    // Удаляем состояние
    this.activeTracking.delete(trackingKey);

    console.log('🛑 Stopped GPS route tracking for:', trackingKey);
  }

  // Основной метод опроса GPS и обновления прогресса
  private static async pollGPSAndUpdateProgress(
    route: Route,
    driver: User,
    warehouses: Warehouse[]
  ): Promise<void> {
    const trackingKey = `${route.id}-${driver.id}`;
    const state = this.activeTracking.get(trackingKey);
    
    if (!state) {
      console.warn('⚠️ No tracking state found for:', trackingKey);
      return;
    }

    try {
      // Получаем текущие GPS данные водителя
      const vehicle = await this.getDriverVehicle(driver.id);
      if (!vehicle) {
        console.warn('⚠️ No vehicle found for driver:', driver.id);
        return;
      }

      const gpsData = await GPSTrackingService.getDeviceByIdWithKey(
        vehicle.id,
        vehicle.gpsApiKey,
        vehicle.trak4DeviceId || vehicle.gpsDeviceId,
        false // Используем кэш если доступен
      );

      if (!gpsData) {
        console.warn('⚠️ No GPS data received for driver:', driver.id);
        return;
      }

      console.log('📡 GPS data received for route tracking:', {
        driver: `${driver.firstName} ${driver.lastName}`,
        position: {
          lat: gpsData.position.latitude,
          lng: gpsData.position.longitude
        },
        currentStop: state.currentStopIndex,
        status: state.status
      });

      // Обновляем последнюю позицию
      state.lastPosition = {
        latitude: gpsData.position.latitude,
        longitude: gpsData.position.longitude,
        timestamp: gpsData.position.timestamp
      };
      state.lastGPSUpdate = new Date().toISOString();

      // Проверяем геозоны и обновляем прогресс
      await this.processGPSUpdate(state, route, warehouses, gpsData);

    } catch (error) {
      console.error('❌ Error in GPS polling:', error);
    }
  }

  // Обработка обновления GPS данных
  private static async processGPSUpdate(
    state: RouteProgressState,
    route: Route,
    warehouses: Warehouse[],
    gpsData: VehicleGPSData
  ): Promise<void> {
    const currentStop = route.stops[state.currentStopIndex];
    const currentWarehouse = warehouses.find(w => w.id === currentStop.warehouseId);
    
    if (!currentWarehouse) {
      console.warn('⚠️ Current warehouse not found:', currentStop.warehouseId);
      return;
    }

    // Проверяем, находится ли водитель в геозоне текущего склада
    const geofenceCheck = this.checkGeofence(
      gpsData.position.latitude,
      gpsData.position.longitude,
      currentWarehouse,
      currentStop.warehouseId
    );

    console.log('🎯 Geofence check result:', {
      stopName: geofenceCheck.stopName,
      isInside: geofenceCheck.isInside,
      distance: geofenceCheck.distance.toFixed(3) + ' miles',
      status: state.status
    });

    // Если есть ожидающее подтверждение, обрабатываем его
    if (state.confirmationPending) {
      await this.handleConfirmationCheck(state, route, warehouses, gpsData, geofenceCheck);
      return;
    }

    // Обрабатываем состояния маршрута
    switch (state.status) {
      case 'not_started':
        await this.handleNotStartedState(state, route, warehouses, geofenceCheck);
        break;
        
      case 'at_stop':
        await this.handleAtStopState(state, route, warehouses, geofenceCheck, gpsData);
        break;
        
      case 'in_transit':
        await this.handleInTransitState(state, route, warehouses, geofenceCheck, gpsData);
        break;
    }

    // Сохраняем обновленное состояние
    this.saveTrackingState(state);
  }

  // Обработка состояния "не начат"
  private static async handleNotStartedState(
    state: RouteProgressState,
    route: Route,
    warehouses: Warehouse[],
    geofenceCheck: GeofenceCheck
  ): Promise<void> {
    if (geofenceCheck.isInside) {
      // Водитель находится на первом складе - фиксируем arrival
      console.log('✅ Driver is at first stop:', geofenceCheck.stopName);
      
      state.stopTimes[state.currentStopId] = {
        arrivalTime: new Date().toISOString()
      };
      state.status = 'at_stop';
      
      this.notifyStopArrival(state, route, geofenceCheck.stopName);
    } else {
      // Водитель за пределами первого склада - НО нужно подтверждение!
      // Начинаем процедуру подтверждения отъезда
      console.log('⚠️ Driver appears to be outside first stop, starting departure confirmation...');
      
      state.confirmationPending = {
        type: 'departure',
        stopId: state.currentStopId,
        firstCheckTime: new Date().toISOString(),
        position: {
          latitude: state.lastPosition.latitude,
          longitude: state.lastPosition.longitude
        }
      };

      // Устанавливаем таймаут для повторной проверки через 30 секунд
      const trackingKey = `${state.routeId}-${state.driverId}`;
      const timeout = setTimeout(() => {
        this.confirmationTimeouts.delete(trackingKey);
        // Повторная проверка будет выполнена при следующем опросе GPS
      }, this.CONFIRMATION_DELAY_MS);
      
      this.confirmationTimeouts.set(trackingKey, timeout);
    }
  }

  // Обработка состояния "на остановке"
  private static async handleAtStopState(
    state: RouteProgressState,
    route: Route,
    warehouses: Warehouse[],
    geofenceCheck: GeofenceCheck,
    gpsData: VehicleGPSData
  ): Promise<void> {
    if (!geofenceCheck.isInside) {
      // Водитель покинул геозону - начинаем подтверждение departure
      console.log('🚪 Driver left geofence, starting departure confirmation...');
      
      state.confirmationPending = {
        type: 'departure',
        stopId: state.currentStopId,
        firstCheckTime: new Date().toISOString(),
        position: {
          latitude: gpsData.position.latitude,
          longitude: gpsData.position.longitude
        }
      };

      // Устанавливаем таймаут для повторной проверки через 30 секунд
      const trackingKey = `${state.routeId}-${state.driverId}`;
      const timeout = setTimeout(() => {
        this.confirmationTimeouts.delete(trackingKey);
        // Повторная проверка будет выполнена при следующем опросе GPS
      }, this.CONFIRMATION_DELAY_MS);
      
      this.confirmationTimeouts.set(trackingKey, timeout);
    }
  }

  // Обработка состояния "в пути"
  private static async handleInTransitState(
    state: RouteProgressState,
    route: Route,
    warehouses: Warehouse[],
    geofenceCheck: GeofenceCheck,
    gpsData: VehicleGPSData
  ): Promise<void> {
    if (geofenceCheck.isInside) {
      // Водитель прибыл на склад - начинаем подтверждение arrival
      console.log('🎯 Driver entered geofence, starting arrival confirmation...');
      
      state.confirmationPending = {
        type: 'arrival',
        stopId: state.currentStopId,
        firstCheckTime: new Date().toISOString(),
        position: {
          latitude: gpsData.position.latitude,
          longitude: gpsData.position.longitude
        }
      };

      // Устанавливаем таймаут для повторной проверки через 30 секунд
      const trackingKey = `${state.routeId}-${state.driverId}`;
      const timeout = setTimeout(() => {
        this.confirmationTimeouts.delete(trackingKey);
        // Повторная проверка будет выполнена при следующем опросе GPS
      }, this.CONFIRMATION_DELAY_MS);
      
      this.confirmationTimeouts.set(trackingKey, timeout);
    }
  }

  // Обработка подтверждения arrival/departure
  private static async handleConfirmationCheck(
    state: RouteProgressState,
    route: Route,
    warehouses: Warehouse[],
    gpsData: VehicleGPSData,
    geofenceCheck: GeofenceCheck
  ): Promise<void> {
    const confirmation = state.confirmationPending!;
    const timeSinceFirstCheck = Date.now() - new Date(confirmation.firstCheckTime).getTime();
    
    if (timeSinceFirstCheck < this.CONFIRMATION_DELAY_MS) {
      // Еще не прошло 30 секунд
      return;
    }

    console.log('⏰ Processing confirmation after 30 seconds:', {
      type: confirmation.type,
      isInside: geofenceCheck.isInside
    });

    if (confirmation.type === 'departure') {
      if (!geofenceCheck.isInside) {
        // Подтверждено: водитель действительно покинул склад
        console.log('✅ Departure confirmed for stop:', geofenceCheck.stopName);
        
        state.stopTimes[state.currentStopId] = {
          ...state.stopTimes[state.currentStopId],
          departureTime: confirmation.firstCheckTime
        };
        
        state.status = 'in_transit';
        
        // Если это было начальное состояние (не начат), переходим к следующей остановке
        if (state.currentStopIndex === 0 && !state.stopTimes[state.currentStopId]?.arrivalTime) {
          // Это начальный отъезд - водитель уже был за пределами первого склада
          console.log('🚀 Initial departure confirmed - driver started route from outside first stop');
        }
        
        this.moveToNextStop(state, route);
        this.notifyStopDeparture(state, route, geofenceCheck.stopName);
        
      } else {
        // Ложная тревога: водитель вернулся в геозону
        console.log('❌ False departure alarm - driver returned to geofence');
        
        // Если это было начальное состояние, устанавливаем статус "на остановке"
        if (state.status === 'not_started') {
          console.log('🏪 Driver is actually at first stop - setting arrival time');
          state.stopTimes[state.currentStopId] = {
            arrivalTime: new Date().toISOString()
          };
          state.status = 'at_stop';
          this.notifyStopArrival(state, route, geofenceCheck.stopName);
        }
      }
    } else if (confirmation.type === 'arrival') {
      if (geofenceCheck.isInside) {
        // Подтверждено: водитель действительно прибыл на склад
        console.log('✅ Arrival confirmed for stop:', geofenceCheck.stopName);
        
        state.stopTimes[state.currentStopId] = {
          ...state.stopTimes[state.currentStopId],
          arrivalTime: confirmation.firstCheckTime
        };
        
        state.status = 'at_stop';
        this.notifyStopArrival(state, route, geofenceCheck.stopName);
        
      } else {
        // Ложная тревога: водитель покинул геозону
        console.log('❌ False arrival alarm - driver left geofence');
      }
    }

    // Очищаем ожидающее подтверждение
    state.confirmationPending = undefined;
    
    // Очищаем таймаут
    const trackingKey = `${state.routeId}-${state.driverId}`;
    const timeout = this.confirmationTimeouts.get(trackingKey);
    if (timeout) {
      clearTimeout(timeout);
      this.confirmationTimeouts.delete(trackingKey);
    }
  }

  // Переход к следующей остановке
  private static moveToNextStop(state: RouteProgressState, route: Route): void {
    state.currentStopIndex++;
    
    if (state.currentStopIndex >= route.stops.length) {
      // Маршрут завершен
      state.status = 'completed';
      state.currentStopId = '';
      
      console.log('🏁 Route completed!');
      this.notifyRouteCompleted(state, route);
      
      // Останавливаем отслеживание
      this.stopRouteTracking(state.routeId, state.driverId);
      
    } else {
      // Переходим к следующей остановке
      const nextStop = route.stops[state.currentStopIndex];
      state.currentStopId = nextStop.warehouseId;
      
      console.log('➡️ Moving to next stop:', {
        stopIndex: state.currentStopIndex,
        stopId: state.currentStopId
      });
    }
  }

  // Проверка геозоны (находится ли точка в радиусе 0.1 мили от склада)
  private static checkGeofence(
    lat: number,
    lng: number,
    warehouse: Warehouse,
    stopId: string
  ): GeofenceCheck {
    const warehouseLat = warehouse.coordinates?.lat || warehouse.latitude || 0;
    const warehouseLng = warehouse.coordinates?.lng || warehouse.longitude || 0;
    
    const distance = this.calculateDistance(lat, lng, warehouseLat, warehouseLng);
    const isInside = distance <= this.GEOFENCE_RADIUS_MILES;
    
    return {
      isInside,
      distance,
      stopId,
      stopName: warehouse.name
    };
  }

  // Вычисление расстояния между двумя точками в милях
  private static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 3959; // Радиус Земли в милях
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Получение автомобиля водителя
  private static async getDriverVehicle(driverId: string): Promise<Vehicle | null> {
    try {
      // Получаем данные из localStorage
      const appDataStr = localStorage.getItem('ntruck_app_data');
      if (!appDataStr) return null;
      
      const appData = JSON.parse(appDataStr);
      if (!appData.vehicles) return null;
      
      // Ищем автомобиль, назначенный водителю
      const vehicle = appData.vehicles.find((v: Vehicle) => v.driverId === driverId);
      
      if (vehicle) {
        return vehicle;
      }
      
      // Если автомобиль не найден, возвращаем автомобиль 001 как fallback
      const vehicle001 = appData.vehicles.find((v: Vehicle) => v.id === 'vehicle-001');
      if (vehicle001) {
        return vehicle001;
      }
      
      // Последний fallback - создаем временный автомобиль
      return {
        id: 'vehicle-001',
        name: 'Автомобиль 001',
        gpsApiKey: 'Xx7MWwsUEOBjRVr7NfDQc9PEBiEN1qna',
        trak4DeviceId: 153332,
        gpsDeviceId: 153332,
        status: 'available',
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting driver vehicle:', error);
      return null;
    }
  }

  // Уведомления о событиях
  private static notifyStopArrival(state: RouteProgressState, route: Route, stopName: string): void {
    console.log('📍 ARRIVAL NOTIFICATION:', {
      route: route.name,
      stop: stopName,
      time: new Date().toLocaleString()
    });
    
    // Здесь можно добавить отправку уведомлений, обновление UI и т.д.
  }

  private static notifyStopDeparture(state: RouteProgressState, route: Route, stopName: string): void {
    console.log('🚀 DEPARTURE NOTIFICATION:', {
      route: route.name,
      stop: stopName,
      time: new Date().toLocaleString()
    });
    
    // Здесь можно добавить отправку уведомлений, обновление UI и т.д.
  }

  private static notifyRouteCompleted(state: RouteProgressState, route: Route): void {
    console.log('🏁 ROUTE COMPLETED NOTIFICATION:', {
      route: route.name,
      time: new Date().toLocaleString()
    });
    
    // Здесь можно добавить обновление статуса маршрута и заказа
  }

  // Сохранение состояния отслеживания
  private static saveTrackingState(state: RouteProgressState): void {
    const trackingKey = `${state.routeId}-${state.driverId}`;
    this.activeTracking.set(trackingKey, state);
    
    // Также можно сохранять в localStorage для персистентности
    try {
      const allStates = Array.from(this.activeTracking.entries());
      localStorage.setItem('route_gps_tracking_states', JSON.stringify(allStates));
    } catch (error) {
      console.warn('⚠️ Could not save tracking state to localStorage:', error);
    }
  }

  // Загрузка состояния отслеживания
  static loadTrackingStates(): void {
    try {
      const saved = localStorage.getItem('route_gps_tracking_states');
      if (saved) {
        const allStates = JSON.parse(saved);
        this.activeTracking = new Map(allStates);
        console.log('📂 Loaded tracking states:', this.activeTracking.size);
      }
    } catch (error) {
      console.warn('⚠️ Could not load tracking states from localStorage:', error);
    }
  }

  // Получение текущего состояния отслеживания
  static getTrackingState(routeId: string, driverId: string): RouteProgressState | null {
    const trackingKey = `${routeId}-${driverId}`;
    return this.activeTracking.get(trackingKey) || null;
  }

  // Получение всех активных отслеживаний
  static getAllActiveTracking(): RouteProgressState[] {
    return Array.from(this.activeTracking.values());
  }
}
