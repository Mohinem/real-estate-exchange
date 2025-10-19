# 🏠 Real Estate Exchange

A full-stack property exchange platform that allows users to **list, browse, and swap real estate** — complete with secure authentication, admin controls, and a modern UI.

---

## 🚀 Tech Stack

### Frontend (Vercel Deployment)
- ⚛️ **React + TypeScript + Vite**
- 🎨 **Tailwind CSS v4**
- 🧭 **React Router**
- ☁️ Hosted on **Vercel**

### Backend (Render Deployment)
- 🟢 **Node.js (v22) + Express**
- 🗄️ **PostgreSQL (Neon)**
- 🧩 **PostGraphile-style schema with RLS**
- 🔐 **JWT-based authentication**
- ☁️ Hosted on **Render**

---

## 🌐 Live Demo

- **Frontend:** [https://real-estate-exchange.vercel.app](https://real-estate-exchange.vercel.app)  
- **Backend API:** [https://real-estate-exchange.onrender.com](https://real-estate-exchange.onrender.com)

---

## ⚙️ Deployment Overview

### 🖥️ Backend (Render)

**Root Directory:** `backend/`

**Build Command:** `npm ci --include=dev && npm run build`

**Start Command:** `npm run start`

**Environment Variables:** 
`NODE_ENV=production

CORS_ORIGINS=https://real-estate-exchange.vercel.app,*.vercel.app,http://localhost:5173

DATABASE_URL=<your_postgres_url>

JWT_SECRET=<your_secret>

NPM_CONFIG_PRODUCTION=false
`
