import { BaseService } from './base.service.js';
import { conCache } from './cache-colecciones.js';

class EdificiosService extends BaseService {
  constructor() { super('edificios'); }
}

// Cambian muy de vez en cuando: se cachean en memoria (ver
// cache-colecciones.js) y se invalidan solas al crear/editar/borrar.
export const edificiosService = conCache(new EdificiosService(), 'edificios');
