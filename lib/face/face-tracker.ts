/**
 * lib/face/face-tracker.ts
 *
 * Face tracking and Active Speaker Detection engine using @vladmandic/face-api.
 *
 * Pipeline:
 *  1. Extract video frames at regular intervals (e.g. 2 fps)
 *  2. Detect all faces and 68 facial landmarks per frame
 *  3. Measure lip motion dynamics to identify active speaker among multiple faces
 *  4. Generate smooth, jitter-free 9:16 vertical crop trajectory with deadzone and easing
 *  5. Build FFmpeg dynamic crop filter expression
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { spawn } from 'child_process';
import * as canvas from 'canvas';

// Dynamically require face-api wasm backend
// eslint-disable-next-line @typescript-eslint/no-require-imports
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

let isModelLoaded = false;

/**
 * Initialize face-api with Node.js canvas and load neural network models from disk.
 */
export async function initFaceApi(): Promise<void> {
  if (isModelLoaded) return;

  faceapi.env.monkeyPatch({
    Canvas: canvas.Canvas as unknown as typeof HTMLCanvasElement,
    Image: canvas.Image as unknown as typeof HTMLImageElement,
    ImageData: canvas.ImageData as unknown as typeof ImageData,
  });

  if (faceapi.tf?.ready) {
    await faceapi.tf.ready();
  }

  const modelPath = path.join(process.cwd(), 'node_modules/@vladmandic/face-api/model');

  // Load SSD MobileNet for accurate face detection + 68 landmark model for mouth tracking
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
  ]);

  isModelLoaded = true;
}

export interface FaceDetectionResult {
  timestamp: number; // seconds
  x: number;         // normalized 0.0 - 1.0 (bounding box left)
  y: number;         // normalized 0.0 - 1.0 (bounding box top)
  width: number;     // normalized width
  height: number;    // normalized height
  confidence: number;
  lipOpenness: number;
  centerX: number;   // normalized center X
  centerY: number;   // normalized center Y
}

export interface FrameFaces {
  timestamp: number;
  faces: FaceDetectionResult[];
}

export interface VideoDimensions {
  width: number;
  height: number;
  duration: number;
}

/**
 * Get video dimensions and duration using ffprobe
 */
export function getVideoDimensions(videoPath: string): Promise<VideoDimensions> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,duration:format=duration',
      '-of', 'json',
      videoPath,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed: ${stderr}`));
      }
      try {
        const data = JSON.parse(stdout);
        const stream = data.streams?.[0] || {};
        const width = stream.width || 1280;
        const height = stream.height || 720;
        const duration = parseFloat(stream.duration || data.format?.duration || '10');
        resolve({ width, height, duration });
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Extract frames from video at a specified frame rate into a temporary directory
 */
async function extractFrames(
  videoPath: string,
  tmpDir: string,
  fps: number = 2
): Promise<{ frameFiles: string[]; fps: number }> {
  return new Promise((resolve, reject) => {
    const pattern = path.join(tmpDir, 'frame_%05d.jpg');
    const proc = spawn('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vf', `fps=${fps},scale=640:-1`, // scale for fast inference while preserving aspect ratio
      '-q:v', '3',
      pattern,
    ]);

    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Frame extraction failed: ${stderr.slice(-500)}`));
      }

      fs.readdir(tmpDir).then((files) => {
        const frameFiles = files
          .filter((f) => f.startsWith('frame_') && f.endsWith('.jpg'))
          .sort()
          .map((f) => path.join(tmpDir, f));
        resolve({ frameFiles, fps });
      }).catch(reject);
    });
  });
}

/**
 * Run face and mouth landmark detection on extracted frames
 */
export async function detectFacesInVideo(
  videoPath: string,
  fps: number = 2,
  onProgress?: (processed: number, total: number) => Promise<void> | void
): Promise<{ frames: FrameFaces[]; videoInfo: VideoDimensions }> {
  await initFaceApi();

  const videoInfo = await getVideoDimensions(videoPath);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vc-face-frames-'));

  try {
    const { frameFiles } = await extractFrames(videoPath, tmpDir, fps);
    const frames: FrameFaces[] = [];

    for (let i = 0; i < frameFiles.length; i++) {
      const filePath = frameFiles[i];
      const timestamp = i / fps;

      const img = await canvas.loadImage(filePath);
      const imgWidth = img.width;
      const imgHeight = img.height;

      // Detect all faces with 68 landmarks
      const detections = await faceapi
        .detectAllFaces(
          img as unknown as HTMLCanvasElement,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })
        )
        .withFaceLandmarks();

      const detectedFaces: FaceDetectionResult[] = [];

      for (const d of detections) {
        const box = d.detection.box;
        const landmarks = d.landmarks;
        const positions = landmarks.positions;

        // Calculate lip openness (distance between inner upper & lower lip points: 62 & 66, 61 & 67, 63 & 65)
        // normalized by mouth width (distance between outer corners: 48 & 54)
        const mouthCornerLeft = positions[48];
        const mouthCornerRight = positions[54];
        const upperInnerLip = positions[62];
        const lowerInnerLip = positions[66];

        const mouthWidth = Math.hypot(
          mouthCornerRight.x - mouthCornerLeft.x,
          mouthCornerRight.y - mouthCornerLeft.y
        ) || 1;

        const lipDistance = Math.hypot(
          lowerInnerLip.x - upperInnerLip.x,
          lowerInnerLip.y - upperInnerLip.y
        );

        const lipOpenness = lipDistance / mouthWidth;

        const normX = Math.max(0, Math.min(1, box.x / imgWidth));
        const normY = Math.max(0, Math.min(1, box.y / imgHeight));
        const normW = Math.max(0, Math.min(1, box.width / imgWidth));
        const normH = Math.max(0, Math.min(1, box.height / imgHeight));

        detectedFaces.push({
          timestamp,
          x: normX,
          y: normY,
          width: normW,
          height: normH,
          confidence: d.detection.score,
          lipOpenness,
          centerX: normX + normW / 2,
          centerY: normY + normH / 2,
        });
      }

      frames.push({ timestamp, faces: detectedFaces });

      // Yield back to the Node.js event loop so BullMQ lock renewal timers and Redis I/O can execute
      await new Promise((resolve) => setImmediate(resolve));

      if (onProgress) {
        await onProgress(i + 1, frameFiles.length);
      }
    }

    return { frames, videoInfo };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Determine the active speaker for each frame and compute smooth 9:16 crop coordinates
 */
export function computeSmoothCropTrajectory(
  frames: FrameFaces[],
  videoInfo: VideoDimensions
): {
  cropFilter: string;
  detections: Array<{ timestamp: number; x: number; y: number; width: number; height: number; confidence: number }>;
} {
  const { width: vidW, height: vidH, duration: vidDuration } = videoInfo;

  // 9:16 aspect ratio: crop width = vidH * 9 / 16
  const cropW = Math.round(vidH * (9 / 16));
  const maxCropX = Math.max(0, vidW - cropW);

  const allDetections: Array<{ timestamp: number; x: number; y: number; width: number; height: number; confidence: number }> = [];

  if (frames.length === 0) {
    const defaultX = Math.round(maxCropX / 2);
    return {
      cropFilter: `crop=${cropW}:${vidH}:${defaultX}:0`,
      detections: [],
    };
  }

  // 1. Collect all detections for DB storage
  for (const f of frames) {
    for (const face of f.faces) {
      allDetections.push({
        timestamp: f.timestamp,
        x: face.x,
        y: face.y,
        width: face.width,
        height: face.height,
        confidence: face.confidence,
      });
    }
  }

  // 2. Compute raw target X for each frame with Active Speaker Tracking
  const rawTargetPoints: Array<{ timestamp: number; cropX: number }> = [];
  let lastSpeakerCenter = 0.5; // default center
  let activeSpeakerHoldUntil = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const faces = frame.faces;

    if (faces.length === 0) {
      // Keep last speaker center
      const targetX = Math.max(0, Math.min(maxCropX, lastSpeakerCenter * vidW - cropW / 2));
      rawTargetPoints.push({ timestamp: frame.timestamp, cropX: targetX });
      continue;
    }

    if (faces.length === 1) {
      lastSpeakerCenter = faces[0].centerX;
      const targetX = Math.max(0, Math.min(maxCropX, lastSpeakerCenter * vidW - cropW / 2));
      rawTargetPoints.push({ timestamp: frame.timestamp, cropX: targetX });
      continue;
    }

    // Multiple faces: determine who is speaking
    // Look ahead/behind in a rolling window of ±1.5s to compute lip movement variance
    const windowStart = Math.max(0, i - 3);
    const windowEnd = Math.min(frames.length - 1, i + 3);

    let bestSpeaker = faces[0];
    let maxSpeakingScore = -1;

    for (const face of faces) {
      // Collect openness history of faces near this face's position
      const opennessValues: number[] = [face.lipOpenness];

      for (let w = windowStart; w <= windowEnd; w++) {
        if (w === i) continue;
        const neighborFrame = frames[w];
        const match = neighborFrame.faces.find(
          (nf) => Math.abs(nf.centerX - face.centerX) < 0.15
        );
        if (match) opennessValues.push(match.lipOpenness);
      }

      // Variance of openness represents dynamic talking
      const avg = opennessValues.reduce((a, b) => a + b, 0) / opennessValues.length;
      const variance = opennessValues.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / opennessValues.length;
      const sizeBonus = (face.width * face.height) * 0.5; // slight preference for closer/larger speaker
      const speakingScore = (variance * 100) + sizeBonus;

      if (speakingScore > maxSpeakingScore) {
        maxSpeakingScore = speakingScore;
        bestSpeaker = face;
      }
    }

    // Apply speaker switching hysteresis (prevent rapid back-and-forth jitter)
    if (frame.timestamp >= activeSpeakerHoldUntil || Math.abs(bestSpeaker.centerX - lastSpeakerCenter) < 0.1) {
      lastSpeakerCenter = bestSpeaker.centerX;
      activeSpeakerHoldUntil = frame.timestamp + 1.2; // hold speaker focus for at least 1.2s
    }

    const targetX = Math.max(0, Math.min(maxCropX, lastSpeakerCenter * vidW - cropW / 2));
    rawTargetPoints.push({ timestamp: frame.timestamp, cropX: targetX });
  }

  // 3. Smooth the trajectory (Exponential Moving Average + Deadzone Filter)
  // This removes camera jitters and gives a smooth, cinematic camera pan between speakers
  const smoothedPoints: Array<{ timestamp: number; cropX: number }> = [];
  let currentSmoothX = rawTargetPoints[0]?.cropX ?? maxCropX / 2;
  const alpha = 0.18; // responsiveness vs smoothness (0.15 - 0.25 is sweet spot)
  const deadzone = cropW * 0.04; // don't move camera for micro-head tilts (< 4% of crop width)

  for (const pt of rawTargetPoints) {
    const diff = pt.cropX - currentSmoothX;
    if (Math.abs(diff) > deadzone) {
      currentSmoothX += diff * alpha;
    }
    // Clamp
    currentSmoothX = Math.max(0, Math.min(maxCropX, currentSmoothX));
    smoothedPoints.push({ timestamp: pt.timestamp, cropX: Math.round(currentSmoothX) });
  }

  // 4. Build FFmpeg piecewise linear expression for dynamic crop
  // x = 'if(lte(t, t1), x0 + (x1-x0)*(t-t0)/(t1-t0), ...)'
  if (smoothedPoints.length <= 1) {
    const singleX = smoothedPoints[0]?.cropX ?? Math.round(maxCropX / 2);
    return {
      cropFilter: `crop=${cropW}:${vidH}:${singleX}:0`,
      detections: allDetections,
    };
  }

  // Build piecewise linear interpolation expression
  // For FFmpeg expression length limit safety, compress consecutive points with almost same X
  const compressed: Array<{ timestamp: number; cropX: number }> = [];
  for (let i = 0; i < smoothedPoints.length; i++) {
    const curr = smoothedPoints[i];
    if (i === 0 || i === smoothedPoints.length - 1) {
      compressed.push(curr);
    } else {
      const prev = compressed[compressed.length - 1];
      const next = smoothedPoints[i + 1];
      // Keep if there's significant movement or directional change
      if (Math.abs(curr.cropX - prev.cropX) > 2 || Math.abs(next.cropX - curr.cropX) > 2) {
        compressed.push(curr);
      }
    }
  }

  // Build nested if-expression for FFmpeg
  // Example: if(lte(t, 0.5), 100 + (120-100)*(t-0.0)/0.5, if(lte(t, 1.0), ...))
  let expr = `${compressed[compressed.length - 1].cropX}`;

  for (let i = compressed.length - 2; i >= 0; i--) {
    const p0 = compressed[i];
    const p1 = compressed[i + 1];
    const t0 = p0.timestamp.toFixed(2);
    const t1 = p1.timestamp.toFixed(2);
    const dt = (p1.timestamp - p0.timestamp).toFixed(2);
    const x0 = p0.cropX;
    const dx = p1.cropX - p0.cropX;

    if (parseFloat(dt) <= 0.01 || dx === 0) {
      expr = `if(lte(t,${t1}),${x0},${expr})`;
    } else {
      expr = `if(lte(t,${t1}),${x0}+(${dx})*(t-${t0})/${dt},${expr})`;
    }
  }

  const cropFilter = `crop=w=${cropW}:h=${vidH}:x='min(max(0,${expr}),${maxCropX})':y=0:exact=1`;

  return {
    cropFilter,
    detections: allDetections,
  };
}
