import Head from 'next/head';
import Script from 'next/script';
import { useRef, useState } from 'react';
import { useKettlebellAnalyzer } from '../hooks/useKettlebellAnalyzer';
import styles from '../styles/Home.module.css';

export default function Home() {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  // The hook now expects global variables to be present
  const { result } = useKettlebellAnalyzer({ 
    webcamRef, 
    canvasRef, 
    width: 1280, 
    height: 720,
    isReady: loaded 
  });

  return (
    <div className={styles.container}>
      <Head>
        <title>KB Swing AI</title>
      </Head>

      {/* Load MediaPipe via CDN to avoid build errors */}
      <Script 
        src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js" 
        strategy="beforeInteractive"
      />
      <Script 
        src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" 
        strategy="beforeInteractive"
      />
      <Script 
        src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js" 
        strategy="beforeInteractive"
        onLoad={() => setLoaded(true)}
      />

      <h1 className={styles.title}>KB Swing AI</h1>
      <div className={styles.videoBox}>
        <video ref={webcamRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} className={styles.canvas} width={1280} height={720} />
        <div className={styles.ui}>
          <h2>Reps: {result?.reps ?? 0}</h2>
          <p className={result?.isFormBad ? styles.error : styles.good}>
            {loaded ? result?.feedback : "Loading AI Modules..."}
          </p>
        </div>
      </div>
    </div>
  );
}
