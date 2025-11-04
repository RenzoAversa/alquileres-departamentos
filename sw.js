// ========================================
// SERVICE WORKER - Cache y funcionalidad offline
// ========================================

const CACHE_NAME = 'alquileres-v1';

// Rutas para GitHub Pages (archivos en la raíz)
const REPO_NAME = '/alquileres-departamentos';

const CACHE_URLS = [
    REPO_NAME + '/',
    REPO_NAME + '/index.html',
    REPO_NAME + '/css/style.css',
    REPO_NAME + '/js/model.js',
    REPO_NAME + '/js/view.js',
    REPO_NAME + '/js/controller.js',
    REPO_NAME + '/manifest.json'
];

// ========================================
// INSTALACIÓN
// ========================================

self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Archivos en caché');
                return cache.addAll(CACHE_URLS);
            })
            .then(() => {
                console.log('✅ Service Worker: Instalación completa');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Error al cachear archivos:', error);
            })
    );
});

// ========================================
// ACTIVACIÓN
// ========================================

self.addEventListener('activate', (event) => {
    console.log('⚡ Service Worker: Activando...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Eliminar cachés antiguos
                        if (cacheName !== CACHE_NAME) {
                            console.log('🗑️ Service Worker: Eliminando caché antigua:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker: Activación completa');
                return self.clients.claim();
            })
    );
});

// ========================================
// FETCH - Estrategia: Cache First, fallback a Network
// ========================================

self.addEventListener('fetch', (event) => {
    // Solo manejar peticiones GET
    if (event.request.method !== 'GET') {
        return;
    }

    // Ignorar extensiones de navegador y localhost API calls
    if (event.request.url.includes('chrome-extension') || 
        event.request.url.includes('moz-extension')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Si está en caché, devolver la respuesta cacheada
                if (cachedResponse) {
                    console.log('📦 Desde caché:', event.request.url);
                    return cachedResponse;
                }

                // Si no está en caché, hacer fetch a la red
                console.log('🌐 Desde red:', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // Verificar si la respuesta es válida
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clonar la respuesta porque solo se puede consumir una vez
                        const responseToCache = response.clone();

                        // Agregar a caché para uso futuro
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.error('❌ Error en fetch:', error);
                        
                        // Si es una página HTML y falla, podrías devolver una página offline custom
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// ========================================
// MENSAJES - Comunicación con la app
// ========================================

self.addEventListener('message', (event) => {
    console.log('📨 Service Worker: Mensaje recibido', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.delete(CACHE_NAME)
                .then(() => {
                    console.log('🗑️ Caché limpiado');
                    return self.clients.matchAll();
                })
                .then((clients) => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'CACHE_CLEARED',
                            message: 'La caché ha sido limpiada'
                        });
                    });
                })
        );
    }
});

// ========================================
// SINCRONIZACIÓN EN SEGUNDO PLANO (Opcional)
// ========================================

// Esta funcionalidad requiere registro desde el cliente
// Útil para sincronizar datos cuando vuelve la conexión

self.addEventListener('sync', (event) => {
    console.log('🔄 Service Worker: Sincronización en background');
    
    if (event.tag === 'sync-data') {
        event.waitUntil(
            // Aquí podrías sincronizar datos con un servidor
            // Por ahora solo registramos el evento
            Promise.resolve().then(() => {
                console.log('✅ Sincronización completada');
            })
        );
    }
});

// ========================================
// NOTIFICACIONES PUSH (Opcional)
// ========================================

// Escuchar notificaciones push
self.addEventListener('push', (event) => {
    console.log('📬 Service Worker: Push recibido');
    
    const options = {
        body: event.data ? event.data.text() : 'Nueva notificación',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Ver más',
                icon: '/icon-96x96.png'
            },
            {
                action: 'close',
                title: 'Cerrar',
                icon: '/icon-96x96.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Registro de Alquileres', options)
    );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
    console.log('🔔 Notificación clickeada:', event.action);
    
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

console.log('✅ Service Worker cargado');
