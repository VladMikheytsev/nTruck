// Route Adjustment Service for handling route corrections and recalculations
import { RouteCalculationService } from './routeCalculationService';
import { Route, RouteStop } from '../types';

export interface RouteAdjustment {
  id: string;
  routeId: string;
  stopId: string;
  originalArrivalTime: string;
  adjustedArrivalTime: string;
  adjustedDepartureTime?: string;
  reason: string;
  adjustmentType: 'delay' | 'early' | 'manual';
  delayMinutes: number;
  createdAt: Date;
  createdBy: string;
}

export interface AdjustmentResult {
  success: boolean;
  adjustedStops: RouteStop[];
  affectedStopsCount: number;
  totalDelayPropagated: number;
  warnings: string[];
  error?: string;
}

export class RouteAdjustmentService {
  private static adjustmentHistory: Map<string, RouteAdjustment[]> = new Map();

  // Adjust arrival time for a specific stop and recalculate the entire chain
  static async adjustStopArrivalTime(
    route: Route,
    stopId: string,
    newArrivalTime: Date,
    reason: string,
    adjustmentType: 'delay' | 'early' | 'manual' = 'manual',
    createdBy: string = 'user'
  ): Promise<AdjustmentResult> {
    try {
      console.log('🔧 Starting route adjustment for stop:', stopId, 'new time:', newArrivalTime.toLocaleString());

      const stopIndex = route.stops.findIndex(stop => stop.id === stopId);
      if (stopIndex === -1) {
        return {
          success: false,
          adjustedStops: [],
          affectedStopsCount: 0,
          totalDelayPropagated: 0,
          warnings: [],
          error: 'Stop not found in route'
        };
      }

      const targetStop = route.stops[stopIndex];
      const originalArrivalTime = new Date(targetStop.arrivalTime);
      const delayMinutes = Math.round((newArrivalTime.getTime() - originalArrivalTime.getTime()) / (1000 * 60));

      // Create adjustment record
      const adjustment: RouteAdjustment = {
        id: `adj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        routeId: route.id,
        stopId,
        originalArrivalTime: targetStop.arrivalTime,
        adjustedArrivalTime: newArrivalTime.toISOString(),
        reason,
        adjustmentType,
        delayMinutes,
        createdAt: new Date(),
        createdBy
      };

      // Store adjustment in history
      if (!this.adjustmentHistory.has(route.id)) {
        this.adjustmentHistory.set(route.id, []);
      }
      this.adjustmentHistory.get(route.id)!.push(adjustment);

      // Recalculate the route chain from the adjusted stop onwards
      const result = await this.recalculateRouteChain(route, stopIndex, newArrivalTime);

      // Update the adjustment with departure time if calculated
      if (result.adjustedStops.length > 0) {
        const adjustedStop = result.adjustedStops.find(s => s.id === stopId);
        if (adjustedStop) {
          adjustment.adjustedDepartureTime = adjustedStop.departureTime;
        }
      }

      console.log('✅ Route adjustment completed:', {
        stopId,
        delayMinutes,
        affectedStops: result.affectedStopsCount,
        totalDelay: result.totalDelayPropagated
      });

      return {
        ...result,
        success: true
      };

    } catch (error) {
      console.error('❌ Error adjusting route:', error);
      return {
        success: false,
        adjustedStops: [],
        affectedStopsCount: 0,
        totalDelayPropagated: 0,
        warnings: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Recalculate route chain from a specific stop index onwards
  private static async recalculateRouteChain(
    route: Route,
    fromStopIndex: number,
    newArrivalTime: Date
  ): Promise<Omit<AdjustmentResult, 'success'>> {
    const adjustedStops: RouteStop[] = [...route.stops];
    const warnings: string[] = [];
    let totalDelayPropagated = 0;
    let currentTime = new Date(newArrivalTime);

    console.log('🔄 Recalculating route chain from stop index:', fromStopIndex);

    for (let i = fromStopIndex; i < adjustedStops.length; i++) {
      const currentStop = adjustedStops[i];
      const originalArrivalTime = new Date(currentStop.arrivalTime);
      
      // Update arrival time
      currentStop.arrivalTime = currentTime.toISOString();
      
      // Calculate departure time considering lunch break
      const departureTime = this.calculateDepartureTime(currentTime, currentStop);
      currentStop.departureTime = departureTime.toISOString();

      // Calculate delay for this stop
      const stopDelay = Math.round((currentTime.getTime() - originalArrivalTime.getTime()) / (1000 * 60));
      if (stopDelay > 0) {
        totalDelayPropagated += stopDelay;
      }

      // Check for business hours violations
      const arrivalHour = currentTime.getHours();
      if (arrivalHour < 7 || arrivalHour >= 20) {
        warnings.push(`Stop ${i + 1} arrival time ${currentTime.toLocaleTimeString()} is outside business hours (07:00-20:00)`);
      }

      // If this is not the last stop, calculate travel time to next stop
      if (i < adjustedStops.length - 1) {
        const nextStop = adjustedStops[i + 1];
        
        try {
          // Get warehouse addresses for route calculation
          const currentWarehouse = this.getWarehouseById(currentStop.warehouseId);
          const nextWarehouse = this.getWarehouseById(nextStop.warehouseId);
          
          if (currentWarehouse && nextWarehouse) {
            // Calculate travel time using RouteCalculationService
            const travelResult = await RouteCalculationService.calculateTravelTime(
              currentWarehouse.fullAddress,
              nextWarehouse.fullAddress,
              route.weekday ?? undefined,
              departureTime
            );

            if (travelResult && travelResult.success) {
              // Add travel time to get next arrival time
              const nextArrivalTime = new Date(departureTime.getTime() + (travelResult.travelTimeMinutes * 60 * 1000));
              currentTime = nextArrivalTime;

              console.log(`📍 Stop ${i + 1} -> ${i + 2}: ${travelResult.travelTimeMinutes} min travel time`);
            } else {
              // Fallback: use estimated travel time
              const estimatedTravelMinutes = this.estimateTravelTime(currentWarehouse, nextWarehouse);
              currentTime = new Date(departureTime.getTime() + (estimatedTravelMinutes * 60 * 1000));
              warnings.push(`Used estimated travel time (${estimatedTravelMinutes} min) for stop ${i + 1} -> ${i + 2}`);
            }
          } else {
            // Fallback: add 30 minutes
            currentTime = new Date(departureTime.getTime() + (30 * 60 * 1000));
            warnings.push(`Used default travel time (30 min) for stop ${i + 1} -> ${i + 2} - warehouse not found`);
          }
        } catch (error) {
          console.error('Error calculating travel time:', error);
          // Fallback: add 30 minutes
          currentTime = new Date(departureTime.getTime() + (30 * 60 * 1000));
          warnings.push(`Used default travel time (30 min) for stop ${i + 1} -> ${i + 2} due to calculation error`);
        }
      }
    }

    const affectedStopsCount = adjustedStops.length - fromStopIndex;

    console.log('🔄 Route chain recalculation completed:', {
      affectedStops: affectedStopsCount,
      totalDelayPropagated,
      warningsCount: warnings.length
    });

    return {
      adjustedStops,
      affectedStopsCount,
      totalDelayPropagated,
      warnings
    };
  }

  // Calculate departure time considering lunch breaks
  private static calculateDepartureTime(arrivalTime: Date, stop: RouteStop): Date {
    const departureTime = new Date(arrivalTime);
    
    if (stop.hasLunch && stop.lunchDurationMinutes) {
      // Add lunch duration
      departureTime.setMinutes(departureTime.getMinutes() + stop.lunchDurationMinutes);
    } else {
      // Add default service time (e.g., 15 minutes for loading/unloading)
      departureTime.setMinutes(departureTime.getMinutes() + 15);
    }
    
    return departureTime;
  }

  // Get warehouse by ID (this would typically come from a warehouse service)
  private static getWarehouseById(warehouseId: string): any {
    // This is a placeholder - in a real app, this would fetch from the warehouse service
    // For now, we'll return a mock warehouse
    return {
      id: warehouseId,
      name: `Warehouse ${warehouseId}`,
      fullAddress: `Address for warehouse ${warehouseId}`,
      coordinates: { lat: 34.0522, lng: -118.2437 }
    };
  }

  // Estimate travel time between warehouses (fallback method)
  private static estimateTravelTime(fromWarehouse: any, toWarehouse: any): number {
    // Simple distance-based estimation
    // In a real app, this would use more sophisticated logic
    const baseTime = 20; // Base travel time in minutes
    const randomVariation = Math.floor(Math.random() * 20) - 10; // ±10 minutes variation
    return Math.max(5, baseTime + randomVariation);
  }

  // Get adjustment history for a route
  static getAdjustmentHistory(routeId: string): RouteAdjustment[] {
    return this.adjustmentHistory.get(routeId) || [];
  }

  // Get latest adjustment for a specific stop
  static getLatestStopAdjustment(routeId: string, stopId: string): RouteAdjustment | null {
    const history = this.getAdjustmentHistory(routeId);
    const stopAdjustments = history.filter(adj => adj.stopId === stopId);
    return stopAdjustments.length > 0 ? stopAdjustments[stopAdjustments.length - 1] : null;
  }

  // Calculate total delay for a route
  static calculateTotalRouteDelay(routeId: string): number {
    const history = this.getAdjustmentHistory(routeId);
    return history.reduce((total, adj) => total + Math.max(0, adj.delayMinutes), 0);
  }

  // Check if a route has any adjustments
  static hasAdjustments(routeId: string): boolean {
    return this.getAdjustmentHistory(routeId).length > 0;
  }

  // Clear adjustment history for a route
  static clearRouteAdjustments(routeId: string): void {
    this.adjustmentHistory.delete(routeId);
    console.log('🧹 Cleared adjustment history for route:', routeId);
  }

  // Get summary of all route adjustments
  static getAdjustmentSummary(routeId: string): {
    totalAdjustments: number;
    totalDelayMinutes: number;
    affectedStops: number;
    lastAdjustment?: Date;
  } {
    const history = this.getAdjustmentHistory(routeId);
    const uniqueStops = new Set(history.map(adj => adj.stopId));
    const totalDelay = history.reduce((sum, adj) => sum + Math.max(0, adj.delayMinutes), 0);
    const lastAdjustment = history.length > 0 ? history[history.length - 1].createdAt : undefined;

    return {
      totalAdjustments: history.length,
      totalDelayMinutes: totalDelay,
      affectedStops: uniqueStops.size,
      lastAdjustment
    };
  }

  // Suggest optimal adjustment based on current delays
  static suggestOptimalAdjustment(route: Route, currentStopIndex: number, currentDelay: number): {
    suggestedArrivalTime: Date;
    reasoning: string;
    impactAnalysis: string;
  } {
    const currentStop = route.stops[currentStopIndex];
    const originalTime = new Date(currentStop.arrivalTime);
    const suggestedTime = new Date(originalTime.getTime() + (currentDelay * 60 * 1000));

    // Analyze impact on subsequent stops
    const remainingStops = route.stops.length - currentStopIndex - 1;
    const estimatedPropagation = Math.round(currentDelay * 0.8); // Assume 80% delay propagation

    return {
      suggestedArrivalTime: suggestedTime,
      reasoning: `Based on current delay of ${currentDelay} minutes, adjusting arrival time to maintain schedule feasibility`,
      impactAnalysis: `This adjustment will affect ${remainingStops} subsequent stops with an estimated ${estimatedPropagation} minutes delay propagation`
    };
  }
}
