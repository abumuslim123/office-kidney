import { Injectable } from '@nestjs/common';

@Injectable()
export class AgentsService {
  getPlaceholder() {
    return {
      message: 'AI Agents module — providers and run endpoints will be added here',
      agents: [],
    };
  }
}
