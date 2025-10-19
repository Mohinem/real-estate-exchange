🏠 Real Estate Exchange

A full-stack property exchange platform that allows users to list, browse, and swap real estate — complete with secure authentication, admin controls, and a modern UI.

🚀 Tech Stack

Frontend (Vercel Deployment)

React + TypeScript + Vite

Tailwind CSS v4

React Router

Hosted on Vercel

Backend (Render Deployment)

Node.js (v22) + Express

PostgreSQL (Neon)

PostGraphile-style schema with RLS

JWT-based authentication

Hosted on Render

🌐 Live Demo

Frontend: https://real-estate-exchange.vercel.app

Backend API: https://real-estate-exchange.onrender.com

⚙️ Deployment Overview
Backend (Render)

Root Directory: backend/

Build Command:

npm ci --include=dev && npm run build


Start Command:

npm run start


Environment Variables:

NODE_ENV=production
CORS_ORIGINS=https://real-estate-exchange.vercel.app,*.vercel.app,http://localhost:5173
DATABASE_URL=<your_postgres_url>
JWT_SECRET=<your_secret>
NPM_CONFIG_PRODUCTION=false


⚠️ Note: Render free-tier apps sleep after inactivity. Expect a 30–50s cold start.

Frontend (Vercel)

Root Directory: frontend/

Build Command:

npm run build


Output Directory:

dist


Environment Variable:

VITE_API_URL=https://real-estate-exchange.onrender.com


🧭 Vercel handles client-side routing via vercel.json:

{
  "version": 2,
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}

🔐 Authentication

JWT stored in localStorage

Login and registration via /auth/login and /auth/register

Role-based RLS policies (app_user, app_admin) enforced in Postgres

🧩 Features

🔑 User Authentication – Secure JWT-based login and registration

🏘️ Property Listings – Create, edit, delete, and browse listings

🔄 Exchange Proposals – Swap properties or propose cash adjustments

🗂️ Admin Access – Manage all listings through RLS-protected queries

📨 Messaging – Exchange messages between users for active proposals

🖼️ Image Previews – Local image preview before upload

🧰 Development Setup

Clone the repo:

git clone https://github.com/Mohinem/real-estate-exchange.git
cd real-estate-exchange


Set up backend:

cd backend
npm install
npm run dev


Set up frontend:

cd ../frontend
npm install
npm run dev


Visit:
👉 http://localhost:5173

🧠 Author

Mohit Kumar Basak
Full-stack developer & independent researcher
🔗 GitHub: Mohinem

🪪 License

This project is licensed under the MIT License – see the LICENSE
 file for details.
