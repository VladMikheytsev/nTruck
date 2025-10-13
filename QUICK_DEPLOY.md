# 🚀 Быстрый деплой NTruck (5 минут)

## Вариант 1: Vercel + Railway (Самый простой)

### Шаг 1: Деплой Backend на Railway (2 минуты)

1. Перейдите на [Railway.app](https://railway.app)
2. Нажмите **"Start a New Project"**
3. Выберите **"Deploy from GitHub repo"**
4. Выберите ваш репозиторий
5. Railway автоматически определит Node.js и задеплоит
6. Скопируйте URL (например: `https://ntruck-proxy.railway.app`)

**Готово!** Backend запущен ✅

### Шаг 2: Деплой Frontend на Vercel (2 минуты)

1. Перейдите на [Vercel.com](https://vercel.com)
2. Нажмите **"Add New Project"**
3. Импортируйте GitHub репозиторий
4. Настройте:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Добавьте Environment Variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://ntruck-proxy.railway.app` (ваш Railway URL)
6. Нажмите **"Deploy"**

**Готово!** Frontend запущен ✅

### Шаг 3: Обновите CORS в Railway (1 минута)

1. Откройте ваш проект в Railway
2. Перейдите в **Variables**
3. Добавьте переменную:
   - **Key**: `FRONTEND_URL`
   - **Value**: `https://your-app.vercel.app` (ваш Vercel URL)
4. Нажмите **"Deploy"** для перезапуска

**Готово!** Приложение работает в интернете! 🎉

---

## Вариант 2: Netlify + Render (Альтернатива)

### Backend на Render:
1. [Render.com](https://render.com) → **New Web Service**
2. Connect GitHub → Select repo
3. Settings:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Environment Variables:
   - `FRONTEND_URL`: (добавим позже)

### Frontend на Netlify:
1. [Netlify.com](https://netlify.com) → **Add new site**
2. Import from Git
3. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Environment Variables:
   - `VITE_API_URL`: `https://your-app.onrender.com`

---

## 🎯 Проверка работы

### 1. Проверьте Backend
```bash
curl https://your-app.railway.app/health
```
Должен вернуть: `{"status":"OK",...}`

### 2. Откройте Frontend
```
https://your-app.vercel.app
```

### 3. Проверьте GPS функционал
- Войдите в систему
- Откройте раздел "Транспорт"
- Протестируйте GPS для любого автомобиля

---

## 🔧 Если что-то не работает

### Backend не отвечает:
```bash
# Проверьте логи в Railway Dashboard
# Settings → Logs
```

### Frontend не загружается:
```bash
# Проверьте логи в Vercel Dashboard
# Deployments → View Function Logs
```

### CORS ошибки:
1. Убедитесь, что `FRONTEND_URL` в Railway соответствует вашему Vercel URL
2. Убедитесь, что `VITE_API_URL` в Vercel соответствует вашему Railway URL
3. Перезапустите оба сервиса

### GPS не работает:
1. Откройте DevTools (F12) → Console
2. Проверьте есть ли ошибки
3. Проверьте Network tab → есть ли запросы к `/api/trak4/device`
4. Убедитесь, что API ключ и Device ID правильные

---

## 💡 Полезные команды

### Vercel CLI (опционально):
```bash
# Установка
npm install -g vercel

# Локальный тест
vercel dev

# Деплой
vercel --prod
```

### Railway CLI (опционально):
```bash
# Установка
npm install -g @railway/cli

# Логи в реальном времени
railway logs

# Локальный запуск с production переменными
railway run node server.js
```

---

## 📊 Мониторинг

### Railway:
- Dashboard → Your Project → Metrics
- Смотрите CPU, Memory, Network usage

### Vercel:
- Dashboard → Your Project → Analytics
- Speed Insights, Web Vitals

---

## 💰 Стоимость

### Бесплатные лимиты:
- **Vercel**: 100GB bandwidth/месяц
- **Railway**: $5 кредит/месяц (хватает на ~500 часов работы)
- **Netlify**: 100GB bandwidth/месяц
- **Render**: 750 часов/месяц (бесплатный tier)

Для небольшого проекта этого более чем достаточно! 🎉

---

## 🎓 Следующие шаги

1. ✅ Настройте custom domain (опционально)
2. ✅ Включите Analytics в Vercel
3. ✅ Настройте error tracking (Sentry)
4. ✅ Добавьте CI/CD (GitHub Actions)

См. **DEPLOYMENT_GUIDE.md** для подробной информации!

