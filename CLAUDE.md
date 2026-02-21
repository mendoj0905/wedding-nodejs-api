# CLAUDE.md — Wedding Guest API

This file provides context for AI assistants working on this codebase.

## Project Overview

A Node.js/Express REST API backend for a wedding website ([jujubaewedding.com](https://jujubaewedding.com)). It manages:
- **Guest list & RSVP tracking** — add, search, and update guest records
- **Website password protection** — bcrypt-hashed password gate for the wedding site
- **Photo gallery** — upload and serve wedding photos with metadata
- **Admin authentication** — JWT-based auth for protected admin operations

The frontend is a separate GatsbyJS repo. This API is deployed on Kubernetes via a Docker image pushed to Docker Hub.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM modules — `"type": "module"`) |
| Framework | Express 4 |
| Database | MongoDB Atlas via Mongoose 6 |
| Auth | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| File uploads | Multer (disk storage) |
| Dev server | Nodemon |
| Container | Docker (ARM64 Alpine base image) |
| Orchestration | Kubernetes (namespace: `juju-wedding`) |

---

## Repository Structure

```
wedding-nodejs-api/
├── src/
│   ├── server.js                    # Entry point — starts HTTP server on PORT (default 4000)
│   ├── app.js                       # Express app setup, middleware, route registration
│   ├── db/
│   │   └── connect.js               # MongoDB Atlas connection via Mongoose
│   ├── middlewares/
│   │   └── authMiddleware.js        # JWT Bearer token verification middleware
│   ├── util/
│   │   ├── PasswordUtil.js          # bcrypt hash/compare + base64 encode/decode helpers
│   │   └── index.js                 # (empty placeholder)
│   └── components/                  # Feature modules (component-per-feature pattern)
│       ├── auth/                    # Admin user auth (login, create user)
│       │   ├── authRoutes.js
│       │   ├── authController.js
│       │   ├── authService.js
│       │   ├── userDAL.js
│       │   └── userModel.js
│       ├── guests/                  # Guest RSVP management
│       │   ├── guestRoute.js
│       │   ├── guestController.js
│       │   ├── guestService.js
│       │   ├── guestDAL.js
│       │   └── guestModel.js
│       ├── photo/                   # Photo upload and gallery
│       │   ├── photoRoute.js
│       │   ├── photoController.js
│       │   ├── photoDAL.js          # (photoService.js is empty)
│       │   └── photoModel.js
│       └── webPassword/             # Website password gate
│           ├── webPassRoutes.js
│           ├── webPassController.js
│           ├── webPassService.js
│           ├── webPassDAL.js
│           └── webPassModel.js
├── scripts/                         # One-off data management scripts (run locally)
│   ├── loadDatabase.js              # Bulk-import guests from guestList.csv
│   ├── batchUploadPhotos.js         # Batch upload photos from a local directory
│   ├── updatePhotos.js              # Patch photo metadata from photoList.csv
│   ├── photoFileRename.js           # Utility for renaming photo files
│   ├── guestList.csv                # Sample guest CSV input
│   └── photoList.csv                # Sample photo metadata CSV
├── k8s/apply/                       # Kubernetes manifests (apply in numeric order)
│   ├── 01-deployment.yaml
│   ├── 02-service.yaml
│   ├── 03-ingress.yaml
│   ├── 04-cert.yaml
│   ├── 05-secrets.yaml
│   ├── 06-pv-nfs.yaml
│   └── 07-pvc-nfs.yaml
├── .github/workflows/
│   └── wedding-guest-api-docker-build.yml  # CI: builds & pushes Docker image on push to master
├── Dockerfile                       # ARM64 Alpine Node image, production build
├── .gitignore                       # Excludes .env, node_modules, upload/, docker-compose.yaml
├── package.json
└── README.md
```

---

## Architecture Pattern

Every feature follows a strict 4-layer component structure:

```
Route → Controller → Service → DAL (Data Access Layer) → Mongoose Model
```

- **Routes** (`*Routes.js` / `*Route.js`): Express Router, applies middleware, maps HTTP verbs to controller methods.
- **Controller** (`*Controller.js`): Extracts request data, calls service, sends response. No business logic.
- **Service** (`*Service.js`): Business logic layer. Calls DAL methods, handles validation, orchestrates multi-step operations.
- **DAL** (`*DAL.js`): All Mongoose calls live here. Returns raw documents. No business logic.
- **Model** (`*Model.js`): Mongoose Schema + model definition.

All classes use `static async` methods — no class instantiation anywhere.

---

## API Endpoints

All routes are prefixed by the base path shown below.

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/token` | No | Login — returns `{ token: "Bearer <jwt>" }` |
| POST | `/user/create` | No | Create admin user |

### Website Password — `/api/password`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | No | Verify site password `{ wedding, password }` → `{ success: bool }` |
| POST | `/create` | No | Create a new wedding password entry |

### Guests — `/api/guests`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/all` | **JWT required** | Get all guests |
| POST | `/` | No | Add a guest (with optional family members) |
| DELETE | `/` | No | Remove guest by `{ email }` in body |
| POST | `/search` | No | Search by exact name → RSVP record |
| PATCH | `/rsvp` | No | Update RSVP fields by name |
| PATCH | `/name` | No | Update guest name (currently wired to `updateRsvp`) |
| POST | `/v2/search` | No | Partial name search (min 2 chars) |

### Photos — `/api/photos`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:wedding` | No | Get all photos for a wedding, sorted by filename |
| POST | `/upload/:wedding` | No | Upload single photo (multipart `photos` field) |
| POST | `/upload/bulk/:wedding` | No | Bulk upload (stub — returns "test") |
| PATCH | `/` | No | Update photo metadata (filename, width, height, subheader) |

Static files are served at `/photos/*` from `./upload/photos/`.

---

## MongoDB Collections

| Collection | Model | Key Fields |
|---|---|---|
| `users` | `User` | `username`, `hash` |
| `password` | `WebPass` | `wedding`, `hash` |
| `guests` | `Guest` | `name`, `email`, `familyMembers[]`, `isAttending`, `childrenAttending`, `children[]`, `plusOne` |
| `photos` | `Photo` | `filename`, `src`, `wedding`, `subheader`, `createDate`, `height`, `width` |

The database name is `juju-wedding` (hardcoded in the Atlas connection URI in `src/db/connect.js`).

---

## Environment Variables

Create a `.env` file at the project root (never committed — in `.gitignore`):

```
DB_URL="<atlas-cluster-host>"          # e.g. cluster0.xxxxx.mongodb.net
DB_USERNAME="<atlas-username>"
DB_PASSWORD="<atlas-password>"         # stored as base64 in the URI
JWT_SECRET="<random-secret-string>"
SITE_PASSWORD="<wedding-site-password>"
PORT=4000
```

**Note:** `DB_PASSWORD` is base64-encoded before being embedded in the MongoDB connection URI (see `PasswordUtil.encodePassword`). The raw value in `.env` is plain text — the encoding happens at connection time.

---

## Development Workflow

### Install and run locally

```bash
npm install
# create .env with values above
npm start          # starts nodemon watching src/server.js
```

The server listens on `PORT` (default `4000`).

### Module system

The project uses **ES Modules** (`"type": "module"` in `package.json`). All imports must use explicit `.js` extensions:

```js
import AuthService from './authService.js';  // correct
import AuthService from './authService';      // will fail
```

### No test suite

There are currently no automated tests (`npm test` exits with an error). When adding tests, use a framework compatible with ESM (e.g., Vitest or Jest with `--experimental-vm-modules`).

---

## Docker & Container Workflow

The Dockerfile targets **ARM64** (`arm64v8/node:lts-alpine`). For x86/amd64 builds, change the base image.

```bash
# Build
docker build -t wedding-guest-api:local .

# Run (supply env vars)
docker run -p 4000:4000 \
  -e DB_URL=... -e DB_USERNAME=... -e DB_PASSWORD=... \
  -e JWT_SECRET=... -e SITE_PASSWORD=... \
  wedding-guest-api:local
```

Production runs as `node src/server.js` (not nodemon).

### CI/CD

`.github/workflows/wedding-guest-api-docker-build.yml` triggers on push/PR to `master`:
1. Builds the Docker image
2. Pushes to Docker Hub as `<DOCKER_HUB_USERNAME>/wedding-guest-api:latest`

Required GitHub secrets: `DOCKER_HUB_USERNAME`, `DOCKER_HUB_ACCESS_TOKEN`.

---

## Kubernetes Deployment

Manifests are in `k8s/apply/`. Apply in order:

```bash
kubectl apply -f k8s/apply/05-secrets.yaml    # create Secret first
kubectl apply -f k8s/apply/06-pv-nfs.yaml
kubectl apply -f k8s/apply/07-pvc-nfs.yaml
kubectl apply -f k8s/apply/01-deployment.yaml
kubectl apply -f k8s/apply/02-service.yaml
kubectl apply -f k8s/apply/04-cert.yaml
kubectl apply -f k8s/apply/03-ingress.yaml
```

Key details:
- Namespace: `juju-wedding`
- Secret name: `juju-wedding-secret` (keys: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `SITE_PASSWORD`, `JWT_SECRET`)
- Photos are persisted on an NFS PersistentVolume mounted at `/usr/src/app/upload/photos`
- Ingress host: `api.wedding.justinmendoza.net` with TLS via cert-manager (Let's Encrypt)
- Ingress max body size set to `10m` for photo uploads

---

## One-Off Scripts

Scripts in `scripts/` are run directly with Node (they are not part of the server). They require `devDependencies` (axios, csv-parser, fast-csv):

```bash
cd scripts
node loadDatabase.js        # reads guestList.csv, POSTs each guest to the API
node batchUploadPhotos.js   # uploads all images from ../new_photos/
node updatePhotos.js        # reads photoList.csv, PATCHes photo metadata
node photoFileRename.js     # local file renaming utility
```

The API URL in each script may need updating between `localhost:4000` and the production URL before running.

---

## Key Conventions & Gotchas

1. **Static class methods everywhere** — no `new ClassName()` is used. All service/DAL/controller methods are `static async`.

2. **Error handling pattern** — all DAL and service methods wrap calls in `try/catch` and log errors with `console.error`. They return `undefined` on failure (no error is re-thrown to the controller). Controllers should check return values before sending responses.

3. **Guest removal uses name, not email** — `GuestController.remove` passes `req.body.email` to `GuestService.remove`, but `GuestService.remove` calls `GuestDAL.remove(name)` and `GuestDAL.remove` queries by `name`. The field name in the route's body is misleading.

4. **`/guests` PATCH `/name` bug** — the `/name` route is wired to `GuestController.updateRsvp` instead of `GuestController.updateName`.

5. **`photoService.js` is empty** — `PhotoController` calls `photoDAL` directly, skipping the service layer (unlike the other components).

6. **Photo filenames are the unique key** — duplicate filename uploads are rejected by `PhotoDAL.add`.

7. **JWT expiry** — tokens expire after **2 hours** (`expiresIn: "2h"`).

8. **CORS** — `cors()` middleware is applied globally with default settings (all origins allowed). Restrict in production if needed.

9. **Upload directory** — `app.js` auto-creates `upload/photos/` on startup if it doesn't exist. In production (Kubernetes), this path is backed by the NFS PersistentVolume.

10. **`DB_PASSWORD` encoding** — the password in `.env` is plain text; `PasswordUtil.encodePassword` base64-encodes it before inserting into the MongoDB Atlas URI. Do not pre-encode the value in `.env`.
