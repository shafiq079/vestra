# VESTRA

VESTRA is a completed fashion e-commerce platform with Virtual Try-On, ML size recommendation, product recommendations, customer accounts, cart, checkout, orders, and admin management.

## Architecture

The repository contains three independent applications:

```
vestra/
├── frontend/      # React + Vite + TypeScript
├── backend/       # Node.js + Express + TypeScript + MongoDB
├── ml-service/    # Python + FastAPI + Decision Tree model
├── render.yaml    # Render deployment configuration
└── README.md
```

Each application has its own dependencies and runs from its own folder. There is no root npm application.

Production request flow:

```
Browser -> Frontend -> Express backend -> MongoDB Atlas
                              |-> Cloudinary + Pixelcut Virtual Try-On
                              |-> FastAPI ML size recommendation service
```

## Frontend

```bash
cd frontend
npm ci
npm run dev
```

Production build:

```bash
npm run build
```

The frontend is deployed independently to Vercel. Its API base URL is configured through `VITE_API_BASE_URL`.

## Backend

```bash
cd backend
npm ci
cp .env.example .env
npm run dev
```

Production build:

```bash
npm run build
npm start
```

The backend is deployed independently to Render and connects to MongoDB Atlas, Cloudinary, Pixelcut, and the ML service through server-side environment variables.

## ML service

```bash
cd ml-service
python -m venv .venv
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

The ML service is deployed independently to Render. The browser never calls it directly; the Express backend is the only application that sends prediction requests.

## Automated tests

The final automated suite contains **100 test cases**:

- Backend: **91**
- ML service: **9**

Run them independently:

```bash
cd backend
npm test
```

```bash
cd ml-service
pip install -r requirements-training.txt
pytest -q
```

## Deployment

- Frontend: Vercel
- Backend API: Render
- ML service: Render
- Database: MongoDB Atlas
- Image storage: Cloudinary
- Virtual Try-On provider: Pixelcut

`render.yaml` is intentionally retained because it describes the two Render services and their build/start configuration.

## Security

Real credentials are not committed to the repository. Copy the relevant `.env.example` file for local development and provide secrets through local environment files or the deployment platform.
