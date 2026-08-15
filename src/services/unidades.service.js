import { BaseService } from './base.service.js';

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

export const unidadesService = new UnidadesService();
