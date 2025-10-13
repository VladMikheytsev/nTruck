import { Trak4GPSService, VehicleGPSData } from './trak4GPSService';

// Интерфейсы для отслеживания фактического маршрута
export interface WarehouseStatus {
  warehouseId: string;
  status: 0 | 1 | 2 | 3 | 4; // 0-не начат, 1-приезд, 2-ожидание, 3-выезд, 4-завершен
  arrivalTime?: string; // Фактическое время прибытия
  departureTime?: string; // Фактическое время выезда
}

export interface ActualRouteProgress {
  routeId: string;
  driverId: string;
  vehicleId: string;
  date: string; // YYYY-MM-DD
  warehouseStatuses: WarehouseStatus[];
  createdAt: string;
  lastUpdate: string;
}

export interface GPSLogEntry {
  timestamp: string;
  vehicleId: string;
  routeId: string;
  driverId: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  currentWarehouseId?: string;
  currentWarehouseStatus?: 0 | 1 | 2 | 3 | 4;
  isWithinGeofence: boolean;
  date: string;
}

export class ActualRouteTrackingService {
  private static readonly GEOFENCE_RADIUS_MILES = 0.1;
  private static readonly TRACKING_INTERVAL = 30000; // 30 seconds
  private static readonly DEFAULT_TRACKING_START_HOUR = 5; // 5 AM
  private static readonly DEFAULT_TRACKING_END_HOUR = 23; // 11 PM
  
  private static activeIntervals: Map<string, number> = new Map();
  private static routeProgresses: Map<string, ActualRouteProgress> = new Map();


  /**
   * Сохраняет настройки рабочего времени в localStorage
   */
  public static setTrackingTimeSettings(startHour: number, endHour: number): void {
    try {
      if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
        throw new Error('Часы должны быть в диапазоне 0-23');
      }
      
      if (startHour >= endHour) {
        throw new Error('Время начала должно быть меньше времени окончания');
      }

      const settings = { startHour, endHour };
      localStorage.setItem('tracking_time_settings', JSON.stringify(settings));
      
      console.log(`⚙️ Обновлены настройки рабочего времени: ${startHour}:00-${endHour}:00`);
      
      // Перезапускаем отслеживание с новыми настройками если оно было активно
      if (this.isTrackingActive()) {
        console.log('🔄 Перезапуск отслеживания с новыми настройками времени');
        this.stopAllTracking();
        setTimeout(() => {
          this.startTrackingAllRoutes();
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Ошибка сохранения настроек времени:', error);
      throw error;
    }
  }

  /**
   * Получает текущие настройки рабочего времени (публичный метод)
   */
  public static getTrackingTimeSettings(): { startHour: number; endHour: number } {
    return this.getTrackingTimeSettingsInternal();
  }

  /**
   * Внутренний метод для получения настроек времени
   */
  private static getTrackingTimeSettingsInternal(): { startHour: number; endHour: number } {
    try {
      const settings = localStorage.getItem('tracking_time_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        return {
          startHour: parsed.startHour || this.DEFAULT_TRACKING_START_HOUR,
          endHour: parsed.endHour || this.DEFAULT_TRACKING_END_HOUR,
        };
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки настроек времени отслеживания:', error);
    }
    
    return {
      startHour: this.DEFAULT_TRACKING_START_HOUR,
      endHour: this.DEFAULT_TRACKING_END_HOUR,
    };
  }

  /**
   * Вычисляет расстояние между двумя точками в милях
   */
  private static calculateDistanceInMiles(
    lat1: number, 
    lng1: number, 
    lat2: number, 
    lng2: number
  ): number {
    const R = 3959; // Радиус Земли в милях
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  /**
   * Проверяет, находится ли транспорт в пределах геофенса склада
   */
  private static isWithinGeofence(
    vehicleCoords: { latitude: number; longitude: number },
    warehouseCoords: { lat: number; lng: number }
  ): boolean {
    const distance = this.calculateDistanceInMiles(
      vehicleCoords.latitude,
      vehicleCoords.longitude,
      warehouseCoords.lat,
      warehouseCoords.lng
    );
    
    return distance <= this.GEOFENCE_RADIUS_MILES;
  }

  /**
   * Проверяет, находится ли текущее время в рамках отслеживания и это сегодняшний день
   */
  private static isTrackingTime(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const settings = this.getTrackingTimeSettingsInternal();
    
    // Проверяем что это сегодняшний день и рабочее время
    return hour >= settings.startHour && hour <= settings.endHour;
  }

  /**
   * Проверяет, является ли дата сегодняшней
   */
  private static isToday(date: string): boolean {
    return date === this.getCurrentDate();
  }

  /**
   * Получает текущий день в формате YYYY-MM-DD
   */
  private static getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Загружает прогресс маршрута с готовыми данными маршрута
   */
  private static loadRouteProgressWithData(route: any, driverId: string, vehicleId: string): ActualRouteProgress {
    const today = this.getCurrentDate();
    const key = `actual_route_${route.id}_${driverId}_${today}`;
    
    // Проверяем существующий прогресс
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        console.log(`📋 Загружен существующий прогресс для маршрута: ${route.name}`);
        return JSON.parse(stored);
      } catch (error) {
        console.error('❌ Ошибка загрузки прогресса маршрута:', error);
      }
    }

    // Создаем новый прогресс маршрута с готовыми данными
    console.log(`📝 Создание нового прогресса для маршрута: ${route.name} (${route.id})`);
    
    if (!route.stops || route.stops.length === 0) {
      throw new Error(`Маршрут ${route.name} не имеет остановок`);
    }

    const warehouseStatuses: WarehouseStatus[] = route.stops
      .sort((a: any, b: any) => a.order - b.order)
      .map((stop: any, index: number) => ({
        warehouseId: stop.warehouseId,
        status: index === 0 ? 1 : 0, // Первый склад имеет статус 1 (приезд), остальные 0
      }));

    const newProgress: ActualRouteProgress = {
      routeId: route.id,
      driverId,
      vehicleId,
      date: today,
      warehouseStatuses,
      createdAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };

    this.saveRouteProgress(newProgress);
    console.log(`✅ Создан прогресс маршрута: ${route.name}, складов: ${warehouseStatuses.length}, первый статус: ${warehouseStatuses[0]?.status}`);
    
    return newProgress;
  }

  /**
   * УСТАРЕВШИЙ: Загружает прогресс маршрута из localStorage или создает новый (только для сегодняшнего дня)
   */
  private static loadRouteProgress(routeId: string, driverId: string, vehicleId: string): ActualRouteProgress {
    const today = this.getCurrentDate();
    
    // Отслеживание возможно только для сегодняшнего дня
    if (!this.isToday(today)) {
      throw new Error(`Отслеживание возможно только для текущего дня. Текущая дата: ${today}`);
    }
    
    const key = `actual_route_${routeId}_${driverId}_${today}`;
    
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('❌ Ошибка загрузки прогресса маршрута:', error);
      }
    }

    // Создаем новый прогресс маршрута
    const routes = JSON.parse(localStorage.getItem('routes') || '[]');
    const route = routes.find((r: any) => r.id === routeId);
    
    if (!route) {
      throw new Error(`Маршрут не найден: ${routeId}`);
    }

    const warehouseStatuses: WarehouseStatus[] = route.stops
      .sort((a: any, b: any) => a.order - b.order)
      .map((stop: any, index: number) => ({
        warehouseId: stop.warehouseId,
        status: index === 0 ? 1 : 0, // Первый склад имеет статус 1 (приезд), остальные 0
      }));

    const newProgress: ActualRouteProgress = {
      routeId,
      driverId,
      vehicleId,
      date: today,
      warehouseStatuses,
      createdAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };

    this.saveRouteProgress(newProgress);
    return newProgress;
  }

  /**
   * Сохраняет прогресс маршрута в localStorage
   */
  private static saveRouteProgress(progress: ActualRouteProgress): void {
    const key = `actual_route_${progress.routeId}_${progress.driverId}_${progress.date}`;
    progress.lastUpdate = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(progress));
    this.routeProgresses.set(key, progress);
  }

  /**
   * Логирует GPS данные в JSON файл
   */
  private static logGPSData(
    vehicleId: string,
    routeId: string,
    driverId: string,
    coordinates: { latitude: number; longitude: number },
    currentWarehouseId?: string,
    currentWarehouseStatus?: 0 | 1 | 2 | 3 | 4,
    isWithinGeofence: boolean = false
  ): void {
    const logEntry: GPSLogEntry = {
      timestamp: new Date().toISOString(),
      vehicleId,
      routeId,
      driverId,
      coordinates,
      currentWarehouseId,
      currentWarehouseStatus,
      isWithinGeofence,
      date: this.getCurrentDate(),
    };

    // Получаем существующие логи
    const existingLogs = JSON.parse(localStorage.getItem('gps_tracking_logs') || '[]');
    existingLogs.push(logEntry);

    // Ограничиваем количество логов (последние 1000 записей)
    if (existingLogs.length > 1000) {
      existingLogs.splice(0, existingLogs.length - 1000);
    }

    localStorage.setItem('gps_tracking_logs', JSON.stringify(existingLogs));
    console.log('📝 GPS лог записан:', logEntry);
  }

  /**
   * Находит текущий склад в маршруте на основе статусов
   */
  private static findCurrentWarehouse(warehouseStatuses: WarehouseStatus[]): WarehouseStatus | null {
    // Ищем склад со статусом 1 (приезд)
    let current = warehouseStatuses.find(ws => ws.status === 1);
    if (current) return current;

    // Ищем склад со статусом 2 (ожидание)
    current = warehouseStatuses.find(ws => ws.status === 2);
    if (current) return current;

    // Ищем склад со статусом 3 (выезд)
    current = warehouseStatuses.find(ws => ws.status === 3);
    if (current) return current;

    return null; // Нет текущего склада
  }

  /**
   * Обрабатывает GPS данные для маршрута с готовыми данными
   */
  private static async processRouteGPSWithData(
    route: any,
    driverId: string,
    vehicle: any,
    warehouses: any[]
  ): Promise<void> {
    try {
      const today = this.getCurrentDate();
      
      if (!this.isToday(today)) {
        console.warn(`⚠️ Отслеживание возможно только для текущего дня. Пропускаем маршрут: ${route.name}`);
        return;
      }
      
      // Загружаем или создаем прогресс маршрута с готовыми данными
      const progress = this.loadRouteProgressWithData(route, driverId, vehicle.id);
      const currentWarehouse = this.findCurrentWarehouse(progress.warehouseStatuses);

      if (!currentWarehouse) {
        console.log(`ℹ️ Нет текущего склада для маршрута: ${route.name}`);
        return;
      }

      // Находим данные текущего склада
      const warehouse = warehouses.find(w => w.id === currentWarehouse.warehouseId);
      if (!warehouse || !warehouse.coordinates) {
        console.warn(`⚠️ Склад не найден или нет координат: ${currentWarehouse.warehouseId}`);
        return;
      }

      // Используем переданные данные транспорта (не ищем в localStorage)
      console.log(`📡 Обработка GPS для транспорта: ${vehicle.name} (ID: ${vehicle.id})`);

      if (!vehicle.trak4DeviceId && !vehicle.gpsDeviceId) {
        console.warn(`⚠️ Нет GPS устройства для транспорта: ${vehicle.name} (ID: ${vehicle.id})`);
        console.warn(`   Необходимо добавить в карточку транспорта:`);
        console.warn(`   • gpsApiKey: API ключ для 4-Trak`);
        console.warn(`   • trak4DeviceId: Device ID устройства`);
        console.warn(`   • gpsDeviceId: GPS Device ID (опционально)`);
        console.warn(`   Откройте "Транспорт" → Редактировать "${vehicle.name}" → Добавьте GPS данные`);
        return;
      }

      if (!vehicle.gpsApiKey) {
        console.warn(`⚠️ Нет GPS API Key для транспорта: ${vehicle.name} (ID: ${vehicle.id})`);
        console.warn(`   Добавьте gpsApiKey в карточку транспорта`);
        return;
      }

      const deviceId = vehicle.gpsDeviceId || vehicle.trak4DeviceId;
      const apiKey = vehicle.gpsApiKey || 'default-key';

      console.log(`📡 Загружаем GPS данные: deviceId=${deviceId}, apiKey=${apiKey.substring(0, 8)}...`);

      const gpsData = await Trak4GPSService.getDeviceByIdWithKey(
        vehicle.id,
        apiKey,
        parseInt(String(deviceId)),
        false // Используем кэширование
      );

      if (!gpsData || !gpsData.position) {
        console.warn(`⚠️ Нет GPS данных для транспорта: ${vehicle.name}`);
        return;
      }

      // Проверяем геофенс
      const isWithinGeofence = this.isWithinGeofence(
        gpsData.position,
        warehouse.coordinates
      );

      // Логируем GPS данные
      this.logGPSData(
        vehicle.id,
        route.id,
        driverId,
        gpsData.position,
        currentWarehouse.warehouseId,
        currentWarehouse.status,
        isWithinGeofence
      );

      // Обрабатываем статусы склада согласно ТЗ
      let statusChanged = false;
      const currentTime = new Date().toISOString();

      console.log(`🔍 Обработка склада: ${warehouse.name}, статус: ${currentWarehouse.status}, в геофенсе: ${isWithinGeofence}`);

      if (currentWarehouse.status === 1) {
        // Статус 1 (Приезд): Согласно ТЗ - если "Сценарий2" = true (ВНЕ геофенса) → arrival + статус 2
        if (!isWithinGeofence) {
          currentWarehouse.arrivalTime = currentTime;
          currentWarehouse.status = 2;
          statusChanged = true;
          console.log(`✅ [Статус 1→2] Зафиксировано прибытие на склад: ${warehouse.name} в ${currentTime}`);
        } else {
          console.log(`ℹ️ [Статус 1] Транспорт В геофенсе склада ${warehouse.name}, ожидаем согласно ТЗ`);
        }
      } else if (currentWarehouse.status === 2) {
        // Статус 2 (Ожидание): Согласно ТЗ - если "Сценарий1" = true (В геофенсе) → departure + статус 3  
        if (isWithinGeofence) {
          currentWarehouse.departureTime = currentTime;
          currentWarehouse.status = 3;
          statusChanged = true;
          console.log(`✅ [Статус 2→3] Зафиксировано начало выезда со склада: ${warehouse.name} в ${currentTime}`);
        } else {
          console.log(`ℹ️ [Статус 2] Транспорт ВНЕ геофенса склада ${warehouse.name}, ожидаем согласно ТЗ`);
        }
      } else if (currentWarehouse.status === 3) {
        // Статус 3 (Выезд): Если "Сценарий2" = true (транспорт ВНЕ геофенса)
        if (!isWithinGeofence) {
          currentWarehouse.departureTime = currentTime;
          currentWarehouse.status = 4;
          
          // Находим следующий склад и активируем его (статус 0 → статус 1)
          const currentIndex = progress.warehouseStatuses.findIndex(ws => ws.warehouseId === currentWarehouse.warehouseId);
          if (currentIndex !== -1 && currentIndex < progress.warehouseStatuses.length - 1) {
            const nextWarehouse = progress.warehouseStatuses[currentIndex + 1];
            nextWarehouse.status = 1;
            console.log(`✅ [Статус 3→4] Завершен склад: ${warehouse.name}, активирован следующий склад: ${nextWarehouse.warehouseId}`);
          } else {
            console.log(`✅ [Статус 3→4] Завершен последний склад маршрута: ${warehouse.name}`);
          }
          
          statusChanged = true;
          console.log(`✅ Завершен склад: ${warehouse.name} в ${currentTime}`);
        } else {
          console.log(`ℹ️ [Статус 3] Транспорт В геофенсе склада ${warehouse.name}, ожидаем выход за пределы для завершения`);
        }
      }

      // Сохраняем изменения если были
      if (statusChanged) {
        this.saveRouteProgress(progress);
        
        // Уведомляем об изменении статуса
        window.dispatchEvent(new CustomEvent('routeProgressChanged', {
          detail: { routeId: route.id, progress }
        }));
      }

    } catch (error) {
      console.error(`❌ Ошибка обработки GPS для маршрута ${route.name} (${route.id}):`, error);
    }
  }

  /**
   * Принудительно запускает отслеживание конкретного маршрута (игнорирует время)
   */
  public static startTrackingRouteForced(
    routeId: string,
    driverId: string,
    vehicleId: string,
    warehouses: any[]
  ): void {
    this.startTrackingRouteInternal(routeId, driverId, vehicleId, warehouses, true);
  }

  /**
   * УСТАРЕВШИЙ: Обрабатывает GPS данные для одного маршрута (только для сегодняшнего дня)
   */
  private static async processRouteGPS(
    routeId: string,
    driverId: string,
    vehicleId: string,
    warehouses: any[]
  ): Promise<void> {
    try {
      const today = this.getCurrentDate();
      
      // Проверяем, что обрабатываем только сегодняшний день
      if (!this.isToday(today)) {
        console.warn(`⚠️ Отслеживание возможно только для текущего дня. Пропускаем маршрут: ${routeId}`);
        return;
      }
      // Загружаем GPS данные транспорта
      const vehicles = JSON.parse(localStorage.getItem('vehicles') || '[]');
      const vehicle = vehicles.find((v: any) => v.id === vehicleId);
      
      if (!vehicle) {
        console.warn(`⚠️ Транспорт не найден: ${vehicleId}`);
        return;
      }

      if (!vehicle.trak4DeviceId && !vehicle.gpsDeviceId) {
        console.warn(`⚠️ Нет GPS устройства для транспорта: ${vehicle.name} (ID: ${vehicleId})`);
        console.warn(`   Необходимо добавить в карточку транспорта:`);
        console.warn(`   • gpsApiKey: API ключ для 4-Trak`);
        console.warn(`   • trak4DeviceId: Device ID устройства`);
        console.warn(`   • gpsDeviceId: GPS Device ID (опционально)`);
        console.warn(`   Откройте "Транспорт" → Редактировать "${vehicle.name}" → Добавьте GPS данные`);
        return;
      }

      if (!vehicle.gpsApiKey) {
        console.warn(`⚠️ Нет GPS API Key для транспорта: ${vehicle.name} (ID: ${vehicleId})`);
        console.warn(`   Добавьте gpsApiKey в карточку транспорта`);
        return;
      }

      const deviceId = vehicle.gpsDeviceId || vehicle.trak4DeviceId;
      const apiKey = vehicle.gpsApiKey || 'default-key';

      const gpsData = await Trak4GPSService.getDeviceByIdWithKey(
        vehicleId,
        apiKey,
        parseInt(String(deviceId)),
        false // Используем кэширование
      );

      if (!gpsData || !gpsData.position) {
        console.warn(`⚠️ Нет GPS данных для транспорта: ${vehicle.name}`);
        return;
      }

      // Загружаем или создаем прогресс маршрута
      const progress = this.loadRouteProgress(routeId, driverId, vehicleId);
      const currentWarehouse = this.findCurrentWarehouse(progress.warehouseStatuses);

      if (!currentWarehouse) {
        console.log(`ℹ️ Нет текущего склада для маршрута: ${routeId}`);
        return;
      }

      // Находим данные текущего склада
      const warehouse = warehouses.find(w => w.id === currentWarehouse.warehouseId);
      if (!warehouse || !warehouse.coordinates) {
        console.warn(`⚠️ Склад не найден или нет координат: ${currentWarehouse.warehouseId}`);
        return;
      }

      // Проверяем геофенс
      const isWithinGeofence = this.isWithinGeofence(
        gpsData.position,
        warehouse.coordinates
      );

      // Логируем GPS данные
      this.logGPSData(
        vehicleId,
        routeId,
        driverId,
        gpsData.position,
        currentWarehouse.warehouseId,
        currentWarehouse.status,
        isWithinGeofence
      );

      // Обрабатываем статусы склада согласно ТЗ
      let statusChanged = false;
      const currentTime = new Date().toISOString();

      console.log(`🔍 Обработка склада: ${warehouse.name}, статус: ${currentWarehouse.status}, в геофенсе: ${isWithinGeofence}`);

      if (currentWarehouse.status === 1) {
        // Статус 1 (Приезд): Согласно ТЗ - если "Сценарий2" = true (ВНЕ геофенса) → arrival + статус 2
        // ЛОГИКА ТЗ: Транспорт едет к складу, когда он оказывается ВНЕ геофенса - это означает что он УЖЕ ПРИБЫЛ
        if (!isWithinGeofence) { // Сценарий 2: ВНЕ геофенса = ПРИБЫЛ
          currentWarehouse.arrivalTime = currentTime;
          currentWarehouse.status = 2;
          statusChanged = true;
          console.log(`✅ [Статус 1→2] Зафиксировано прибытие на склад: ${warehouse.name} в ${currentTime} (ТЗ: транспорт ВНЕ геофенса = прибыл)`);
        } else {
          console.log(`ℹ️ [Статус 1] Транспорт В геофенсе склада ${warehouse.name}, ожидаем согласно ТЗ`);
        }
      } else if (currentWarehouse.status === 2) {
        // Статус 2 (Ожидание): Согласно ТЗ - если "Сценарий1" = true (В геофенсе) → departure + статус 3  
        // ЛОГИКА ТЗ: Транспорт на складе, когда он В геофенсе - начинает выезд
        if (isWithinGeofence) { // Сценарий 1: В геофенсе = НАЧИНАЕТ ВЫЕЗД
          currentWarehouse.departureTime = currentTime;
          currentWarehouse.status = 3;
          statusChanged = true;
          console.log(`✅ [Статус 2→3] Зафиксировано начало выезда со склада: ${warehouse.name} в ${currentTime} (ТЗ: транспорт В геофенсе = начинает выезд)`);
        } else {
          console.log(`ℹ️ [Статус 2] Транспорт ВНЕ геофенса склада ${warehouse.name}, ожидаем согласно ТЗ`);
        }
      } else if (currentWarehouse.status === 3) {
        // Статус 3 (Выезд): Если "Сценарий2" = true (транспорт ВНЕ геофенса)
        // → изменяет время departure → статус 3 на статус 4 + следующий склад статус 0 на статус 1
        if (!isWithinGeofence) { // Сценарий 2: ВНЕ геофенса
          currentWarehouse.departureTime = currentTime;
          currentWarehouse.status = 4;
          
          // Находим следующий склад и активируем его (статус 0 → статус 1)
          const currentIndex = progress.warehouseStatuses.findIndex(ws => ws.warehouseId === currentWarehouse.warehouseId);
          if (currentIndex !== -1 && currentIndex < progress.warehouseStatuses.length - 1) {
            const nextWarehouse = progress.warehouseStatuses[currentIndex + 1];
            nextWarehouse.status = 1; // Статус 0 → статус 1
            console.log(`✅ [Статус 3→4] Завершен склад: ${warehouse.name}, активирован следующий склад: ${nextWarehouse.warehouseId} (статус 0→1)`);
          } else {
            console.log(`✅ [Статус 3→4] Завершен последний склад маршрута: ${warehouse.name}`);
          }
          
          statusChanged = true;
          console.log(`✅ Завершен склад: ${warehouse.name} в ${currentTime} (транспорт ВНЕ геофенса)`);
        } else {
          console.log(`ℹ️ [Статус 3] Транспорт В геофенсе склада ${warehouse.name}, ожидаем выход за пределы для завершения`);
        }
      }

      // Сохраняем изменения если были
      if (statusChanged) {
        this.saveRouteProgress(progress);
        
        // Уведомляем об изменении статуса
        window.dispatchEvent(new CustomEvent('routeProgressChanged', {
          detail: { routeId, progress }
        }));
      }

    } catch (error) {
      console.error(`❌ Ошибка обработки GPS для маршрута ${routeId}:`, error);
    }
  }

  /**
   * Запускает отслеживание для всех активных маршрутов (только сегодняшних)
   */
  public static startTrackingAllRoutes(): void {
    if (!this.isTrackingTime()) {
      console.log('⏰ Отслеживание не активно (время вне 5:00-23:00)');
      return;
    }

    const today = this.getCurrentDate();
    console.log(`📅 Запуск отслеживания только для сегодняшнего дня: ${today}`);

    try {
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const vehicles = JSON.parse(localStorage.getItem('vehicles') || '[]');
      const warehouses = JSON.parse(localStorage.getItem('warehouses') || '[]');
      const workSchedules = JSON.parse(localStorage.getItem('workSchedules') || '[]');
      
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      // ИСПРАВЛЕНО: Используем активные маршруты напрямую из Route Management
      console.log(`📋 Поиск активных маршрутов в Route Management...`);
      
      const activeRoutes = routes.filter((route: any) => route.isActive);
      console.log(`📦 Найдено активных маршрутов: ${activeRoutes.length}`);
      
      activeRoutes.forEach((route: any, index: number) => {
        console.log(`📋 Проверяем маршрут ${index + 1}/${activeRoutes.length}: ${route.name} (ID: ${route.id})`);
        
        // Проверяем назначенного водителя
        if (!route.driverId) {
          console.warn(`⚠️ Маршрут ${route.name} не имеет назначенного водителя`);
          return;
        }
        
        const driver = users.find((u: any) => u.id === route.driverId);
        if (!driver) {
          console.warn(`⚠️ Водитель не найден для маршрута ${route.name}: ${route.driverId}`);
          return;
        }
        
        console.log(`👤 Найден водитель: ${driver.firstName} ${driver.lastName}`);
        
        // Находим транспорт двумя способами
        let vehicle = null;
        
        if (route.vehicleId) {
          vehicle = vehicles.find((v: any) => v.id === route.vehicleId);
          console.log(`🔍 Поиск по route.vehicleId: ${route.vehicleId} → ${vehicle ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
        }
        
        if (!vehicle) {
          const driverFullName = `${driver.firstName} ${driver.lastName}`;
          vehicle = vehicles.find((v: any) => v.assignedDriver === driverFullName);
          console.log(`🔍 Поиск по assignedDriver: ${driverFullName} → ${vehicle ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
        }
        
        if (vehicle) {
          console.log(`✅ Запуск отслеживания: ${route.name} для ${driver.firstName} ${driver.lastName} на ${vehicle.name}`);
          this.startTrackingRoute(route.id, driver.id, vehicle.id, warehouses);
        } else {
          console.warn(`⚠️ Нет транспорта для маршрута: ${route.name}`);
        }
      });

      console.log('🚀 Запущено отслеживание всех активных маршрутов');
    } catch (error) {
      console.error('❌ Ошибка запуска отслеживания маршрутов:', error);
    }
  }

  /**
   * Запускает отслеживание конкретного маршрута
   */
  public static startTrackingRoute(
    routeId: string,
    driverId: string,
    vehicleId: string,
    warehouses: any[]
  ): void {
    this.startTrackingRouteInternal(routeId, driverId, vehicleId, warehouses, false);
  }

  /**
   * Запускает отслеживание маршрута с готовыми данными (обновленная версия)
   */
  public static startTrackingRouteWithFullData(
    route: any,
    driver: any,
    vehicle: any,
    warehouses: any[]
  ): void {
    console.log(`🎯 Запуск отслеживания маршрута с полными данными: ${route.name} (${route.id})`);
    console.log(`   Водитель: ${driver.firstName} ${driver.lastName} (ID: ${driver.id})`);
    console.log(`   Транспорт: ${vehicle.name} (ID: ${vehicle.id})`);
    
    const key = `${route.id}_${driver.id}_${vehicle.id}`;
    
    // Останавливаем существующее отслеживание для этого маршрута
    this.stopTrackingRoute(route.id, driver.id, vehicle.id);

    // Запускаем новое отслеживание с полными данными
    const intervalId = window.setInterval(async () => {
      await this.processRouteGPSWithData(route, driver.id, vehicle, warehouses);
    }, this.TRACKING_INTERVAL);

    this.activeIntervals.set(key, intervalId);
    console.log(`🎯 Запущено отслеживание маршрута: ${route.name} для водителя: ${driver.firstName} ${driver.lastName} на транспорте: ${vehicle.name}`);

    // Сразу выполняем первую проверку
    this.processRouteGPSWithData(route, driver.id, vehicle, warehouses);
  }

  /**
   * УСТАРЕВШИЙ: Запускает отслеживание маршрута с готовыми данными
   */
  public static startTrackingRouteWithData(
    route: any,
    driverId: string,
    vehicleId: string,
    warehouses: any[]
  ): void {
    console.log(`⚠️ УСТАРЕВШИЙ МЕТОД: startTrackingRouteWithData используется для ${route.name}`);
    console.log(`   Используйте startTrackingRouteWithFullData для избежания ошибок поиска транспорта`);
    
    // Получаем данные транспорта из localStorage
    const vehicles = JSON.parse(localStorage.getItem('vehicles') || '[]');
    const vehicle = vehicles.find((v: any) => v.id === vehicleId);
    
    if (!vehicle) {
      console.error(`❌ Не удалось найти транспорт для запуска отслеживания: ${vehicleId}`);
      console.error(`   Доступные транспорт ID:`, vehicles.map(v => v.id));
      return;
    }

    // Используем новый метод
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const driver = users.find((u: any) => u.id === driverId);
    
    if (driver) {
      this.startTrackingRouteWithFullData(route, driver, vehicle, warehouses);
    } else {
      console.error(`❌ Водитель не найден: ${driverId}`);
    }
  }

  /**
   * Внутренняя функция для запуска отслеживания маршрута
   */
  private static startTrackingRouteInternal(
    routeId: string,
    driverId: string,
    vehicleId: string,
    warehouses: any[],
    forced: boolean = false
  ): void {
    const key = `${routeId}_${driverId}_${vehicleId}`;
    
    // Останавливаем существующее отслеживание для этого маршрута
    this.stopTrackingRoute(routeId, driverId, vehicleId);

    // Запускаем новое отслеживание
    const intervalId = window.setInterval(async () => {
      if (!forced && !this.isTrackingTime()) {
        console.log('⏰ Остановка отслеживания (время вне 5:00-23:00)');
        this.stopTrackingRoute(routeId, driverId, vehicleId);
        return;
      }

      await this.processRouteGPS(routeId, driverId, vehicleId, warehouses);
    }, this.TRACKING_INTERVAL);

    this.activeIntervals.set(key, intervalId);
    console.log(`🎯 Запущено отслеживание маршрута: ${routeId} для водителя: ${driverId} ${forced ? '(принудительно)' : ''}`);

    // Сразу выполняем первую проверку
    this.processRouteGPS(routeId, driverId, vehicleId, warehouses);
  }

  /**
   * Останавливает отслеживание конкретного маршрута
   */
  public static stopTrackingRoute(routeId: string, driverId: string, vehicleId: string): void {
    const key = `${routeId}_${driverId}_${vehicleId}`;
    const intervalId = this.activeIntervals.get(key);
    
    if (intervalId) {
      clearInterval(intervalId);
      this.activeIntervals.delete(key);
      console.log(`🛑 Остановлено отслеживание маршрута: ${routeId}`);
    }
  }

  /**
   * Останавливает все активные отслеживания
   */
  public static stopAllTracking(): void {
    this.activeIntervals.forEach((intervalId, key) => {
      clearInterval(intervalId);
      console.log(`🛑 Остановлено отслеживание: ${key}`);
    });
    this.activeIntervals.clear();
    console.log('🛑 Все отслеживания остановлены');
  }

  /**
   * Создает или получает прогресс маршрута с готовыми данными маршрута
   */
  public static initializeRouteProgressWithData(
    route: any, 
    driverId: string, 
    vehicleId: string
  ): ActualRouteProgress | null {
    const today = this.getCurrentDate();
    
    if (!this.isToday(today)) {
      console.warn(`⚠️ Инициализация прогресса возможна только для текущего дня: ${today}`);
      return null;
    }

    try {
      return this.loadRouteProgressWithData(route, driverId, vehicleId);
    } catch (error) {
      console.error(`❌ Ошибка инициализации прогресса маршрута ${route.name} (${route.id}):`, error);
      return null;
    }
  }

  /**
   * УСТАРЕВШИЙ: Создает или получает прогресс маршрута (публичный метод для инициализации)
   */
  public static initializeRouteProgress(routeId: string, driverId: string, vehicleId: string): ActualRouteProgress | null {
    const today = this.getCurrentDate();
    
    if (!this.isToday(today)) {
      console.warn(`⚠️ Инициализация прогресса возможна только для текущего дня: ${today}`);
      return null;
    }

    try {
      return this.loadRouteProgress(routeId, driverId, vehicleId);
    } catch (error) {
      console.error(`❌ Ошибка инициализации прогресса маршрута ${routeId}:`, error);
      return null;
    }
  }

  /**
   * Получает текущий прогресс маршрута (только для сегодняшнего дня)
   */
  public static getRouteProgress(routeId: string, driverId: string): ActualRouteProgress | null {
    const today = this.getCurrentDate();
    
    // Возвращаем данные только для сегодняшнего дня
    if (!this.isToday(today)) {
      console.warn(`⚠️ Данные прогресса доступны только для текущего дня: ${today}`);
      return null;
    }
    
    const key = `actual_route_${routeId}_${driverId}_${today}`;
    
    const cached = this.routeProgresses.get(key);
    if (cached) return cached;

    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const progress = JSON.parse(stored);
        this.routeProgresses.set(key, progress);
        return progress;
      } catch (error) {
        console.error('❌ Ошибка загрузки прогресса:', error);
      }
    }

    return null;
  }

  /**
   * Получает все GPS логи за день (по умолчанию только за сегодня)
   */
  public static getGPSLogs(date?: string): GPSLogEntry[] {
    const targetDate = date || this.getCurrentDate();
    
    // Предупреждаем, если запрашивают не сегодняшние данные
    if (date && !this.isToday(date)) {
      console.warn(`⚠️ Запрошены GPS логи не за сегодняшний день: ${date}. Рекомендуется использовать только сегодняшние данные.`);
    }
    
    const allLogs = JSON.parse(localStorage.getItem('gps_tracking_logs') || '[]');
    
    return allLogs.filter((log: GPSLogEntry) => log.date === targetDate);
  }

  /**
   * Получает статистику отслеживания
   */
  public static getTrackingStats(): {
    activeRoutes: number;
    totalLogs: number;
    lastUpdate: string | null;
  } {
    const logs = this.getGPSLogs();
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

    return {
      activeRoutes: this.activeIntervals.size,
      totalLogs: logs.length,
      lastUpdate: lastLog ? lastLog.timestamp : null,
    };
  }

  /**
   * Проверяет, активно ли отслеживание
   */
  public static isTrackingActive(): boolean {
    return this.activeIntervals.size > 0;
  }

  /**
   * Получает список активно отслеживаемых маршрутов
   */
  public static getActiveTrackingRoutes(): string[] {
    return Array.from(this.activeIntervals.keys());
  }

  /**
   * Принудительно запускает отслеживание с готовыми данными маршрутов
   */
  public static forceStartTrackingWithRoutes(
    dailyRoutes: Array<{ driver: any; route: any }>,
    vehicles: any[],
    warehouses: any[]
  ): void {
    console.log('🎯 ===== ПРИНУДИТЕЛЬНЫЙ ЗАПУСК С ГОТОВЫМИ ДАННЫМИ =====');
    console.log(`📊 Получены данные: маршрутов=${dailyRoutes.length}, транспорта=${vehicles.length}, складов=${warehouses.length}`);
    
    let startedRoutes = 0;
    
    dailyRoutes.forEach(({ driver, route }, index) => {
      console.log(`📋 Обрабатываем маршрут ${index + 1}/${dailyRoutes.length}: ${route.name} (ID: ${route.id})`);
      console.log(`👤 Водитель: ${driver.firstName} ${driver.lastName} (ID: ${driver.id})`);
      
      // Находим транспорт двумя способами
      let vehicle = null;
      
      if (route.vehicleId) {
        vehicle = vehicles.find((v: any) => v.id === route.vehicleId);
        console.log(`🔍 Поиск транспорта по route.vehicleId: ${route.vehicleId} → ${vehicle ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
      }
      
      if (!vehicle) {
        const driverFullName = `${driver.firstName} ${driver.lastName}`;
        vehicle = vehicles.find((v: any) => v.assignedDriver === driverFullName);
        console.log(`🔍 Поиск транспорта по assignedDriver: ${driverFullName} → ${vehicle ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
      }
      
      if (vehicle) {
        console.log(`✅ Запуск отслеживания: ${route.name} для ${driver.firstName} ${driver.lastName} на ${vehicle.name}`);
        this.startTrackingRouteWithFullData(route, driver, vehicle, warehouses);
        startedRoutes++;
      } else {
        console.warn(`⚠️ Нет транспорта для маршрута: ${route.name}`);
        console.warn(`   route.vehicleId = ${route.vehicleId || 'НЕТ'}`);
        console.warn(`   assignedDriver для "${driver.firstName} ${driver.lastName}" не найден`);
      }
    });
    
    console.log(`🚀 Запущено отслеживание ${startedRoutes} из ${dailyRoutes.length} маршрутов`);
    console.log(`📊 Активных интервалов: ${this.activeIntervals.size}`);
    console.log(`📅 ===== КОНЕЦ ПРИНУДИТЕЛЬНОГО ЗАПУСКА =====`);
  }

  /**
   * Принудительно запускает отслеживание (ручной запуск в любое время) - УСТАРЕВШИЙ МЕТОД
   */
  public static forceStartTracking(): void {
    const now = new Date();
    const hour = now.getHours();
    const settings = this.getTrackingTimeSettingsInternal();
    
    console.log('🎯 Принудительный запуск отслеживания маршрутов');
    
    if (hour < settings.startHour || hour > settings.endHour) {
      console.warn(`⚠️ Ручной запуск вне рабочего времени (${settings.startHour}:00-${settings.endHour}:00). Текущее время: ${hour}:${now.getMinutes().toString().padStart(2, '0')}`);
      console.log('🔧 Принудительный запуск разрешен для тестирования и диагностики');
    }

    // Запускаем отслеживание независимо от времени при ручном запуске
    this.startTrackingAllRoutesForced();
  }

  /**
   * Принудительно запускает отслеживание всех маршрутов (игнорирует время)
   */
  private static startTrackingAllRoutesForced(): void {
    const today = this.getCurrentDate();
    console.log(`📅 ===== ПРИНУДИТЕЛЬНЫЙ ЗАПУСК ОТСЛЕЖИВАНИЯ =====`);
    console.log(`📅 Дата: ${today}`);

    try {
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const vehicles = JSON.parse(localStorage.getItem('vehicles') || '[]');
      const warehouses = JSON.parse(localStorage.getItem('warehouses') || '[]');
      
      console.log(`📊 Загружены данные:`, {
        routes: routes.length,
        users: users.length,
        vehicles: vehicles.length,
        warehouses: warehouses.length
      });

      // ИСПРАВЛЕНО: Используем маршруты напрямую из Route Management, а не через workSchedules
      console.log(`📋 Поиск активных маршрутов в Route Management...`);
      
      let startedRoutes = 0;
      
      // Находим все активные маршруты с назначенными водителями и транспортом
      const activeRoutes = routes.filter((route: any) => route.isActive);
      console.log(`📦 Найдено активных маршрутов: ${activeRoutes.length}`);
      
      activeRoutes.forEach((route: any, index: number) => {
        console.log(`📋 Проверяем маршрут ${index + 1}/${activeRoutes.length}: ${route.name} (ID: ${route.id})`);
        
        // Проверяем назначенного водителя
        if (!route.driverId) {
          console.warn(`⚠️ Маршрут ${route.name} не имеет назначенного водителя (driverId пуст)`);
          return;
        }
        
        const driver = users.find((u: any) => u.id === route.driverId);
        if (!driver) {
          console.warn(`⚠️ Водитель не найден для маршрута ${route.name}: ${route.driverId}`);
          return;
        }
        
        console.log(`👤 Найден водитель: ${driver.firstName} ${driver.lastName} (ID: ${driver.id})`);
        
        // Находим транспорт двумя способами
        let vehicle = null;
        
        if (route.vehicleId) {
          // Способ 1: По vehicleId в маршруте
          vehicle = vehicles.find((v: any) => v.id === route.vehicleId);
          console.log(`🔍 Поиск транспорта по route.vehicleId: ${route.vehicleId} → ${vehicle ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
        }
        
        if (!vehicle) {
          // Способ 2: По assignedDriver в транспорте
          const driverFullName = `${driver.firstName} ${driver.lastName}`;
          vehicle = vehicles.find((v: any) => v.assignedDriver === driverFullName);
          console.log(`🔍 Поиск транспорта по assignedDriver: ${driverFullName} → ${vehicle ? 'НАЙДЕН' : 'НЕ НАЙДЕН'}`);
        }
        
        console.log(`📋 Детали маршрута:`, {
          routeName: route.name,
          routeId: route.id,
          driverId: route.driverId,
          driverName: `${driver.firstName} ${driver.lastName}`,
          routeVehicleId: route.vehicleId || 'НЕ УКАЗАН',
          foundVehicle: vehicle ? `${vehicle.name} (ID: ${vehicle.id})` : 'НЕ НАЙДЕН'
        });
        
        if (vehicle) {
          console.log(`✅ Принудительный запуск отслеживания: ${route.name} (${route.id}) для ${driver.firstName} ${driver.lastName} на транспорте ${vehicle.name}`);
          this.startTrackingRouteForced(route.id, driver.id, vehicle.id, warehouses);
          startedRoutes++;
        } else {
          console.warn(`⚠️ Нет назначенного транспорта для маршрута: ${route.name}`);
          console.warn(`   Откройте "Маршруты" → Редактировать "${route.name}" → Назначьте транспорт`);
          console.warn(`   ИЛИ откройте "Транспорт" → Назначьте водителя "${driver.firstName} ${driver.lastName}" автомобилю`);
        }
      });

      console.log(`🚀 Принудительно запущено отслеживание ${startedRoutes} маршрутов`);
      console.log(`📊 Активных интервалов после запуска: ${this.activeIntervals.size}`);
      console.log(`🔍 Список активных ключей:`, Array.from(this.activeIntervals.keys()));
      console.log(`📅 ===== КОНЕЦ ПРИНУДИТЕЛЬНОГО ЗАПУСКА =====`);
      
      if (startedRoutes === 0) {
        console.error('❌ НИ ОДИН МАРШРУТ НЕ ЗАПУЩЕН! Возможные причины:');
        console.error('   • Нет маршрутов на сегодня в workSchedules');
        console.error('   • Нет назначенного транспорта водителям');
        console.error('   • Ошибки в данных routes/users/vehicles');
      }
    } catch (error) {
      console.error('❌ Ошибка принудительного запуска отслеживания маршрутов:', error);
    }
  }

  /**
   * Инициализирует сервис отслеживания
   */
  public static initialize(): void {
    console.log('🚀 Инициализация ActualRouteTrackingService');
    
    // Запускаем отслеживание если время подходящее
    if (this.isTrackingTime()) {
      this.startTrackingAllRoutes();
    } else {
      console.log('⏰ Отслеживание не запущено (время вне 5:00-23:00)');
    }

    // Проверяем время каждую минуту для автоматического запуска/остановки
    setInterval(() => {
      if (this.isTrackingTime() && this.activeIntervals.size === 0) {
        console.log('⏰ Время отслеживания - запускаем автоматически');
        this.startTrackingAllRoutes();
      } else if (!this.isTrackingTime() && this.activeIntervals.size > 0) {
        console.log('⏰ Время отслеживания закончилось - останавливаем');
        this.stopAllTracking();
      }
    }, 60000); // Проверяем каждую минуту
  }

  /**
   * Экспортирует данные отслеживания в JSON
   */
  public static exportTrackingData(date?: string): {
    routeProgresses: ActualRouteProgress[];
    gpsLogs: GPSLogEntry[];
    exportDate: string;
  } {
    const targetDate = date || this.getCurrentDate();
    
    // Собираем все прогрессы маршрутов за день
    const routeProgresses: ActualRouteProgress[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('actual_route_') && key.includes(targetDate)) {
        try {
          const progress = JSON.parse(localStorage.getItem(key) || '');
          routeProgresses.push(progress);
        } catch (error) {
          console.error(`❌ Ошибка загрузки прогресса: ${key}`, error);
        }
      }
    }

    const gpsLogs = this.getGPSLogs(targetDate);

    return {
      routeProgresses,
      gpsLogs,
      exportDate: new Date().toISOString(),
    };
  }
}
