# GuestGreet API - Testing Guide

## Quick Start

### 1. Import Postman Collection
Import the `GuestGreet-API.postman_collection.json` file into Postman.

### 2. Prepare Test Images
You'll need JPG/PNG images with faces. You can:
- Use your own photos
- Download sample faces from: https://thispersondoesnotexist.com/
- Use stock photos from Unsplash

---

## Testing Flow

### Phase 1: System Health Check

**Step 1: Check Face Service**
```
GET http://localhost:8000/health
```
Expected Response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "insightface-buffalo_l"
}
```

**Step 2: Check Recognition Status**
```
GET http://localhost:3000/recognition/status
```
Expected Response:
```json
{
  "enabled": true,
  "confidenceThreshold": 0.75,
  "cooldownMinutes": 10,
  "faceServiceHealthy": true
}
```

---

### Phase 2: Customer Enrollment

**Step 3: Enroll First Customer (Alex)**

Use Postman request: `Customer Management > Enroll Customer with Face`

1. Select a face image (single person, clear face)
2. Set form data:
   - `displayName`: Alex
   - `consentGiven`: true
   - `branchId`: branch-001
   - `profileImage`: [Select your image file]

3. Send request

Expected Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "displayName": "Alex",
  "profileImageUrl": "/uploads/profiles/1234567890-abc123.jpg",
  "enrolledAt": "2024-01-15T10:30:00Z",
  "message": "Customer enrolled successfully with face recognition"
}
```

**📋 IMPORTANT**: Copy the `id` value and save it as the `customerId` variable in Postman!

**Step 4: Enroll Second Customer (Sarah)**

Repeat Step 3 with:
- Different face image
- `displayName`: Sarah
- Same `consentGiven`: true

**Step 5: Verify Customers List**
```
GET http://localhost:3000/customers
```

You should see both Alex and Sarah with `hasEmbedding: true`

---

### Phase 3: Face Recognition Testing

**Step 6: Convert Image to Base64**

Use one of these methods:

**Method A: Online Tool**
1. Go to https://base64.guru/converter/encode/image
2. Upload the same image you used for Alex
3. Copy the base64 string

**Method B: Command Line (Linux/Mac)**
```bash
base64 -i alex-photo.jpg | tr -d '\n' > base64.txt
cat base64.txt
```

**Method C: Python Script**
```python
import base64

with open("alex-photo.jpg", "rb") as f:
    encoded = base64.b64encode(f.read()).decode()
    print(encoded)
```

**Step 7: Test Recognition from Frame**

Use Postman request: `Face Recognition > Identify from Frame`

Request body:
```json
{
  "imageBase64": "YOUR_BASE64_STRING_HERE",
  "cameraId": "lobby-cam-01",
  "branchId": "branch-001"
}
```

Expected Response (if matched):
```json
{
  "facesDetected": 1,
  "results": [
    {
      "matched": true,
      "customer": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "displayName": "Alex",
        "profileImageUrl": "/uploads/profiles/1234567890-abc123.jpg"
      },
      "confidence": 0.87,
      "greeting": "Welcome back, Alex!"
    }
  ]
}
```

**Step 8: Test with Wrong Face**

Upload Sarah's image and verify it doesn't match Alex:
```json
{
  "facesDetected": 1,
  "results": [
    {
      "matched": true,
      "customer": {
        "displayName": "Sarah",
        ...
      },
      "greeting": "Welcome back, Sarah!"
    }
  ]
}
```

**Step 9: Test with Unknown Person**

Use a completely different face image (not enrolled):
```json
{
  "facesDetected": 1,
  "results": []
}
```
No match because the person hasn't consented/enrolled.

---

### Phase 4: Privacy & Cooldown Testing

**Step 10: Test Cooldown**

1. Recognize Alex successfully (from Step 7)
2. Immediately try to recognize Alex again with the same camera
3. Expected: `matched: false` (cooldown prevents repeat greeting)
4. Wait 10 minutes or change `cameraId`, then try again

**Step 11: Revoke Consent**

```
POST http://localhost:3000/customers/{{customerId}}/revoke-consent
```

Expected Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "consentGiven": false,
  "isActive": false,
  "hasEmbedding": false
}
```

**Step 12: Verify No Recognition After Revocation**

Try to recognize the same person again. Expected:
```json
{
  "facesDetected": 1,
  "results": []
}
```
✅ Privacy protected - no recognition after consent revoked!

---

### Phase 5: System Controls

**Step 13: Disable Recognition Globally**
```
PATCH http://localhost:3000/recognition/toggle
Body: { "enabled": false }
```

**Step 14: Test Recognition While Disabled**

Try to recognize any face. Expected:
```json
{
  "facesDetected": 0,
  "results": []
}
```
✅ Global kill switch works!

**Step 15: Re-enable Recognition**
```
PATCH http://localhost:3000/recognition/toggle
Body: { "enabled": true }
```

**Step 16: Check Recognition Logs**
```
GET http://localhost:3000/recognition/logs?limit=20
```

Review all recognition events with timestamps and confidence scores.

---

## Advanced Testing

### Multi-Face Detection

Upload an image with multiple people:
```json
{
  "facesDetected": 3,
  "results": [
    {
      "matched": true,
      "customer": { "displayName": "Alex" },
      "confidence": 0.89,
      "greeting": "Welcome back, Alex!"
    }
  ]
}
```
Only enrolled persons with consent are greeted.

### Custom Threshold

Lower threshold for stricter matching:
```json
{
  "embedding": [...],
  "threshold": 0.9
}
```

### Branch Filtering

Enroll customers with different `branchId` values, then test recognition with branch filters:
```json
{
  "imageBase64": "...",
  "branchId": "branch-002"
}
```

Only customers from `branch-002` will be matched.

---

## Expected Behaviors (Privacy Rules)

✅ **Consent Required**: Can't enroll without `consentGiven: true`
✅ **No Face = Error**: Image without face returns 400 error
✅ **Multiple Faces = Error**: Enrollment requires single face
✅ **Unknown Person = No Match**: Non-enrolled faces return empty results
✅ **Revoked Consent = No Match**: Embeddings deleted, no recognition
✅ **Global Disable = No Recognition**: Kill switch prevents all matching
✅ **Cooldown Active = No Repeat**: Same person not greeted within 10min
✅ **Low Confidence = No Match**: Below threshold (0.75) returns no match

---

## Troubleshooting

### Face Service Not Loading
```bash
docker logs guestgreet-face-dev
```
Wait for "Face analysis model loaded successfully"

### Database Connection Issues
```bash
docker ps | grep postgres
docker logs guestgreet-db-dev
```

### No Face Detected
- Ensure image has clear, frontal face
- Check image size (not too small)
- Verify base64 encoding is correct

### Low Confidence Scores
- Use higher quality images
- Ensure good lighting in photos
- Same person with different angles may have lower scores

---

## Sample Test Scenario

**Hotel Lobby Use Case:**

1. **Day 1**: Guest checks in
   - Front desk enrolls "Maria" with consent
   - Takes profile photo at counter

2. **Day 2**: Guest returns to lobby
   - CCTV captures frame every 1 second
   - System detects Maria's face
   - Display shows: "Welcome back, Maria! 👋"
   - Logs event with confidence 0.89

3. **Guest leaves lobby, returns 5 min later**
   - System detects face again
   - No greeting shown (cooldown active)
   - Event logged but `greetingShown: false`

4. **Day 5**: Guest checks out and revokes consent
   - Front desk clicks revoke
   - All face data deleted
   - Future visits = no recognition

---

## API Documentation

Swagger UI available at:
```
http://localhost:3000/api/docs
```

You can test all endpoints directly from the browser!
