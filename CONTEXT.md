# GuestGreet System - Build Context

## Project Overview
A privacy-first face recognition welcome system for hotels that greets opted-in returning customers by name.

## Core Principle
**Privacy First**: Only recognize customers who have explicitly consented. Never store raw video. Fail silently for non-consented or low-confidence matches.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend API | NestJS (TypeScript) |
| Database | PostgreSQL |
| ORM | TypeORM |
| Face Recognition | Python FastAPI microservice |
| Matching Method | Face embeddings + cosine similarity |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOTEL ENVIRONMENT                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐     RTSP Stream      ┌─────────────────────────────┐  │
│  │  CCTV    │ ──────────────────►  │  Python Face Service        │  │
│  │  Camera  │                      │  (FastAPI)                  │  │
│  └──────────┘                      │  - Frame sampling (500ms)   │  │
│                                    │  - Face detection           │  │
│                                    │  - Embedding generation     │  │
│                                    │  - Similarity matching      │  │
│                                    └──────────────┬──────────────┘  │
│                                                   │                  │
│                                                   ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    NestJS Backend API                         │   │
│  │  ┌─────────────────┐    ┌─────────────────┐                  │   │
│  │  │ Customers       │    │ Recognition     │                  │   │
│  │  │ Module          │    │ Module          │                  │   │
│  │  │ - Enrollment    │    │ - Match lookup  │                  │   │
│  │  │ - Consent mgmt  │    │ - Logging       │                  │   │
│  │  │ - Profile CRUD  │    │ - Global toggle │                  │   │
│  │  └─────────────────┘    └─────────────────┘                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                    │                                 │
│                                    ▼                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL Database                        │   │
│  │  - customers (profile, consent flag)                         │   │
│  │  - face_embeddings (vector data, linked to customer)         │   │
│  │  - recognition_logs (audit trail, optional)                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│                                    │                                 │
│                                    ▼                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Display Client                             │   │
│  │  "Welcome back, Alex! 👋"  [Profile Picture]                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
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

1. **Frame Capture**: CCTV stream sampled every 500ms-1s
2. **Face Detection**: Python service detects faces in frame
3. **Embedding Generation**: Generate 512-dim embedding per face
4. **Candidate Fetch**: NestJS fetches only consented customer embeddings
5. **Similarity Match**: Cosine similarity against candidates
6. **Threshold Check**: Only return if confidence ≥ threshold (e.g., 0.75)
7. **Display**: Show "Welcome back, {name}!" with profile picture
8. **Cooldown**: Don't re-greet same person within X minutes

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

## Build Order (Recommended)

### Phase 1: Foundation
1. NestJS project setup with TypeORM + PostgreSQL
2. Database schema with pgvector extension
3. Customer module (CRUD + consent management)
4. Basic API structure

### Phase 2: Face Service
5. Python FastAPI service setup
6. Face detection integration (e.g., MTCNN, RetinaFace)
7. Embedding generation (e.g., FaceNet, ArcFace)
8. Similarity matching logic

### Phase 3: Integration
9. NestJS ↔ Python service communication
10. Enrollment flow (image → embedding → store)
11. Recognition flow (frame → match → response)

### Phase 4: Production Ready
12. Global recognition toggle
13. Recognition logging
14. Cooldown logic (prevent repeat greetings)
15. Error handling and fallbacks
16. Testing and optimization

---

## Key Libraries

### NestJS
- `@nestjs/typeorm` - ORM integration
- `@nestjs/config` - Configuration
- `pgvector` - Vector similarity in PostgreSQL
- `multer` - File upload handling
- `class-validator` - DTO validation

### Python
- `fastapi` - API framework
- `opencv-python` - Image processing
- `face_recognition` or `deepface` - Face detection/embedding
- `numpy` - Vector operations
- `uvicorn` - ASGI server

---

## Files to Create

```
guest-greet-api/
├── nest-api/                    # NestJS backend
├── face-service/                # Python FastAPI
├── docker-compose.yml           # Local dev environment
├── .env.example                 # Environment template
└── README.md                    # Setup instructions
```
