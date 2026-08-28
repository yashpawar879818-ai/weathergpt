# WeatherGPT

WeatherGPT is a Smart India Hackathon-style weather intelligence prototype. It turns a live Open-Meteo forecast into a readable daily brief, threshold-based advisories, practical recommendations, and a conversational interface that is explicit about what the data can and cannot establish.

## What is implemented

- Live current conditions, hourly data, and a seven-day forecast from Open-Meteo.
- City/state/country search through Open-Meteo geocoding.
- Browser geolocation, with a manual-search fallback.
- Normalized weather data shared by the dashboard, recommendations, alerts, and chat.
- Deterministic weather chat grounded in the fetched forecast.
- Optional server-side OpenAI generation, with deterministic fallback if the key is missing or the model fails.
- English, Hindi, and Marathi response modes.
- Temperature display in Celsius or Fahrenheit.
- Clothing, rain, sun, outdoor-plan, travel, and agriculture guidance.
- Transparent analytical advisories for heat, wind, heavy rain, and thunderstorms.
- Browser notification permission preference. The prototype does not claim to deliver push notifications while the app is closed.
- Voice input where the browser exposes Web Speech Recognition.
- Django session preferences plus local storage for the selected location.
- Responsive Angular dashboard while preserving the existing forecast route.

## Deliberate boundaries

The app does not fabricate weather values, historical records, official warnings, or notification delivery. Alert cards are threshold-based signals derived from the available forecast and are not government or emergency alerts. Safety-critical decisions should use official local sources.

Historical trend analysis, map overlays, user accounts, persistent profiles, official alert feeds, and push delivery are extension points rather than completed features.

## Architecture

```text
Angular 15 dashboard
        │
        │ HTTP + session credentials
        ▼
Django weather API
  ├── Open-Meteo forecast adapter
  ├── Open-Meteo geocoding adapter
  ├── normalization and analysis
  ├── recommendations and advisory thresholds
  └── grounded deterministic chat
        │
        └── optional OpenAI server-side fallback
```

The backend caches normalized overview responses for 15 minutes. The provider payload remains available in the response for prototype inspection, while the frontend renders only the normalized fields it needs.

## Run locally

### Docker Compose

1. Copy the environment template:

   ```bash
   cp backend/.env.example backend/.env
   ```

2. Add an OpenAI key only if optional model-generated phrasing is wanted. The deterministic assistant works without it.

3. Start both services:

   ```bash
   docker-compose up --build
   ```

4. Open `http://localhost:4200`. The API is available at `http://localhost:8000`.

### Without Docker

Start the backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

In another terminal, start the frontend:

```bash
cd frontend
pnpm install
pnpm start
```

The frontend development environment targets `http://localhost:8000`. Set `BACKEND_URL` in the environment files if the API is hosted elsewhere.

## API surface

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/weather/forecast/<lat>/<lon>` | Existing raw forecast endpoint |
| GET | `/weather/forecast-summary/<lat>/<lon>` | Existing summary endpoint |
| GET | `/weather/overview/<lat>/<lon>` | Normalized weather, analysis, recommendations, and advisories |
| GET | `/weather/locations/search?q=...` | Location search |
| POST | `/weather/chat` | Grounded chat using coordinates and current forecast |
| GET | `/weather/preferences` | Read session preferences |
| PUT | `/weather/preferences/update` | Update allowed preferences |

## Environment variables

See [`backend/.env.example`](./backend/.env.example):

- `DJANGO_SECRET_KEY` — secret used by Django sessions.
- `DJANGO_DEBUG` — development mode toggle.
- `DJANGO_ALLOWED_HOSTS` — comma-separated allowed hosts.
- `FRONTEND_URL` — frontend origin used by CORS.
- `OPENAI_API_KEY` — optional server-side key.
- `OPENAI_MODEL` — optional model name, defaulting to `gpt-3.5-turbo`.

## Validation

The repository includes backend service tests and a GitHub Actions workflow at [`.github/workflows/ci.yml`](./.github/workflows/ci.yml). The workflow runs:

- Python compilation, Django system checks, and Django tests.
- A frozen pnpm install and Angular production build.

Run the same checks locally:

```bash
cd backend
python -m compileall -q .
python manage.py check
python manage.py test

cd ../frontend
pnpm install --frozen-lockfile
pnpm run build
```

## Extension path for Indian weather intelligence

The service layer is intentionally provider-oriented. A future production version can add:

- IMD or other official alert ingestion, retaining source, issue time, expiry, and severity.
- Historical daily/hourly storage for district-level trend and anomaly analysis.
- NWP integrations such as GFS or WRF behind a provider adapter, with model run time and forecast lead time exposed.
- Rainfall, heat, wind, and crop-stage rules calibrated with domain experts.
- Maps and district boundaries.
- Authenticated profiles and scheduled push delivery.

Any such addition should preserve provenance, freshness, uncertainty, and the distinction between analytical guidance and official warnings.