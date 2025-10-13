import React from 'react';
import { Database } from '../utils/database';
import { Trash2, Download, Upload, RefreshCw } from 'lucide-react';

const DatabaseManager: React.FC = () => {
  const handleClearDatabase = () => {
    if (window.confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      Database.clear();
      window.location.reload();
    }
  };

  const handleExportData = () => {
    const data = Database.export();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ntruck-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = e.target?.result as string;
        if (Database.import(jsonData)) {
          alert('Data imported successfully!');
          window.location.reload();
        } else {
          alert('Error importing data. Please check the file format.');
        }
      } catch (error) {
        alert('Error reading file.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset to default demo data? This will overwrite all current data.')) {
      Database.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Database Management</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={handleClearDatabase}
          className="flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Data
        </button>
        
        <button
          onClick={handleExportData}
          className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </button>
        
        <label className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors cursor-pointer">
          <Upload className="h-4 w-4 mr-2" />
          Import
          <input
            type="file"
            accept=".json"
            onChange={handleImportData}
            className="hidden"
          />
        </label>
        
        <button
          onClick={handleResetToDefaults}
          className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </button>
      </div>
    </div>
  );
};

export default DatabaseManager;
