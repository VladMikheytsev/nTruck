import { Route, RouteStop, RouteProgress, Warehouse } from '../types';
import { RouteCalculationService } from './routeCalculationService';

/**
 * Сервис для автоматического обновления плановых времен маршрута
 * на основе фактических времен отъезда (fact: Departure)
 */
export class RouteTimeUpdateService {
  
  /**
   * Обновляет плановые времена всех последующих остановок маршрута
   * на основе фактического времени отъезда с текущей остановки
   */
  static async updateRouteTimesFromDeparture(
    route: Route,
    departedStopIndex: number,
    actualDepartureTime: string,
    warehouses: Warehouse[],
    dispatch: any
  ): Promise<Route | null> {
    try {
      console.log('🔄 Начинаем обновление плановых времен маршрута:', {
        routeId: route.id,
        departedStopIndex,
        actualDepartureTime
      });

      // Создаем копию маршрута для обновления
      const updatedRoute = { ...route };
      const updatedStops = [...route.stops].sort((a, b) => a.order - b.order);
      
      // Проверяем, есть ли остановки для обновления
      if (departedStopIndex >= updatedStops.length - 1) {
        console.log('✅ Это была последняя остановка, обновление не требуется');
        return route;
      }

      // Получаем текущую остановку (с которой отъехали)
      const currentStop = updatedStops[departedStopIndex];
      if (!currentStop) {
        console.error('❌ Текущая остановка не найдена');
        return null;
      }

      // Обновляем фактическое время отъезда текущей остановки
      currentStop.departureTime = new Date(actualDepartureTime).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      });

      console.log('📍 Обновляем времена начиная с остановки:', departedStopIndex + 1);

      // Обновляем все последующие остановки
      for (let i = departedStopIndex + 1; i < updatedStops.length; i++) {
        const nextStop = updatedStops[i];
        const prevStop = updatedStops[i - 1];
        
        console.log(`🔄 Обновляем остановку ${i}:`, {
          stopId: nextStop.id,
          warehouseId: nextStop.warehouseId
        });

        // Находим склады для расчета времени
        const fromWarehouse = warehouses.find(w => w.id === prevStop.warehouseId);
        const toWarehouse = warehouses.find(w => w.id === nextStop.warehouseId);

        if (!fromWarehouse || !toWarehouse) {
          console.error('❌ Склады не найдены для расчета:', {
            fromWarehouseId: prevStop.warehouseId,
            toWarehouseId: nextStop.warehouseId
          });
          continue;
        }

        // Рассчитываем время в пути от предыдущей остановки
        const departureDateTime = this.parseTimeToDate(prevStop.departureTime);
        
        try {
          const travelResult = await RouteCalculationService.calculateTravelTimeForRoute(
            fromWarehouse,
            toWarehouse,
            toWarehouse.trafficScenario,
            undefined, // weekday
            departureDateTime,
            55 // default speed limit
          );

          if (travelResult.success && travelResult.travelTimeMinutes) {
            // Рассчитываем новое время прибытия
            const arrivalDateTime = new Date(departureDateTime.getTime() + travelResult.travelTimeMinutes * 60000);
            nextStop.arrivalTime = arrivalDateTime.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            });

            // Рассчитываем время отъезда (прибытие + время на складе)
            const timeOnWarehouse = this.calculateTimeOnWarehouse(nextStop);
            const departureDateTime = new Date(arrivalDateTime.getTime() + timeOnWarehouse * 60000);
            nextStop.departureTime = departureDateTime.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            });

            console.log('✅ Обновлены времена для остановки:', {
              stopId: nextStop.id,
              newArrival: nextStop.arrivalTime,
              newDeparture: nextStop.departureTime,
              travelTime: travelResult.travelTimeMinutes
            });
          } else {
            console.warn('⚠️ Не удалось рассчитать время в пути, используем базовые значения');
            // Используем базовое время (30 минут в пути + время на складе)
            const arrivalDateTime = new Date(departureDateTime.getTime() + 30 * 60000);
            nextStop.arrivalTime = arrivalDateTime.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            });

            const timeOnWarehouse = this.calculateTimeOnWarehouse(nextStop);
            const departureDateTime = new Date(arrivalDateTime.getTime() + timeOnWarehouse * 60000);
            nextStop.departureTime = departureDateTime.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        } catch (error) {
          console.error('❌ Ошибка расчета времени в пути:', error);
          // Используем базовые значения при ошибке
          const arrivalDateTime = new Date(departureDateTime.getTime() + 30 * 60000);
          nextStop.arrivalTime = arrivalDateTime.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
          });

          const timeOnWarehouse = this.calculateTimeOnWarehouse(nextStop);
          const departureDateTime = new Date(arrivalDateTime.getTime() + timeOnWarehouse * 60000);
          nextStop.departureTime = departureDateTime.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      }

      // Обновляем маршрут в состоянии приложения
      updatedRoute.stops = updatedStops;
      updatedRoute.updatedAt = new Date();

      // Отправляем обновление в Redux/Context
      dispatch({
        type: 'UPDATE_ROUTE',
        payload: updatedRoute
      });

      console.log('✅ Маршрут успешно обновлен с новыми плановыми временами');
      return updatedRoute;

    } catch (error) {
      console.error('❌ Ошибка обновления времен маршрута:', error);
      return null;
    }
  }

  /**
   * Преобразует время в формате "HH:MM" в объект Date
   */
  private static parseTimeToDate(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * Рассчитывает время, которое водитель проводит на складе
   * Учитывает обед и базовое время обработки
   */
  private static calculateTimeOnWarehouse(stop: RouteStop): number {
    let timeMinutes = 30; // Базовое время на складе (30 минут)

    // Добавляем время обеда, если есть
    if (stop.hasLunch && stop.lunchDuration) {
      timeMinutes += stop.lunchDuration;
    }

    return timeMinutes;
  }

  /**
   * Проверяет, нужно ли обновлять времена маршрута
   * на основе изменений в прогрессе
   */
  static shouldUpdateRouteTimes(
    routeProgress: RouteProgress,
    previousProgress?: RouteProgress
  ): { shouldUpdate: boolean; departedStopIndex?: number; actualDepartureTime?: string } {
    
    // Ищем остановки, которые недавно получили фактическое время отъезда
    for (let i = 0; i < routeProgress.stops.length; i++) {
      const currentStop = routeProgress.stops[i];
      const previousStop = previousProgress?.stops[i];

      // Если у остановки появилось фактическое время отъезда
      if (currentStop.actualDeparture && !previousStop?.actualDeparture) {
        return {
          shouldUpdate: true,
          departedStopIndex: i,
          actualDepartureTime: currentStop.actualDeparture
        };
      }
    }

    return { shouldUpdate: false };
  }

  /**
   * Автоматически обновляет маршрут при изменении прогресса
   */
  static async handleRouteProgressUpdate(
    routeProgress: RouteProgress,
    previousProgress: RouteProgress | undefined,
    route: Route,
    warehouses: Warehouse[],
    dispatch: any
  ): Promise<void> {
    const updateCheck = this.shouldUpdateRouteTimes(routeProgress, previousProgress);
    
    if (updateCheck.shouldUpdate && updateCheck.departedStopIndex !== undefined && updateCheck.actualDepartureTime) {
      console.log('🚀 Обнаружен fact: Departure, запускаем обновление плановых времен');
      
      await this.updateRouteTimesFromDeparture(
        route,
        updateCheck.departedStopIndex,
        updateCheck.actualDepartureTime,
        warehouses,
        dispatch
      );
    }
  }
}
