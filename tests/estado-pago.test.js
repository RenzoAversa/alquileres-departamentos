// Test de estadoPagoDe() (reservas.service.js): deriva el estado de pago
// a partir de lo pagado vs el total. Es una función pura — no toca
// Firestore — pero el módulo que la exporta sí importa 'firebase/firestore'
// a nivel de módulo, así que hace falta el paquete npm `firebase`
// (devDependency) para que Node pueda resolver el import; no hace falta
// el emulador corriendo (initializeApp/getFirestore no llaman a la red).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { estadoPagoDe } from '../src/services/reservas.service.js';

describe('estadoPagoDe', () => {
  test('sin pagar', () => {
    assert.equal(estadoPagoDe(0, 1000), 'sin_pagar');
  });
  test('pagado negativo o inválido se trata como sin pagar', () => {
    assert.equal(estadoPagoDe(-50, 1000), 'sin_pagar');
    assert.equal(estadoPagoDe(undefined, 1000), 'sin_pagar');
    assert.equal(estadoPagoDe(NaN, 1000), 'sin_pagar');
  });
  test('pago parcial', () => {
    assert.equal(estadoPagoDe(500, 1000), 'parcial');
  });
  test('pagado exacto = pagado', () => {
    assert.equal(estadoPagoDe(1000, 1000), 'pagado');
  });
  test('pagado de más (error de redondeo/vuelto) sigue siendo pagado, no rompe', () => {
    assert.equal(estadoPagoDe(1000.01, 1000), 'pagado');
    assert.equal(estadoPagoDe(1500, 1000), 'pagado');
  });
  test('reserva de total 0 (ej. cortesía) con cualquier pago > 0 queda pagada', () => {
    assert.equal(estadoPagoDe(0, 0), 'sin_pagar');
    assert.equal(estadoPagoDe(1, 0), 'pagado');
  });
});
