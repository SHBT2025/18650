/**
 * Battery Manager PWA - Service Worker
 * Version: 3.1
 */

// 缓存名称
const CACHE_NAME = 'battery-manager-v3.1';
const STATIC_CACHE = 'battery-static-v3.1';
const DYNAMIC_CACHE = 'battery-dynamic-v3.1';

// 核心文件列表 - 首次安装时缓存
const CORE_FILES = [
  './index.html',
  './manifest.json',
  './192.png',
  './512.png'
];

// 安装阶段：缓存核心文件
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching core files');
        return cache.addAll(CORE_FILES);
      })
      .then(() => {
        console.log('[SW] Skip waiting for activation');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Install failed:', err);
        // 即使缓存失败也继续安装
        return self.skipWaiting();
      })
  );
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // 删除旧版本缓存
              return name.startsWith('battery-') && 
                     name !== STATIC_CACHE && 
                     name !== DYNAMIC_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// 请求拦截：缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // 导航请求（HTML）：优先网络，失败时回退缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 缓存新的 HTML
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 静态资源（图片、CSS、JS）：缓存优先，失败时回退网络
  if (request.destination === 'image' || 
      request.destination === 'style' ||
      request.destination === 'script') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // 返回缓存，同时更新缓存（后台更新）
            fetch(request)
              .then((networkResponse) => {
                caches.open(DYNAMIC_CACHE)
                  .then((cache) => cache.put(request, networkResponse));
              })
              .catch(() => {});
            return cachedResponse;
          }
          // 无缓存，尝试网络
          return fetch(request)
            .then((response) => {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => cache.put(request, responseClone));
              return response;
            });
        })
    );
    return;
  }

  // 其他请求：网络优先
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// 处理来自页面的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('[SW] Service Worker loaded');
