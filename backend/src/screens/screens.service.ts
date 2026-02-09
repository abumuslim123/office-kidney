import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Screen } from './entities/screen.entity';

@Injectable()
export class ScreensService {
  private readonly videoDir: string;

  constructor(
    @InjectRepository(Screen)
    private repo: Repository<Screen>,
    private config: ConfigService,
  ) {
    const base = this.config.get<string>('SCREENS_VIDEO_DIR') || path.join(process.cwd(), 'uploads', 'screens');
    this.videoDir = path.isAbsolute(base) ? base : path.join(process.cwd(), base);
  }

  async findAll(): Promise<Screen[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
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

  async delete(id: string): Promise<void> {
    const screen = await this.findOne(id);
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

  async getFeed(deviceId: string): Promise<{ videoUrl: string | null }> {
    const screen = await this.repo.findOne({ where: { deviceId } });
    if (!screen || !screen.currentVideoPath) return { videoUrl: null };
    const base = (this.config.get<string>('API_BASE_URL') || '').trim().replace(/\/+$/, '');
    const path = `/api/public/screens/video/${screen.id}`;
    const videoUrl = base ? `${base}${path}` : path;
    return { videoUrl };
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
