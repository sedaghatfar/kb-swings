import { useRef } from 'react';
import { useKettlebellAnalyzer } from '../hooks/useKettlebellAnalyzer';
import styles from '../styles/Home.module.css';

export default function Home() {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { result } = useKettlebellAnalyzer({ webcamRef, canvasRef, width: 1280, height: 720 });

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>KB Swing AI</h1>
      <div className={styles.videoBox}>
        <video ref={webcamRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} className={styles.canvas} width={1280} height={720} />
        <div className={styles.ui}>
          <h2>Reps: {result?.reps ?? 0}</h2>
          <p className={result?.isFormBad ? styles.error : styles.good}>{result?.feedback}</p>
        </div>
      </div>
    </div>
  );
}
