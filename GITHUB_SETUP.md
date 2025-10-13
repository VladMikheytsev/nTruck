# 📚 Размещение проекта на GitHub

## Шаг 1: Подготовка проекта

### 1.1. Проверка Git
```bash
# Проверьте, установлен ли Git
git --version

# Если нет, установите:
# macOS: brew install git
# Windows: https://git-scm.com/download/win
```

### 1.2. Настройка Git (если первый раз)
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## Шаг 2: Инициализация Git репозитория

```bash
# Инициализация Git в проекте
git init

# Добавление всех файлов
git add .

# Первый commit
git commit -m "Initial commit: NTruck Warehouse Management System"
```

---

## Шаг 3: Создание репозитория на GitHub

### 3.1. Через Web интерфейс

1. Откройте [github.com](https://github.com)
2. Войдите в аккаунт (или создайте новый)
3. Нажмите ➕ → **New repository**
4. Заполните форму:
   - **Repository name**: `ntruck` (или любое другое)
   - **Description**: "Система управления складскими перемещениями с GPS-трекингом"
   - **Public** или **Private** (на ваш выбор)
   - ❌ **НЕ** добавляйте README, .gitignore, license (они уже есть)
5. Нажмите **Create repository**

### 3.2. GitHub покажет команды для push

```bash
# Добавление удаленного репозитория
git remote add origin https://github.com/your-username/ntruck.git

# Переименование ветки в main (если нужно)
git branch -M main

# Push кода на GitHub
git push -u origin main
```

---

## Шаг 4: Push на GitHub

```bash
# Замените your-username на ваш GitHub username
git remote add origin https://github.com/your-username/ntruck.git

# Push
git branch -M main
git push -u origin main
```

### Если попросит авторизацию:

**Через HTTPS (рекомендуется):**
```bash
# Используйте Personal Access Token вместо пароля
# Создайте токен: GitHub → Settings → Developer settings → Personal access tokens
```

**Через SSH (альтернатива):**
```bash
# Настройте SSH ключ
ssh-keygen -t ed25519 -C "your.email@example.com"

# Добавьте ключ на GitHub
# Settings → SSH and GPG keys → New SSH key
```

---

## Шаг 5: Проверка

```bash
# Откройте в браузере
https://github.com/your-username/ntruck

# Должны увидеть весь код и README
```

---

## 🎯 Дальнейшие действия

### Обновление кода на GitHub

```bash
# После изменений:
git add .
git commit -m "Описание изменений"
git push
```

### Работа с ветками

```bash
# Создание новой ветки
git checkout -b feature/new-feature

# Push ветки на GitHub
git push -u origin feature/new-feature

# Создание Pull Request на GitHub
```

### Защита main ветки

В **GitHub → Settings → Branches**:
- Добавьте **Branch protection rule** для `main`
- Включите **Require pull request reviews**
- Включите **Require status checks**

---

## 🔐 Безопасность

### Важно! Проверьте .gitignore

Убедитесь, что следующие файлы **НЕ попали** в Git:
- `.env` и `.env.*`
- `node_modules/`
- `dist/`
- API ключи и пароли

```bash
# Проверка что будет закоммичено
git status

# Если случайно добавили секреты:
git reset HEAD .env
echo ".env" >> .gitignore
```

### Если секреты уже в истории:

```bash
# Удалите из истории (осторожно!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (будьте осторожны!)
git push origin --force --all
```

---

## 📋 GitHub Features

### Issues
- Создавайте issues для bug reports и feature requests
- Используйте labels (bug, enhancement, question)
- Назначайте исполнителей

### Projects
- Создайте Project board для управления задачами
- Kanban-style workflow
- Автоматизация с GitHub Actions

### Wiki
- Добавьте дополнительную документацию
- Гайды для пользователей
- API документацию

### Releases
```bash
# Создание тега для релиза
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# На GitHub создайте Release из тега
```

---

## 🚀 GitHub Actions (CI/CD)

Создайте `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm install
      
    - name: Lint
      run: npm run lint
      
    - name: Build
      run: npm run build
```

---

## 📊 GitHub Stats

Добавьте badges в README:

```markdown
![GitHub stars](https://img.shields.io/github/stars/your-username/ntruck)
![GitHub forks](https://img.shields.io/github/forks/your-username/ntruck)
![GitHub issues](https://img.shields.io/github/issues/your-username/ntruck)
![GitHub license](https://img.shields.io/github/license/your-username/ntruck)
```

---

## ❓ Troubleshooting

### Ошибка: "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/your-username/ntruck.git
```

### Ошибка: "failed to push"
```bash
# Pull изменения сначала
git pull origin main --rebase
git push origin main
```

### Ошибка: "Permission denied"
```bash
# Проверьте SSH ключ или используйте HTTPS с токеном
git remote set-url origin https://github.com/your-username/ntruck.git
```

---

## 🎓 Полезные команды

```bash
# Статус репозитория
git status

# История коммитов
git log --oneline

# Просмотр изменений
git diff

# Отмена последнего коммита (но оставить изменения)
git reset --soft HEAD~1

# Просмотр удаленных репозиториев
git remote -v

# Клонирование репозитория
git clone https://github.com/your-username/ntruck.git
```

---

## 📚 Дополнительные ресурсы

- [GitHub Docs](https://docs.github.com)
- [Git Book](https://git-scm.com/book/en/v2)
- [GitHub Skills](https://skills.github.com/)
- [GitHub CLI](https://cli.github.com/)

---

## ✅ Чеклист

- [ ] Git установлен и настроен
- [ ] `.gitignore` настроен
- [ ] Репозиторий создан на GitHub
- [ ] Код запушен на GitHub
- [ ] README отображается корректно
- [ ] Секреты не попали в Git
- [ ] Установлены branch protection rules
- [ ] Создан первый release/tag

Готово! 🎉

