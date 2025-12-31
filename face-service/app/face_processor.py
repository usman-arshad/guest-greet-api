import base64
import logging
from typing import Optional

import cv2
import numpy as np
from insightface.app import FaceAnalysis

from .config import settings

logger = logging.getLogger(__name__)


class FaceProcessor:
    def __init__(self):
        self.model: Optional[FaceAnalysis] = None
        self.model_version = f"insightface-{settings.model_name}"
        self._initialized = False

    def initialize(self):
        if self._initialized:
            return

        logger.info(f"Loading face analysis model: {settings.model_name}")
        self.model = FaceAnalysis(
            name=settings.model_name,
            providers=["CPUExecutionProvider"],
        )
        self.model.prepare(ctx_id=-1, det_size=(640, 640))
        self._initialized = True
        logger.info("Face analysis model loaded successfully")

    @property
    def is_loaded(self) -> bool:
        return self._initialized and self.model is not None

    def decode_image(self, image_base64: str) -> np.ndarray:
        try:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]

            image_bytes = base64.b64decode(image_base64)
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                raise ValueError("Failed to decode image")

            return image
        except Exception as e:
            logger.error(f"Image decode error: {e}")
            raise ValueError(f"Invalid image data: {e}")

    def detect_faces(self, image: np.ndarray) -> list[dict]:
        if not self.is_loaded:
            raise RuntimeError("Face model not initialized")

        faces = self.model.get(image)
        results = []

        for face in faces:
            if face.det_score < settings.detection_threshold:
                continue

            bbox = face.bbox.tolist()
            landmarks = face.kps.tolist() if face.kps is not None else []

            results.append(
                {
                    "bbox": bbox,
                    "landmarks": landmarks,
                    "confidence": float(face.det_score),
                }
            )

        return results

    def generate_embedding(self, image: np.ndarray) -> Optional[list[float]]:
        if not self.is_loaded:
            raise RuntimeError("Face model not initialized")

        faces = self.model.get(image)

        if not faces:
            return None

        face = max(faces, key=lambda f: f.det_score)

        if face.embedding is None:
            return None

        embedding = face.embedding.tolist()
        return embedding

    @staticmethod
    def cosine_similarity(embedding1: list[float], embedding2: list[float]) -> float:
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)

        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        similarity = dot_product / (norm1 * norm2)
        normalized = (similarity + 1) / 2

        return float(normalized)

    def find_best_match(
        self,
        query_embedding: list[float],
        candidates: list[dict],
        threshold: float = 0.75,
    ) -> tuple[Optional[str], float]:

        if not candidates:
            return None, 0.0

        best_match_id = None
        best_similarity = 0.0

        for candidate in candidates:
            similarity = self.cosine_similarity(
                query_embedding, candidate["embedding"]
            )

            if similarity > best_similarity:
                best_similarity = similarity
                best_match_id = candidate["customer_id"]

        if best_similarity >= threshold:
            return best_match_id, best_similarity

        return None, best_similarity


face_processor = FaceProcessor()
