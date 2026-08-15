#!/usr/bin/env bash
# ============================================================
# nuevo-cliente.sh
# Prepara la app para un cliente nuevo: genera su configuración
# (claves de Firebase + marca) y deja todo listo para publicar,
# ya sea en Firebase Hosting o en GitHub Pages.
#
# Uso:  bash scripts/nuevo-cliente.sh
# ============================================================
set -e

echo "==============================================="
echo "   Alta de nuevo cliente — Alquileres App"
echo "==============================================="
echo ""
echo "PASO PREVIO en https://console.firebase.google.com :"
echo "  1) Crear un proyecto nuevo para el cliente."
echo "  2) Agregar una app Web y copiar el firebaseConfig."
echo "  3) Authentication -> activar Email/Password y crear el usuario del dueño."
echo "  4) Firestore Database -> crear la base (modo producción)."
echo ""

read -p "Nombre del cliente (ej: Alquileres Lopez): " NOMBRE
read -p "Firebase projectId: " PROJECT_ID
read -p "Firebase apiKey: " API_KEY
read -p "Firebase appId: " APP_ID
read -p "Firebase messagingSenderId: " SENDER_ID
read -p "Color primario (hex, ej #2563eb) [Enter = default]: " COLOR
COLOR=${COLOR:-#2563eb}

# 1) Proyecto de Firebase por defecto (para deploy con Firebase CLI)
cat > .firebaserc <<JSON
{
  "projects": {
    "default": "${PROJECT_ID}"
  }
}
JSON

# 2) Config del cliente a partir de la plantilla
sed \
  -e "s|__NOMBRE__|${NOMBRE}|g" \
  -e "s|__API_KEY__|${API_KEY}|g" \
  -e "s|__PROJECT_ID__|${PROJECT_ID}|g" \
  -e "s|__APP_ID__|${APP_ID}|g" \
  -e "s|__SENDER_ID__|${SENDER_ID}|g" \
  -e "s|__COLOR__|${COLOR}|g" \
  config/client.config.example.js > public/config/client.config.js

echo ""
echo "✅ Configuración generada para: ${NOMBRE}"
echo "   - .firebaserc                    -> proyecto ${PROJECT_ID}"
echo "   - public/config/client.config.js -> claves + marca"
echo ""
echo "-----------------------------------------------"
echo "AHORA, ELEGÍ CÓMO PUBLICAR:"
echo ""
echo "OPCIÓN A) Firebase Hosting"
echo "   npm run deploy:rules     # sube reglas + índices"
echo "   npm run deploy           # publica la app"
echo ""
echo "OPCIÓN B) GitHub Pages"
echo "   1) Creá un repo nuevo en GitHub para este cliente y subí el proyecto:"
echo "        git init && git add -A && git commit -m \"Alta ${NOMBRE}\""
echo "        git branch -M main"
echo "        git remote add origin <URL-del-repo>"
echo "        git push -u origin main"
echo "   2) En el repo: Settings -> Pages -> Source: GitHub Actions."
echo "      (El workflow .github/workflows/deploy-pages.yml publica solo.)"
echo "   3) Igual subí las reglas de Firestore una vez con: npm run deploy:rules"
echo ""
echo "Ver ONBOARDING.md para el detalle completo."
