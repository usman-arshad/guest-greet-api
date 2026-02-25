"""
GuestGreet - Live Webcam Recognition Client

Captures frames from a USB webcam and sends them to the GuestGreet API
for face recognition. Displays a live preview with greeting overlay
when a returning customer is recognized.

Usage:
    python webcam_grabber.py

Press 'q' to quit.
"""

import base64
import threading
import time
import sys

import cv2
import requests

# ──────────────────────────────────────────────
# Configuration - Change these to match your setup
# ──────────────────────────────────────────────

API_URL = "http://localhost:3000"
CAMERA_INDEX = 0              # USB webcam device index (0 = default camera)
FRAME_INTERVAL = 1.0          # Seconds between API calls
CAMERA_ID = "door-cam-01"     # Logical name for this camera
BRANCH_ID = "branch-001"      # Hotel branch identifier
JPEG_QUALITY = 85             # JPEG compression quality (1-100)
API_TIMEOUT = 10              # Seconds to wait for API response
GREETING_DISPLAY_SECS = 5     # How long to show greeting overlay
WINDOW_NAME = "GuestGreet - Door Camera"


def check_api_health():
    """Check if the GuestGreet API is reachable and recognition is enabled."""
    try:
        resp = requests.get(f"{API_URL}/recognition/status", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            enabled = data.get("enabled", False)
            face_ok = data.get("faceServiceHealthy", False)
            print(f"  API Status: connected")
            print(f"  Recognition enabled: {enabled}")
            print(f"  Face service healthy: {face_ok}")
            print(f"  Threshold: {data.get('confidenceThreshold', 'N/A')}")
            print(f"  Cooldown: {data.get('cooldownMinutes', 'N/A')} minutes")
            return True
        else:
            print(f"  API returned status {resp.status_code}")
            return False
    except requests.ConnectionError:
        print("  API is not reachable. Is the NestJS server running?")
        return False
    except Exception as e:
        print(f"  API check failed: {e}")
        return False


def encode_frame_to_base64(frame):
    """Convert an OpenCV frame to a base64-encoded JPEG string."""
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
    success, buffer = cv2.imencode(".jpg", frame, encode_params)
    if not success:
        return None
    return base64.b64encode(buffer).decode("utf-8")


def send_frame_to_api(image_base64):
    """Send a base64-encoded frame to the recognition API."""
    payload = {
        "imageBase64": image_base64,
        "cameraId": CAMERA_ID,
        "branchId": BRANCH_ID,
    }
    try:
        resp = requests.post(
            f"{API_URL}/recognition/identify-frame",
            json=payload,
            timeout=API_TIMEOUT,
        )
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"  [API Error] Status {resp.status_code}: {resp.text[:200]}")
            return None
    except requests.ConnectionError:
        return None
    except requests.Timeout:
        print("  [API Timeout] Request took too long")
        return None
    except Exception as e:
        print(f"  [API Error] {e}")
        return None


def draw_greeting_overlay(frame, greeting, confidence, display_name):
    """Draw a green greeting banner on the frame."""
    h, w = frame.shape[:2]

    # Semi-transparent green banner at top
    overlay = frame.copy()
    banner_height = 80
    cv2.rectangle(overlay, (0, 0), (w, banner_height), (0, 150, 0), -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

    # Greeting text
    font = cv2.FONT_HERSHEY_SIMPLEX
    text = greeting
    text_size = cv2.getTextSize(text, font, 1.0, 2)[0]
    text_x = (w - text_size[0]) // 2
    cv2.putText(frame, text, (text_x, 35), font, 1.0, (255, 255, 255), 2)

    # Confidence score
    conf_text = f"Confidence: {confidence:.0%}"
    conf_size = cv2.getTextSize(conf_text, font, 0.6, 1)[0]
    conf_x = (w - conf_size[0]) // 2
    cv2.putText(frame, conf_text, (conf_x, 62), font, 0.6, (200, 255, 200), 1)

    return frame


def draw_no_match_overlay(frame, faces_detected):
    """Draw a subtle indicator when faces are detected but no match."""
    if faces_detected > 0:
        h, w = frame.shape[:2]
        text = f"{faces_detected} face(s) detected - no match"
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(frame, text, (10, 30), font, 0.6, (0, 165, 255), 1)
    return frame


def draw_status_bar(frame, api_online, fps):
    """Draw a status bar at the bottom of the frame."""
    h, w = frame.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX

    # Status bar background
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h - 30), (w, h), (40, 40, 40), -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

    # API status dot
    dot_color = (0, 200, 0) if api_online else (0, 0, 200)
    cv2.circle(frame, (15, h - 15), 6, dot_color, -1)
    status_text = "API Online" if api_online else "API Offline"
    cv2.putText(frame, status_text, (28, h - 9), font, 0.4, (200, 200, 200), 1)

    # Camera info
    info = f"Camera: {CAMERA_ID} | Branch: {BRANCH_ID}"
    cv2.putText(frame, info, (w - 350, h - 9), font, 0.4, (200, 200, 200), 1)

    return frame


def api_worker(state, lock):
    """Background thread that sends frames to the API without blocking the camera."""
    while not state["stop"]:
        # Wait until a new frame is ready to send
        frame_to_send = None
        with lock:
            frame_to_send = state.pop("pending_frame", None)

        if frame_to_send is None:
            time.sleep(0.05)
            continue

        image_b64 = encode_frame_to_base64(frame_to_send)
        if not image_b64:
            continue

        result = send_frame_to_api(image_b64)
        now = time.time()

        with lock:
            if result is not None:
                state["api_online"] = True
                faces = result.get("facesDetected", 0)
                results = result.get("results", [])

                if results:
                    match = results[0]
                    customer = match.get("customer", {})
                    name = customer.get("displayName", "Guest")
                    confidence = match.get("confidence", 0)
                    greeting = match.get("greeting", f"Welcome back, {name}!")

                    state["greeting"] = {
                        "greeting": greeting,
                        "confidence": confidence,
                        "name": name,
                    }
                    state["greeting_expire"] = now + GREETING_DISPLAY_SECS
                    print(f"  >>> {greeting} (confidence: {confidence:.0%})")
                elif faces > 0:
                    if now > state.get("greeting_expire", 0):
                        state["greeting"] = None
                else:
                    if now > state.get("greeting_expire", 0):
                        state["greeting"] = None

                state["request_in_flight"] = False
            else:
                state["api_online"] = False
                state["request_in_flight"] = False


def main():
    print("=" * 50)
    print("  GuestGreet - Live Webcam Recognition")
    print("=" * 50)
    print()

    # Check API
    print("[1/2] Checking API connection...")
    api_online = check_api_health()
    if not api_online:
        print()
        print("  WARNING: API is not available.")
        print("  The webcam will start, but recognition won't work")
        print("  until the API comes online.")
        print()

    # Open webcam
    print(f"[2/2] Opening camera (index {CAMERA_INDEX})...")
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print(f"  ERROR: Could not open camera at index {CAMERA_INDEX}")
        print("  - Is a USB webcam connected?")
        print("  - Try changing CAMERA_INDEX (0, 1, 2...)")
        sys.exit(1)

    # Get camera resolution
    cam_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    cam_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"  Camera opened: {cam_w}x{cam_h}")
    print()
    print("-" * 50)
    print(f"  Sending frames every {FRAME_INTERVAL}s")
    print(f"  Press 'q' to quit")
    print("-" * 50)
    print()

    # Shared state between main thread and API worker thread
    lock = threading.Lock()
    state = {
        "stop": False,
        "api_online": api_online,
        "greeting": None,
        "greeting_expire": 0.0,
        "request_in_flight": False,
    }

    # Start background API thread
    worker = threading.Thread(target=api_worker, args=(state, lock), daemon=True)
    worker.start()

    last_api_call = 0.0
    frame_count = 0
    fps_time = time.time()
    fps = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("  WARNING: Failed to read frame. Retrying...")
                time.sleep(0.5)
                continue

            now = time.time()

            # Calculate FPS
            frame_count += 1
            elapsed = now - fps_time
            if elapsed >= 1.0:
                fps = frame_count / elapsed
                frame_count = 0
                fps_time = now

            # Queue a frame for the API worker (non-blocking)
            if now - last_api_call >= FRAME_INTERVAL:
                with lock:
                    if not state["request_in_flight"]:
                        state["pending_frame"] = frame.copy()
                        state["request_in_flight"] = True
                        last_api_call = now

            # Read shared state for overlay (non-blocking)
            with lock:
                current_greeting = state["greeting"]
                greeting_expire = state["greeting_expire"]
                api_online_state = state["api_online"]

            # Draw overlays on display frame
            display = frame.copy()

            if current_greeting and now < greeting_expire:
                display = draw_greeting_overlay(
                    display,
                    current_greeting["greeting"],
                    current_greeting["confidence"],
                    current_greeting["name"],
                )

            display = draw_status_bar(display, api_online_state, fps)

            # Show frame
            cv2.imshow(WINDOW_NAME, display)

            # Check for quit key
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                print()
                print("  Quitting...")
                break

    except KeyboardInterrupt:
        print()
        print("  Interrupted. Shutting down...")

    finally:
        with lock:
            state["stop"] = True
        worker.join(timeout=2)
        cap.release()
        cv2.destroyAllWindows()
        print("  Camera released. Goodbye!")


if __name__ == "__main__":
    main()
