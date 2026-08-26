import path from 'path';
import http from 'http';
import fs from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { CaptionCue, SubtitleStyleConfig, TikTokCaptionsProps } from '../../remotion/types';

let cachedBundleLocation: string | null = null;
let bundlePromise: Promise<string> | null = null;

/**
 * Get or create bundled Remotion Webpack output.
 * Caches the bundle in memory for performance, but allows fresh bundles when needed.
 */
export async function getRemotionBundle(forceFresh = false): Promise<string> {
  if (!forceFresh && cachedBundleLocation && process.env.NODE_ENV === 'production') {
    return cachedBundleLocation;
  }

  if (!forceFresh && bundlePromise) {
    return bundlePromise;
  }

  const entryPoint = path.join(process.cwd(), 'remotion/index.ts');

  bundlePromise = bundle({
    entryPoint,
  }).then((loc) => {
    cachedBundleLocation = loc;
    return loc;
  }).catch((err) => {
    bundlePromise = null;
    throw err;
  });

  return bundlePromise;
}

/**
 * Serve a local video file via a temporary lightweight HTTP server
 * so Remotion's Chromium renderer can stream and decode frames seamlessly.
 */
function serveLocalFileTemporarily(filePath: string): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end();
        return;
      }
      const stat = fs.statSync(filePath);
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': 'video/mp4',
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stat.size,
          'Content-Type': 'video/mp4',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    });

    server.on('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' ? addr?.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/video.mp4`,
        close: () => server.close(),
      });
    });
  });
}

export interface RenderRemotionSubtitleOptions {
  videoPath: string; // Absolute path to vertical mp4 file
  outputPath: string;
  durationSeconds: number;
  cues: CaptionCue[];
  styleConfig?: SubtitleStyleConfig;
  onProgress?: (progress: number) => void;
}

/**
 * Render 9:16 vertical video with animated Remotion subtitles.
 */
export async function renderRemotionSubtitles(opts: RenderRemotionSubtitleOptions): Promise<void> {
  const bundleLocation = await getRemotionBundle();
  const fps = 30;

  // Start ephemeral HTTP server to stream the local video to Remotion renderer
  const localServer = await serveLocalFileTemporarily(opts.videoPath);

  try {
    const inputProps: TikTokCaptionsProps = {
      videoSrc: localServer.url,
      durationInSeconds: opts.durationSeconds,
      fps,
      cues: opts.cues,
      styleConfig: opts.styleConfig,
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'TikTokCaptions',
      inputProps: inputProps as unknown as Record<string, unknown>,
    });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: opts.outputPath,
      inputProps: inputProps as unknown as Record<string, unknown>,
      onProgress: ({ progress }) => {
        if (opts.onProgress) {
          opts.onProgress(progress);
        }
      },
    });
  } finally {
    localServer.close();
  }
}
