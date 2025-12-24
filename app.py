import streamlit as st
import cv2
import mediapipe as mp
import numpy as np
from streamlit_webrtc import webrtc_streamer, VideoTransformerBase

# --- 1. LOGIC CLASS (The Brains) ---
class KettlebellLogic:
    def __init__(self):
        self.state = 'standing'  # 'standing', 'down', 'up'
        self.reps = 0
        self.feedback = "Stand sideways to camera"
        self.is_form_bad = False
        
        # Thresholds (Same as JS version)
        self.MIN_KNEE_ANGLE_HINGE = 140 
        self.MAX_HIP_ANGLE_TOP = 165    
        self.MIN_HIP_ANGLE_BOTTOM = 130 

    def calculate_angle(self, a, b, c):
        """
        Calculates angle between three points (a, b, c).
        Points are expected to be [x, y] arrays/tuples.
        """
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)

        radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
        angle = np.abs(radians * 180.0 / np.pi)

        if angle > 180.0:
            angle = 360 - angle
        return angle

    def process(self, landmarks, width, height):
        # Extract coordinates (MediaPipe gives 0-1 normalized, we convert to pixels)
        # 11: L.Shoulder, 23: L.Hip, 25: L.Knee, 27: L.Ankle
        
        # Helper to get pixel coords
        def get_coords(idx):
            return [landmarks[idx].x * width, landmarks[idx].y * height]

        shoulder = get_coords(11)
        hip = get_coords(23)
        knee = get_coords(25)
        ankle = get_coords(27)

        # Calculate Angles
        hip_angle = self.calculate_angle(shoulder, hip, knee)
        knee_angle = self.calculate_angle(hip, knee, ankle)

        # --- State Machine ---
        if self.state in ['standing', 'up']:
            if hip_angle < self.MIN_HIP_ANGLE_BOTTOM:
                self.state = 'down'
                self.is_form_bad = False # Reset flag

        elif self.state == 'down':
            # Check Form
            if knee_angle < self.MIN_KNEE_ANGLE_HINGE:
                self.feedback = "TOO SQUATTY! Straighten legs."
                self.is_form_bad = True
            else:
                self.feedback = "Good Hinge."

            # Check for Rep Completion
            if hip_angle > self.MAX_HIP_ANGLE_TOP:
                self.state = 'up'
                if not self.is_form_bad:
                    self.reps += 1
                    self.feedback = "Good Rep!"
                else:
                    self.feedback = "Rep Invalid (Squatted)"

        return {
            "reps": self.reps,
            "feedback": self.feedback,
            "hip_angle": int(hip_angle),
            "knee_angle": int(knee_angle),
            "bad_form": self.is_form_bad
        }


# --- 2. VIDEO PROCESSOR (The Bridge) ---
class VideoProcessor(VideoTransformerBase):
    def __init__(self):
        self.pose = mp.solutions.pose.Pose(
            min_detection_confidence=0.5, 
            min_tracking_confidence=0.5
        )
        self.logic = KettlebellLogic()
        self.mp_drawing = mp.solutions.drawing_utils

    def transform(self, frame):
        # Convert frame to standard format for OpenCv
        img = frame.to_ndarray(format="bgr24")
        height, width, _ = img.shape
        
        # 1. MediaPipe Processing
        # Convert BGR to RGB for MediaPipe
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = self.pose.process(img_rgb)

        # 2. Draw Skeleton & Run Logic
        if results.pose_landmarks:
            # Draw standard skeleton
            self.mp_drawing.draw_landmarks(
                img, results.pose_landmarks, mp.solutions.pose.POSE_CONNECTIONS)
            
            # Analyze
            data = self.logic.process(results.pose_landmarks.landmark, width, height)

            # 3. Draw UI Overlay on Video
            
            # Rep Counter (Top Left)
            cv2.rectangle(img, (0,0), (250, 80), (245,117,16), -1)
            cv2.putText(img, f"REPS: {data['reps']}", (15, 60), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255,255,255), 2)

            # Feedback (Bottom Center)
            color = (0, 0, 255) if data['bad_form'] else (0, 255, 0) # Red if bad, Green if good
            cv2.putText(img, data['feedback'], (50, height - 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            
            # Angle Data (Top Right - Optional debug)
            cv2.putText(img, f"Hip: {data['hip_angle']}", (width-200, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
            cv2.putText(img, f"Knee: {data['knee_angle']}", (width-200, 80), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)

        return img


# --- 3. STREAMLIT INTERFACE ---
st.title("🏋️ Kettlebell Swing AI Coach")
st.markdown("""
**Instructions:**
1. Allow camera access.
2. Step back and ensure your **full body** is visible from the **side**.
3. Perform swings. The AI will count valid reps and warn you if you squat too much.
""")

# Start the WebRTC streamer
webrtc_streamer(
    key="kettlebell-pose",
    video_transformer_factory=VideoProcessor,
    media_stream_constraints={"video": True, "audio": False},
)
