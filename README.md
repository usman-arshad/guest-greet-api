# GuestGreet API

A privacy-first face recognition welcome system for hotels. Greet returning customers by name when they've explicitly opted in.

## Features

✅ **Privacy-First**: Only recognizes customers who explicitly consent
✅ **Face Embeddings**: Stores mathematical representations, never raw images
✅ **Global Kill Switch**: Disable recognition system instantly
✅ **Cooldown Protection**: Prevents repeated greetings
✅ **Branch Support**: Multi-location hotel chains
✅ **Audit Logging**: Complete recognition event history
✅ **High Performance**: < 1 second recognition time
✅ **Live Webcam Client**: USB camera captures frames and sends to API in real-time
🔲 **Android LED Display**: Wall-mounted display at door showing greetings (pending)

---

## Tech Stack

- **Backend**: NestJS (TypeScript)
- **Database**: PostgreSQL with pgvector
- **Face Recognition**: Python FastAPI + InsightFace
- **Live Camera**: Python + OpenCV (USB Webcam)
- **ORM**: TypeORM
- **Containerization**: Docker & Docker Compose
- **Display** (Pending): Android app for LED/tablet greeting display

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- Python 3.10+ (for local development)

### 1. Clone and Setup

```bash
cd guest-greet-api
```

### 2. Start Development Environment (Docker - Recommended)

```bash
# Start all services (DB + Face Service + NestJS with live reload)
docker compose -f docker-compose.dev.yml up -d

# Wait for face service to download models (first time: ~2-3 min)
docker logs -f guestgreet-face

# When you see "Face analysis model loaded successfully", the system is ready
```

# if you changes in .env so you need to recreate that container
docker compose -f docker-compose.dev.yml up -d --force-recreate nest-api

### 3. Or Run NestJS Locally (DB + Face Service still in Docker)

```bash
# Start only DB + Face Service in Docker
docker compose -f docker-compose.dev.yml up -d postgres face-service

# Run NestJS locally
cd nest-api
npm install
npm run start:dev
```

### 4. Access the Application

- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api/docs
- **Face Service**: http://localhost:8000
- **Face Service Docs**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432 (user: postgres, pass: postgres)

### 5. Run Live Webcam Client (Optional)

```bash
# Install dependencies
cd webcam-client
pip install -r requirements.txt

# Run the webcam grabber (requires USB webcam)
python webcam_grabber.py
```

This opens a live preview window. When a recognized customer appears on camera, a green greeting banner is shown. Press 'q' to quit.

---

## Production Deployment

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Project Structure

```
guest-greet-api/
├── nest-api/                          # NestJS Backend
│   ├── src/
│   │   ├── customers/                 # Customer enrollment & management
│   │   │   ├── customers.controller.ts
│   │   │   ├── customers.service.ts
│   │   │   ├── dto/                   # Data transfer objects
│   │   │   └── entities/              # TypeORM entities
│   │   ├── recognition/               # Face recognition & matching
│   │   │   ├── recognition.controller.ts
│   │   │   ├── recognition.service.ts
│   │   │   ├── recognition.gateway.ts  # WebSocket — emits match events
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   ├── face-service/              # Python service HTTP client
│   │   └── config/                    # App configuration
│   └── Dockerfile
├── face-service/                      # Python FastAPI Service
│   ├── app/
│   │   ├── main.py                    # FastAPI routes
│   │   ├── face_processor.py          # InsightFace integration
│   │   ├── models.py                  # Pydantic schemas
│   │   └── config.py
│   ├── requirements.txt
│   └── Dockerfile
├── webcam-client/                     # Live USB Webcam Client
│   ├── webcam_grabber.py              # Frame capture + API + overlay
│   └── requirements.txt
├── android-display/                   # Android LED Display (PENDING)
├── docker-compose.yml                 # Production setup
├── docker-compose.dev.yml             # Development setup
├── GuestGreet-API.postman_collection.json
├── TESTING_GUIDE.md
├── CONTEXT.md
└── README.md
```

---

## API Endpoints

### Customer Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/customers/enroll` | Enroll customer with face image + consent |
| GET | `/customers` | List all customers |
| GET | `/customers/:id` | Get customer details |
| PATCH | `/customers/:id` | Update customer info |
| PUT | `/customers/:id/profile-image` | Update face image & regenerate embedding |
| POST | `/customers/:id/revoke-consent` | Revoke consent & delete embeddings |
| DELETE | `/customers/:id` | Delete customer completely |

### Face Recognition

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recognition/identify-frame` | Detect & identify faces from CCTV frame |
| POST | `/recognition/identify` | Identify from pre-computed embedding |
| GET | `/recognition/status` | System status & health check |
| PATCH | `/recognition/toggle` | Enable/disable recognition globally |
| GET | `/recognition/logs` | Get recognition audit logs |

### Python Face Service (Internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| POST | `/detect-faces` | Detect faces in image |
| POST | `/generate-embedding` | Generate 512-dim face embedding |
| POST | `/match` | Match embedding against candidates |

---

## Configuration

### Environment Variables

All config lives in a single root `.env` file (used by both Docker and local runs):

```env
# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Database
# Local defaults — Docker overrides DB_HOST and DB_PORT via docker-compose environment
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=admin
DB_PASSWORD=secret
DB_DATABASE=guest_greet_db

# Face Service
# Local default — Docker overrides FACE_SERVICE_URL via docker-compose environment
FACE_SERVICE_URL=http://localhost:8000
FACE_SERVICE_TIMEOUT=30000
FACE_MODEL_NAME=buffalo_l
FACE_DETECTION_THRESHOLD=0.5

# Recognition Settings
RECOGNITION_ENABLED=true
RECOGNITION_THRESHOLD=0.75
RECOGNITION_COOLDOWN_MINUTES=1

# Storage
PROFILE_IMAGES_PATH=./uploads/profiles
```

### Recognition Threshold

- `0.6-0.7`: More lenient (may have false positives)
- `0.75`: **Recommended** (good balance)
- `0.8-0.9`: Stricter (may miss some matches)

### Cooldown Period

Prevents re-greeting the same customer:
- Default: 10 minutes
- Per camera or globally
- Configurable via `RECOGNITION_COOLDOWN_MINUTES`

---

## Testing

### 1. Import Postman Collection

Import `GuestGreet-API.postman_collection.json` into Postman.

### 2. Follow Testing Guide

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for comprehensive test scenarios.

### 3. Quick Test Flow

1. ✅ Check health: `GET /recognition/status`
2. 📸 Enroll customer with face photo: `POST /customers/enroll`
3. 🎭 Test recognition: `POST /recognition/identify-frame`
4. 📊 View logs: `GET /recognition/logs`
5. 📹 Live test: Run `webcam_grabber.py` and stand in front of camera

---

## Privacy & Security

### Privacy Rules

1. ✅ **Explicit Consent Required**: `consentGiven: true` mandatory
2. ✅ **No Raw Storage**: Only embeddings stored, never images
3. ✅ **Right to Forget**: Revoke consent deletes all face data
4. ✅ **Global Disable**: Recognition can be turned off instantly
5. ✅ **Audit Trail**: All recognition events logged

### Data Flow

```
Enrollment:
  Customer Photo → Face Detection → Embedding Generation → Store in DB
                                                                ↓
                                                           (512 numbers)
                                                           NOT the photo!

Live Recognition:
  USB Webcam → webcam_grabber.py → POST /identify-frame → NestJS → Python Face Service
       ↓                                                     ↓              ↓
  Live Preview                                          WebSocket   Detect → Embed → Match
       ↓                                                     ↓              ↓
  OpenCV Window ◄────────────── HTTP result ◄──────── Return match + confidence
                                                             ↓
                                                    recognition:match event
                                                             ↓
                                                    Android LED Display at door
```

### Compliance

- GDPR compliant (right to erasure, data minimization)
- No biometric data stored without consent
- Complete audit trail for compliance
- Data retention policies configurable

---

## Performance

### Benchmarks

- **Face Detection**: ~100-200ms
- **Embedding Generation**: ~50-150ms
- **Database Query**: ~10-50ms (with pgvector)
- **End-to-End**: **< 1 second**

### Scaling

- Multiple face service instances (load balancer)
- Redis cache for active customer embeddings
- Database read replicas for recognition queries
- Message queue for high-volume frame processing

---

## Database Schema

### customers
```sql
id              UUID PRIMARY KEY
display_name    VARCHAR(100)
profile_image_url VARCHAR(500)
consent_given   BOOLEAN
consent_given_at TIMESTAMP
is_active       BOOLEAN
branch_id       VARCHAR(50)
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### face_embeddings
```sql
id              UUID PRIMARY KEY
customer_id     UUID REFERENCES customers
embedding       FLOAT[] (512 dimensions)
model_version   VARCHAR(50)
created_at      TIMESTAMP
```

### recognition_logs
```sql
id              UUID PRIMARY KEY
customer_id     UUID REFERENCES customers
camera_id       VARCHAR(50)
branch_id       VARCHAR(50)
confidence_score FLOAT
matched         BOOLEAN
greeting_shown  BOOLEAN
created_at      TIMESTAMP
```

---

## Troubleshooting

### Face Service Not Starting

```bash
# Check logs
docker logs guestgreet-face-dev

# Common issue: Models downloading (first time)
# Wait 2-3 minutes for InsightFace models to download
```

### Database Connection Failed

```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# Check connection
docker exec -it guestgreet-db-dev psql -U postgres -d guestgreet
```

### No Face Detected

- Ensure image has clear frontal face
- Check image quality and size
- Verify base64 encoding is correct

### Low Recognition Accuracy

- Use higher quality enrollment photos
- Ensure good lighting
- Adjust `RECOGNITION_THRESHOLD` (lower = more matches)

---

## Development

### Run Tests

```bash
# Backend tests
cd nest-api
npm test

# Python tests
cd face-service
pytest
```

### Database Migrations

```bash
# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migration:run
```

### Docker Commands

```bash
# Start everything (dev with live reload)
docker compose -f docker-compose.dev.yml up -d

# After changing .env — must force-recreate to reload env vars
docker compose -f docker-compose.dev.yml up -d --force-recreate nest-api

# After adding/removing npm packages — must rebuild image
docker compose -f docker-compose.dev.yml up -d --build nest-api

# Full rebuild (no cache)
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up -d

# Stop everything
docker compose -f docker-compose.dev.yml down
```

**What auto-reloads without any command:**
- Any file change in `nest-api/src/` (watch mode restarts NestJS automatically)
- Any file change in `face-service/app/` (uvicorn --reload restarts Python automatically)

---

## Roadmap

- [ ] **Android LED Display App** - Wall-mounted tablet/LED at hotel door showing greeting (next priority)
- [x] WebSocket support for real-time greeting push to display clients (`ws://host:3000/recognition` — event: `recognition:match`)
- [ ] Multi-camera coordination
- [ ] Analytics dashboard
- [ ] Mobile SDK for enrollment
- [ ] Facial liveness detection (anti-spoofing)
- [ ] Multi-face batch processing
- [ ] Cloud deployment templates (AWS, Azure, GCP)

---

## License

ISC

---

## Support

For issues and questions:
- Check [TESTING_GUIDE.md](TESTING_GUIDE.md)
- Review [CONTEXT.md](CONTEXT.md) for architecture details
- Open an issue on GitHub

---

Built with ❤️ for privacy-conscious hospitality
