export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'guestgreet',
  },
  faceService: {
    url: process.env.FACE_SERVICE_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.FACE_SERVICE_TIMEOUT || '5000', 10),
  },
  recognition: {
    enabled: process.env.RECOGNITION_ENABLED !== 'false',
    confidenceThreshold: parseFloat(process.env.RECOGNITION_THRESHOLD || '0.75'),
    cooldownMinutes: parseInt(process.env.RECOGNITION_COOLDOWN_MINUTES || '10', 10),
  },
  storage: {
    profileImagesPath: process.env.PROFILE_IMAGES_PATH || './uploads/profiles',
  },
});
