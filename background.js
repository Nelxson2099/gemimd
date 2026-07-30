// background.js - Service Worker para GemiMd (Sincronización con Obsidian REST API)

chrome.runtime.onInstalled.addListener(() => {
  console.log('GemiMd Extension v1.2 instalada correctamente.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. DESCARGA MANUAL VÍA BLOB/DOWNLOADS API
  if (request.action === 'DOWNLOAD_FILE') {
    const { content, filename } = request;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    
    const reader = new FileReader();
    reader.onload = function () {
      chrome.downloads.download({
        url: reader.result,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      });
    };
    reader.readAsDataURL(blob);
    return true;
  }

  // 2. AUTO-SYNC EN SEGUNDO PLANO VÍA OBSIDIAN LOCAL REST API
  if (request.action === 'AUTO_SYNC_NOTE') {
    const { data, apiKey, vaultFolder } = request;
    const safeFilename = encodeURIComponent(data.filename);
    
    // Formatear carpeta personalizada (soporta carpetas anidadas o raíz)
    let folderPath = (vaultFolder !== undefined ? vaultFolder : '5_Conversaciones').trim().replace(/^\/+|\/+$/g, '');
    const path = folderPath ? `${folderPath}/${safeFilename}` : safeFilename;

    const httpUrl = `http://127.0.0.1:27123/vault/${path}`;
    const httpsUrl = `https://127.0.0.1:27124/vault/${path}`;

    const headers = {
      'Content-Type': 'text/markdown'
    };

    if (apiKey && apiKey.trim()) {
      const cleanToken = apiKey.trim().replace(/^Bearer\s+/i, '');
      headers['Authorization'] = `Bearer ${cleanToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    fetch(httpUrl, {
      method: 'PUT',
      headers: headers,
      body: data.markdown,
      signal: controller.signal
    })
    .then(res => {
      clearTimeout(timeoutId);
      if (res.ok) {
        console.log('[GemiMd Auto-Sync HTTP Exitoso]:', path);
        sendResponse({ success: true, mode: 'http', status: res.status, folder: folderPath });
      } else {
        throw new Error('HTTP Status ' + res.status);
      }
    })
    .catch(errHttp => {
      clearTimeout(timeoutId);
      console.warn('[GemiMd Auto-Sync HTTP fallo, intentando HTTPS...]:', errHttp.message);

      const controllerHttps = new AbortController();
      const timeoutHttpsId = setTimeout(() => controllerHttps.abort(), 4000);

      fetch(httpsUrl, {
        method: 'PUT',
        headers: headers,
        body: data.markdown,
        signal: controllerHttps.signal
      })
      .then(res => {
        clearTimeout(timeoutHttpsId);
        if (res.ok) {
          console.log('[GemiMd Auto-Sync HTTPS Exitoso]:', path);
          sendResponse({ success: true, mode: 'https', status: res.status, folder: folderPath });
        } else {
          sendResponse({ success: false, error: 'HTTPS Status ' + res.status });
        }
      })
      .catch(errHttps => {
        clearTimeout(timeoutHttpsId);
        console.error('[GemiMd Auto-Sync Error Final]:', errHttps.message);
        sendResponse({ success: false, error: errHttps.message });
      });
    });

    return true; // Asíncrono
  }
});
