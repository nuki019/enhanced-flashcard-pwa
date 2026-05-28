// Service Worker - 智能闪卡学习系统
// 版本号
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `smart-flashcard-${CACHE_VERSION}`;

// 需要缓存的资源
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './spaced-repetition.js',
  './richtext.js',
  './tags.js',
  './search.js',
  './data/cards.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// 安装事件 - 预缓存资源
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Pre-caching assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('smart-flashcard-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim();
      })
  );
});

// 请求拦截 - 缓存优先策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }

  // 对于导航请求，使用网络优先策略
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 如果成功，更新缓存
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          // 如果失败，返回缓存的页面
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 对于其他请求，使用缓存优先策略
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // 返回缓存的资源
          return cachedResponse;
        }

        // 如果没有缓存，从网络获取
        return fetch(request)
          .then((response) => {
            // 检查响应是否有效
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 缓存新资源
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));

            return response;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch failed:', error);

            // 对于图片请求，返回占位图
            if (request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#eee" width="200" height="200"/><text fill="#999" font-family="sans-serif" font-size="18" x="50%" y="50%" text-anchor="middle" dy=".3em">图片离线</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }

            throw error;
          });
      })
  );
});

// 后台同步（如果支持）
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    console.log('[Service Worker] Syncing progress...');
    // 这里可以添加同步逻辑，例如上传学习进度到服务器
  }
});

// 推送通知（如果支持）
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '该复习啦！',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '开始复习',
        icon: './assets/icon-192.png'
      },
      {
        action: 'close',
        title: '稍后提醒',
        icon: './assets/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('智能闪卡学习提醒', options)
  );
});

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received.');

  event.notification.close();

  if (event.action === 'explore') {
    // 打开应用
    event.waitUntil(
      clients.openWindow('./index.html')
    );
  } else if (event.action === 'close') {
    // 关闭通知
    console.log('[Service Worker] Notification dismissed');
  }
});

// 消息处理
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[Service Worker] Script loaded');
