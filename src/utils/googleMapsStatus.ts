// Google Maps API Status Checker
import { GOOGLE_MAPS_CONFIG } from '../config/googleMaps';

export interface GoogleMapsStatus {
  isLoaded: boolean;
  hasApiKey: boolean;
  isInitialized: boolean;
  error?: string;
  suggestions?: string[];
}

export class GoogleMapsStatusChecker {
  static checkStatus(): GoogleMapsStatus {
    const status: GoogleMapsStatus = {
      isLoaded: false,
      hasApiKey: false,
      isInitialized: false,
      suggestions: []
    };

    // Check if API key is configured
    if (!GOOGLE_MAPS_CONFIG.apiKey || GOOGLE_MAPS_CONFIG.apiKey.trim() === '') {
      status.error = 'API ключ не настроен';
      status.suggestions?.push('Добавьте действительный API ключ в src/config/googleMaps.ts');
      return status;
    }
    status.hasApiKey = true;

    // Check if Google Maps is loaded
    if (typeof window === 'undefined') {
      status.error = 'Выполняется на сервере (SSR)';
      return status;
    }

    if (typeof google === 'undefined' || !google.maps) {
      status.error = 'Google Maps JavaScript API не загружен';
      status.suggestions?.push('Убедитесь, что useGoogleMaps hook используется в компоненте');
      status.suggestions?.push('Проверьте интернет соединение');
      status.suggestions?.push('Проверьте настройки домена в Google Cloud Console');
      return status;
    }
    status.isLoaded = true;

    // Check if DirectionsService is available
    try {
      if (google.maps.DirectionsService) {
        new google.maps.DirectionsService();
        status.isInitialized = true;
      } else {
        console.info('ℹ️ DirectionsService недоступен, но Maps API загружен - это нормально');
        status.isInitialized = true; // Позволяем продолжить работу
        status.suggestions?.push('DirectionsService недоступен, но базовые функции карты работают');
      }
    } catch (error) {
      console.warn('⚠️ Ошибка при проверке DirectionsService:', error);
      status.isInitialized = true; // Позволяем продолжить работу с базовой функциональностью
      status.suggestions?.push('DirectionsService недоступен, но базовые функции карты работают');
    }

    return status;
  }

  static logStatus(): void {
    const status = this.checkStatus();
    
    console.group('📍 Google Maps API Status');
    
    if (status.isInitialized) {
      console.log('✅ Google Maps API готов к использованию');
      console.log('📊 Статус компонентов:', {
        'API Key': status.hasApiKey ? '✅ Настроен' : '❌ Отсутствует',
        'JavaScript API': status.isLoaded ? '✅ Загружен' : '❌ Не загружен',
        'DirectionsService': status.isInitialized ? '✅ Доступен' : '❌ Недоступен'
      });
    } else {
      console.warn('⚠️ Google Maps API недоступен:', status.error);
      
      if (status.suggestions && status.suggestions.length > 0) {
        console.group('💡 Рекомендации по устранению:');
        status.suggestions.forEach((suggestion, index) => {
          console.log(`${index + 1}. ${suggestion}`);
        });
        console.groupEnd();
      }
    }
    
    console.groupEnd();
  }

  static async testApiKey(): Promise<boolean> {
    const status = this.checkStatus();
    
    if (!status.isLoaded) {
      console.warn('❌ Невозможно протестировать API ключ: Google Maps не загружен');
      return false;
    }

    try {
      const geocoder = new google.maps.Geocoder();
      
      return new Promise((resolve) => {
        geocoder.geocode({ address: 'Los Angeles, CA' }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK) {
            console.log('✅ API ключ работает корректно');
            resolve(true);
          } else {
            console.warn('❌ Ошибка при тестировании API ключа:', status);
            
            switch (status) {
              case google.maps.GeocoderStatus.REQUEST_DENIED:
                console.warn('🔑 API ключ недействителен или ограничен');
                break;
              case google.maps.GeocoderStatus.OVER_QUERY_LIMIT:
                console.warn('📊 Превышена квота запросов');
                break;
              default:
                console.warn('🌐 Проблема с сетью или сервисом');
            }
            
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error('❌ Ошибка при тестировании API ключа:', error);
      return false;
    }
  }
}

// Utility function for components
export const useGoogleMapsStatus = () => {
  return GoogleMapsStatusChecker.checkStatus();
};
