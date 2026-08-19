import * as fs from 'fs/promises';
import * as path from 'path';

// =============================================================================
// STORAGE SERVICE INTERFACE
// =============================================================================

export interface StorageService {
  /**
   * Save a file from a source path to the storage at the given key.
   * Returns the storage key.
   */
  save(key: string, sourcePath: string): Promise<string>;

  /**
   * Save raw buffer data to the storage at the given key.
   * Returns the storage key.
   */
  saveBuffer(key: string, data: Buffer | string, encoding?: BufferEncoding): Promise<string>;

  /**
   * Get the absolute filesystem path for a given storage key.
   * Throws if the file does not exist.
   */
  get(key: string): Promise<string>;

  /**
   * Delete a file from storage by key.
   */
  delete(key: string): Promise<void>;

  /**
   * Delete an entire directory from storage by directory key/path.
   * Ignores errors if the directory does not exist.
   */
  deleteDirectory(dirKey: string): Promise<void>;

  /**
   * Check whether a file exists at the given key.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get the public/internal URL for accessing a file.
   * For local storage, returns an API route path.
   * For S3-compatible storage, returns a presigned URL.
   */
  getUrl(key: string): string;
}

// =============================================================================
// STORAGE KEY HELPERS
// =============================================================================

export const StorageKeys = {
  videoSource: (userId: string, videoId: string) =>
    `users/${userId}/videos/${videoId}/source.mp4`,

  clipVideo: (userId: string, clipId: string) =>
    `users/${userId}/clips/${clipId}/clip.mp4`,

  clipThumbnail: (userId: string, clipId: string) =>
    `users/${userId}/clips/${clipId}/thumbnail.jpg`,

  clipSubtitle: (userId: string, clipId: string) =>
    `users/${userId}/clips/${clipId}/subtitle.srt`,

  clipVertical: (userId: string, clipId: string) =>
    `users/${userId}/clips/${clipId}/clip_vertical.mp4`,
};

// =============================================================================
// LOCAL STORAGE IMPLEMENTATION
// =============================================================================

export class LocalStorageService implements StorageService {
  private readonly rootPath: string;

  constructor(rootPath?: string) {
    this.rootPath = rootPath ?? process.env.STORAGE_PATH ?? './storage';
  }

  private resolvePath(key: string): string {
    // Prevent path traversal
    const normalized = path.normalize(key);
    if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
      throw new Error(`Invalid storage key: "${key}"`);
    }
    return path.resolve(this.rootPath, normalized);
  }

  async save(key: string, sourcePath: string): Promise<string> {
    const dest = this.resolvePath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(sourcePath, dest);
    return key;
  }

  async saveBuffer(key: string, data: Buffer | string, encoding?: BufferEncoding): Promise<string> {
    const dest = this.resolvePath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    if (typeof data === 'string') {
      await fs.writeFile(dest, data, encoding ?? 'utf-8');
    } else {
      await fs.writeFile(dest, data);
    }
    return key;
  }

  async get(key: string): Promise<string> {
    const filePath = this.resolvePath(key);
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`Storage file not found: "${key}"`);
    }
    return filePath;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignore ENOENT (already deleted)
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async deleteDirectory(dirKey: string): Promise<void> {
    const dirPath = this.resolvePath(dirKey);
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (err) {
      // Ignore ENOENT (already deleted)
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolvePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(key: string): string {
    // In local dev, serve via API route
    return `/api/storage/${encodeURIComponent(key)}`;
  }

  /** Get absolute path for streaming (used internally) */
  getAbsolutePath(key: string): string {
    return this.resolvePath(key);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let _storage: StorageService | null = null;

export function getStorage(): StorageService {
  if (!_storage) {
    const provider = process.env.STORAGE_PROVIDER ?? 'local';
    if (provider === 'local') {
      _storage = new LocalStorageService();
    } else {
      // Future: S3, GCS, etc.
      throw new Error(`Unknown storage provider: "${provider}"`);
    }
  }
  return _storage;
}
