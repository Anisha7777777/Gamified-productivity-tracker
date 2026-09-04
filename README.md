# Questly — production preparation

Questly is a gamified productivity tracker.

```text
React client → Express API → MongoDB Atlas
```

This repository contains deployment preparation only. **No external deployment was performed in Phase 10.**

## Required environment values

Create `server/.env` locally from `server/.env.example`. Never commit it.

```text
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=a-long-random-secret
JWT_EXPIRES_IN=7d
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
TRUST_PROXY=false
```

Email verification and password recovery also need the SMTP settings listed in `server/.env.example`.

The client may use `VITE_API_URL`, for example `http://localhost:5000`. It is a **public build-time URL**, not a secret. Never put `JWT_SECRET`, SMTP passwords, or MongoDB credentials in a `VITE_` variable.

## Local production build

```powershell
cd server
npm ci
npm run typecheck
npm test
npm run build
npm start

cd ../client
npm ci
npm run lint
npm run build
npm run preview
```

The backend production command runs compiled JavaScript from `server/dist`; development remains `npm run dev`.

## Health checks

- `GET /api/health` is a liveness check. It returns `200` even if MongoDB is down, so a platform can tell that the HTTP process is alive.
- `GET /api/ready` is a readiness check. It returns `200` only when Mongoose is connected; otherwise it returns a safe `503` response.

Use liveness for process monitoring and readiness before routing database-backed traffic to an instance.

## Cookies, CORS, and proxies

`CLIENT_ORIGIN` must be the exact React origin. The API keeps `credentials: true` and never uses `*` for credentialed CORS.

For one same-site deployment, use HTTPS in production with:

```text
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

For separate frontend and API sites, use:

```text
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
```

`SameSite=None` requires `Secure=true`, and secure cookies require HTTPS. If the API is behind a known reverse proxy, set `TRUST_PROXY` to its exact hop count, commonly `1`. Do not set it to a broad trust-all value: Express and rate limiting rely on this setting when identifying client IP addresses.

## Docker image builds

Docker is optional. These commands build images but do not run or publish them:

```powershell
docker build -t questly-api-test ./server
docker build --build-arg VITE_API_URL=https://api.example.com -t questly-client-test ./client
```

The Docker ignore files exclude `.env`, dependencies, tests, Git metadata, and build output. Supply server environment values when running a container; do not bake them into an image.

## MongoDB Atlas guidance

- Add only the deployment network addresses required by your host.
- Create a dedicated database user for Questly with the smallest practical role on its own database.
- Store its connection string only in the host's secret manager or server environment.
- Never use Atlas as a substitute for the in-memory test database.

## Deployment checklist

- [ ] Choose a hosting provider and HTTPS domains for client and API.
- [ ] Set server secrets in the provider, not in Git.
- [ ] Configure the exact `CLIENT_ORIGIN`.
- [ ] Configure cookie settings for same-site or cross-site hosting.
- [ ] Configure `TRUST_PROXY` only when the platform uses a known proxy.
- [ ] Restrict Atlas network access and use a least-privilege database user.
- [ ] Configure SMTP if verification and recovery email must be delivered.
- [ ] Build and test both services before release.
- [ ] Point platform liveness and readiness checks to the correct endpoints.

## Current operational limits

Rate limits use in-memory storage, which is suitable for one API instance. Before horizontal scaling, move rate-limit state to a shared store such as Redis.

Task reminders are displayed only while the browser is open. Questly currently has no email, push, cron, or background-job reminder delivery.
