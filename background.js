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

    // Escanear e iniciar la subida de imágenes en paralelo
    const imgRegex = /!\[\[([^\]]+\.(?:png|jpg|jpeg|webp|gif))\]\]\s*<!--\s*fallback:\s*(https?:\/\/[^\s>]+)\s*-->/g;
    const imgMatches = [...data.markdown.matchAll(imgRegex)];
    
    if (imgMatches.length > 0) {
      console.log(`[GemiMd] Encontradas ${imgMatches.length} imágenes para sincronizar.`);
      const imageHeaders = { ...headers };
      delete imageHeaders['Content-Type']; // Se definirá dinámicamente según la respuesta del fetch
      
      Promise.all(imgMatches.map(async (match) => {
        const imageVaultPath = match[1];
        const imageUrl = match[2];
        return uploadImageToObsidian(imageVaultPath, imageUrl, imageHeaders, 'http://127.0.0.1:27123/vault/', 'https://127.0.0.1:27124/vault/');
      })).then((results) => {
        const successCount = results.filter(Boolean).length;
        console.log(`[GemiMd] Sincronización de imágenes finalizada. Éxito: ${successCount}/${results.length}`);
      });
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

// Función auxiliar para descargar una imagen de la web y subirla a Obsidian Local REST API
async function uploadImageToObsidian(imageVaultPath, imageUrl, headers, httpUrlBase, httpsUrlBase) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Fetch error: ${response.statusText}`);
    }
    const blob = await response.blob();
    const contentType = response.headers.get('Content-Type') || 'image/png';

    // Codificar la ruta del archivo respetando las barras de carpetas
    const encodedPath = imageVaultPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const httpUrl = `${httpUrlBase}${encodedPath}`;
    const httpsUrl = `${httpsUrlBase}${encodedPath}`;

    const uploadHeaders = {
      ...headers,
      'Content-Type': contentType
    };

    console.log(`[GemiMd] Subiendo imagen a: ${imageVaultPath}`);

    // Intentar por HTTP
    try {
      const putRes = await fetch(httpUrl, {
        method: 'PUT',
        headers: uploadHeaders,
        body: blob
      });
      if (putRes.ok) {
        console.log(`[GemiMd] Imagen subida con éxito (HTTP): ${imageVaultPath}`);
        return true;
      }
    } catch (e) {
      console.warn(`[GemiMd] Falló subida HTTP, intentando HTTPS...`, e.message);
    }

    // Intentar por HTTPS
    const putResHttps = await fetch(httpsUrl, {
      method: 'PUT',
      headers: uploadHeaders,
      body: blob
    });
    if (putResHttps.ok) {
      console.log(`[GemiMd] Imagen subida con éxito (HTTPS): ${imageVaultPath}`);
      return true;
    }
  } catch (err) {
    console.error(`[GemiMd] Error al subir imagen ${imageVaultPath}:`, err.message);
  }
  return false;
}

