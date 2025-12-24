import { useState, useRef, useEffect, useCallback } from 'react';
import * as mpPose from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

interface KettlebellAnalysisResult {
  reps: number;
  state: 'standing' | 'down' | 'up';
  feedback: string;
  hipAngle: number;
  kneeAngle: number;
  isFormBad: boolean;
}

class KettlebellLogic {
  state: 'standing' | 'down' | 'up' = 'standing';
  reps: number = 0;
  feedback: string = "Stand sideways to camera.";
  isFormBad: boolean = false;

  MIN_KNEE_ANGLE_HINGE = 140; 
  MAX_HIP_ANGLE_TOP = 165;    
  MIN_HIP_ANGLE_BOTTOM = 130; 

  calculateAngle(a: any, b: any, c: any): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  }

  update(landmarks: any): KettlebellAnalysisResult {
    const shoulder = landmarks[11];
    const hip = landmarks[23];
    const knee = landmarks[25];
    const ankle = landmarks[27];

    const hipAngle = this.calculateAngle(shoulder, hip, knee);
    const kneeAngle = this.calculateAngle(hip, knee, ankle);

    if (this.state === 'standing' || this.state === 'up') {
        if (hipAngle < this.MIN_HIP_ANGLE_BOTTOM) {
            this.state = 'down';
            this.isFormBad = false;
        }
    } else if (this.state === 'down') {
        if (kneeAngle < this.MIN_KNEE_ANGLE_HINGE) {
            this.feedback = "⚠ Too much Squat!";
            this.isFormBad = true;
        }
        if (hipAngle > this.MAX_HIP_ANGLE_TOP) {
            this.state = 'up';
            if (!this.isFormBad) { this.reps++; this.feedback = "Good Rep!"; }
            else { this.feedback = "Invalid (Squatted)"; }
        }
    }

    return { reps: this.reps, state: this.state, feedback: this.feedback, hipAngle: Math.floor(hipAngle), kneeAngle: Math.floor(kneeAngle), isFormBad: this.isFormBad };
  }
}

export const useKettlebellAnalyzer = ({ webcamRef, canvasRef, width, height }: any) => {
    const [result, setResult] = useState<KettlebellAnalysisResult | null>(null);
    const logic = useRef(new KettlebellLogic());

    const onResults = useCallback((results: any) => {
        const canvasCtx = canvasRef.current?.getContext('2d');
        if (!canvasCtx) return;
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, width, height);
        canvasCtx.drawImage(results.image, 0, 0, width, height);
        if (results.poseLandmarks) {
            drawConnectors(canvasCtx, results.poseLandmarks, mpPose.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
            drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
            setResult(logic.current.update(results.poseLandmarks));
        }
        canvasCtx.restore();
    }, [canvasRef, width, height]);

    useEffect(() => {
        const pose = new mpPose.Pose({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
        pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        pose.onResults(onResults);
        if (webcamRef.current) {
            const camera = new Camera(webcamRef.current, { onFrame: async () => { await pose.send({ image: webcamRef.current! }); }, width, height });
            camera.start();
        }
    }, [onResults, webcamRef, width, height]);

    return { result };
};
