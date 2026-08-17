import { BaseService } from './base.service.js';
import { conCache } from './cache-colecciones.js';

class UnidadesService extends BaseService {
  constructor() { super('unidades'); }

  // Unidades de un edificio
  getByEdificio(edificioId) {
    return this.buscar([['edificioId', '==', edificioId]]);
  }

  // Departamentos sueltos (sin edificio)
  getSueltas() {
    return this.buscar([['edificioId', '==', null]]);
  }
}

// Cambian muy de vez en cuando: se cachean en memoria (ver
// cache-colecciones.js) y se invalidan solas al crear/editar/borrar.
export const unidadesService = conCache(new UnidadesService(), 'unidades');
