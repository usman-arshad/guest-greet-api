from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "GuestGreet Face Service"
    model_name: str = "buffalo_l"
    detection_threshold: float = 0.5
    embedding_size: int = 512

    class Config:
        env_prefix = "FACE_"


settings = Settings()
