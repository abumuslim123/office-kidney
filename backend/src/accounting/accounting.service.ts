import { Injectable } from '@nestjs/common';

@Injectable()
export class AccountingService {
  getPlaceholder() {
    return {
      message: 'Accounting module — tables and entities will be added here',
      data: [],
    };
  }
}
