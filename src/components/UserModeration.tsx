import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { User, UserRole } from '../types';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Phone, 
  MapPin, 
  Shield, 
  User as UserIcon,
  Search,
  Filter,
  MessageCircle,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

const UserModeration: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswords, setShowPasswords] = useState<{[key: string]: boolean}>({});
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Loading state check
  if (!state.users || !state.warehouses) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Загрузка данных пользователей...</p>
        </div>
      </div>
    );
  }

  const handleAddUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleDeleteUser = (userId: string) => {
    const user = state.users.find(u => u.id === userId);
    if (window.confirm(`Вы уверены, что хотите удалить пользователя "${user?.firstName} ${user?.lastName}"?`)) {
      dispatch({ type: 'DELETE_USER', payload: userId });
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleBulkDelete = () => {
    if (selectedUsers.length === 0) return;
    
    if (window.confirm(`Вы уверены, что хотите удалить ${selectedUsers.length} пользователей?`)) {
      selectedUsers.forEach(userId => {
        dispatch({ type: 'DELETE_USER', payload: userId });
      });
      setSelectedUsers([]);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Администратор';
      case 'warehouse_employee':
        return 'Сотрудник склада';
      case 'driver':
        return 'Водитель';
      default:
        return role;
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'warehouse_employee':
        return 'bg-blue-100 text-blue-800';
      case 'driver':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWarehouseName = (warehouseId: string) => {
    return state.warehouses.find(w => w.id === warehouseId)?.name || 'Неизвестный склад';
  };

  const filteredUsers = state.users.filter(user => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesSearch = searchTerm === '' || 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phoneNumber.includes(searchTerm) ||
      (user.telegramId && user.telegramId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesRole && matchesSearch;
  });

  const roleCounts = {
    all: state.users.length,
    admin: state.users.filter(u => u.role === 'admin').length,
    warehouse_employee: state.users.filter(u => u.role === 'warehouse_employee').length,
    driver: state.users.filter(u => u.role === 'driver').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Модерация пользователей</h1>
          <p className="text-gray-600 mt-1">Управление пользователями системы и их правами доступа</p>
        </div>
        <div className="flex space-x-3">
          {selectedUsers.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="btn-danger flex items-center"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить выбранные ({selectedUsers.length})
            </button>
          )}
          <button
            onClick={handleAddUser}
            className="btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить пользователя
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по имени, логину, телефону или Telegram ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 input"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
              className="input min-w-[150px]"
            >
              <option value="all">Все роли</option>
              <option value="admin">Администраторы</option>
              <option value="warehouse_employee">Сотрудники склада</option>
              <option value="driver">Водители</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div 
          className={`card p-4 cursor-pointer transition-colors ${
            roleFilter === 'all' ? 'ring-2 ring-primary-500' : 'hover:bg-gray-50'
          }`}
          onClick={() => setRoleFilter('all')}
        >
          <div className="flex items-center">
            <Users className="h-5 w-5 text-gray-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Всего пользователей</p>
              <p className="text-lg font-semibold text-gray-900">{roleCounts.all}</p>
            </div>
          </div>
        </div>

        <div 
          className={`card p-4 cursor-pointer transition-colors ${
            roleFilter === 'admin' ? 'ring-2 ring-primary-500' : 'hover:bg-gray-50'
          }`}
          onClick={() => setRoleFilter('admin')}
        >
          <div className="flex items-center">
            <Shield className="h-5 w-5 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Администраторы</p>
              <p className="text-lg font-semibold text-gray-900">{roleCounts.admin}</p>
            </div>
          </div>
        </div>

        <div 
          className={`card p-4 cursor-pointer transition-colors ${
            roleFilter === 'warehouse_employee' ? 'ring-2 ring-primary-500' : 'hover:bg-gray-50'
          }`}
          onClick={() => setRoleFilter('warehouse_employee')}
        >
          <div className="flex items-center">
            <UserIcon className="h-5 w-5 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Сотрудники склада</p>
              <p className="text-lg font-semibold text-gray-900">{roleCounts.warehouse_employee}</p>
            </div>
          </div>
        </div>

        <div 
          className={`card p-4 cursor-pointer transition-colors ${
            roleFilter === 'driver' ? 'ring-2 ring-primary-500' : 'hover:bg-gray-50'
          }`}
          onClick={() => setRoleFilter('driver')}
        >
          <div className="flex items-center">
            <UserIcon className="h-5 w-5 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Водители</p>
              <p className="text-lg font-semibold text-gray-900">{roleCounts.driver}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {roleFilter === 'all' ? 'Все пользователи' : `${getRoleLabel(roleFilter as UserRole)}ы`}
            {searchTerm && ` (найдено: ${filteredUsers.length})`}
          </h3>
          {filteredUsers.length > 0 && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedUsers.length === filteredUsers.length}
                onChange={toggleAllUsers}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-500">Выбрать все</span>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={toggleAllUsers}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Роль
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Контакты
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Склад
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пароль
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Создан
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 ${selectedUsers.includes(user.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <UserIcon className="h-5 w-5 text-gray-500" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          @{user.login}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-gray-400 mr-1" />
                        {user.phoneNumber}
                      </div>
                      {user.telegramId && (
                        <div className="flex items-center">
                          <MessageCircle className="h-4 w-4 text-gray-400 mr-1" />
                          @{user.telegramId}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                      {getWarehouseName(user.warehouseId)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono">
                        {showPasswords[user.id] ? user.password : '••••••••'}
                      </span>
                      <button
                        onClick={() => togglePasswordVisibility(user.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords[user.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(user.createdAt), 'dd.MM.yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Редактировать пользователя"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Удалить пользователя"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'Пользователи не найдены' : 'Нет пользователей'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm 
                ? `По запросу "${searchTerm}" ничего не найдено`
                : roleFilter === 'all' 
                  ? 'Начните с добавления первого пользователя'
                  : `Нет пользователей с ролью "${getRoleLabel(roleFilter as UserRole)}"`
              }
            </p>
            {!searchTerm && (
              <button onClick={handleAddUser} className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Добавить пользователя
              </button>
            )}
          </div>
        )}
      </div>

      {/* Security Warning */}
      <div className="card p-4 bg-yellow-50 border-yellow-200">
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800">Безопасность</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Пароли пользователей отображаются в открытом виде только для администраторов. 
              Убедитесь, что экран не виден посторонним лицам.
            </p>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <UserModerationForm
          user={editingUser}
          warehouses={state.warehouses}
          onClose={handleFormClose}
          onSave={(user) => {
            if (editingUser) {
              dispatch({ type: 'UPDATE_USER', payload: user });
            } else {
              dispatch({ type: 'ADD_USER', payload: user });
            }
            handleFormClose();
          }}
        />
      )}
    </div>
  );
};

interface UserModerationFormProps {
  user: User | null;
  warehouses: any[];
  onClose: () => void;
  onSave: (user: User) => void;
}

const UserModerationForm: React.FC<UserModerationFormProps> = ({ user, warehouses, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    login: user?.login || '',
    password: user?.password || '',
    phoneNumber: user?.phoneNumber || '',
    telegramId: user?.telegramId || '',
    warehouseId: user?.warehouseId || '',
    role: user?.role || 'warehouse_employee' as UserRole,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newUser: User = {
      id: user?.id || Date.now().toString(),
      ...formData,
      email: `${formData.login}@ntruck.com`,
      name: `${formData.firstName} ${formData.lastName}`,
      createdAt: user?.createdAt || new Date(),
    };

    onSave(newUser);
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Администратор' },
    { value: 'warehouse_employee', label: 'Сотрудник склада' },
    { value: 'driver', label: 'Водитель' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {user ? 'Редактировать пользователя' : 'Добавить пользователя'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Имя *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={handleChange('firstName')}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Фамилия *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={handleChange('lastName')}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Логин *
              </label>
              <input
                type="text"
                value={formData.login}
                onChange={handleChange('login')}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Пароль *
              </label>
              <input
                type="text"
                value={formData.password}
                onChange={handleChange('password')}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Номер телефона *
              </label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={handleChange('phoneNumber')}
                className="input"
                placeholder="+1 (555) 123-4567"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telegram ID
              </label>
              <input
                type="text"
                value={formData.telegramId}
                onChange={handleChange('telegramId')}
                className="input"
                placeholder="username или @username"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Склад *
            </label>
            <select
              value={formData.warehouseId}
              onChange={handleChange('warehouseId')}
              className="input"
              required
            >
              <option value="">Выберите склад...</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Роль *
            </label>
            <select
              value={formData.role}
              onChange={handleChange('role')}
              className="input"
              required
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Информация о ролях:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li><strong>Администратор:</strong> Полный доступ ко всем функциям системы</li>
              <li><strong>Сотрудник склада:</strong> Создание заявок, просмотр дашборда</li>
              <li><strong>Водитель:</strong> Просмотр назначенных маршрутов и GPS отслеживание</li>
            </ul>
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {user ? 'Обновить' : 'Добавить'} пользователя
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModeration;
