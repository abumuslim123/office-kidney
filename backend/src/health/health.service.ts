import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
}
