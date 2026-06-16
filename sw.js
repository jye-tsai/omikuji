// 今日運勢 — Service Worker（離線快取）
const CACHE = 'omikuji-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon.png'];

// 安裝：快取 app shell（個別加入，單一失敗不影響整體）
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

// 啟用：清掉舊版快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 取用策略
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isData = url.pathname.endsWith('data.json') || url.hostname.includes('api.github.com');
  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  // 資料：永遠走網路（確保同步最新），完全不快取
  if (isData) { e.respondWith(fetch(req).catch(() => caches.match(req))); return; }

  // 網頁：網路優先，離線時退回快取的 index.html
  if (isDoc) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // 靜態資源（圖示、manifest）：快取優先，沒有再抓網路並補快取
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
