# 🚂 Railway Backend Deployment Guide

## Шаг 1: Создание проекта на Railway

1. **Откройте [railway.app](https://railway.app)**
2. **Войдите в аккаунт** (или создайте новый)
3. **Нажмите "Start a New Project"**
4. **Выберите "Deploy from GitHub repo"**
5. **Выберите репозиторий**: `VladMikheytsev/nTruck`

## Шаг 2: Настройка проекта

### 2.1 Настройте Root Directory
- **ВАЖНО**: В настройках проекта установите **Root Directory** на `backend`
- Это заставит Railway использовать папку `backend/` как корень проекта
- Railway автоматически найдет `package.json` в папке `backend/`

### 2.2 Настройте переменные окружения
В разделе **Variables** добавьте:

```
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://navitruck-29urxp7gv-vladshkriabas-projects.vercel.app
CORS_ORIGIN=https://navitruck-29urxp7gv-vladshkriabas-projects.vercel.app
```

### 2.3 Настройте домен
- Railway автоматически создаст URL типа: `https://ntruck-production.railway.app`
- **Скопируйте этот URL** - он понадобится для настройки Vercel

## Шаг 3: Обновление Vercel

### 3.1 Добавьте переменную окружения в Vercel
1. **Откройте [vercel.com](https://vercel.com)**
2. **Перейдите в проект**: `navitruck`
3. **Settings** → **Environment Variables**
4. **Добавьте новую переменную**:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://your-railway-url.railway.app` (URL от Railway)
   - **Environment**: Production

### 3.2 Передеплойте frontend
1. **Deployments** → **Redeploy** (последний деплой)
2. Или выполните: `vercel --prod`

## Шаг 4: Тестирование

### 4.1 Проверьте backend
```bash
# Проверьте health endpoint
curl https://your-railway-url.railway.app/health

# Должен вернуть: {"status":"ok","message":"Trak-4 GPS Proxy Server is running"}
```

### 4.2 Проверьте frontend
1. **Откройте**: https://navitruck-29urxp7gv-vladshkriabas-projects.vercel.app
2. **Войдите**: admin / admin123
3. **Перейдите в "Транспорт"**
4. **Проверьте GPS статус** - должен работать без ошибок

## Шаг 5: Troubleshooting

### Если GPS не работает:

1. **Проверьте Railway логи**:
   - Railway Dashboard → Project → Deployments → View Logs

2. **Проверьте переменные окружения**:
   - Убедитесь, что `VITE_API_URL` правильно настроена в Vercel

3. **Проверьте CORS**:
   - Railway должен разрешать запросы с Vercel домена

4. **Проверьте API ключи**:
   - Убедитесь, что Trak-4 API ключи корректны

## Полезные команды

```bash
# Локальная проверка backend
cd backend
npm install
npm start

# Проверка Railway CLI (опционально)
npm install -g @railway/cli
railway login
railway status
railway logs
```

## Структура проекта

```
nTruck/
├── backend/                 # Railway backend
│   ├── package.json        # Backend dependencies
│   ├── server.js          # Production server
│   └── env.example        # Environment variables example
├── src/                    # Vercel frontend
│   └── services/          # GPS services (обновлены для продакшена)
├── vercel.json            # Vercel configuration
└── railway.json           # Railway configuration
```

## Готово! 🎉

После настройки Railway и обновления Vercel:
- **Frontend**: https://navitruck-29urxp7gv-vladshkriabas-projects.vercel.app
- **Backend**: https://your-railway-url.railway.app
- **GPS функционал** должен работать в продакшене
