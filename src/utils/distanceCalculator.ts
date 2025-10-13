/**
 * Утилиты для расчета расстояний между GPS координатами
 */

export interface GPSPosition {
  latitude: number;
  longitude: number;
}

/**
 * Вычисляет расстояние между двумя GPS точками в милях
 * Использует формулу Haversine для точного расчета на сферической Земле
 */
export function calculateDistanceInMiles(
  position1: GPSPosition,
  position2: GPSPosition
): number {
  const R = 3959; // Радиус Земли в милях
  const dLat = toRadians(position2.latitude - position1.latitude);
  const dLng = toRadians(position2.longitude - position1.longitude);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(position1.latitude)) * Math.cos(toRadians(position2.latitude)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Проверяет, находится ли водитель в пределах указанного радиуса от склада
 */
export function isWithinRadius(
  driverPosition: GPSPosition,
  warehousePosition: GPSPosition,
  radiusMiles: number = 0.1
): boolean {
  const distance = calculateDistanceInMiles(driverPosition, warehousePosition);
  return distance <= radiusMiles;
}

/**
 * Конвертирует градусы в радианы
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Форматирует расстояние для отображения пользователю
 */
export function formatDistance(distanceMiles: number): string {
  if (distanceMiles < 0.01) {
    return '< 0.01 мили';
  } else if (distanceMiles < 1) {
    return `${(distanceMiles * 1000).toFixed(0)} футов`;
  } else {
    return `${distanceMiles.toFixed(2)} мили`;
  }
}
