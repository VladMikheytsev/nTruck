import { useState, useEffect } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { GOOGLE_MAPS_CONFIG } from '../config/googleMaps';

let isGoogleMapsLoaded = false;
let isGoogleMapsLoading = false;
let loadPromise: Promise<any> | null = null;

export const useGoogleMaps = () => {
  const [isLoaded, setIsLoaded] = useState(isGoogleMapsLoaded);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!isGoogleMapsLoaded);

  useEffect(() => {
    if (isGoogleMapsLoaded) {
      setIsLoaded(true);
      setIsLoading(false);
      return;
    }

    if (isGoogleMapsLoading && loadPromise) {
      loadPromise
        .then(() => {
          setIsLoaded(true);
          setIsLoading(false);
        })
        .catch((err: any) => {
          console.error('Error loading Google Maps API:', err);
          
          let errorMessage = 'Ошибка загрузки Google Maps API';
          if (err.message?.includes('InvalidKeyMapError')) {
            errorMessage = 'Недействительный API ключ Google Maps';
          } else if (err.message?.includes('RefererNotAllowedMapError')) {
            errorMessage = 'Домен не разрешен для данного API ключа';
          }
          
          setError(errorMessage);
          setIsLoading(false);
        });
      return;
    }

    const loadGoogleMaps = async () => {
      try {
        isGoogleMapsLoading = true;
        
        console.log('🗺️ Loading Google Maps with config:', {
          apiKey: GOOGLE_MAPS_CONFIG.apiKey.substring(0, 20) + '...',
          libraries: GOOGLE_MAPS_CONFIG.libraries,
          version: GOOGLE_MAPS_CONFIG.version
        });
        
        const loader = new Loader(GOOGLE_MAPS_CONFIG);
        
        loadPromise = loader.load();
        await loadPromise;
        
        console.log('✅ Google Maps loaded successfully');
        
        isGoogleMapsLoaded = true;
        isGoogleMapsLoading = false;
        setIsLoaded(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error loading Google Maps API:', err);
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          config: GOOGLE_MAPS_CONFIG
        });
        
        let errorMessage = 'Ошибка загрузки Google Maps API';
        
        if (err.message?.includes('InvalidKeyMapError')) {
          errorMessage = 'Недействительный API ключ Google Maps';
        } else if (err.message?.includes('RefererNotAllowedMapError')) {
          errorMessage = 'Домен не разрешен для данного API ключа';
        } else if (err.message?.includes('RequestDeniedMapError')) {
          errorMessage = 'Запрос отклонен Google Maps API';
        } else if (err.message?.includes('QuotaExceededError')) {
          errorMessage = 'Превышена квота Google Maps API';
        } else if (err.message?.includes('NetworkError')) {
          errorMessage = 'Ошибка сети при загрузке Google Maps API';
        }
        
        isGoogleMapsLoading = false;
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    loadGoogleMaps();
  }, []);

  return { isLoaded, isLoading, error };
};
