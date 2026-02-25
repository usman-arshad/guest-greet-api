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

### Phase 6: Live Webcam Testing

**Prerequisites**: Complete Phase 2 first (enroll at least one customer).

**Step 17: Install Webcam Client**
```bash
cd webcam-client
pip install -r requirements.txt
```

**Step 18: Run Webcam Client**
```bash
python webcam_grabber.py
```

Expected output:
```
==================================================
  GuestGreet - Live Webcam Recognition
==================================================

[1/2] Checking API connection...
  API Status: connected
  Recognition enabled: true
  Face service healthy: true
  Threshold: 0.75
  Cooldown: 10 minutes
[2/2] Opening camera (index 0)...
  Camera opened: 640x480
--------------------------------------------------
  Sending frames every 1.0s
  Press 'q' to quit
--------------------------------------------------
```

An OpenCV window opens showing the live camera feed.

**Step 19: Test Recognition with Webcam**

1. Stand in front of the USB webcam (use the same face you enrolled in Phase 2)
2. Wait 1-2 seconds for the API call to complete
3. Expected: Green banner appears on the OpenCV window with "Welcome back, {name}!"
4. Terminal prints: `>>> Welcome back, Alex! (confidence: 87%)`

**Step 20: Test Unknown Person**

1. Have someone who is NOT enrolled stand in front of the camera
2. Expected: No green banner, terminal shows no match output
3. The status bar at the bottom still shows "API Online"

**Step 21: Test Cooldown via Webcam**

1. After being recognized, stay in front of the camera
2. The greeting banner disappears after 5 seconds
3. The system won't re-greet you for 10 minutes (cooldown)
4. Walk away and come back — still no greeting within cooldown window

**Step 22: Test Camera Disconnect**

1. While the script is running, unplug the USB webcam
2. Expected: Terminal shows "WARNING: Failed to read frame. Retrying..."
3. Plug the webcam back in — script should recover

**Step 23: Test API Offline**

1. Stop the NestJS server (`Ctrl+C` in the nest-api terminal)
2. The webcam window status bar should show red dot + "API Offline"
3. Restart the NestJS server — status bar should return to green "API Online"

**Webcam Configuration**

Edit the constants at the top of `webcam_grabber.py` if needed:
```python
CAMERA_INDEX = 0          # Change to 1, 2 etc. for different cameras
FRAME_INTERVAL = 1.0      # Seconds between API calls (lower = more responsive)
CAMERA_ID = "door-cam-01" # Logical name for this camera
BRANCH_ID = "branch-001"  # Your hotel branch
```

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

**Hotel Door Use Case (Full Live Flow):**

1. **Day 1**: Guest checks in
   - Front desk enrolls "Maria" with consent via `POST /customers/enroll`
   - Takes profile photo at counter

2. **Setup**: USB webcam placed at hotel door
   - `webcam_grabber.py` running on a computer near the door
   - OpenCV window showing live camera feed (for dev/testing)
   - [PENDING] Android tablet mounted on wall next to door for production display

3. **Day 2**: Guest walks through the door
   - Webcam captures frame every 1 second
   - Frame sent to API → face detected → embedding matched
   - OpenCV window shows green banner: "Welcome back, Maria!"
   - Terminal prints: `>>> Welcome back, Maria! (confidence: 89%)`
   - [PENDING] Android LED display shows full-screen greeting
   - Event logged with confidence 0.89

4. **Guest leaves, returns 5 min later**
   - Webcam detects face again
   - No greeting shown (cooldown active — 10 min window)
   - Event logged but `greetingShown: false`

5. **Day 5**: Guest checks out and revokes consent
   - Front desk revokes via `POST /customers/:id/revoke-consent`
   - All face data deleted
   - Future visits = no recognition, webcam shows no match

---

## API Documentation

Swagger UI available at:
```
http://localhost:3000/api/docs
```

You can test all endpoints directly from the browser!
