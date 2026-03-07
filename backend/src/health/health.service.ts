import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class HealthService {
  constructor(private dataSource: DataSource) {}

  async check(): Promise<{ status: string; db: string }> {
    let dbStatus = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'up';
    } catch {
      // leave dbStatus as 'down'
    }
    return {
      status: 'ok',
      db: dbStatus,
    };
  }

  async backupStatus(): Promise<{
    hasBackupToday: boolean;
    lastBackup: string | null;
    lastBackupSize: number | null;
    backupCount: number;
  }> {
    const backupDir = process.env.DB_BACKUP_DIR || '/backups';
    const result = {
      hasBackupToday: false,
      lastBackup: null as string | null,
      lastBackupSize: null as number | null,
      backupCount: 0,
    };

    try {
      if (!fs.existsSync(backupDir)) return result;

      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.endsWith('.sql.gz'))
        .map((f) => {
          const stat = fs.statSync(path.join(backupDir, f));
          return { name: f, mtime: stat.mtime, size: stat.size };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      result.backupCount = files.length;

      if (files.length > 0) {
        const latest = files[0];
        result.lastBackup = latest.mtime.toISOString();
        result.lastBackupSize = latest.size;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        result.hasBackupToday = latest.mtime >= today;
      }
    } catch {
      // directory not accessible — return defaults
    }

    return result;
  }
}
