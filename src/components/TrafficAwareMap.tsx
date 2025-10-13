import React, { useEffect, useRef, useState } from 'react';
import { RouteCalculationResult } from '../services/routeCalculationService';

interface TrafficAwareMapProps {
  routeResult?: RouteCalculationResult;
  origin?: string;
  destination?: string;
  className?: string;
}

const TrafficAwareMap: React.FC<TrafficAwareMapProps> = ({
  routeResult,
  origin,
  destination,
  className = "w-full h-96"
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [trafficLayer, setTrafficLayer] = useState<google.maps.TrafficLayer | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || typeof google === 'undefined') return;

    const mapInstance = new google.maps.Map(mapRef.current, {
      zoom: 10,
      center: { lat: 34.0522, lng: -118.2437 }, // LA default
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapId: 'DEMO_MAP_ID',
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    // Add traffic layer
    const traffic = new google.maps.TrafficLayer();
    traffic.setMap(mapInstance);

    // Add directions renderer
    const renderer = new google.maps.DirectionsRenderer({
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#4285F4',
        strokeWeight: 6,
        strokeOpacity: 0.8
      }
    });
    renderer.setMap(mapInstance);

    setMap(mapInstance);
    setTrafficLayer(traffic);
    setDirectionsRenderer(renderer);

    console.log('🗺️ TrafficAwareMap initialized with traffic layer');
  }, []);

  // Display route with traffic information
  useEffect(() => {
    if (!map || !directionsRenderer || !routeResult?.polyline) return;

    try {
      // If we have polyline from Routes API, decode and display it
      if (routeResult.polyline) {
        displayRouteFromPolyline(routeResult.polyline);
      }
    } catch (error) {
      console.error('❌ Error displaying route:', error);
    }
  }, [map, directionsRenderer, routeResult]);

  const displayRouteFromPolyline = (encodedPolyline: string) => {
    if (!map) return;

    try {
      // Decode polyline and create path
      const decodedPath = google.maps.geometry.encoding.decodePath(encodedPolyline);
      
      // Create polyline with traffic-aware styling
      const routePolyline = new google.maps.Polyline({
        path: decodedPath,
        geodesic: true,
        strokeColor: getRouteColor(),
        strokeOpacity: 0.8,
        strokeWeight: 6
      });

      routePolyline.setMap(map);

      // Fit map to route bounds
      const bounds = new google.maps.LatLngBounds();
      decodedPath.forEach(point => bounds.extend(point));
      map.fitBounds(bounds);

      // Add markers for start and end
      if (decodedPath.length > 0) {
        // Start marker
        if (google.maps.marker?.AdvancedMarkerElement) {
          const startPin = new google.maps.marker.PinElement({
            background: '#4CAF50',
            borderColor: '#2E7D32',
            glyphColor: '#ffffff',
            glyph: '🚀',
            scale: 1.0
          });

          new google.maps.marker.AdvancedMarkerElement({
            position: decodedPath[0],
            map: map,
            title: 'Start',
            content: startPin.element
          });
        } else {
          new google.maps.Marker({
            position: decodedPath[0],
            map: map,
            title: 'Start',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#4CAF50',
              fillOpacity: 1,
              strokeColor: '#2E7D32',
              strokeWeight: 2
            }
          });
        }

        // End marker
        if (google.maps.marker?.AdvancedMarkerElement) {
          const endPin = new google.maps.marker.PinElement({
            background: '#F44336',
            borderColor: '#C62828',
            glyphColor: '#ffffff',
            glyph: '🏁',
            scale: 1.0
          });

          new google.maps.marker.AdvancedMarkerElement({
            position: decodedPath[decodedPath.length - 1],
            map: map,
            title: 'End',
            content: endPin.element
          });
        } else {
          new google.maps.Marker({
            position: decodedPath[decodedPath.length - 1],
            map: map,
            title: 'End',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#F44336',
              fillOpacity: 1,
              strokeColor: '#C62828',
              strokeWeight: 2
            }
          });
        }
      }

      console.log('✅ Route displayed with traffic layer');
    } catch (error) {
      console.error('❌ Error decoding polyline:', error);
    }
  };

  const getRouteColor = (): string => {
    if (!routeResult?.trafficInfo) return '#4285F4'; // Default blue

    switch (routeResult.trafficInfo.trafficConditions) {
      case 'light':
        return '#4CAF50'; // Green
      case 'moderate':
        return '#FF9800'; // Orange
      case 'heavy':
        return '#F44336'; // Red
      default:
        return '#4285F4'; // Blue
    }
  };

  const getTrafficStatusText = (): string => {
    if (!routeResult?.trafficInfo) return 'Traffic data unavailable';

    const { trafficConditions, delayMinutes } = routeResult.trafficInfo;
    
    switch (trafficConditions) {
      case 'light':
        return `Light traffic (+${delayMinutes} min)`;
      case 'moderate':
        return `Moderate traffic (+${delayMinutes} min)`;
      case 'heavy':
        return `Heavy traffic (+${delayMinutes} min)`;
      default:
        return 'Traffic conditions unknown';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      
      {/* Traffic info overlay */}
      {routeResult?.trafficInfo && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs">
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getRouteColor() }}
            />
            <span className="text-sm font-medium">
              {getTrafficStatusText()}
            </span>
          </div>
          
          {routeResult.speedLimitInfo && (
            <div className="mt-2 text-xs text-gray-600">
              <div>Avg. speed limit: {routeResult.speedLimitInfo.averageSpeedLimit} mph</div>
              {routeResult.speedLimitInfo.speedLimitUsed && (
                <div className="text-orange-600">Vehicle speed limited</div>
              )}
            </div>
          )}
          
          {routeResult.additionalDelays && (
            <div className="mt-2 text-xs text-gray-600">
              <div className="font-medium">Additional delays:</div>
              <div>Traffic lights: +{routeResult.additionalDelays.trafficLightDelayMinutes}m</div>
              <div>Stop signs: +{routeResult.additionalDelays.stopSignDelayMinutes}m</div>
              <div>Intersections: +{routeResult.additionalDelays.intersectionDelayMinutes}m</div>
              <div className="text-blue-600 capitalize">Route: {routeResult.additionalDelays.routeComplexity}</div>
            </div>
          )}
          
          <div className="mt-2 text-xs text-gray-500">
            <div>Distance: {routeResult.distance}</div>
            <div>Duration: {routeResult.durationInTraffic || routeResult.duration}</div>
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3">
        <div className="text-xs font-medium text-gray-700 mb-2">Traffic Conditions</div>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs">Light</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-xs">Moderate</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs">Heavy</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficAwareMap;
