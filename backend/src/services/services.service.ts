import { Injectable } from '@nestjs/common';

@Injectable()
export class ServicesService {
  getPlaceholder() {
    return {
      message: 'Services/Jobs module — Bull/BullMQ and run tasks will be added here',
      jobs: [],
    };
  }
}
