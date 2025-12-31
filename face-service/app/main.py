import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .face_processor import face_processor
from .models import (
    DetectFacesRequest,
    DetectFacesResponse,
    DetectedFace,
    GenerateEmbeddingRequest,
    GenerateEmbeddingResponse,
    MatchRequest,
    MatchResponse,
    HealthResponse,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Face Service...")
    face_processor.initialize()
    yield
    logger.info("Shutting down Face Service...")


app = FastAPI(
    title=settings.app_name,
    description="Face detection, embedding generation, and matching service for GuestGreet",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy" if face_processor.is_loaded else "unhealthy",
        model_loaded=face_processor.is_loaded,
        model_version=face_processor.model_version,
    )


@app.post("/detect-faces", response_model=DetectFacesResponse)
async def detect_faces(request: DetectFacesRequest):
    try:
        image = face_processor.decode_image(request.image_base64)
        faces = face_processor.detect_faces(image)

        return DetectFacesResponse(
            faces=[
                DetectedFace(
                    bbox=f["bbox"],
                    landmarks=f["landmarks"],
                    confidence=f["confidence"],
                )
                for f in faces
            ],
            count=len(faces),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Face detection error: {e}")
        raise HTTPException(status_code=500, detail="Face detection failed")


@app.post("/generate-embedding", response_model=GenerateEmbeddingResponse)
async def generate_embedding(request: GenerateEmbeddingRequest):
    try:
        image = face_processor.decode_image(request.face_image_base64)
        embedding = face_processor.generate_embedding(image)

        if embedding is None:
            raise HTTPException(
                status_code=400, detail="No face detected in the image"
            )

        return GenerateEmbeddingResponse(
            embedding=embedding,
            model_version=face_processor.model_version,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Embedding generation error: {e}")
        raise HTTPException(status_code=500, detail="Embedding generation failed")


@app.post("/match", response_model=MatchResponse)
async def match_embedding(request: MatchRequest):
    try:
        candidates = [
            {"customer_id": c.customer_id, "embedding": c.embedding}
            for c in request.candidate_embeddings
        ]

        customer_id, confidence = face_processor.find_best_match(
            query_embedding=request.query_embedding,
            candidates=candidates,
            threshold=request.threshold,
        )

        return MatchResponse(
            matched=customer_id is not None,
            customer_id=customer_id,
            confidence=confidence,
        )
    except Exception as e:
        logger.error(f"Matching error: {e}")
        raise HTTPException(status_code=500, detail="Face matching failed")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
