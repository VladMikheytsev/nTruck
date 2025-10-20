# nTruck Backend

GPS Proxy Server for nTruck application.

## Railway Deployment

This backend is designed to be deployed on Railway. The main files are:

- `package.json` - Dependencies
- `server.js` - Production server
- `railway.json` - Railway configuration

## Environment Variables

Set these in Railway dashboard:

```
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://navitruck-29urxp7gv-vladshkriabas-projects.vercel.app
CORS_ORIGIN=https://navitruck-29urxp7gv-vladshkriabas-projects.vercel.app
```

## Local Development

```bash
npm install
npm start
```

## Health Check

The server provides a health check endpoint at `/health` that returns:

```json
{
  "status": "ok",
  "message": "Trak-4 GPS Proxy Server is running"
}
```
