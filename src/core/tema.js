// ============================================================
// Modo oscuro: preferencia guardada en localStorage, aplicada
// vía atributo data-tema en <html> (los overrides viven en
// tokens.css). El anti-flash (aplicar ANTES de pintar) va en un
// script inline en index.html/login.html con la misma clave.
// ============================================================
export const CLAVE_TEMA = 'alquileres_tema';

export function aplicarTemaGuardado() {
  const tema = localStorage.getItem(CLAVE_TEMA) === 'oscuro' ? 'oscuro' : 'claro';
  document.documentElement.setAttribute('data-tema', tema);
  return tema;
}

export function temaActual() {
  return document.documentElement.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
}

export function alternarTema() {
  const nuevo = temaActual() === 'oscuro' ? 'claro' : 'oscuro';
  document.documentElement.setAttribute('data-tema', nuevo);
  localStorage.setItem(CLAVE_TEMA, nuevo);
  return nuevo;
}
