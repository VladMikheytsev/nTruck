import React, { useState, useEffect } from 'react';
import { Route, RouteStop } from '../types';
import { RouteAdjustmentService, AdjustmentResult } from '../services/routeAdjustmentService';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Calendar,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Save,
  AlertCircle
} from 'lucide-react';

interface RouteAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: Route;
  selectedStopId: string;
  onRouteUpdated: (updatedRoute: Route) => void;
}

const RouteAdjustmentModal: React.FC<RouteAdjustmentModalProps> = ({
  isOpen,
  onClose,
  route,
  selectedStopId,
  onRouteUpdated
}) => {
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);
  const [newArrivalTime, setNewArrivalTime] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'delay' | 'early' | 'manual'>('delay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [adjustmentResult, setAdjustmentResult] = useState<AdjustmentResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize selected stop when modal opens
  useEffect(() => {
    if (isOpen && selectedStopId) {
      const stop = route.stops.find(s => s.id === selectedStopId);
      if (stop) {
        setSelectedStop(stop);
        // Set current arrival time as default
        const currentTime = new Date(stop.arrivalTime);
        const timeString = currentTime.toISOString().slice(0, 16); // Format for datetime-local input
        setNewArrivalTime(timeString);
      }
    }
  }, [isOpen, selectedStopId, route.stops]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedStop(null);
      setNewArrivalTime('');
      setAdjustmentReason('');
      setAdjustmentType('delay');
      setAdjustmentResult(null);
      setShowPreview(false);
    }
  }, [isOpen]);

  const handlePreviewAdjustment = async () => {
    if (!selectedStop || !newArrivalTime) return;

    setIsProcessing(true);
    setShowPreview(true);

    try {
      const adjustedTime = new Date(newArrivalTime);
      const result = await RouteAdjustmentService.adjustStopArrivalTime(
        route,
        selectedStop.id,
        adjustedTime,
        adjustmentReason || 'Manual adjustment',
        adjustmentType,
        'user'
      );

      setAdjustmentResult(result);
    } catch (error) {
      console.error('Error previewing adjustment:', error);
      setAdjustmentResult({
        success: false,
        adjustedStops: [],
        affectedStopsCount: 0,
        totalDelayPropagated: 0,
        warnings: [],
        error: 'Failed to preview adjustment'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyAdjustment = () => {
    if (!adjustmentResult || !adjustmentResult.success) return;

    // Create updated route with adjusted stops
    const updatedRoute: Route = {
      ...route,
      stops: adjustmentResult.adjustedStops,
      updatedAt: new Date()
    };

    onRouteUpdated(updatedRoute);
    onClose();
  };

  const getDelayInfo = () => {
    if (!selectedStop || !newArrivalTime) return null;

    const originalTime = new Date(selectedStop.arrivalTime);
    const newTime = new Date(newArrivalTime);
    const delayMinutes = Math.round((newTime.getTime() - originalTime.getTime()) / (1000 * 60));

    return {
      delayMinutes,
      isDelay: delayMinutes > 0,
      isEarly: delayMinutes < 0
    };
  };

  const delayInfo = getDelayInfo();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Clock className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Корректировка маршрута</h2>
              <p className="text-sm text-gray-600">
                Маршрут: {route.name} | Остановка: {selectedStop?.order || 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Stop Info */}
          {selectedStop && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-900">Текущая остановка</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Склад: {selectedStop.warehouseId} | Порядок: {selectedStop.order}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-blue-600">Текущее время прибытия:</div>
                  <div className="font-medium text-blue-900">
                    {new Date(selectedStop.arrivalTime).toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Adjustment Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Новое время прибытия
                </label>
                <input
                  type="datetime-local"
                  value={newArrivalTime}
                  onChange={(e) => setNewArrivalTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип корректировки
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value as 'delay' | 'early' | 'manual')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="delay">Задержка</option>
                  <option value="early">Раннее прибытие</option>
                  <option value="manual">Ручная корректировка</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Причина корректировки
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Укажите причину изменения времени..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Delay Analysis */}
            <div className="space-y-4">
              {delayInfo && (
                <div className={`p-4 rounded-lg border ${
                  delayInfo.isDelay 
                    ? 'bg-red-50 border-red-200' 
                    : delayInfo.isEarly 
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    {delayInfo.isDelay ? (
                      <TrendingUp className="h-5 w-5 text-red-600" />
                    ) : delayInfo.isEarly ? (
                      <TrendingDown className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-600" />
                    )}
                    <span className={`font-medium ${
                      delayInfo.isDelay 
                        ? 'text-red-900' 
                        : delayInfo.isEarly 
                        ? 'text-green-900'
                        : 'text-gray-900'
                    }`}>
                      {delayInfo.isDelay 
                        ? `Задержка: +${delayInfo.delayMinutes} мин`
                        : delayInfo.isEarly 
                        ? `Раннее прибытие: ${delayInfo.delayMinutes} мин`
                        : 'Без изменений'
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Adjustment History */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">История корректировок</h4>
                {RouteAdjustmentService.hasAdjustments(route.id) ? (
                  <div className="space-y-2">
                    {RouteAdjustmentService.getAdjustmentHistory(route.id).slice(-3).map((adj, index) => (
                      <div key={adj.id} className="text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Остановка {adj.stopId}</span>
                          <span>{adj.delayMinutes > 0 ? '+' : ''}{adj.delayMinutes} мин</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {adj.createdAt.toLocaleString('ru-RU')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Корректировок пока не было</p>
                )}
              </div>
            </div>
          </div>

          {/* Preview Button */}
          <div className="flex justify-center">
            <button
              onClick={handlePreviewAdjustment}
              disabled={!selectedStop || !newArrivalTime || isProcessing}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              <span>{isProcessing ? 'Расчет...' : 'Предварительный расчет'}</span>
            </button>
          </div>

          {/* Adjustment Result */}
          {showPreview && adjustmentResult && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Результат корректировки</h3>
              
              {adjustmentResult.success ? (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-sm text-blue-600">Затронуто остановок</div>
                      <div className="text-2xl font-bold text-blue-900">{adjustmentResult.affectedStopsCount}</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="text-sm text-orange-600">Общая задержка</div>
                      <div className="text-2xl font-bold text-orange-900">+{adjustmentResult.totalDelayPropagated} мин</div>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="text-sm text-yellow-600">Предупреждения</div>
                      <div className="text-2xl font-bold text-yellow-900">{adjustmentResult.warnings.length}</div>
                    </div>
                  </div>

                  {/* Warnings */}
                  {adjustmentResult.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium text-yellow-900">Предупреждения</span>
                      </div>
                      <ul className="space-y-1">
                        {adjustmentResult.warnings.map((warning, index) => (
                          <li key={index} className="text-sm text-yellow-700">• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Updated Schedule Preview */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Обновленное расписание</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {adjustmentResult.adjustedStops.map((stop, index) => {
                        const isAdjusted = index >= route.stops.findIndex(s => s.id === selectedStopId);
                        return (
                          <div 
                            key={stop.id} 
                            className={`flex justify-between items-center p-2 rounded ${
                              isAdjusted ? 'bg-blue-100 border border-blue-200' : 'bg-white'
                            }`}
                          >
                            <span className="text-sm font-medium">Остановка {stop.order}</span>
                            <div className="text-right">
                              <div className="text-sm">
                                Прибытие: {new Date(stop.arrivalTime).toLocaleTimeString('ru-RU')}
                              </div>
                              <div className="text-sm text-gray-600">
                                Отправление: {new Date(stop.departureTime).toLocaleTimeString('ru-RU')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Apply Button */}
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleApplyAdjustment}
                      className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      <span>Применить корректировку</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-900">Ошибка корректировки</span>
                  </div>
                  <p className="text-sm text-red-700 mt-2">
                    {adjustmentResult.error || 'Не удалось выполнить корректировку'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteAdjustmentModal;
