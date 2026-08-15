import { BaseService } from './base.service.js';

class EdificiosService extends BaseService {
  constructor() { super('edificios'); }
}

export const edificiosService = new EdificiosService();
