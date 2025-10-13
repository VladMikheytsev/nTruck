import { RouteProgress, RouteProgressStop, IntermediateStop, VehicleGPSData, Route } from '../types';
import { RouteTimeUpdateService } from './routeTimeUpdateService';

/**
 * Сервис для отслеживания прогресса выполнения маршрута водителем
 * Отслеживает движение GPS трекера и фиксирует фактическое время движений и остановок
 */
export class RouteProgressTrackingService {
  private static readonly WAREHOUSE_RADIUS_MILES = 0.1; // Радиус склада в милях
  private static readonly WAREHOUSE_RADIUS_METERS = 160.934; // 0.1 мили в метрах
  private static readonly MIN_STOP_DURATION = 2; // Минимальная длительность остановки в минутах
  
  // Хранилище активных прогрессов маршрутов
  private static activeRouteProgresses: Map<string, RouteProgress> = new Map();
  
  // Хранилище предыдущих состояний для отслеживания изменений
  private static previousRouteProgresses: Map<string, RouteProgress> = new Map();
  
  /**
   * Инициализация отслеживания маршрута для водителя
   */
  static initializeRouteTracking(route: Route, driverId: string, vehicleId: string): RouteProgress {
    const today = new Date().toISOString().split('T')[0];
    const routeProgressId = `${route.id}-${driverId}-${today}`;
    
    const routeProgress: RouteProgress = {
      routeId: route.id,
      driverId,
      vehicleId,
      date: today,
      status: 'not_started',
      currentStopIndex: 0,
      stops: route.stops.map(stop => ({
        stopId: stop.id,
        warehouseId: stop.warehouseId,
        order: stop.order,
        plannedArrival: stop.arrivalTime,
        plannedDeparture: stop.departureTime,
        status: 'pending'
      })),
      intermediateStops: [],
      lastGPSUpdate: new Date().toISOString()
    };
    
    this.activeRouteProgresses.set(routeProgressId, routeProgress);
    console.log('🚀 Инициализировано отслеживание маршрута:', routeProgressId);
    
    return routeProgress;
  }
  
  /**
   * Обновление прогресса маршрута на основе GPS данных
   */
  static updateRouteProgress(
    routeId: string, 
    driverId: string, 
    gpsData: VehicleGPSData,
    warehouses: any[]
  ): RouteProgress | null {
    const today = new Date().toISOString().split('T')[0];
    const routeProgressId = `${routeId}-${driverId}-${today}`;
    
    const routeProgress = this.activeRouteProgresses.get(routeProgressId);
    if (!routeProgress) {
      console.warn('⚠️ Прогресс маршрута не найден:', routeProgressId);
      return null;
    }
    
    // Обновляем время последнего GPS обновления
    routeProgress.lastGPSUpdate = gpsData.lastUpdate;
    
    // Получаем текущую остановку
    const currentStop = routeProgress.stops[routeProgress.currentStopIndex];
    if (!currentStop) {
      console.log('✅ Все остановки маршрута завершены');
      routeProgress.status = 'completed';
      routeProgress.endTime = new Date().toISOString();
      return routeProgress;
    }
    
    // Находим склад текущей остановки
    const warehouse = warehouses.find(w => w.id === currentStop.warehouseId);
    if (!warehouse) {
      console.error('❌ Склад не найден:', currentStop.warehouseId);
      return routeProgress;
    }
    
    // Вычисляем расстояние до текущей остановки
    const distanceToStop = this.calculateDistance(
      gpsData.position.latitude,
      gpsData.position.longitude,
      warehouse.coordinates?.lat || 0,
      warehouse.coordinates?.lng || 0
    );
    
    const isWithinRadius = distanceToStop <= this.WAREHOUSE_RADIUS_METERS;
    const currentTime = new Date().toISOString();
    
    console.log('📍 GPS обновление:', {
      routeProgressId,
      currentStopIndex: routeProgress.currentStopIndex,
      stopStatus: currentStop.status,
      distanceToStop: Math.round(distanceToStop),
      isWithinRadius,
      warehouseName: warehouse.name
    });
    
    // Логика отслеживания в зависимости от статуса остановки
    switch (currentStop.status) {
      case 'pending':
        // Водитель еще не начал движение к этой остановке
        if (!isWithinRadius && routeProgress.currentStopIndex === 0) {
          // Первая остановка: выезд из радиуса = начало маршрута
          currentStop.status = 'en_route';
          currentStop.exitedRadius = currentTime;
          routeProgress.status = 'in_progress';
          routeProgress.startTime = currentTime;
          console.log('🚀 Начало маршрута - выезд из первой остановки');
        } else if (!isWithinRadius && routeProgress.currentStopIndex > 0) {
          // Последующие остановки: выезд из предыдущей остановки
          const prevStop = routeProgress.stops[routeProgress.currentStopIndex - 1];
          if (prevStop.status === 'departed') {
            currentStop.status = 'en_route';
            currentStop.exitedRadius = currentTime;
            console.log('🛣️ Начало движения к остановке:', warehouse.name);
          }
        }
        break;
        
      case 'en_route':
        // Водитель в пути к остановке
        if (isWithinRadius) {
          // Прибытие на остановку
          currentStop.status = 'arrived';
          currentStop.enteredRadius = currentTime;
          currentStop.actualArrival = currentTime;
          console.log('🎯 Прибытие на остановку:', warehouse.name);
        } else {
          // Проверяем промежуточные остановки
          this.checkForIntermediateStop(routeProgress, gpsData, currentTime);
        }
        break;
        
      case 'arrived':
        // Водитель на остановке
        if (!isWithinRadius) {
          // Отъезд с остановки
          currentStop.status = 'departed';
          currentStop.exitedRadius = currentTime;
          currentStop.actualDeparture = currentTime;
          
          // Переходим к следующей остановке
          routeProgress.currentStopIndex++;
          
          // Если есть следующая остановка, устанавливаем ее статус
          const nextStop = routeProgress.stops[routeProgress.currentStopIndex];
          if (nextStop) {
            nextStop.status = 'pending';
            console.log('🚀 Отъезд с остановки, движение к:', 
              warehouses.find(w => w.id === nextStop.warehouseId)?.name);
          }
          
          console.log('✅ Завершение остановки:', warehouse.name);
        }
        break;
    }
    
    // Сохраняем предыдущее состояние для отслеживания изменений
    const previousProgress = this.activeRouteProgresses.get(routeProgressId);
    if (previousProgress) {
      this.previousRouteProgresses.set(routeProgressId, { ...previousProgress });
    }
    
    // Сохраняем обновленный прогресс
    this.activeRouteProgresses.set(routeProgressId, routeProgress);
    
    return routeProgress;
  }
  
  /**
   * Проверка промежуточных остановок (когда водитель останавливается не на складе)
   */
  private static checkForIntermediateStop(
    routeProgress: RouteProgress, 
    gpsData: VehicleGPSData, 
    currentTime: string
  ) {
    // Проверяем, стоит ли водитель (скорость < 5 км/ч)
    const isStationary = (gpsData.position.speed || 0) < 5;
    
    if (!isStationary) {
      // Водитель движется - завершаем активные промежуточные остановки
      const activeIntermediateStop = routeProgress.intermediateStops.find(
        stop => !stop.endTime
      );
      
      if (activeIntermediateStop) {
        activeIntermediateStop.endTime = currentTime;
        activeIntermediateStop.duration = Math.round(
          (new Date(currentTime).getTime() - new Date(activeIntermediateStop.startTime).getTime()) / (1000 * 60)
        );
        console.log('🔴 Завершение промежуточной остановки, длительность:', 
          activeIntermediateStop.duration, 'мин');
      }
      return;
    }
    
    // Водитель стоит - проверяем, есть ли уже активная промежуточная остановка
    const activeIntermediateStop = routeProgress.intermediateStops.find(
      stop => !stop.endTime
    );
    
    if (activeIntermediateStop) {
      // Проверяем, не сменилась ли позиция значительно
      const distance = this.calculateDistance(
        gpsData.position.latitude,
        gpsData.position.longitude,
        activeIntermediateStop.position.latitude,
        activeIntermediateStop.position.longitude
      );
      
      // Если водитель переместился более чем на 50 метров, создаем новую остановку
      if (distance > 50) {
        // Завершаем предыдущую остановку
        activeIntermediateStop.endTime = currentTime;
        activeIntermediateStop.duration = Math.round(
          (new Date(currentTime).getTime() - new Date(activeIntermediateStop.startTime).getTime()) / (1000 * 60)
        );
        
        // Создаем новую промежуточную остановку
        this.createIntermediateStop(routeProgress, gpsData, currentTime);
      }
    } else {
      // Создаем новую промежуточную остановку
      this.createIntermediateStop(routeProgress, gpsData, currentTime);
    }
  }
  
  /**
   * Создание новой промежуточной остановки
   */
  private static createIntermediateStop(
    routeProgress: RouteProgress, 
    gpsData: VehicleGPSData, 
    currentTime: string
  ) {
    const currentStop = routeProgress.stops[routeProgress.currentStopIndex];
    const nextStop = routeProgress.stops[routeProgress.currentStopIndex + 1];
    
    if (!currentStop || !nextStop) return;
    
    const intermediateStop: IntermediateStop = {
      id: `intermediate-${Date.now()}`,
      position: {
        latitude: gpsData.position.latitude,
        longitude: gpsData.position.longitude
      },
      startTime: currentTime,
      type: 'intermediate',
      betweenStops: {
        fromStopId: currentStop.stopId,
        toStopId: nextStop.stopId
      }
    };
    
    routeProgress.intermediateStops.push(intermediateStop);
    console.log('🔴 Новая промежуточная остановка создана:', {
      lat: intermediateStop.position.latitude,
      lng: intermediateStop.position.longitude
    });
  }
  
  /**
   * Вычисление расстояния между двумя точками в метрах
   */
  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Радиус Земли в метрах
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
  
  /**
   * Получение активного прогресса маршрута
   */
  static getActiveRouteProgress(routeId: string, driverId: string): RouteProgress | null {
    const today = new Date().toISOString().split('T')[0];
    const routeProgressId = `${routeId}-${driverId}-${today}`;
    return this.activeRouteProgresses.get(routeProgressId) || null;
  }
  
  /**
   * Получение всех активных прогрессов маршрутов
   */
  static getAllActiveRouteProgresses(): RouteProgress[] {
    return Array.from(this.activeRouteProgresses.values());
  }
  
  /**
   * Сохранение прогресса маршрута (в реальном приложении - в базу данных)
   */
  static saveRouteProgress(routeProgress: RouteProgress): void {
    // В реальном приложении здесь будет сохранение в базу данных
    console.log('💾 Сохранение прогресса маршрута:', {
      routeId: routeProgress.routeId,
      status: routeProgress.status,
      currentStopIndex: routeProgress.currentStopIndex,
      intermediateStopsCount: routeProgress.intermediateStops.length
    });
    
    // Для демонстрации сохраняем в localStorage
    const key = `route_progress_${routeProgress.routeId}_${routeProgress.driverId}_${routeProgress.date}`;
    localStorage.setItem(key, JSON.stringify(routeProgress));
  }
  
  /**
   * Загрузка прогресса маршрута из хранилища
   */
  static loadRouteProgress(routeId: string, driverId: string, date: string): RouteProgress | null {
    const key = `route_progress_${routeId}_${driverId}_${date}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      try {
        const routeProgress = JSON.parse(stored) as RouteProgress;
        const routeProgressId = `${routeId}-${driverId}-${date}`;
        this.activeRouteProgresses.set(routeProgressId, routeProgress);
        return routeProgress;
      } catch (error) {
        console.error('❌ Ошибка загрузки прогресса маршрута:', error);
      }
    }
    
    return null;
  }

  /**
   * Обновляет плановые времена маршрута при фактическом отъезде
   */
  static async updateRouteTimesOnDeparture(
    routeProgress: RouteProgress,
    route: Route,
    warehouses: any[],
    dispatch: any
  ): Promise<void> {
    const routeProgressId = `${routeProgress.routeId}-${routeProgress.driverId}-${routeProgress.date}`;
    const previousProgress = this.previousRouteProgresses.get(routeProgressId);
    
    if (previousProgress) {
      try {
        await RouteTimeUpdateService.handleRouteProgressUpdate(
          routeProgress,
          previousProgress,
          route,
          warehouses,
          dispatch
        );
      } catch (error) {
        console.error('❌ Ошибка обновления времен маршрута:', error);
      }
    }
  }

  /**
   * Получение предыдущего состояния прогресса маршрута
   */
  static getPreviousRouteProgress(routeId: string, driverId: string, date: string): RouteProgress | null {
    const routeProgressId = `${routeId}-${driverId}-${date}`;
    return this.previousRouteProgresses.get(routeProgressId) || null;
  }
}
