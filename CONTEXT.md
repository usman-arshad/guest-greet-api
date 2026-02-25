# GuestGreet System - Build Context

## Project Overview
A privacy-first face recognition welcome system for hotels that greets opted-in returning customers by name.

## Core Principle
**Privacy First**: Only recognize customers who have explicitly consented. Never store raw video. Fail silently for non-consented or low-confidence matches.

---

## Tech Stack

| Component | Technology | Status |
|-----------|------------|--------|
| Backend API | NestJS (TypeScript) | Done |
| Database | PostgreSQL + pgvector | Done |
| ORM | TypeORM | Done |
| Face Recognition | Python FastAPI + InsightFace | Done |
| Matching Method | Face embeddings + cosine similarity | Done |
| Live Camera Client | Python + OpenCV (USB Webcam) | Done |
| Android LED Display | Android App (WebSocket/HTTP) | Pending |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOTEL ENVIRONMENT                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                    │
│  │  USB Webcam   │   Grabs frame every 1s                            │
│  │  (Door Camera)│ ──────────────────┐                               │
│  └──────────────┘                    │                               │
│                                      ▼                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Webcam Client (Python + OpenCV)                [DONE]       │   │
│  │  - Captures frames from USB webcam                           │   │
│  │  - Encodes frame → JPEG → base64                             │   │
│  │  - Sends to NestJS API every ~1 second                       │   │
│  │  - Shows live preview + greeting overlay                     │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                              │ POST /recognition/identify-frame      │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  NestJS Backend API                             [DONE]       │   │
│  │  ┌─────────────────┐    ┌─────────────────┐                  │   │
│  │  │ Customers       │    │ Recognition     │                  │   │
│  │  │ Module          │    │ Module          │                  │   │
│  │  │ - Enrollment    │    │ - Match lookup  │                  │   │
│  │  │ - Consent mgmt  │    │ - Logging       │                  │   │
│  │  │ - Profile CRUD  │    │ - Global toggle │                  │   │
│  │  └─────────────────┘    └────────┬────────┘                  │   │
│  └──────────────────────────────────┼───────────────────────────┘   │
│                  Calls internally   │                                │
│                                     ▼                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Python Face Service (FastAPI + InsightFace)    [DONE]       │   │
│  │  - Face detection                                            │   │
│  │  - 512-dim embedding generation                              │   │
│  │  - Cosine similarity matching                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL + pgvector                          [DONE]       │   │
│  │  - customers (profile, consent flag)                         │   │
│  │  - face_embeddings (vector data, linked to customer)         │   │
│  │  - recognition_logs (audit trail)                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│                Match result returned to client                       │
│                              │                                       │
│                   ┌──────────┴──────────┐                            │
│                   ▼                     ▼                             │
│  ┌────────────────────────┐  ┌──────────────────────────────────┐   │
│  │  OpenCV Window  [DONE] │  │  Android LED Display  [PENDING]  │   │
│  │  Live preview +        │  │  Wall-mounted tablet/LED at door │   │
│  │  greeting overlay      │  │  Shows "Welcome back, Alex!"    │   │
│  │  (dev/testing)         │  │  (production display)            │   │
│  └────────────────────────┘  └──────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### customers
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| display_name | VARCHAR(100) | First name for greeting |
| profile_image_url | VARCHAR(500) | S3/storage URL for profile pic |
| consent_given | BOOLEAN | Explicit opt-in flag |
| consent_given_at | TIMESTAMP | When consent was recorded |
| is_active | BOOLEAN | Soft delete / disable |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |

### face_embeddings
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| customer_id | UUID | FK to customers |
| embedding | VECTOR(512) | Face embedding array |
| model_version | VARCHAR(50) | Model used for embedding |
| created_at | TIMESTAMP | When generated |

### recognition_logs (optional - audit)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| customer_id | UUID | NULL if no match |
| camera_id | VARCHAR(50) | Source camera |
| confidence_score | FLOAT | Match confidence |
| matched | BOOLEAN | Whether greeting shown |
| created_at | TIMESTAMP | Event time |

---

## NestJS Module Structure

```
src/
├── app.module.ts
├── config/
│   └── configuration.ts          # Recognition thresholds, API URLs
├── common/
│   ├── guards/
│   ├── interceptors/
│   └── filters/
├── customers/
│   ├── customers.module.ts
│   ├── customers.controller.ts
│   ├── customers.service.ts
│   ├── dto/
│   │   ├── create-customer.dto.ts
│   │   ├── update-customer.dto.ts
│   │   └── customer-response.dto.ts
│   └── entities/
│       ├── customer.entity.ts
│       └── face-embedding.entity.ts
├── recognition/
│   ├── recognition.module.ts
│   ├── recognition.controller.ts
│   ├── recognition.service.ts
│   ├── dto/
│   │   ├── recognize-face.dto.ts
│   │   └── recognition-result.dto.ts
│   └── entities/
│       └── recognition-log.entity.ts
└── face-service/
    ├── face-service.module.ts
    └── face-service.client.ts    # HTTP client for Python service
```

---

## API Contracts

### NestJS Endpoints

#### POST /customers/enroll
Enroll a new customer with consent.
```typescript
Request:
{
  displayName: string;
  profileImage: File;        // Multipart
  consentGiven: boolean;     // Must be true
}

Response:
{
  id: string;
  displayName: string;
  profileImageUrl: string;
  enrolledAt: string;
}
```

#### POST /recognition/identify
Identify face from frame (called by Python service or internal).
```typescript
Request:
{
  embedding: number[];       // 512-dimensional vector
  cameraId?: string;
}

Response:
{
  matched: boolean;
  customer?: {
    id: string;
    displayName: string;
    profileImageUrl: string;
  };
  confidence?: number;
}
```

#### GET /recognition/status
Check if recognition is enabled globally.

#### PATCH /recognition/toggle
Enable/disable recognition system globally.

---

### Python FastAPI Endpoints

#### POST /detect-faces
Detect faces in an image frame.
```python
Request: { "image_base64": str }
Response: { "faces": [{ "bbox": [...], "landmarks": [...] }] }
```

#### POST /generate-embedding
Generate embedding from face crop.
```python
Request: { "face_image_base64": str }
Response: { "embedding": [float] * 512, "model_version": str }
```

#### POST /match
Find best match from candidate embeddings.
```python
Request: {
  "query_embedding": [float],
  "candidate_embeddings": [{ "customer_id": str, "embedding": [float] }],
  "threshold": float  # Default 0.7
}
Response: {
  "matched": bool,
  "customer_id": str | null,
  "confidence": float
}
```

---

## Recognition Flow

1. **Frame Capture**: USB webcam frame grabbed every ~1s by webcam client
2. **Send to API**: Webcam client POSTs base64 JPEG to `POST /recognition/identify-frame`
3. **Face Detection**: NestJS calls Python service to detect faces in frame
4. **Embedding Generation**: Python service generates 512-dim embedding per face
5. **Candidate Fetch**: NestJS fetches only consented customer embeddings from DB
6. **Similarity Match**: Cosine similarity against candidates
7. **Threshold Check**: Only return if confidence >= threshold (default 0.75)
8. **Cooldown**: Don't re-greet same person within X minutes (default 10 min)
9. **Display (Current)**: OpenCV window shows live preview + green greeting overlay
10. **Display (Pending)**: Android LED display at door shows "Welcome back, {name}!"

---

## Privacy Rules (Non-Negotiable)

- ✅ Only match against `consent_given = true` customers
- ✅ No raw video/frame storage
- ✅ Global kill switch for recognition
- ✅ Configurable confidence threshold
- ✅ Embeddings stored, never raw face images
- ✅ Audit logging for compliance
- ❌ Never greet non-consented visitors
- ❌ Never store CCTV footage

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| End-to-end latency | < 1 second |
| Frame processing | 500ms - 1s intervals |
| Embedding generation | < 200ms |
| DB query (vector search) | < 100ms |
| Concurrent cameras | Scalable to multiple |

---

## Scalability Considerations

1. **Vector Search**: Use pgvector extension for efficient similarity search
2. **Caching**: Redis cache for active customer embeddings
3. **Multi-branch**: Add `branch_id` to customers and cameras
4. **Load Balancing**: Multiple Python service instances behind LB
5. **Queue**: Consider message queue for high-volume frame processing

---

## Build Order

### Phase 1: Foundation - DONE
1. NestJS project setup with TypeORM + PostgreSQL
2. Database schema with pgvector extension
3. Customer module (CRUD + consent management)
4. Basic API structure

### Phase 2: Face Service - DONE
5. Python FastAPI service setup
6. Face detection integration (InsightFace buffalo_l)
7. Embedding generation (ArcFace, 512-dim)
8. Similarity matching logic (cosine similarity)

### Phase 3: Integration - DONE
9. NestJS ↔ Python service communication (HTTP client)
10. Enrollment flow (image → embedding → store)
11. Recognition flow (frame → match → response)

### Phase 4: Production Ready - DONE
12. Global recognition toggle
13. Recognition logging
14. Cooldown logic (prevent repeat greetings)
15. Error handling and fallbacks
16. Docker Compose (dev + prod), Postman collection, Swagger docs

### Phase 5: Live Camera Client - DONE
17. USB webcam frame grabber (Python + OpenCV)
18. Base64 encoding + API integration
19. Live preview window with greeting overlay
20. Status bar, error handling, graceful shutdown

### Phase 6: Android LED Display - PENDING
21. Android app that receives recognition results
22. Full-screen greeting display ("Welcome back, {name}!")
23. Communication method: WebSocket or HTTP polling from NestJS API
24. Wall-mounted tablet/LED at hotel door
25. Auto-dismiss greeting after timeout
26. Idle screen when no recognition active

---

## Key Libraries

### NestJS
- `@nestjs/typeorm` - ORM integration
- `@nestjs/config` - Configuration
- `pgvector` - Vector similarity in PostgreSQL
- `multer` - File upload handling
- `class-validator` - DTO validation

### Python (Face Service)
- `fastapi` - API framework
- `insightface` - Face detection & embedding (buffalo_l model)
- `opencv-python-headless` - Image processing
- `numpy` - Vector operations
- `onnxruntime` - Model inference
- `uvicorn` - ASGI server

### Python (Webcam Client)
- `opencv-python` - Camera capture & live preview window
- `requests` - HTTP calls to NestJS API

---

## Project Structure

```
guest-greet-api/
├── nest-api/                    # NestJS backend           [DONE]
├── face-service/                # Python FastAPI            [DONE]
├── webcam-client/               # USB webcam grabber        [DONE]
│   ├── webcam_grabber.py        # Live camera → API client
│   └── requirements.txt
├── android-display/             # Android LED display       [PENDING]
├── docker-compose.yml           # Production environment    [DONE]
├── docker-compose.dev.yml       # Development environment   [DONE]
├── GuestGreet-API.postman_collection.json                   [DONE]
├── CONTEXT.md                   # Architecture docs
├── TESTING_GUIDE.md             # Test scenarios
└── README.md                    # Setup instructions
```

---

## Pending: Android LED Display

### Purpose
A wall-mounted Android tablet or LED display placed at the hotel door entrance. When the webcam client recognizes a returning customer, the display shows a full-screen greeting like "Welcome back, Alex!".

### Requirements
- Receive recognition results from the backend in real-time
- Show full-screen greeting with customer name (and optionally profile picture)
- Auto-dismiss greeting after a configurable timeout (e.g. 5-10 seconds)
- Show an idle/welcome screen when no recognition is active
- Handle offline/API-down gracefully

### Communication Options (To Be Decided)
1. **WebSocket** - NestJS pushes greeting events to the Android app in real-time (preferred, lowest latency)
2. **HTTP Polling** - Android app polls an endpoint every 1-2 seconds for new greetings
3. **MQTT** - Lightweight messaging protocol, good for IoT/embedded displays
4. **Firebase Cloud Messaging (FCM)** - Push notifications to Android app

### Tech Stack Options (To Be Decided)
- Native Android app (Kotlin/Java)
- Flutter app (cross-platform)
- Simple Android WebView app loading a web page served by NestJS
- React Native app

### Architecture Change Needed
The webcam client currently receives recognition results directly. For the Android display, either:
- The webcam client forwards results to the display (peer-to-peer)
- NestJS broadcasts results via WebSocket to all connected display clients
- Both approaches could work; WebSocket from NestJS is cleaner for multiple displays
