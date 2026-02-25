from pydantic import BaseModel, Field
from typing import Optional


class DetectFacesRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DetectedFace(BaseModel):
    bbox: list[float] = Field(..., description="Bounding box [x1, y1, x2, y2]")
    landmarks: list[list[float]] = Field(..., description="Facial landmarks")
    confidence: float = Field(..., description="Detection confidence")


class DetectFacesResponse(BaseModel):
    faces: list[DetectedFace]
    count: int


class GenerateEmbeddingRequest(BaseModel):
    face_image_base64: str = Field(..., description="Base64 encoded face image")


class GenerateEmbeddingResponse(BaseModel):
    embedding: list[float] = Field(..., description="512-dimensional face embedding")
    model_version: str = Field(..., description="Model used for embedding")


class CandidateEmbedding(BaseModel):
    customer_id: str
    embedding: list[float]


class MatchRequest(BaseModel):
    query_embedding: list[float] = Field(..., description="Query face embedding")
    candidate_embeddings: list[CandidateEmbedding] = Field(
        ..., description="List of candidate embeddings to match against"
    )
    threshold: float = Field(
        default=0.75, ge=0.0, le=1.0, description="Similarity threshold"
    )


class MatchResponse(BaseModel):
    matched: bool = Field(..., description="Whether a match was found")
    customer_id: Optional[str] = Field(None, description="Matched customer ID")
    confidence: float = Field(..., description="Similarity score")


class DetectAndEmbedRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")


class FaceWithEmbedding(BaseModel):
    bbox: list[float] = Field(..., description="Bounding box [x1, y1, x2, y2]")
    confidence: float = Field(..., description="Detection confidence")
    embedding: list[float] = Field(..., description="512-dimensional face embedding")


class DetectAndEmbedResponse(BaseModel):
    faces: list[FaceWithEmbedding]
    count: int
    model_version: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str
