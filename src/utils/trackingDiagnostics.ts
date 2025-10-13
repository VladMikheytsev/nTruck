// Утилита для диагностики проблем с отслеживанием геозон

export interface DiagnosticResult {
  category: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

export class TrackingDiagnostics {
  // Проверка всех компонентов системы отслеживания
  static async runFullDiagnostics(
    driver: any,
    route: any,
    vehicle: any,
    warehouses: any[]
  ): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    // 1. Проверка водителя
    results.push(this.checkDriver(driver));

    // 2. Проверка маршрута
    results.push(this.checkRoute(route));

    // 3. Проверка автомобиля
    results.push(this.checkVehicle(vehicle));

    // 4. Проверка GPS конфигурации
    results.push(this.checkGPSConfiguration(vehicle));

    // 5. Проверка складов
    results.push(...this.checkWarehouses(route, warehouses));

    // 6. Проверка прокси сервера
    results.push(await this.checkProxyServer());

    // 7. Проверка подключения к Trak-4 API
    if (vehicle?.gpsApiKey && vehicle?.gpsDeviceId) {
      results.push(await this.checkTrak4Connection(vehicle.gpsApiKey, vehicle.gpsDeviceId));
    }

    return results;
  }

  // Проверка водителя
  private static checkDriver(driver: any): DiagnosticResult {
    if (!driver) {
      return {
        category: 'Водитель',
        status: 'error',
        message: 'Водитель не выбран',
        details: { driver: null }
      };
    }

    if (!driver.id || !driver.firstName || !driver.lastName) {
      return {
        category: 'Водитель',
        status: 'error',
        message: 'Неполные данные водителя',
        details: { 
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName
        }
      };
    }

    return {
      category: 'Водитель',
      status: 'success',
      message: `Водитель: ${driver.firstName} ${driver.lastName}`,
      details: { driverId: driver.id }
    };
  }

  // Проверка маршрута
  private static checkRoute(route: any): DiagnosticResult {
    if (!route) {
      return {
        category: 'Маршрут',
        status: 'error',
        message: 'Маршрут не выбран',
        details: { route: null }
      };
    }

    if (!route.id || !route.name) {
      return {
        category: 'Маршрут',
        status: 'error',
        message: 'Неполные данные маршрута',
        details: { 
          id: route.id,
          name: route.name
        }
      };
    }

    if (!route.stops || !Array.isArray(route.stops) || route.stops.length === 0) {
      return {
        category: 'Маршрут',
        status: 'error',
        message: 'Маршрут не содержит остановок',
        details: { 
          stops: route.stops,
          stopsCount: route.stops?.length || 0
        }
      };
    }

    if (route.stops.length < 2) {
      return {
        category: 'Маршрут',
        status: 'warning',
        message: 'Маршрут содержит менее 2 остановок',
        details: { stopsCount: route.stops.length }
      };
    }

    return {
      category: 'Маршрут',
      status: 'success',
      message: `Маршрут: ${route.name} (${route.stops.length} остановок)`,
      details: { 
        routeId: route.id,
        stopsCount: route.stops.length
      }
    };
  }

  // Проверка автомобиля
  private static checkVehicle(vehicle: any): DiagnosticResult {
    if (!vehicle) {
      return {
        category: 'Автомобиль',
        status: 'error',
        message: 'Автомобиль не назначен водителю',
        details: { vehicle: null }
      };
    }

    if (!vehicle.id || !vehicle.name) {
      return {
        category: 'Автомобиль',
        status: 'error',
        message: 'Неполные данные автомобиля',
        details: { 
          id: vehicle.id,
          name: vehicle.name
        }
      };
    }

    return {
      category: 'Автомобиль',
      status: 'success',
      message: `Автомобиль: ${vehicle.name}`,
      details: { vehicleId: vehicle.id }
    };
  }

  // Проверка GPS конфигурации
  private static checkGPSConfiguration(vehicle: any): DiagnosticResult {
    if (!vehicle) {
      return {
        category: 'GPS Конфигурация',
        status: 'error',
        message: 'Автомобиль не найден',
        details: { vehicle: null }
      };
    }

    const hasApiKey = !!vehicle.gpsApiKey;
    const hasDeviceId = !!vehicle.gpsDeviceId;

    if (!hasApiKey && !hasDeviceId) {
      return {
        category: 'GPS Конфигурация',
        status: 'error',
        message: 'GPS API ключ и Device ID не настроены',
        details: { 
          hasApiKey: false,
          hasDeviceId: false
        }
      };
    }

    if (!hasApiKey) {
      return {
        category: 'GPS Конфигурация',
        status: 'error',
        message: 'GPS API ключ не настроен',
        details: { 
          hasApiKey: false,
          hasDeviceId: true
        }
      };
    }

    if (!hasDeviceId) {
      return {
        category: 'GPS Конфигурация',
        status: 'error',
        message: 'GPS Device ID не настроен',
        details: { 
          hasApiKey: true,
          hasDeviceId: false
        }
      };
    }

    // Проверяем формат Device ID (должен быть числом)
    const deviceIdNumber = parseInt(vehicle.gpsDeviceId);
    if (isNaN(deviceIdNumber)) {
      return {
        category: 'GPS Конфигурация',
        status: 'error',
        message: 'GPS Device ID должен быть числом',
        details: { 
          deviceId: vehicle.gpsDeviceId,
          isNumber: false
        }
      };
    }

    return {
      category: 'GPS Конфигурация',
      status: 'success',
      message: `GPS настроен (Device ID: ${vehicle.gpsDeviceId})`,
      details: { 
        hasApiKey: true,
        hasDeviceId: true,
        deviceId: deviceIdNumber
      }
    };
  }

  // Проверка складов
  private static checkWarehouses(route: any, warehouses: any[]): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    if (!warehouses || !Array.isArray(warehouses)) {
      results.push({
        category: 'Склады',
        status: 'error',
        message: 'Список складов недоступен',
        details: { warehouses: warehouses }
      });
      return results;
    }

    if (!route?.stops) {
      results.push({
        category: 'Склады',
        status: 'error',
        message: 'Остановки маршрута недоступны',
        details: { stops: route?.stops }
      });
      return results;
    }

    // Проверяем каждую остановку маршрута
    route.stops.forEach((stop: any, index: number) => {
      const warehouse = warehouses.find(w => w.id === stop.warehouseId);
      
      if (!warehouse) {
        results.push({
          category: `Склад ${index + 1}`,
          status: 'error',
          message: `Склад не найден (ID: ${stop.warehouseId})`,
          details: { 
            warehouseId: stop.warehouseId,
            availableWarehouses: warehouses.map(w => ({ id: w.id, name: w.name }))
          }
        });
        return;
      }

      if (!warehouse.coordinates || !warehouse.coordinates.lat || !warehouse.coordinates.lng) {
        results.push({
          category: `Склад ${index + 1}`,
          status: 'error',
          message: `У склада "${warehouse.name}" отсутствуют GPS координаты`,
          details: { 
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            coordinates: warehouse.coordinates
          }
        });
        return;
      }

      // Проверяем валидность координат
      const lat = warehouse.coordinates.lat;
      const lng = warehouse.coordinates.lng;
      
      if (typeof lat !== 'number' || typeof lng !== 'number' || 
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        results.push({
          category: `Склад ${index + 1}`,
          status: 'error',
          message: `У склада "${warehouse.name}" некорректные GPS координаты`,
          details: { 
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            coordinates: { lat, lng }
          }
        });
        return;
      }

      results.push({
        category: `Склад ${index + 1}`,
        status: 'success',
        message: `${warehouse.name} (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
        details: { 
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          coordinates: { lat, lng }
        }
      });
    });

    return results;
  }

  // Проверка прокси сервера
  private static async checkProxyServer(): Promise<DiagnosticResult> {
    try {
      const response = await fetch('http://localhost:3002/health', {
        method: 'GET',
        timeout: 5000
      } as any);

      if (!response.ok) {
        return {
          category: 'Прокси Сервер',
          status: 'error',
          message: `Прокси сервер недоступен (HTTP ${response.status})`,
          details: { 
            status: response.status,
            statusText: response.statusText
          }
        };
      }

      const data = await response.json();
      return {
        category: 'Прокси Сервер',
        status: 'success',
        message: 'Прокси сервер работает',
        details: data
      };
    } catch (error) {
      return {
        category: 'Прокси Сервер',
        status: 'error',
        message: 'Не удается подключиться к прокси серверу',
        details: { 
          error: error instanceof Error ? error.message : String(error),
          url: 'http://localhost:3002/health'
        }
      };
    }
  }

  // Проверка подключения к Trak-4 API
  private static async checkTrak4Connection(apiKey: string, deviceId: string): Promise<DiagnosticResult> {
    try {
      const response = await fetch('http://localhost:3002/api/trak4/device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          APIKey: apiKey,
          DeviceID: parseInt(deviceId)
        }),
        timeout: 10000
      } as any);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          category: 'Trak-4 API',
          status: 'error',
          message: `Ошибка Trak-4 API (HTTP ${response.status})`,
          details: { 
            status: response.status,
            statusText: response.statusText,
            error: errorText
          }
        };
      }

      const data = await response.json();
      
      if (data.Device) {
        const hasCoordinates = !!(data.Device.LastReport_Latitude || data.Device.Latitude);
        return {
          category: 'Trak-4 API',
          status: hasCoordinates ? 'success' : 'warning',
          message: hasCoordinates ? 
            'Trak-4 API работает, GPS данные получены' : 
            'Trak-4 API работает, но нет GPS координат',
          details: { 
            deviceFound: true,
            hasCoordinates,
            deviceData: data.Device
          }
        };
      } else {
        return {
          category: 'Trak-4 API',
          status: 'error',
          message: 'Устройство не найдено в Trak-4 API',
          details: { 
            deviceFound: false,
            response: data
          }
        };
      }
    } catch (error) {
      return {
        category: 'Trak-4 API',
        status: 'error',
        message: 'Не удается подключиться к Trak-4 API',
        details: { 
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  // Форматирование результатов диагностики для отображения
  static formatDiagnosticsForDisplay(results: DiagnosticResult[]): string {
    const sections = {
      success: results.filter(r => r.status === 'success'),
      warning: results.filter(r => r.status === 'warning'),
      error: results.filter(r => r.status === 'error')
    };

    let output = '🔍 ДИАГНОСТИКА СИСТЕМЫ ОТСЛЕЖИВАНИЯ\n\n';

    if (sections.error.length > 0) {
      output += '❌ ОШИБКИ:\n';
      sections.error.forEach(result => {
        output += `• ${result.category}: ${result.message}\n`;
      });
      output += '\n';
    }

    if (sections.warning.length > 0) {
      output += '⚠️ ПРЕДУПРЕЖДЕНИЯ:\n';
      sections.warning.forEach(result => {
        output += `• ${result.category}: ${result.message}\n`;
      });
      output += '\n';
    }

    if (sections.success.length > 0) {
      output += '✅ УСПЕШНО:\n';
      sections.success.forEach(result => {
        output += `• ${result.category}: ${result.message}\n`;
      });
    }

    return output;
  }
}
