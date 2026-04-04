self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'CashOut Alert';
  const options = {
    body: data.body || 'Cash spotted a live play.',
    icon: '/cashout-icon.png',
    badge: '/cashout-icon.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || 'https://cashout.inc' },
    actions: [
      { action: 'view', title: 'View Pick' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://cashout.inc';
  event.waitUntil(clients.openWindow(url));
});
