# 🚀 Руководство по деплою NTruck

## Обзор архитектуры

Приложение состоит из двух частей:
1. **Frontend (React + Vite)** - статические файлы
2. **Backend (Proxy Server)** - Node.js сервер для GPS API

## 🎯 Рекомендуемые платформы

### Вариант 1: Vercel + Railway (Рекомендуется)
- ✅ **Frontend**: Vercel (бесплатный план)
- ✅ **Backend**: Railway (бесплатный план $5/месяц кредит)
- ✅ **Простота**: Самый легкий вариант
- ✅ **Скорость**: Быстрый деплой

### Вариант 2: Netlify + Render
- ✅ **Frontend**: Netlify (бесплатный план)
- ✅ **Backend**: Render (бесплатный план с ограничениями)

### Вариант 3: VPS (DigitalOcean, Linode, AWS)
- ✅ **Полный контроль**
- ⚠️ **Требует настройки**
- 💰 **От $5/месяц**

---

## 📦 Вариант 1: Vercel + Railway

### Часть 1: Подготовка проекта

#### 1.1. Создайте файл конфигурации для production

**`vite.config.ts`** (обновите):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
```

#### 1.2. Обновите proxy-server для production

Создайте **`server.js`** в корне проекта:
```javascript
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3002;

// CORS configuration for production
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Trak-4 API proxy endpoint
app.post('/api/trak4/device', async (req, res) => {
  try {
    console.log('📡 Proxy: Received request for Trak-4 device data');
    
    const { APIKey, DeviceID } = req.body;
    
    if (!APIKey || !DeviceID) {
      return res.status(400).json({
        error: 'Missing required parameters',
        details: 'Both APIKey and DeviceID are required'
      });
    }

    const apiUrl = 'https://api-v3.trak-4.com/Device/GetDeviceByID';
    
    console.log(`🌐 Forwarding to Trak-4 API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        APIKey,
        DeviceID
      })
    });

    const data = await response.json();
    
    console.log(`✅ Received response from Trak-4 (Status: ${response.status})`);
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Trak-4 API Error',
        status: response.status,
        statusText: response.statusText,
        details: JSON.stringify(data)
      });
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Proxy Error:', error);
    res.status(500).json({
      error: 'Proxy Server Error',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Trak-4 GPS Proxy Server is running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Trak-4 GPS Proxy Server started');
  console.log(`📡 Server running on port ${PORT}`);
  console.log('🔗 Proxy endpoint: POST /api/trak4/device');
  console.log('❤️ Health check: GET /health');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});
```

#### 1.3. Создайте `package.json` для backend

Создайте **`backend/package.json`**:
```json
{
  "name": "ntruck-proxy-server",
  "version": "1.0.0",
  "description": "GPS Proxy Server for NTruck",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "node-fetch": "^2.7.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

#### 1.4. Создайте environment configuration

**`.env.example`**:
```env
# Backend
PORT=3002
FRONTEND_URL=https://your-app.vercel.app

# Frontend (создайте .env в корне)
VITE_API_URL=https://your-backend.railway.app
```

### Часть 2: Деплой Backend на Railway

#### 2.1. Подготовка
1. Зарегистрируйтесь на [Railway.app](https://railway.app)
2. Подключите GitHub аккаунт

#### 2.2. Создание проекта
```bash
# 1. Установите Railway CLI
npm install -g @railway/cli

# 2. Войдите в Railway
railway login

# 3. Инициализируйте проект
railway init

# 4. Создайте новый проект
railway up
```

#### 2.3. Настройка переменных окружения
В Railway Dashboard:
- `PORT` → автоматически
- `FRONTEND_URL` → URL вашего Vercel проекта (установите позже)

#### 2.4. Деплой
```bash
# Задеплоить backend
cd backend
railway up
```

Railway автоматически:
- Определит Node.js проект
- Установит зависимости
- Запустит `npm start`
- Присвоит публичный URL

**Запомните URL**: `https://your-project.railway.app`

### Часть 3: Обновление Frontend для production

#### 3.1. Создайте environment файлы

**`.env.production`**:
```env
VITE_API_URL=https://your-project.railway.app
```

#### 3.2. Обновите сервисы для использования environment переменных

**`src/config/api.ts`** (создайте новый файл):
```typescript
export const API_CONFIG = {
  PROXY_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3002',
  PROXY_DEVICE_URL: `${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/trak4/device`,
  HEALTH_CHECK_URL: `${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/health`,
};
```

#### 3.3. Обновите сервисы

**`src/services/gpsTrackingService.ts`**:
```typescript
import { API_CONFIG } from '../config/api';

export class GPSTrackingService {
  private static readonly API_BASE_URL = 'https://api-v3.trak-4.com';
  private static readonly PROXY_BASE_URL = API_CONFIG.PROXY_BASE_URL;
  // ...
}
```

**`src/services/trak4GPSService.ts`**:
```typescript
import { API_CONFIG } from '../config/api';

export class Trak4GPSService {
  private static readonly API_BASE_URL = 'https://api-v3.trak-4.com';
  private static readonly PROXY_URL = API_CONFIG.PROXY_DEVICE_URL;
  // ...
}
```

### Часть 4: Деплой Frontend на Vercel

#### 4.1. Подготовка
1. Зарегистрируйтесь на [Vercel.com](https://vercel.com)
2. Подключите GitHub аккаунт

#### 4.2. Через Vercel CLI
```bash
# 1. Установите Vercel CLI
npm install -g vercel

# 2. Войдите в Vercel
vercel login

# 3. Деплой
vercel

# 4. Production деплой
vercel --prod
```

#### 4.3. Через Vercel Dashboard
1. Нажмите "Add New Project"
2. Импортируйте GitHub репозиторий
3. Framework: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Environment Variables:
   - `VITE_API_URL` → URL вашего Railway backend

#### 4.4. Настройка
В **Vercel Dashboard** → **Settings**:
- **Environment Variables**:
  - `VITE_API_URL` = `https://your-project.railway.app`

### Часть 5: Финальная настройка

#### 5.1. Обновите CORS в Railway
В Railway Dashboard → Environment Variables:
- `FRONTEND_URL` = `https://your-app.vercel.app`

#### 5.2. Проверьте работу
1. Откройте `https://your-app.vercel.app`
2. Проверьте GPS функционал
3. Проверьте логи в Railway Dashboard

---

## 📦 Вариант 2: Netlify + Render

### Деплой Backend на Render

1. Зарегистрируйтесь на [Render.com](https://render.com)
2. Create New → Web Service
3. Connect GitHub repository
4. Settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment Variables**: `FRONTEND_URL`

### Деплой Frontend на Netlify

1. Зарегистрируйтесь на [Netlify.com](https://netlify.com)
2. Add new site → Import from Git
3. Build settings:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
4. Environment Variables:
   - `VITE_API_URL` = URL вашего Render backend

---

## 🖥️ Вариант 3: VPS (DigitalOcean)

### 1. Создание Droplet
```bash
# На DigitalOcean создайте Ubuntu 22.04 Droplet
# Минимум: $6/месяц (1GB RAM)
```

### 2. Подключение и настройка
```bash
# Подключитесь по SSH
ssh root@your-server-ip

# Обновите систему
apt update && apt upgrade -y

# Установите Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установите Nginx
apt install -y nginx

# Установите PM2 (процесс менеджер)
npm install -g pm2
```

### 3. Загрузка кода
```bash
# Клонируйте репозиторий
git clone https://github.com/your-username/ntruck.git
cd ntruck

# Установите зависимости
npm install

# Build frontend
npm run build
```

### 4. Настройка Backend
```bash
# Создайте .env файл
nano .env
# Добавьте:
# PORT=3002
# FRONTEND_URL=http://your-domain.com

# Запустите backend с PM2
pm2 start server.js --name ntruck-proxy
pm2 save
pm2 startup
```

### 5. Настройка Nginx
```bash
nano /etc/nginx/sites-available/ntruck
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /root/ntruck/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend proxy
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активируйте конфигурацию
ln -s /etc/nginx/sites-available/ntruck /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 6. SSL (Let's Encrypt)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

## 🔐 Безопасность

### 1. Environment Variables
**Никогда не коммитьте**:
- API ключи
- Пароли
- Секретные токены

### 2. CORS
Настройте CORS только для вашего домена:
```javascript
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true
};
```

### 3. Rate Limiting
Добавьте rate limiting для API:
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 📊 Мониторинг

### Vercel Analytics
В Vercel Dashboard включите:
- Analytics
- Speed Insights

### Railway Logs
```bash
railway logs
```

### Error Tracking
Рассмотрите использование:
- Sentry.io (бесплатный план)
- LogRocket
- DataDog

---

## 🚀 CI/CD

### GitHub Actions (автоматический деплой)

**`.github/workflows/deploy.yml`**:
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend
```

---

## 📝 Чеклист перед деплоем

- [ ] Создан production build: `npm run build`
- [ ] Проверены environment variables
- [ ] Обновлены API endpoints
- [ ] Настроен CORS
- [ ] Протестирована работа локально с production настройками
- [ ] Созданы .env.example файлы
- [ ] Добавлен .gitignore для .env файлов
- [ ] Настроен SSL сертификат
- [ ] Проверена работа GPS функционала
- [ ] Настроен мониторинг и логирование

---

## 🆘 Troubleshooting

### CORS ошибки
```javascript
// Проверьте CORS настройки в backend
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true
};
app.use(cors(corsOptions));
```

### API не отвечает
```bash
# Проверьте логи
railway logs  # для Railway
vercel logs   # для Vercel
```

### Frontend не загружается
```bash
# Проверьте build
npm run build
# Проверьте dist папку
ls -la dist/
```

---

## 💰 Стоимость

### Бесплатные варианты:
- **Vercel**: Бесплатно (100GB bandwidth)
- **Railway**: $5/месяц кредит (обычно хватает)
- **Netlify**: Бесплатно (100GB bandwidth)

### Платные варианты:
- **VPS**: От $5/месяц
- **Vercel Pro**: $20/месяц
- **Railway Pro**: От $5/месяц

---

## 📞 Поддержка

При проблемах:
1. Проверьте логи сервера
2. Проверьте консоль браузера
3. Проверьте Network tab в DevTools
4. Проверьте environment variables

**Документация платформ:**
- Vercel: https://vercel.com/docs
- Railway: https://docs.railway.app
- Netlify: https://docs.netlify.com

