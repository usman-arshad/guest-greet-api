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

    def detect_and_embed(self, image: np.ndarray) -> list[dict]:
        """Detect all faces and extract embeddings in a single model.get() call.

        This avoids the overhead of calling model.get() twice (once for detection,
        once for embedding) which was the main performance bottleneck.
        """
        if not self.is_loaded:
            raise RuntimeError("Face model not initialized")

        faces = self.model.get(image)
        results = []

        for face in faces:
            if face.det_score < settings.detection_threshold:
                continue
            if face.embedding is None:
                continue

            results.append({
                "bbox": face.bbox.tolist(),
                "confidence": float(face.det_score),
                "embedding": face.embedding.tolist(),
            })

        return results

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

        # Batched numpy matching — much faster than per-candidate loop
        query_vec = np.array(query_embedding, dtype=np.float32)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return None, 0.0
        query_vec = query_vec / query_norm

        candidate_ids = [c["customer_id"] for c in candidates]
        candidate_matrix = np.array(
            [c["embedding"] for c in candidates], dtype=np.float32
        )

        # Normalize all candidate vectors at once
        norms = np.linalg.norm(candidate_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        candidate_matrix = candidate_matrix / norms

        # Single matrix-vector multiply for all similarities
        similarities = candidate_matrix @ query_vec
        # Normalize from [-1, 1] to [0, 1]
        similarities = (similarities + 1) / 2

        best_idx = int(np.argmax(similarities))
        best_similarity = float(similarities[best_idx])

        if best_similarity >= threshold:
            return candidate_ids[best_idx], best_similarity

        return None, best_similarity


face_processor = FaceProcessor()
