import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { User, UserRole } from '../types';
import { Plus, Edit, Trash2, Users, Phone, MapPin, Shield, User as UserIcon, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';

const UserManagement: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

  // Loading state check
  if (!state.users || !state.warehouses) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading user data...</p>
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
    if (window.confirm('Are you sure you want to delete this user?')) {
      dispatch({ type: 'DELETE_USER', payload: userId });
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingUser(null);
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
    return state.warehouses.find(w => w.id === warehouseId)?.name || 'Unknown Warehouse';
  };

  const filteredUsers = state.users.filter(user => 
    roleFilter === 'all' || user.role === roleFilter
  );

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
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage system users and their roles</p>
        </div>
        <button
          onClick={handleAddUser}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </button>
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
              <p className="text-sm font-medium text-gray-500">Total Users</p>
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
              <p className="text-sm font-medium text-gray-500">Administrators</p>
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
              <p className="text-sm font-medium text-gray-500">Warehouse Staff</p>
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
              <p className="text-sm font-medium text-gray-500">Drivers</p>
              <p className="text-lg font-semibold text-gray-900">{roleCounts.driver}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {roleFilter === 'all' ? 'All Users' : `${getRoleLabel(roleFilter as UserRole)}s`}
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(user.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500 mb-4">
              {roleFilter === 'all' 
                ? 'Start by adding your first user'
                : `No users with role "${getRoleLabel(roleFilter as UserRole)}"`
              }
            </p>
            <button onClick={handleAddUser} className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <UserForm
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

interface UserFormProps {
  user: User | null;
  warehouses: any[];
  onClose: () => void;
  onSave: (user: User) => void;
}

const UserForm: React.FC<UserFormProps> = ({ user, warehouses, onClose, onSave }) => {
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
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {user ? 'Edit User' : 'Add User'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
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
                Last Name
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
                Login
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
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={handleChange('password')}
                className="input"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Warehouse
            </label>
            <select
              value={formData.warehouseId}
              onChange={handleChange('warehouseId')}
              className="input"
              required
            >
              <option value="">Select warehouse...</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
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

          <div className="flex space-x-3 pt-4">
            <button type="submit" className="btn-primary flex-1">
              {user ? 'Update' : 'Add'} User
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserManagement;
