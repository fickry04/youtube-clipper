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
  const { width: vidW, height: vidH } = videoInfo;

  // 9:16 aspect ratio: crop width = vidH * 9 / 16 (ensure even width and height for libx264)
  let cropW = Math.round(vidH * (9 / 16));
  if (cropW % 2 !== 0) cropW -= 1;
  let targetH = vidH;
  if (targetH % 2 !== 0) targetH -= 1;
  const maxCropX = Math.max(0, vidW - cropW);

  const allDetections: Array<{ timestamp: number; x: number; y: number; width: number; height: number; confidence: number }> = [];

  if (frames.length === 0) {
    const defaultX = Math.round(maxCropX / 2);
    return {
      cropFilter: `crop=w=${cropW}:h=${targetH}:x=${defaultX}:y=0:exact=1`,
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

    // Multiple faces: determine active speaker
    const windowStart = Math.max(0, i - 3);
    const windowEnd = Math.min(frames.length - 1, i + 3);

    let bestSpeaker = faces[0];
    let maxSpeakingScore = -1;

    for (const face of faces) {
      const opennessValues: number[] = [face.lipOpenness];

      for (let w = windowStart; w <= windowEnd; w++) {
        if (w === i) continue;
        const neighborFrame = frames[w];
        const match = neighborFrame.faces.find(
          (nf) => Math.abs(nf.centerX - face.centerX) < 0.15
        );
        if (match) opennessValues.push(match.lipOpenness);
      }

      const avg = opennessValues.reduce((a, b) => a + b, 0) / opennessValues.length;
      const variance = opennessValues.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / opennessValues.length;
      const sizeBonus = (face.width * face.height) * 0.5;
      const speakingScore = (variance * 100) + sizeBonus;

      if (speakingScore > maxSpeakingScore) {
        maxSpeakingScore = speakingScore;
        bestSpeaker = face;
      }
    }

    // Speaker switching hysteresis (hold speaker focus for at least 1.5s)
    if (frame.timestamp >= activeSpeakerHoldUntil || Math.abs(bestSpeaker.centerX - lastSpeakerCenter) < 0.1) {
      lastSpeakerCenter = bestSpeaker.centerX;
      activeSpeakerHoldUntil = frame.timestamp + 1.5;
    }

    const targetX = Math.max(0, Math.min(maxCropX, lastSpeakerCenter * vidW - cropW / 2));
    rawTargetPoints.push({ timestamp: frame.timestamp, cropX: targetX });
  }

  // 3. Segment-based camera positioning (Cinematic Shot Detection)
  // Instead of wobbling on every minor movement, camera holds steady on the speaker
  // and only pans smoothly when the speaker or scene moves beyond the deadzone.
  const deadzone = cropW * 0.08; // 8% deadzone
  const shots: Array<{ start: number; end: number; cropX: number }> = [];

  let currentShot = {
    start: rawTargetPoints[0].timestamp,
    end: rawTargetPoints[0].timestamp,
    cropX: Math.round(rawTargetPoints[0].cropX),
  };

  for (let i = 1; i < rawTargetPoints.length; i++) {
    const pt = rawTargetPoints[i];
    if (Math.abs(pt.cropX - currentShot.cropX) <= deadzone) {
      currentShot.end = pt.timestamp;
    } else {
      shots.push(currentShot);
      currentShot = {
        start: pt.timestamp,
        end: pt.timestamp,
        cropX: Math.round(pt.cropX),
      };
    }
  }
  shots.push(currentShot);

  // 4. Merge transient / micro-shots (< 1.2s) with neighboring dominant shot
  const stableShots: Array<{ start: number; end: number; cropX: number }> = [];
  for (const shot of shots) {
    if (stableShots.length === 0) {
      stableShots.push(shot);
      continue;
    }
    const prev = stableShots[stableShots.length - 1];
    if (shot.end - shot.start < 1.2) {
      // Short fluctuation: extend previous shot
      prev.end = shot.end;
    } else if (Math.abs(shot.cropX - prev.cropX) <= deadzone) {
      // Nearly identical position: merge
      prev.end = shot.end;
    } else {
      stableShots.push(shot);
    }
  }

  // 5. Hard decimation cap for FFmpeg expression safety (Max 20 shots)
  while (stableShots.length > 20) {
    let minJumpIdx = 0;
    let minJump = Infinity;
    for (let i = 0; i < stableShots.length - 1; i++) {
      const jump = Math.abs(stableShots[i + 1].cropX - stableShots[i].cropX);
      if (jump < minJump) {
        minJump = jump;
        minJumpIdx = i;
      }
    }
    stableShots[minJumpIdx].end = stableShots[minJumpIdx + 1].end;
    stableShots.splice(minJumpIdx + 1, 1);
  }

  // 6. Single shot case: return simple static crop
  if (stableShots.length <= 1) {
    const singleX = stableShots[0]?.cropX ?? Math.round(maxCropX / 2);
    return {
      cropFilter: `crop=w=${cropW}:h=${targetH}:x=${singleX}:y=0:exact=1`,
      detections: allDetections,
    };
  }

  // 7. Build timeline with smooth pan transitions between shots
  interface TimelineSegment {
    t0: number;
    t1: number;
    x0: number;
    x1: number;
    isPan: boolean;
  }

  const timeline: TimelineSegment[] = [];
  for (let i = 0; i < stableShots.length; i++) {
    const shot = stableShots[i];
    if (i === 0) {
      timeline.push({ t0: 0, t1: shot.end, x0: shot.cropX, x1: shot.cropX, isPan: false });
    } else {
      const prev = stableShots[i - 1];
      const panDuration = Math.min(0.75, Math.max(0.3, (shot.start - prev.end) || 0.5));
      const panStart = Math.max(0, shot.start - panDuration);
      
      if (timeline.length > 0) {
        timeline[timeline.length - 1].t1 = panStart;
      }
      
      // Smooth camera pan from prev to current
      timeline.push({ t0: panStart, t1: shot.start, x0: prev.cropX, x1: shot.cropX, isPan: true });
      // Steady hold on current speaker
      timeline.push({ t0: shot.start, t1: shot.end, x0: shot.cropX, x1: shot.cropX, isPan: false });
    }
  }

  // 8. Build safe, concise FFmpeg nested if-expression
  let expr = `${timeline[timeline.length - 1].x1}`;

  for (let i = timeline.length - 1; i >= 0; i--) {
    const seg = timeline[i];
    const t0 = seg.t0.toFixed(2);
    const t1 = seg.t1.toFixed(2);
    const dt = (seg.t1 - seg.t0).toFixed(2);
    const dx = seg.x1 - seg.x0;

    if (!seg.isPan || dx === 0 || parseFloat(dt) <= 0.05) {
      expr = `if(lte(t,${t1}),${seg.x0},${expr})`;
    } else {
      expr = `if(lte(t,${t1}),${seg.x0}+(${dx})*(t-${t0})/${dt},${expr})`;
    }
  }

  const cropFilter = `crop=w=${cropW}:h=${targetH}:x='min(max(0,${expr}),${maxCropX})':y=0:exact=1`;

  return {
    cropFilter,
    detections: allDetections,
  };
}
