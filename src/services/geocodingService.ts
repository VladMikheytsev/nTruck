// Сервис для работы с Google Geocoding API

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId?: string;
  addressComponents: {
    streetNumber?: string;
    route?: string;
    locality?: string;
    administrativeAreaLevel1?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface GeocodeError {
  error: string;
  status: string;
  details?: string;
}

export class GeocodingService {
  private static readonly GEOCODING_CACHE = new Map<string, GeocodeResult>();
  private static readonly CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 часа
  private static readonly CACHE_TIMESTAMPS = new Map<string, number>();

  // Получение координат по адресу
  static async getCoordinatesByAddress(address: string): Promise<GeocodeResult | GeocodeError> {
    if (!address || address.trim().length === 0) {
      return {
        error: 'Адрес не может быть пустым',
        status: 'INVALID_REQUEST'
      };
    }

    const cleanAddress = address.trim();
    console.log('🗺️ Geocoding request for address:', cleanAddress);

    // Проверяем кеш
    const cachedResult = this.getCachedResult(cleanAddress);
    if (cachedResult) {
      console.log('📦 Using cached geocoding result for:', cleanAddress);
      return cachedResult;
    }

    try {
      // Проверяем доступность Google Maps API
      if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
        console.error('❌ Google Maps API not available');
        return {
          error: 'Google Maps API недоступен',
          status: 'API_NOT_AVAILABLE',
          details: 'Убедитесь, что Google Maps API загружен и API ключ корректен'
        };
      }

      const geocoder = new google.maps.Geocoder();
      
      console.log('🔍 Geocoding address with Google API:', cleanAddress);
      
      const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode(
          { 
            address: cleanAddress,
            region: 'US', // Приоритет США для лучших результатов
            language: 'ru' // Русский язык для ответов
          },
          (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
              resolve(results);
            } else {
              reject(new Error(`Geocoding failed: ${status}`));
            }
          }
        );
      });

      if (!result || result.length === 0) {
        return {
          error: 'Адрес не найден',
          status: 'ZERO_RESULTS',
          details: 'Google не смог найти указанный адрес'
        };
      }

      // Берем первый (наиболее точный) результат
      const firstResult = result[0];
      const location = firstResult.geometry.location;
      
      // Парсим компоненты адреса
      const addressComponents = this.parseAddressComponents(firstResult.address_components);
      
      const geocodeResult: GeocodeResult = {
        latitude: location.lat(),
        longitude: location.lng(),
        formattedAddress: firstResult.formatted_address,
        placeId: firstResult.place_id,
        addressComponents
      };

      // Сохраняем в кеш
      this.setCachedResult(cleanAddress, geocodeResult);

      console.log('✅ Geocoding successful:', {
        address: cleanAddress,
        coordinates: `${geocodeResult.latitude}, ${geocodeResult.longitude}`,
        formattedAddress: geocodeResult.formattedAddress
      });

      return geocodeResult;

    } catch (error) {
      console.error('❌ Geocoding error:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Определяем тип ошибки
      if (errorMessage.includes('OVER_QUERY_LIMIT')) {
        return {
          error: 'Превышен лимит запросов к Google API',
          status: 'OVER_QUERY_LIMIT',
          details: 'Попробуйте позже или проверьте квоты API'
        };
      } else if (errorMessage.includes('REQUEST_DENIED')) {
        return {
          error: 'Доступ к Google Geocoding API запрещен',
          status: 'REQUEST_DENIED',
          details: 'Проверьте API ключ и настройки доступа'
        };
      } else if (errorMessage.includes('INVALID_REQUEST')) {
        return {
          error: 'Некорректный запрос к Google API',
          status: 'INVALID_REQUEST',
          details: 'Проверьте формат адреса'
        };
      } else {
        return {
          error: 'Ошибка геокодирования',
          status: 'UNKNOWN_ERROR',
          details: errorMessage
        };
      }
    }
  }

  // Получение адреса по координатам (обратное геокодирование)
  static async getAddressByCoordinates(lat: number, lng: number): Promise<GeocodeResult | GeocodeError> {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return {
        error: 'Некорректные координаты',
        status: 'INVALID_REQUEST'
      };
    }

    const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    console.log('🗺️ Reverse geocoding request for coordinates:', cacheKey);

    // Проверяем кеш
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      console.log('📦 Using cached reverse geocoding result');
      return cachedResult;
    }

    try {
      if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
        return {
          error: 'Google Maps API недоступен',
          status: 'API_NOT_AVAILABLE'
        };
      }

      const geocoder = new google.maps.Geocoder();
      const latLng = new google.maps.LatLng(lat, lng);
      
      const result = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
        geocoder.geocode(
          { 
            location: latLng,
            language: 'ru'
          },
          (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
              resolve(results);
            } else {
              reject(new Error(`Reverse geocoding failed: ${status}`));
            }
          }
        );
      });

      if (!result || result.length === 0) {
        return {
          error: 'Адрес не найден для указанных координат',
          status: 'ZERO_RESULTS'
        };
      }

      const firstResult = result[0];
      const addressComponents = this.parseAddressComponents(firstResult.address_components);
      
      const geocodeResult: GeocodeResult = {
        latitude: lat,
        longitude: lng,
        formattedAddress: firstResult.formatted_address,
        placeId: firstResult.place_id,
        addressComponents
      };

      this.setCachedResult(cacheKey, geocodeResult);

      console.log('✅ Reverse geocoding successful:', {
        coordinates: cacheKey,
        address: geocodeResult.formattedAddress
      });

      return geocodeResult;

    } catch (error) {
      console.error('❌ Reverse geocoding error:', error);
      return {
        error: 'Ошибка обратного геокодирования',
        status: 'UNKNOWN_ERROR',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Валидация адреса (проверка существования)
  static async validateAddress(address: string): Promise<{
    isValid: boolean;
    confidence: 'high' | 'medium' | 'low';
    suggestions?: string[];
    result?: GeocodeResult;
    error?: string;
  }> {
    const geocodeResult = await this.getCoordinatesByAddress(address);
    
    if ('error' in geocodeResult) {
      return {
        isValid: false,
        confidence: 'low',
        error: geocodeResult.error
      };
    }

    // Определяем уверенность на основе типа результата
    const confidence = this.assessAddressConfidence(geocodeResult);
    
    return {
      isValid: true,
      confidence,
      result: geocodeResult
    };
  }

  // Парсинг компонентов адреса
  private static parseAddressComponents(components: google.maps.GeocoderAddressComponent[]) {
    const parsed: GeocodeResult['addressComponents'] = {};
    
    components.forEach(component => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        parsed.streetNumber = component.long_name;
      } else if (types.includes('route')) {
        parsed.route = component.long_name;
      } else if (types.includes('locality')) {
        parsed.locality = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        parsed.administrativeAreaLevel1 = component.short_name;
      } else if (types.includes('country')) {
        parsed.country = component.long_name;
      } else if (types.includes('postal_code')) {
        parsed.postalCode = component.long_name;
      }
    });
    
    return parsed;
  }

  // Оценка уверенности в адресе
  private static assessAddressConfidence(result: GeocodeResult): 'high' | 'medium' | 'low' {
    const components = result.addressComponents;
    
    // Высокая уверенность: есть номер дома и улица
    if (components.streetNumber && components.route) {
      return 'high';
    }
    
    // Средняя уверенность: есть улица или населенный пункт
    if (components.route || components.locality) {
      return 'medium';
    }
    
    // Низкая уверенность: только общие компоненты
    return 'low';
  }

  // Работа с кешем
  private static getCachedResult(key: string): GeocodeResult | null {
    const cached = this.GEOCODING_CACHE.get(key);
    const timestamp = this.CACHE_TIMESTAMPS.get(key);
    
    if (cached && timestamp && (Date.now() - timestamp) < this.CACHE_EXPIRY_MS) {
      return cached;
    }
    
    // Удаляем устаревший кеш
    if (cached) {
      this.GEOCODING_CACHE.delete(key);
      this.CACHE_TIMESTAMPS.delete(key);
    }
    
    return null;
  }

  private static setCachedResult(key: string, result: GeocodeResult): void {
    this.GEOCODING_CACHE.set(key, result);
    this.CACHE_TIMESTAMPS.set(key, Date.now());
  }

  // Очистка кеша
  static clearCache(): void {
    this.GEOCODING_CACHE.clear();
    this.CACHE_TIMESTAMPS.clear();
    console.log('🗑️ Geocoding cache cleared');
  }

  // Статистика кеша
  static getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  } {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    this.CACHE_TIMESTAMPS.forEach((timestamp) => {
      if ((now - timestamp) < this.CACHE_EXPIRY_MS) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    });
    
    return {
      totalEntries: this.GEOCODING_CACHE.size,
      validEntries,
      expiredEntries
    };
  }

  // Форматирование адреса для отображения
  static formatAddressForDisplay(result: GeocodeResult): string {
    const components = result.addressComponents;
    
    // Пытаемся создать краткий адрес
    const parts: string[] = [];
    
    if (components.streetNumber && components.route) {
      parts.push(`${components.route} ${components.streetNumber}`);
    } else if (components.route) {
      parts.push(components.route);
    }
    
    if (components.locality) {
      parts.push(components.locality);
    }
    
    if (components.administrativeAreaLevel1) {
      parts.push(components.administrativeAreaLevel1);
    }
    
    return parts.length > 0 ? parts.join(', ') : result.formattedAddress;
  }

  // Проверка доступности Google Maps API
  static isGoogleMapsAvailable(): boolean {
    return typeof google !== 'undefined' && 
           !!google.maps && 
           !!google.maps.Geocoder;
  }
}
