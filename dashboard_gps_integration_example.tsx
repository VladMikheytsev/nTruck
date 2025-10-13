// Пример интеграции GPS модуля в Dashboard.tsx
// Добавьте эти изменения в существующий файл Dashboard.tsx

// 1. Добавить импорт GPS компонентов
import GPSTrackingTab from './GPSTrackingTab';
import { Navigation } from 'lucide-react';

// 2. Обновить тип activeTab
const [activeTab, setActiveTab] = useState<'requests' | 'routes' | 'sender-groups' | 'receiver-groups' | 'gps'>('requests');

// 3. Добавить GPS кнопку в навигацию (найдите существующие кнопки вкладок и добавьте после них)
<button
  onClick={() => setActiveTab('gps')}
  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
    activeTab === 'gps'
      ? 'bg-blue-600 text-white'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  }`}
>
  <Navigation className="h-4 w-4 mr-2" />
  GPS Отслеживание
</button>

// 4. Добавить рендеринг GPS вкладки (найдите другие условия activeTab === и добавьте после них)
{activeTab === 'gps' && (
  <div className="space-y-6">
    <GPSTrackingTab />
  </div>
)}

// Полный пример структуры Dashboard с GPS:
const Dashboard: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState<'requests' | 'routes' | 'sender-groups' | 'receiver-groups' | 'gps'>('requests');
  // ... остальные состояния

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'requests'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Заявки на перемещение
          </button>
          
          <button
            onClick={() => setActiveTab('routes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'routes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Маршруты
          </button>

          <button
            onClick={() => setActiveTab('sender-groups')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sender-groups'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            По складу отправителя
          </button>

          <button
            onClick={() => setActiveTab('receiver-groups')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'receiver-groups'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            По складу получателя
          </button>

          {/* Новая GPS вкладка */}
          <button
            onClick={() => setActiveTab('gps')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'gps'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Navigation className="h-4 w-4 mr-1" />
            GPS Отслеживание
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'requests' && (
        // ... существующий контент для заявок
      )}

      {activeTab === 'routes' && (
        // ... существующий контент для маршрутов
      )}

      {activeTab === 'sender-groups' && (
        // ... существующий контент для складов отправителя
      )}

      {activeTab === 'receiver-groups' && (
        // ... существующий контент для складов получателя
      )}

      {/* Новая GPS вкладка */}
      {activeTab === 'gps' && (
        <div className="space-y-6">
          <GPSTrackingTab />
        </div>
      )}
    </div>
  );
};
