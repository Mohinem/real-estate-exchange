# 🏠 Real Estate Exchange

A full-stack property exchange platform that allows users to **list, browse, and swap real estate** — complete with secure authentication, admin controls, and a modern UI.

---

## 🚀 Tech Stack

### Frontend (Vercel Deployment)
- ⚛️ React + TypeScript + Vite  
- 🎨 Tailwind CSS v4  
- 🧭 React Router  
- ☁️ Hosted on Vercel

### Backend (Render Deployment)
- 🟢 Node.js (v22) + Express  
- 🗄️ PostgreSQL (Neon)  
- 🧩 PostGraphile-style schema with RLS  
- 🔐 JWT-based authentication  
- ☁️ Hosted on Render

---

## 🌐 Live Demo
- **Frontend:** https://real-estate-exchange.vercel.app  
- **Backend API:** https://real-estate-exchange.onrender.com

---

## ⚙️ Deployment Overview

### 🖥️ Backend (Render)

**Root Directory:** `backend/`  

**Build Command:**  
npm ci --include=dev && npm run build  

**Start Command:**  
npm run start  

**Environment Variables:**  
NODE_ENV=production  
CORS_ORIGINS=https://real-estate-exchange.vercel.app,*.vercel.app,http://localhost:5173  
DATABASE_URL=<your_postgres_url>  
JWT_SECRET=<your_secret>  
NPM_CONFIG_PRODUCTION=false  

⚠️ Render free-tier apps sleep after inactivity (30–50 s cold start).

---

### 💻 Frontend (Vercel)

**Root Directory:** `frontend/`  

**Build Command:**  
npm run build  

**Output Directory:**  
dist  

**Environment Variable:**  
VITE_API_URL=https://real-estate-exchange.onrender.com  

**Vercel SPA Routing (`vercel.json`):**  
{
  "version": 2,
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}

---

## 🔐 Authentication
- JWT stored in localStorage  
- Login and registration via /auth/login and /auth/register  
- Role-based RLS policies (app_user, app_admin) enforced in Postgres  

---

## 🧩 Features
- 🔑 **User Authentication** – Secure JWT login and registration  
- 🏘️ **Property Listings** – Create, edit, delete, and browse listings  
- 🔄 **Exchange Proposals** – Swap properties or propose cash adjustments  
- 🗂️ **Admin Access** – Manage all listings through RLS  
- 📨 **Messaging** – Exchange messages between users for active proposals  
- 🖼️ **Image Previews** – Local preview before upload  

---

## 🧰 Development Setup

1️⃣ **Clone the repo**  
git clone https://github.com/Mohinem/real-estate-exchange.git  
cd real-estate-exchange  

2️⃣ **Backend**  
cd backend  
npm install  
npm run dev  

3️⃣ **Frontend**  
cd ../frontend  
npm install  
npm run dev  

4️⃣ **Visit**  
http://localhost:5173  

---

## 🧠 Author
**Mohit Kumar Basak**  
Full-stack Developer & Independent Researcher  
GitHub: [https://github.com/Mohinem](https://github.com/Mohinem)

---

## 🪪 License
Licensed under the **MIT License** – see the LICENSE file for details.
