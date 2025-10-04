# RealEstate Exchange — TS/Node/PostGraphile + React/Neon


## Prereqs
- Node 20+
- A Neon Postgres database (SSL required)
- psql installed locally (or use Neon SQL Editor)


## 1) Backend setup
```bash
cd backend
cp .env.example .env
# Fill DATABASE_URL (Neon) + JWT_SECRET
npm i
npm run db:schema
npm run db:seed
npm run dev
```
GraphQL will be at `http://localhost:$PORT/graphql` (default 8080).


### Auth
- `register(email, password, display_name)` — creates a user
- `login(email, password)` — returns a signed JWT (string). Store in localStorage as `jwt` and use `Authorization: Bearer <token>`


## 2) Frontend setup
```bash
cd frontend
cp .env.example .env
# Set VITE_GRAPHQL_URL to backend URL
npm i
npm run dev
```


## Matching
The DB function `suggest_matches(listing_id, price_percent)` returns listings within ±price_percent range of a base listing.


## Image Uploads
For demo we use browser object URLs. In production, integrate S3/Cloudinary; store the final URLs in `images` table via GraphQL mutations.


## Deployment
- **Backend**: deploy on Render/Fly/railway; set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`. For Vercel serverless, use `@graphile/worker` alternative or a small Node server on a compatible host.
- **Frontend**: deploy on Vercel; set `VITE_GRAPHQL_URL` to deployed backend.
- **Database**: Neon free tier is perfect; ensure `sslmode=require` in `DATABASE_URL`.


## Admin & Moderation
- Mark admins by setting `is_admin=true` on user rows. JWT will carry role `admin` and RLS policies allow broader access.


## Notes
- RLS ensures users can only edit their resources.
- Connection filter plugin enables robust filtering & pagination via `allListings(filter:{...})`.