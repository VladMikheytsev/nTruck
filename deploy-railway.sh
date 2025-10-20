#!/bin/bash

echo "🚂 Deploying to Railway..."

# Copy railway package.json to root
cp package-railway.json package.json

# Add and commit changes
git add .
git commit -m "Deploy to Railway with correct configuration"

# Push to GitHub
git push

echo "✅ Pushed to GitHub"
echo "📋 Next steps:"
echo "1. Go to https://railway.app"
echo "2. Find your nTruck project"
echo "3. Settings → General → Root Directory: leave empty (root)"
echo "4. Add environment variables:"
echo "   - NODE_ENV=production"
echo "   - PORT=3001"
echo "   - FRONTEND_URL=https://navitruck-9pzzo30x0-vladshkriabas-projects.vercel.app"
echo "   - CORS_ORIGIN=https://navitruck-9pzzo30x0-vladshkriabas-projects.vercel.app"
echo "5. Redeploy the project"
echo ""
echo "🎯 After Railway is working:"
echo "1. Copy Railway URL (e.g., https://ntruck-production.up.railway.app)"
echo "2. Update Vercel: Settings → Environment Variables"
echo "3. Set VITE_API_URL to Railway URL"
echo "4. Redeploy Vercel"
