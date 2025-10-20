# 🟣 Heroku Backend Deployment (Альтернатива Railway)

## 🚀 Быстрый деплой

### 1. Установите Heroku CLI
```bash
# macOS
brew tap heroku/brew && brew install heroku

# Или скачайте с https://devcenter.heroku.com/articles/heroku-cli
```

### 2. Войдите в Heroku
```bash
heroku login
```

### 3. Создайте приложение
```bash
cd backend
heroku create ntruck-backend
```

### 4. Настройте переменные окружения
```bash
heroku config:set NODE_ENV=production
heroku config:set FRONTEND_URL=https://navitruck-29urxp7gv-vladshkriabas-projects.vercel.app
heroku config:set CORS_ORIGIN=https://navitruck-29urxp7gv-vladshkriabas-projects.vercel.app
```

### 5. Деплойте
```bash
git add .
git commit -m "Add Heroku deployment"
git push heroku main
```

### 6. Проверьте
```bash
heroku open
curl https://ntruck-backend.herokuapp.com/health
```

## 🔧 Настройка Vercel

После успешного деплоя на Heroku:

1. **Откройте [vercel.com](https://vercel.com)**
2. **Проект**: `navitruck` → **Settings** → **Environment Variables**
3. **Добавьте**:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://ntruck-backend.herokuapp.com`
4. **Redeploy** проект

## 🧪 Тестирование

1. **Откройте**: https://navitruck-29urxp7gv-vladshkriabas-projects.vercel.app
2. **Войдите**: admin / admin123
3. **Перейдите в "Транспорт"**
4. **Проверьте GPS** - должен работать без ошибок

## 📋 Полезные команды Heroku

```bash
# Посмотреть логи
heroku logs --tail

# Перезапустить приложение
heroku restart

# Посмотреть переменные окружения
heroku config

# Открыть приложение
heroku open

# Масштабировать
heroku ps:scale web=1
```

## 🆚 Railway vs Heroku

| Функция | Railway | Heroku |
|---------|---------|--------|
| **Простота** | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Бесплатный план** | ✅ | ✅ |
| **Автодеплой** | ✅ | ✅ |
| **Логи** | ✅ | ✅ |
| **Переменные** | ✅ | ✅ |

## 🎯 Рекомендация

Если Railway не работает, **Heroku** - отличная альтернатива:
- Более стабильный
- Проще в настройке
- Лучшая документация
- Надежные логи

---

## ✅ После деплоя

1. **Heroku URL**: `https://ntruck-backend.herokuapp.com`
2. **Обновите Vercel**: `VITE_API_URL` = Heroku URL
3. **GPS функционал** заработает! 🎉
