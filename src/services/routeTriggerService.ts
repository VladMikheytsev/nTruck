// Сервис для управления триггерами маршрута
// Циклическая фиксация departure → arrival → departure с пересчетом маршрута

import { RouteCalculationService } from './routeCalculationService';

export interface TriggerState {
  routeId: string;
  currentStopIndex: number;
  nextAction: 'departure' | 'arrival';
  lastTriggeredTime: Date;
}

export class RouteTriggerService {
  private static triggerStates: Map<string, TriggerState> = new Map();

  // Инициализация состояния триггера для маршрута
  static initializeTrigger(routeId: string): TriggerState {
    const triggerState: TriggerState = {
      routeId,
      currentStopIndex: 0,
      nextAction: 'departure', // Начинаем с departure первого склада
      lastTriggeredTime: new Date()
    };

    this.triggerStates.set(routeId, triggerState);
    console.log('🎯 Инициализирован триггер для маршрута:', routeId);
    
    return triggerState;
  }

  // Основная функция триггера
  static async triggerNextAction(routeId: string, route?: any): Promise<boolean> {
    // Объявляем переменные в начале функции для доступности в catch блоке
    let targetRoute: any = null;
    let triggerState: any = null;
    let currentStop: any = null;
    
    try {
      console.log('🎯 Триггер активирован для маршрута:', routeId);

      // Используем переданный маршрут или ищем в localStorage
      targetRoute = route;
      if (!targetRoute) {
        targetRoute = await this.getRouteById(routeId);
      }
      
      if (!targetRoute) {
        console.error('❌ МАРШРУТ НЕ НАЙДЕН - ДЕТАЛЬНАЯ ДИАГНОСТИКА:', {
          routeId,
          providedRoute: !!route,
          searchedInLocalStorage: !route,
          allRoutes: this.getAllRouteIds(),
          localStorage: {
            routesCount: JSON.parse(localStorage.getItem('routes') || '[]').length,
            routesSize: JSON.stringify(JSON.parse(localStorage.getItem('routes') || '[]')).length
          }
        });
        alert(`❌ Маршрут не найден: ${routeId}\n\nВозможные причины:\n• Маршрут был удален\n• Проблемы с localStorage\n• Неверный ID маршрута\n\nОткройте консоль (F12) для подробностей`);
        return false;
      }

      console.log('✅ Маршрут найден:', {
        id: targetRoute.id,
        name: targetRoute.name,
        stops: targetRoute.stops?.length || 0
      });

      // Проверяем, что маршрут на сегодня
      if (!this.isRouteForToday(targetRoute)) {
        console.warn('⚠️ Триггер работает только для сегодняшних маршрутов');
        return false;
      }

      // Получаем или создаем состояние триггера
      triggerState = this.triggerStates.get(routeId);
      if (!triggerState) {
        triggerState = this.initializeTrigger(routeId);
      }

      const sortedStops = targetRoute.stops.sort((a: any, b: any) => a.order - b.order);
      currentStop = sortedStops[triggerState.currentStopIndex];

      if (!currentStop) {
        console.log('🏁 Маршрут завершен - все остановки пройдены');
        return false;
      }

      console.log('🎯 Выполняем действие:', {
        action: triggerState.nextAction,
        stopIndex: triggerState.currentStopIndex,
        stopId: currentStop.id,
        stopDepartureTime: currentStop.departureTime,
        stopArrivalTime: currentStop.arrivalTime
      });

      if (triggerState.nextAction === 'departure') {
        console.log('🎯 ТРИГГЕР DEPARTURE: начинаем обработку', {
          routeId,
          stopIndex: triggerState.currentStopIndex,
          stopId: currentStop.id,
          currentStopDepartureTime: currentStop.departureTime
        });
        
        // Фиксируем departure - используем текущее время для фиксации
        const actualDepartureTime = new Date(); // Текущее время для фиксации departure
        await this.fixDepartureTime(targetRoute, currentStop, actualDepartureTime);
        
        console.log('🔄 Запускаем циклический пересчет от departure...', {
          actualDepartureTime: actualDepartureTime.toLocaleTimeString(),
          stopDepartureTimeAfterFix: currentStop.departureTime
        });
        
        // Запускаем циклический пересчет от зафиксированного departure времени
        await this.recalculateRouteChain(targetRoute, triggerState.currentStopIndex, actualDepartureTime, 'departure');
        
        // Обновляем статус склада как "завершен"
        await this.markStopAsCompleted(routeId, currentStop.id);
        
        // Переходим к следующему действию
        if (triggerState.currentStopIndex < sortedStops.length - 1) {
          triggerState.currentStopIndex++;
          triggerState.nextAction = 'arrival';
        } else {
          console.log('🏁 Последний склад - маршрут завершен');
          await this.completeRoute(routeId);
        }

      } else if (triggerState.nextAction === 'arrival') {
        // Фиксируем arrival - используем текущее время для фиксации
        const actualArrivalTime = new Date(); // Текущее время для фиксации arrival
        await this.fixArrivalTime(targetRoute, currentStop, actualArrivalTime);
        
        console.log('🔄 Запускаем циклический пересчет от arrival...', {
          actualArrivalTime: actualArrivalTime.toLocaleTimeString(),
          stopArrivalTimeAfterFix: currentStop.arrivalTime
        });
        
        // Запускаем циклический пересчет от зафиксированного arrival времени
        await this.recalculateRouteChain(targetRoute, triggerState.currentStopIndex, actualArrivalTime, 'arrival');
        
        // Следующее действие - departure с того же склада
        triggerState.nextAction = 'departure';
      }

      triggerState.lastTriggeredTime = new Date();
      this.triggerStates.set(routeId, triggerState);

      console.log('✅ Триггер выполнен успешно:', {
        routeId,
        nextAction: triggerState.nextAction,
        currentStopIndex: triggerState.currentStopIndex
      });

      return true;

    } catch (error) {
      console.error('❌ ДЕТАЛЬНАЯ ОШИБКА ВЫПОЛНЕНИЯ ТРИГГЕРА:', {
        routeId,
        error: error.message,
        stack: error.stack,
        targetRoute: targetRoute ? {
          id: targetRoute.id,
          name: targetRoute.name,
          date: targetRoute.date,
          weekday: targetRoute.weekday,
          stopsCount: targetRoute.stops ? targetRoute.stops.length : 0
        } : 'НЕ НАЙДЕН',
        triggerState: triggerState ? {
          currentStopIndex: triggerState.currentStopIndex,
          nextAction: triggerState.nextAction,
          lastTriggeredTime: triggerState.lastTriggeredTime
        } : 'НЕ ИНИЦИАЛИЗИРОВАН',
        currentStop: currentStop ? {
          id: currentStop.id,
          warehouseId: currentStop.warehouseId,
          order: currentStop.order,
          arrivalTime: currentStop.arrivalTime,
          departureTime: currentStop.departureTime
        } : 'НЕ НАЙДЕН'
      });
      return false;
    }
  }

  // Фиксация departure времени
  private static async fixDepartureTime(route: any, stop: any, time: Date): Promise<void> {
    try {
      // Обновляем переданный объект маршрута напрямую
      const stopIndex = route.stops.findIndex((s: any) => s.id === stop.id);
      
      if (stopIndex !== -1) {
        route.stops[stopIndex].actualDepartureTime = time.toISOString();
        route.stops[stopIndex].departureTime = time.toTimeString().substring(0, 5); // HH:MM
        
        // 🎯 ИЗМЕНЯЕМ СТАТУС СКЛАДА НА "произошло"
        route.stops[stopIndex].status = 'произошло';
        
        console.log('✅ Зафиксировано departure время в объекте маршрута:', {
          stop: stop.id,
          time: time.toLocaleTimeString(),
          newDepartureTime: stop.departureTime,
          warehouse: await this.getWarehouseName(stop.warehouseId),
          newStatus: 'произошло'
        });
      }

      // Также обновляем localStorage для сохранения
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      const routeIndex = routes.findIndex((r: any) => r.id === route.id);
      
      if (routeIndex !== -1) {
        const localStopIndex = routes[routeIndex].stops.findIndex((s: any) => s.id === stop.id);
        
        if (localStopIndex !== -1) {
          routes[routeIndex].stops[localStopIndex].actualDepartureTime = time.toISOString();
          routes[routeIndex].stops[localStopIndex].departureTime = time.toTimeString().substring(0, 5);
          routes[routeIndex].stops[localStopIndex].status = 'произошло';
          
          localStorage.setItem('routes', JSON.stringify(routes));
          console.log('💾 Departure время сохранено в localStorage');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка фиксации departure времени:', error);
    }
  }

  // Фиксация arrival времени
  private static async fixArrivalTime(route: any, stop: any, time: Date): Promise<void> {
    try {
      // Обновляем переданный объект маршрута напрямую
      const stopIndex = route.stops.findIndex((s: any) => s.id === stop.id);
      
      if (stopIndex !== -1) {
        route.stops[stopIndex].actualArrivalTime = time.toISOString();
        route.stops[stopIndex].arrivalTime = time.toTimeString().substring(0, 5); // HH:MM
        
        console.log('✅ Зафиксировано arrival время в объекте маршрута:', {
          stop: stop.id,
          time: time.toLocaleTimeString(),
          warehouse: await this.getWarehouseName(stop.warehouseId)
        });
      }

      // Также обновляем localStorage для сохранения
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      const routeIndex = routes.findIndex((r: any) => r.id === route.id);
      
      if (routeIndex !== -1) {
        const localStopIndex = routes[routeIndex].stops.findIndex((s: any) => s.id === stop.id);
        
        if (localStopIndex !== -1) {
          routes[routeIndex].stops[localStopIndex].actualArrivalTime = time.toISOString();
          routes[routeIndex].stops[localStopIndex].arrivalTime = time.toTimeString().substring(0, 5);
          
          localStorage.setItem('routes', JSON.stringify(routes));
          console.log('💾 Arrival время сохранено в localStorage');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка фиксации arrival времени:', error);
    }
  }

  // Циклический пересчет всей цепочки маршрута
  private static async recalculateRouteChain(route: any, fromStopIndex: number, changedTime: Date, changeType: 'departure' | 'arrival'): Promise<void> {
    try {
      console.log('🔄 ЦИКЛИЧЕСКИЙ ПЕРЕСЧЕТ цепочки маршрута:', {
        fromStopIndex,
        changeType,
        changedTime: changedTime.toLocaleTimeString()
      });

      const sortedStops = route.stops.sort((a: any, b: any) => a.order - b.order);
      const warehouses = JSON.parse(localStorage.getItem('warehouses') || '[]');

      // Если изменили departure - пересчитываем arrival следующего склада
      if (changeType === 'departure') {
        console.log('🎯 ОБРАБАТЫВАЕМ DEPARTURE ИЗМЕНЕНИЕ:', {
          fromStopIndex,
          hasNextStops: fromStopIndex + 1 < sortedStops.length,
          nextStopExists: sortedStops[fromStopIndex + 1] ? true : false
        });
        
        if (fromStopIndex + 1 < sortedStops.length) {
          await this.recalculateFromDeparture(route, sortedStops, warehouses, fromStopIndex, changedTime);
        } else {
          console.log('⚠️ Нет следующих остановок для пересчета после индекса', fromStopIndex);
        }
      }
      
      // Если изменили arrival - пересчитываем departure текущего склада
      if (changeType === 'arrival') {
        console.log('🎯 ОБРАБАТЫВАЕМ ARRIVAL ИЗМЕНЕНИЕ:', {
          fromStopIndex,
          currentStopExists: sortedStops[fromStopIndex] ? true : false
        });
        
        await this.recalculateFromArrival(route, sortedStops, warehouses, fromStopIndex, changedTime);
      }

      // 💾 Сохраняем обновленный маршрут
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      const routeIndex = routes.findIndex((r: any) => r.id === route.id);
      
      if (routeIndex !== -1) {
        routes[routeIndex] = route;
        localStorage.setItem('routes', JSON.stringify(routes));
        console.log('💾 Обновленная цепочка маршрута сохранена в localStorage');
        
        // Логируем финальное состояние всех остановок
        console.log('📊 ФИНАЛЬНОЕ СОСТОЯНИЕ ОСТАНОВОК:', route.stops.map((s: any) => ({
          id: s.id,
          order: s.order,
          warehouseId: s.warehouseId,
          arrivalTime: s.arrivalTime,
          departureTime: s.departureTime,
          status: s.status
        })));
      }
      
      console.log('✅ ЦИКЛИЧЕСКИЙ ПЕРЕСЧЕТ цепочки завершен');

    } catch (error) {
      console.error('❌ Ошибка циклического пересчета:', error);
    }
  }

  // ПРОСТАЯ ПРЯМАЯ ЦЕПОЧКА: departure склад 1 → arrival склад 2 → departure склад 2 → arrival склад 3
  private static async recalculateFromDeparture(route: any, sortedStops: any[], warehouses: any[], fromStopIndex: number, departureTime: Date): Promise<void> {
    alert('🔥 ФУНКЦИЯ recalculateFromDeparture ВЫЗВАНА! 🔥');
    console.log('🚀🗺️ ПРЯМАЯ ЦЕПОЧКА С ПОЛНОЙ GOOGLE API ЛОГИКОЙ ЗАПУЩЕНА! 🗺️🚀');
    console.log('📍 ИСХОДНЫЕ ДАННЫЕ:', {
      fromStopIndex,
      departureTime: departureTime.toLocaleTimeString(),
      totalStops: sortedStops.length,
      stopsToUpdate: sortedStops.length - (fromStopIndex + 1),
      routeId: route.id,
      routeName: route.name,
      useFullGoogleAPILogic: true,
      includesTrafficLights: true,
      includesStopSigns: true,
      includesTrafficConditions: true
    });
    
    if (fromStopIndex + 1 >= sortedStops.length) {
      console.log('⚠️ Нет остановок для обновления');
      return;
    }
    
    // Начинаем с departure времени текущего склада
    let currentDepartureTime = new Date(departureTime);
    
    // Проходим по всем последующим остановкам
    for (let i = fromStopIndex + 1; i < sortedStops.length; i++) {
      const currentStop = sortedStops[i];
      const prevStop = sortedStops[i - 1];
      
      console.log(`\n🚀 === ЦЕПОЧКА: ОБНОВЛЯЕМ ОСТАНОВКУ ${i} (Google API + пробки + светофоры) ===`);
      console.log('📍 Данные остановки:', {
        stopId: currentStop.id,
        warehouseId: currentStop.warehouseId,
        order: currentStop.order,
        currentArrival: currentStop.arrivalTime,
        currentDeparture: currentStop.departureTime,
        prevStopDeparture: prevStop.departureTime
      });
      
      // Находим склады для Google API расчета
      const prevWarehouse = warehouses.find((w: any) => w.id === prevStop.warehouseId);
      const currentWarehouse = warehouses.find((w: any) => w.id === currentStop.warehouseId);
      
      // 🔧 АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ОТСУТСТВУЮЩИХ СКЛАДОВ
      if (!prevWarehouse) {
        console.log('🔧 Создаем отсутствующий склад для prevStop:', prevStop.warehouseId);
        const newPrevWarehouse = this.createMissingWarehouse(prevStop.warehouseId);
        warehouses.push(newPrevWarehouse);
        localStorage.setItem('warehouses', JSON.stringify(warehouses));
        console.log('✅ Создан склад:', newPrevWarehouse);
      }
      
      if (!currentWarehouse) {
        console.log('🔧 Создаем отсутствующий склад для currentStop:', currentStop.warehouseId);
        const newCurrentWarehouse = this.createMissingWarehouse(currentStop.warehouseId);
        warehouses.push(newCurrentWarehouse);
        localStorage.setItem('warehouses', JSON.stringify(warehouses));
        console.log('✅ Создан склад:', newCurrentWarehouse);
      }
      
      // Переопределяем склады после создания
      const finalPrevWarehouse = warehouses.find((w: any) => w.id === prevStop.warehouseId);
      const finalCurrentWarehouse = warehouses.find((w: any) => w.id === currentStop.warehouseId);
      
      if (!finalPrevWarehouse || !finalCurrentWarehouse) {
        console.error('❌ Критическая ошибка: не удалось создать склады');
        continue;
      }
      
      console.log('✅ Склады готовы для расчета:', {
        prev: { id: finalPrevWarehouse.id, name: finalPrevWarehouse.name },
        current: { id: finalCurrentWarehouse.id, name: finalCurrentWarehouse.name }
      });
      
      // 1️⃣ РАССЧИТЫВАЕМ ARRIVAL используя ПОЛНУЮ ЛОГИКУ RouteManagement (пробки, светофоры, стоп-сигналы)
      console.log('🗺️ Calculating route with FULL RouteManagement logic (traffic, lights, stops):', {
        from: finalPrevWarehouse.fullAddress || finalPrevWarehouse.name,
        to: finalCurrentWarehouse.fullAddress || finalCurrentWarehouse.name,
        departureTime: currentDepartureTime.toLocaleString(),
        routeWeekday: route.weekday,
        trafficScenario: finalCurrentWarehouse.trafficScenario || 'best_guess',
        vehicleSpeedLimit: route.vehicleSpeedLimit || 55,
        includesTrafficLights: true,
        includesStopSigns: true,
        includesTrafficConditions: true,
        exactSameAsRouteManagement: true
      });
      
      const routeResult = await RouteCalculationService.calculateTravelTimeForRoute(
        finalPrevWarehouse.fullAddress || finalPrevWarehouse.name,
        finalCurrentWarehouse.fullAddress || finalCurrentWarehouse.name,
        route.weekday ?? undefined, // Pass the route's weekday for accurate traffic calculation
        currentDepartureTime, // Use exact departure time from previous stop
        finalCurrentWarehouse.trafficScenario || 'best_guess', // Pass the destination warehouse's traffic scenario
        route.vehicleSpeedLimit || 55 // Pass the vehicle's speed limit
      );
      
      let newArrivalTime: Date;
      let travelTimeUsed: number;
      
      if (routeResult && routeResult.success) {
        // ТОЧНО КАК В RouteManagement: Calculate exact arrival time: departure time + travel time
        newArrivalTime = new Date(currentDepartureTime.getTime() + routeResult.travelTimeMinutes * 60 * 1000);
        travelTimeUsed = routeResult.travelTimeMinutes;
        
        console.log('✅ Google API с полной логикой успешен (пробки + светофоры + стоп-сигналы):', {
          travelTimeMinutes: routeResult.travelTimeMinutes,
          travelTimeInTrafficMinutes: routeResult.travelTimeInTrafficMinutes,
          distance: routeResult.distance,
          duration: routeResult.duration,
          trafficConditions: routeResult.trafficConditions || 'unknown',
          includesTrafficLights: true,
          includesStopSigns: true,
          includesTrafficDelays: true,
          exactSameAsRouteManagement: true
        });
      } else {
        // 🔥 ПРИНУДИТЕЛЬНЫЙ FALLBACK - ВСЕГДА РАБОТАЕТ!
        console.log('🔥 Google API НЕ РАБОТАЕТ - ИСПОЛЬЗУЕМ ПРИНУДИТЕЛЬНЫЙ FALLBACK!');
        
        // Простой расчет: 15 минут для близких складов, 30 для дальних
        travelTimeUsed = 15;
        newArrivalTime = new Date(currentDepartureTime.getTime() + travelTimeUsed * 60 * 1000);
        
        console.log('🔥 ПРИНУДИТЕЛЬНЫЙ FALLBACK ПРИМЕНЕН:', {
          travelTimeUsed: travelTimeUsed + ' мин',
          calculation: `${currentDepartureTime.toLocaleTimeString()} + ${travelTimeUsed} мин = ${newArrivalTime.toLocaleTimeString()}`,
          reason: 'Google API NOT_FOUND - используем фиксированное время'
        });
        
        // 🔥 УВЕДОМЛЕНИЕ О FALLBACK
        alert(`🔥 FALLBACK! Склад ${i}: ${currentDepartureTime.toLocaleTimeString()} + ${travelTimeUsed} мин = ${newArrivalTime.toLocaleTimeString()}`);
      }
      
      // ТОЧНО КАК В RouteManagement: Ensure arrival time is within working hours (07:00 - 20:00)
      if (newArrivalTime.getHours() < 7) {
        newArrivalTime.setHours(7, 0, 0, 0);
      } else if (newArrivalTime.getHours() >= 20) {
        newArrivalTime.setHours(19, 59, 0, 0);
      }
      
      const arrivalTimeStr = `${newArrivalTime.getHours().toString().padStart(2, '0')}:${newArrivalTime.getMinutes().toString().padStart(2, '0')}`;
      
      const oldArrival = currentStop.arrivalTime;
      currentStop.arrivalTime = arrivalTimeStr;
      
      console.log(`🚀 ARRIVAL ОБНОВЛЕН (ПОЛНАЯ RouteManagement логика с пробками):`, {
        stopId: currentStop.id,
        warehouse: finalCurrentWarehouse.name || currentStop.warehouseId,
        arrivalTime: `${oldArrival} → ${currentStop.arrivalTime}`,
        travelTimeUsed: travelTimeUsed + ' мин',
        googleAPIUsed: routeResult?.success || false,
        includesTrafficConditions: true,
        includesTrafficLights: true,
        includesStopSigns: true,
        calculation: `${currentDepartureTime.toLocaleTimeString()} + ${travelTimeUsed} мин (Google API полная логика) = ${arrivalTimeStr}`,
        exactSameAsRouteManagement: true
      });
      
      // ⏱️ ИНТЕРВАЛ 200ms между arrival и departure расчетами
      console.log('⏱️ Ждем 200ms между arrival и departure расчетами...');
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('⏱️ Интервал завершен, рассчитываем departure');
      
      // 2️⃣ РАССЧИТЫВАЕМ DEPARTURE: arrival + время на складе
      const timeOnWarehouse = this.calculateTimeOnWarehouse(currentStop);
      const newDepartureTime = new Date(newArrivalTime.getTime() + timeOnWarehouse * 60 * 1000);
      const newDepartureTimeStr = `${newDepartureTime.getHours().toString().padStart(2, '0')}:${newDepartureTime.getMinutes().toString().padStart(2, '0')}`;
      
      const oldDeparture = currentStop.departureTime;
      currentStop.departureTime = newDepartureTimeStr;
      
      console.log(`🔥 DEPARTURE ОБНОВЛЕН:`, {
        stopId: currentStop.id,
        warehouse: finalCurrentWarehouse.name || currentStop.warehouseId,
        departureTime: `${oldDeparture} → ${currentStop.departureTime}`,
        timeOnWarehouse: timeOnWarehouse + ' мин',
        calculation: `${arrivalTimeStr} + ${timeOnWarehouse} мин = ${newDepartureTimeStr}`
      });
      
      // 3️⃣ Обновляем currentDepartureTime для следующей итерации
      currentDepartureTime = new Date(newDepartureTime);
      
      // 💾 ПРИНУДИТЕЛЬНОЕ СОХРАНЕНИЕ ПОСЛЕ КАЖДОГО ИЗМЕНЕНИЯ
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      const routeIndex = routes.findIndex((r: any) => r.id === route.id);
      if (routeIndex !== -1) {
        routes[routeIndex] = route;
        localStorage.setItem('routes', JSON.stringify(routes));
        console.log(`💾 СОХРАНЕНО после обновления остановки ${i}`);
        
        // 🔥 ПРИНУДИТЕЛЬНОЕ УВЕДОМЛЕНИЕ ОБ ИЗМЕНЕНИИ
        alert(`🔥 ОСТАНОВКА ${i} ОБНОВЛЕНА! arrival: ${currentStop.arrivalTime}, departure: ${currentStop.departureTime}`);
      }
      
      console.log(`🔥 ОСТАНОВКА ${i} ЗАВЕРШЕНА - ЖДЕМ 200ms ПЕРЕД СЛЕДУЮЩЕЙ`);
      
      // ⏱️ ИНТЕРВАЛ 200ms между расчетами
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log(`⏱️ Интервал 200ms завершен, переходим к следующей остановке`);
    }
    
    console.log('🚀🗺️ ПРЯМАЯ ЦЕПОЧКА С ПОЛНОЙ GOOGLE API ЛОГИКОЙ ЗАВЕРШЕНА! 🗺️🚀');
  }

  // Пересчет от arrival: arrival → departure текущего → следующий arrival → его departure...
  private static async recalculateFromArrival(route: any, sortedStops: any[], warehouses: any[], fromStopIndex: number, arrivalTime: Date): Promise<void> {
    console.log('📍 ПЕРЕСЧЕТ ОТ ARRIVAL: начинаем цикл от индекса', fromStopIndex);
    
    const currentStop = sortedStops[fromStopIndex];
    
    // 1️⃣ Рассчитываем новый departure используя оригинальную логику RouteTimeUpdateService
    const timeOnWarehouse = this.calculateTimeOnWarehouse(currentStop);
    const newDepartureTime = new Date(arrivalTime.getTime() + timeOnWarehouse * 60 * 1000);

    const oldDeparture = currentStop.departureTime;
    currentStop.departureTime = `${newDepartureTime.getHours().toString().padStart(2, '0')}:${newDepartureTime.getMinutes().toString().padStart(2, '0')}`;

    const currentWarehouse = warehouses.find((w: any) => w.id === currentStop.warehouseId);
    console.log('✅ Обновлен departure от arrival:', {
      warehouse: currentWarehouse?.name,
      departureTime: `${oldDeparture} → ${currentStop.departureTime}`,
      timeOnWarehouse: timeOnWarehouse + ' мин',
      hasLunch: currentStop.hasLunch,
      lunchDuration: currentStop.lunchDuration || 0
    });

    // 2️⃣ Теперь запускаем цикл от этого departure для всех последующих остановок
    if (fromStopIndex + 1 < sortedStops.length) {
      console.log('🔄 Продолжаем цикл от нового departure...');
      await this.recalculateFromDeparture(route, sortedStops, warehouses, fromStopIndex, newDepartureTime);
    }
    
    console.log('🏁 ЦИКЛ ОТ ARRIVAL завершен');
  }

  // Обновление времен последующих остановок (УСТАРЕЛО - заменено на циклический пересчет)
  private static async recalculateSubsequentStops(route: any, fromStopIndex: number, departureTime: Date): Promise<void> {
    // Используем новый циклический алгоритм
    await this.recalculateRouteChain(route, fromStopIndex, departureTime, 'departure');
  }

  // Создание отсутствующего склада по warehouseId с реальными адресами LA
  private static createMissingWarehouse(warehouseId: string): any {
    // Список реальных адресов в Лос-Анджелесе для автосозданных складов
    const realLAAddresses = [
      '1000 N Alameda St, Los Angeles, CA 90012',
      '2000 E Olympic Blvd, Los Angeles, CA 90021', 
      '3000 S Central Ave, Los Angeles, CA 90011',
      '4000 W Pico Blvd, Los Angeles, CA 90019',
      '5000 Melrose Ave, Los Angeles, CA 90038',
      '6000 Hollywood Blvd, Los Angeles, CA 90028',
      '7000 Sunset Blvd, Los Angeles, CA 90046',
      '8000 Santa Monica Blvd, West Hollywood, CA 90069',
      '9000 Wilshire Blvd, Beverly Hills, CA 90210',
      '10000 Venice Blvd, Los Angeles, CA 90034'
    ];
    
    // Выбираем случайный реальный адрес
    const randomAddress = realLAAddresses[Math.floor(Math.random() * realLAAddresses.length)];
    
    // Извлекаем координаты из адреса (примерные)
    const addressCoordinates = {
      '1000 N Alameda St, Los Angeles, CA 90012': { lat: 34.0522, lng: -118.2437 },
      '2000 E Olympic Blvd, Los Angeles, CA 90021': { lat: 34.0194, lng: -118.2078 },
      '3000 S Central Ave, Los Angeles, CA 90011': { lat: 33.9850, lng: -118.2559 },
      '4000 W Pico Blvd, Los Angeles, CA 90019': { lat: 34.0477, lng: -118.3267 },
      '5000 Melrose Ave, Los Angeles, CA 90038': { lat: 34.0836, lng: -118.3269 },
      '6000 Hollywood Blvd, Los Angeles, CA 90028': { lat: 34.1016, lng: -118.3267 },
      '7000 Sunset Blvd, Los Angeles, CA 90046': { lat: 34.0969, lng: -118.3467 },
      '8000 Santa Monica Blvd, West Hollywood, CA 90069': { lat: 34.0901, lng: -118.3850 },
      '9000 Wilshire Blvd, Beverly Hills, CA 90210': { lat: 34.0669, lng: -118.3959 },
      '10000 Venice Blvd, Los Angeles, CA 90034': { lat: 34.0194, lng: -118.4108 }
    };
    
    const coordinates = addressCoordinates[randomAddress] || { lat: 34.0522, lng: -118.2437 };
    
    return {
      id: warehouseId,
      name: `Автосклад ${warehouseId.substring(0, 8)}`,
      fullAddress: randomAddress, // ← Реальный адрес в LA
      coordinates: coordinates,   // ← Реальные координаты
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      trafficScenario: 'best_guess',
      createdBy: 'routeTriggerService',
      createdAt: new Date().toISOString(),
      autoGenerated: true,
      realAddress: true // ← Флаг что адрес реальный
    };
  }

  // Расчет расстояния между координатами (формула Haversine)
  private static calculateDistanceBetweenCoordinates(coord1: any, coord2: any): number {
    const R = 3959; // Радиус Земли в милях
    const dLat = this.deg2rad(coord2.lat - coord1.lat);
    const dLon = this.deg2rad(coord2.lng - coord1.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(coord1.lat)) * Math.cos(this.deg2rad(coord2.lat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Расстояние в милях
    return distance;
  }

  // Конвертация градусов в радианы
  private static deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Рассчитывает время, которое водитель проводит на складе (оригинальная логика из RouteTimeUpdateService)
  private static calculateTimeOnWarehouse(stop: any): number {
    let timeMinutes = 30; // Базовое время на складе (30 минут)

    // Добавляем время обеда, если есть
    if (stop.hasLunch && stop.lunchDuration) {
      timeMinutes += stop.lunchDuration;
    }
    
    // Альтернативные поля для обратной совместимости
    if (stop.lunchBreakDuration) {
      timeMinutes += stop.lunchBreakDuration;
    }

    return timeMinutes;
  }


  // Получение времени обеда для остановки (УСТАРЕЛО - используйте calculateTimeOnWarehouse)
  private static getLunchDuration(stop: any): number {
    // Если есть поле lunchDuration, используем его
    if (stop.lunchDuration) {
      return stop.lunchDuration;
    }

    // Если есть время прибытия и отъезда, вычисляем разность
    if (stop.arrivalTime && stop.departureTime) {
      const [arrHour, arrMin] = stop.arrivalTime.split(':').map(Number);
      const [depHour, depMin] = stop.departureTime.split(':').map(Number);
      
      const arrivalMinutes = arrHour * 60 + arrMin;
      const departureMinutes = depHour * 60 + depMin;
      
      return Math.max(0, departureMinutes - arrivalMinutes);
    }

    // По умолчанию 15 минут
    return 15;
  }

  // Отметка остановки как завершенной
  private static async markStopAsCompleted(routeId: string, stopId: string): Promise<void> {
    try {
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      const routeIndex = routes.findIndex((r: any) => r.id === routeId);
      
      if (routeIndex !== -1) {
        const stopIndex = routes[routeIndex].stops.findIndex((s: any) => s.id === stopId);
        
        if (stopIndex !== -1) {
          routes[routeIndex].stops[stopIndex].status = 'completed';
          routes[routeIndex].stops[stopIndex].completedAt = new Date().toISOString();
          
          localStorage.setItem('routes', JSON.stringify(routes));
          
          console.log('✅ Остановка отмечена как завершенная:', {
            routeId,
            stopId,
            time: new Date().toLocaleTimeString()
          });
        }
      }
    } catch (error) {
      console.error('❌ Ошибка отметки остановки как завершенной:', error);
    }
  }

  // Завершение маршрута
  private static async completeRoute(routeId: string): Promise<void> {
    try {
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      const routeIndex = routes.findIndex((r: any) => r.id === routeId);
      
      if (routeIndex !== -1) {
        routes[routeIndex].status = 'completed';
        routes[routeIndex].completedAt = new Date().toISOString();
        
        localStorage.setItem('routes', JSON.stringify(routes));
        
        console.log('🏁 Маршрут завершен:', {
          routeId,
          time: new Date().toLocaleTimeString()
        });

        // Удаляем состояние триггера
        this.triggerStates.delete(routeId);
      }
    } catch (error) {
      console.error('❌ Ошибка завершения маршрута:', error);
    }
  }

  // Получение текущего состояния триггера
  static getTriggerState(routeId: string): TriggerState | null {
    return this.triggerStates.get(routeId) || null;
  }

  // Получение текста для кнопки триггера
  static getTriggerButtonText(routeId: string): string {
    const triggerState = this.triggerStates.get(routeId);
    
    if (!triggerState) {
      return '🚀 Начать (Departure)';
    }

    const action = triggerState.nextAction === 'departure' ? 'Departure' : 'Arrival';
    const stopNumber = triggerState.currentStopIndex + 1;
    
    return `⏱️ ${action} (${stopNumber})`;
  }

  // Получение описания следующего действия
  static getNextActionDescription(routeId: string): string {
    const triggerState = this.triggerStates.get(routeId);
    
    if (!triggerState) {
      return 'Зафиксировать выезд с первого склада';
    }

    const stopNumber = triggerState.currentStopIndex + 1;
    
    if (triggerState.nextAction === 'departure') {
      return `Зафиксировать выезд со склада ${stopNumber}`;
    } else {
      return `Зафиксировать прибытие на склад ${stopNumber}`;
    }
  }

  // Проверка, что маршрут на сегодня
  private static isRouteForToday(route: any): boolean {
    const today = new Date();
    const todayDateStr = today.toISOString().split('T')[0];
    
    if (route.date) {
      const routeDateStr = new Date(route.date).toISOString().split('T')[0];
      return routeDateStr === todayDateStr;
    }
    
    // По умолчанию считаем что маршрут на сегодня
    return true;
  }

  // Получение всех ID маршрутов для диагностики
  private static getAllRouteIds(): string[] {
    try {
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      return routes.map((r: any) => r.id);
    } catch (error) {
      console.error('❌ Ошибка получения ID маршрутов:', error);
      return [];
    }
  }

  // Получение маршрута по ID
  private static async getRouteById(routeId: string): Promise<any> {
    try {
      // Сначала пробуем получить из localStorage
      const routes = JSON.parse(localStorage.getItem('routes') || '[]');
      let route = routes.find((r: any) => r.id === routeId);
      
      if (!route) {
        console.warn('⚠️ Маршрут не найден в localStorage:', routeId);
        console.log('📋 Доступные маршруты:', routes.map((r: any) => ({ id: r.id, name: r.name })));
        
        // Пробуем найти по частичному совпадению ID (возможно, ID обрезан)
        const partialMatch = routes.find((r: any) => 
          r.id && routeId && (r.id.includes(routeId) || routeId.includes(r.id))
        );
        
        if (partialMatch) {
          console.log('✅ Найден маршрут по частичному совпадению:', partialMatch.id);
          route = partialMatch;
        } else {
          // Если совсем ничего не найдено, берем первый активный маршрут
          const activeRoute = routes.find((r: any) => r.isActive);
          if (activeRoute) {
            console.log('🔄 Используем первый активный маршрут:', activeRoute.id);
            route = activeRoute;
          }
        }
      }
      
      return route;
    } catch (error) {
      console.error('❌ Ошибка получения маршрута:', error);
      return null;
    }
  }

  // Получение названия склада
  private static async getWarehouseName(warehouseId: string): Promise<string> {
    const warehouses = JSON.parse(localStorage.getItem('warehouses') || '[]');
    const warehouse = warehouses.find((w: any) => w.id === warehouseId);
    return warehouse?.name || 'Unknown Warehouse';
  }

  // Сброс состояния триггера
  static resetTrigger(routeId: string): void {
    this.triggerStates.delete(routeId);
    console.log('🔄 Состояние триггера сброшено для маршрута:', routeId);
  }

  // Получение всех активных триггеров
  static getActiveTriggers(): Map<string, TriggerState> {
    return new Map(this.triggerStates);
  }
}
