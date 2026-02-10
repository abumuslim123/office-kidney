import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Screen } from './entities/screen.entity';
import { ScreenPhoto } from './entities/screen-photo.entity';
import { AppSetting } from '../settings/entities/app-setting.entity';

@Injectable()
export class ScreensService {
  private readonly videoDir: string;
  private readonly SETTING_DEFAULT_DURATION = 'screensDefaultPhotoDurationSeconds';

  constructor(
    @InjectRepository(Screen)
    private repo: Repository<Screen>,
    @InjectRepository(ScreenPhoto)
    private photoRepo: Repository<ScreenPhoto>,
    @InjectRepository(AppSetting)
    private settingsRepo: Repository<AppSetting>,
    private config: ConfigService,
  ) {
    const base = this.config.get<string>('SCREENS_VIDEO_DIR') || path.join(process.cwd(), 'uploads', 'screens');
    this.videoDir = path.isAbsolute(base) ? base : path.join(process.cwd(), base);
  }

  async getSettings(): Promise<{ defaultPhotoDurationSeconds: number }> {
    const row = await this.settingsRepo.findOne({ where: { key: this.SETTING_DEFAULT_DURATION } });
    const value = row?.value ? parseInt(row.value, 10) : 15;
    return { defaultPhotoDurationSeconds: Number.isFinite(value) && value > 0 ? value : 15 };
  }

  async updateSettings(data: { defaultPhotoDurationSeconds: number }): Promise<{ defaultPhotoDurationSeconds: number }> {
    const raw = data.defaultPhotoDurationSeconds;
    const normalized = Math.max(1, Math.min(Math.trunc(raw || 15), 3600));
    await this.settingsRepo.save({ key: this.SETTING_DEFAULT_DURATION, value: String(normalized) });
    return { defaultPhotoDurationSeconds: normalized };
  }

  async findAll(): Promise<Screen[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findAllWithPhotoPreview(): Promise<
    (Screen & { photosCount: number; firstPhotoId: string | null })[]
  > {
    const screens = await this.findAll();
    if (!screens.length) return [];

    const screenIds = screens.map((s) => s.id);
    const now = new Date();

    const countsRaw = await this.photoRepo
      .createQueryBuilder('p')
      .select('p.screenId', 'screenId')
      .addSelect('COUNT(*)', 'count')
      .where('p.screenId IN (:...screenIds)', { screenIds })
      .andWhere('(p.expiresAt IS NULL OR p.expiresAt > :now)', { now })
      .groupBy('p.screenId')
      .getRawMany<{ screenId: string; count: string }>();

    const firstRaw = await this.photoRepo
      .createQueryBuilder('p')
      .distinctOn(['p.screenId'])
      .select('p.id', 'id')
      .addSelect('p.screenId', 'screenId')
      .where('p.screenId IN (:...screenIds)', { screenIds })
      .andWhere('(p.expiresAt IS NULL OR p.expiresAt > :now)', { now })
      .orderBy('p.screenId', 'ASC')
      .addOrderBy('p.orderIndex', 'ASC')
      .addOrderBy('p.createdAt', 'ASC')
      .getRawMany<{ id: string; screenId: string }>();

    const countsMap = new Map<string, number>();
    countsRaw.forEach((r) => countsMap.set(r.screenId, parseInt(r.count, 10) || 0));

    const firstMap = new Map<string, string>();
    firstRaw.forEach((r) => firstMap.set(r.screenId, r.id));

    return screens.map((s) => ({
      ...s,
      photosCount: countsMap.get(s.id) || 0,
      firstPhotoId: firstMap.get(s.id) || null,
    }));
  }

  async findOne(id: string): Promise<Screen> {
    const screen = await this.repo.findOne({ where: { id } });
    if (!screen) throw new NotFoundException('Screen not found');
    return screen;
  }

  async updateName(id: string, name: string | null): Promise<Screen> {
    const screen = await this.findOne(id);
    screen.name = name || null;
    return this.repo.save(screen);
  }

  async getVideoPath(screenId: string): Promise<string | null> {
    const screen = await this.repo.findOne({ where: { id: screenId } });
    if (!screen || !screen.currentVideoPath) return null;
    const stored = screen.currentVideoPath;
    if (!stored.startsWith(screenId + path.sep) && !stored.startsWith(screenId + '/')) return null;
    const fullPath = path.join(this.videoDir, stored);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      return null;
    }
  }

  private getPhotosDir(screenId: string): string {
    return path.join(this.videoDir, screenId, 'photos');
  }

  private normalizeRotation(value: number): number {
    const allowed = new Set([0, 90, 180, 270]);
    return allowed.has(value) ? value : 0;
  }

  async listPhotos(screenId: string): Promise<ScreenPhoto[]> {
    return this.photoRepo.find({
      where: { screenId },
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
    });
  }

  async listActivePhotos(screenId: string): Promise<ScreenPhoto[]> {
    const now = new Date();
    const photos = await this.listPhotos(screenId);
    return photos.filter((p) => !p.expiresAt || p.expiresAt > now);
  }

  async savePhoto(
    screenId: string,
    buffer: Buffer,
    originalName: string,
    durationSeconds: number,
    rotation: number,
    expiresAt: Date | null,
    orderIndex: number,
  ): Promise<ScreenPhoto> {
    await this.findOne(screenId);
    const ext = path.extname(originalName) || '.jpg';
    const safeExt = /^\.\w+$/.test(ext) ? ext : '.jpg';
    const dir = this.getPhotosDir(screenId);
    await fs.mkdir(dir, { recursive: true });
    const fileName = `photo-${Date.now()}${safeExt}`;
    const fullPath = path.join(dir, fileName);
    await fs.writeFile(fullPath, buffer);
    const relativePath = `${screenId}/photos/${fileName}`;
    const photo = this.photoRepo.create({
      screenId,
      imagePath: relativePath,
      durationSeconds: Math.max(1, Math.min(durationSeconds || 15, 3600)),
      rotation: this.normalizeRotation(rotation),
      expiresAt,
      orderIndex: Math.max(0, orderIndex || 0),
    });
    return this.photoRepo.save(photo);
  }

  async updatePhoto(
    photoId: string,
    data: { durationSeconds?: number; rotation?: number; expiresAt?: Date | null; orderIndex?: number },
  ): Promise<ScreenPhoto> {
    const photo = await this.photoRepo.findOne({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Photo not found');
    if (data.durationSeconds != null) photo.durationSeconds = Math.max(1, Math.min(data.durationSeconds, 3600));
    if (data.rotation != null) photo.rotation = this.normalizeRotation(data.rotation);
    if (data.expiresAt !== undefined) photo.expiresAt = data.expiresAt;
    if (data.orderIndex != null) photo.orderIndex = Math.max(0, data.orderIndex);
    return this.photoRepo.save(photo);
  }

  async deletePhoto(photoId: string): Promise<void> {
    const photo = await this.photoRepo.findOne({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Photo not found');
    const fullPath = path.join(this.videoDir, photo.imagePath);
    try {
      await fs.rm(fullPath);
    } catch {
      // ignore if file missing
    }
    await this.photoRepo.remove(photo);
  }

  async deleteAllPhotos(screenId: string): Promise<void> {
    await this.findOne(screenId);
    const photos = await this.photoRepo.find({ where: { screenId } });
    await Promise.all(
      photos.map(async (p) => {
        const fullPath = path.join(this.videoDir, p.imagePath);
        try {
          await fs.rm(fullPath);
        } catch {
          // ignore if file missing
        }
      }),
    );
    await this.photoRepo.delete({ screenId });
    const dir = this.getPhotosDir(screenId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  async getPhotoPath(photoId: string): Promise<string | null> {
    const photo = await this.photoRepo.findOne({ where: { id: photoId } });
    if (!photo) return null;
    const fullPath = path.join(this.videoDir, photo.imagePath);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      return null;
    }
  }

  async saveVideo(screenId: string, buffer: Buffer, originalName: string): Promise<Screen> {
    const screen = await this.findOne(screenId);
    const ext = path.extname(originalName) || '.mp4';
    const safeExt = /^\.\w+$/.test(ext) ? ext : '.mp4';
    const dir = path.join(this.videoDir, screenId);
    await fs.mkdir(dir, { recursive: true });
    const fileName = `video${safeExt}`;
    const fullPath = path.join(dir, fileName);
    await fs.writeFile(fullPath, buffer);
    const relativePath = `${screenId}/${fileName}`;
    screen.currentVideoPath = relativePath;
    return this.repo.save(screen);
  }

  async deleteVideo(screenId: string): Promise<void> {
    const screen = await this.findOne(screenId);
    if (!screen.currentVideoPath) return;
    const stored = screen.currentVideoPath;
    if (stored.startsWith(screenId + path.sep) || stored.startsWith(screenId + '/')) {
      const fullPath = path.join(this.videoDir, stored);
      try {
        await fs.rm(fullPath);
      } catch {
        // ignore if file missing
      }
    }
    screen.currentVideoPath = null;
    await this.repo.save(screen);
  }

  async delete(id: string): Promise<void> {
    const screen = await this.findOne(id);
    await this.photoRepo.delete({ screenId: screen.id });
    const dir = path.join(this.videoDir, screen.id);
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // ignore if dir missing
    }
    await this.repo.remove(screen);
  }

  async register(deviceId: string, name?: string): Promise<Screen> {
    const existing = await this.repo.findOne({ where: { deviceId } });
    if (existing) {
      existing.lastSeenAt = new Date();
      if (name != null) existing.name = name || null;
      return this.repo.save(existing);
    }
    const screen = this.repo.create({
      deviceId,
      name: name || null,
      lastSeenAt: new Date(),
    });
    return this.repo.save(screen);
  }

  async getFeed(
    deviceId: string,
  ): Promise<{ videoUrl: string | null; photos?: { url: string; durationSeconds: number; rotation: number }[] }> {
    const screen = await this.repo.findOne({ where: { deviceId } });
    if (!screen) return { videoUrl: null };
    const base = (this.config.get<string>('API_BASE_URL') || '').trim().replace(/\/+$/, '');
    if (screen.currentVideoPath) {
      const path = `/api/public/screens/video/${screen.id}`;
      const videoUrl = base ? `${base}${path}` : path;
      return { videoUrl };
    }
    const photos = await this.listActivePhotos(screen.id);
    const items = photos.map((p) => {
      const path = `/api/public/screens/photo/${p.id}`;
      return {
        url: base ? `${base}${path}` : path,
        durationSeconds: p.durationSeconds,
        rotation: p.rotation,
      };
    });
    return { videoUrl: null, photos: items };
  }

  async getApkPath(): Promise<string | null> {
    const raw = this.config.get<string>('SCREENS_APK_PATH');
    if (!raw?.trim()) return null;
    const fullPath = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      return null;
    }
  }
}
