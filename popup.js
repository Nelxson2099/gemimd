// popup.js - Lógica interactiva para la extensión GemiMd

document.addEventListener('DOMContentLoaded', () => {
  const platformNameEl = document.getElementById('platformName');
  const turnCountEl = document.getElementById('turnCount');
  const wordCountEl = document.getElementById('wordCount');
  const customTagsInput = document.getElementById('customTags');
  const vaultFolderInput = document.getElementById('vaultFolderInput');
  const previewTextEl = document.getElementById('previewText');

  const chkAutoSync = document.getElementById('chkAutoSync');
  const chkSaveImages = document.getElementById('chkSaveImages');
  const apiKeyGroup = document.getElementById('apiKeyGroup');
  const apiKeyInput = document.getElementById('apiKeyInput');

  const btnSyncNow = document.getElementById('btnSyncNow');
  const btnSyncText = document.getElementById('btnSyncText');
  const btnDownload = document.getElementById('btnDownload');
  const btnCopy = document.getElementById('btnCopy');
  const btnObsidian = document.getElementById('btnObsidian');

  let currentData = null;

  // Cargar configuraciones guardadas
  chrome.storage.local.get(['gemiMdTags', 'gemiMdAutoSync', 'gemiMdRestApiKey', 'gemiMdVaultFolder', 'gemiMdSaveImages'], (res) => {
    if (res.gemiMdTags) customTagsInput.value = res.gemiMdTags;
    if (res.gemiMdVaultFolder !== undefined) vaultFolderInput.value = res.gemiMdVaultFolder;
    if (res.gemiMdAutoSync) {
      chkAutoSync.checked = true;
      apiKeyGroup.style.display = 'block';
    }
    if (res.gemiMdRestApiKey) apiKeyInput.value = res.gemiMdRestApiKey;
    if (res.gemiMdSaveImages !== undefined) {
      chkSaveImages.checked = res.gemiMdSaveImages;
    } else {
      chkSaveImages.checked = true;
    }

    updateSyncButtonText();
    requestConversationMD();
  });

  // Actualizar nombre de la carpeta en el botón y refrescar nota
  vaultFolderInput.addEventListener('input', () => {
    const folder = vaultFolderInput.value.trim();
    chrome.storage.local.set({ gemiMdVaultFolder: folder }, () => {
      updateSyncButtonText();
      requestConversationMD();
    });
  });

  function updateSyncButtonText() {
    const folder = vaultFolderInput.value.trim() || 'Raíz (Vault)';
    if (btnSyncText) {
      btnSyncText.textContent = `⚡ Sincronizar en ${folder}`;
    }
  }

  // Manejar cambio en el Switch de Auto-Sync
  chkAutoSync.addEventListener('change', () => {
    const isChecked = chkAutoSync.checked;
    apiKeyGroup.style.display = isChecked ? 'block' : 'none';
    chrome.storage.local.set({ gemiMdAutoSync: isChecked }, () => {
      if (isChecked) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'TRIGGER_SYNC' });
          }
        });
      }
    });
  });

  // Manejar cambio en el Switch de Guardar Imágenes
  chkSaveImages.addEventListener('change', () => {
    const isChecked = chkSaveImages.checked;
    chrome.storage.local.set({ gemiMdSaveImages: isChecked }, () => {
      requestConversationMD();
    });
  });

  // Guardar la API Key al escribir o cambiar
  apiKeyInput.addEventListener('input', () => {
    chrome.storage.local.set({ gemiMdRestApiKey: apiKeyInput.value.trim() });
  });

  // Consultar la pestaña activa
  function requestConversationMD() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;

      const activeTab = tabs[0];
      const folder = vaultFolderInput.value.trim();
      const saveImages = chkSaveImages ? chkSaveImages.checked : true;
      
      chrome.tabs.sendMessage(activeTab.id, { 
        action: 'GET_CONVERSATION_MD',
        options: { saveImages, vaultFolder: folder }
      }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          platformNameEl.textContent = 'Abre Gemini, ChatGPT o Claude';
          previewTextEl.textContent = 'Navega a un chat de IA para extraer y convertir la conversación a Markdown.';
          turnCountEl.textContent = '0';
          wordCountEl.textContent = '0';
          return;
        }

        currentData = response.data;
        updateUI(currentData);
      });
    });
  }

  customTagsInput.addEventListener('input', () => {
    chrome.storage.local.set({ gemiMdTags: customTagsInput.value });
    if (currentData) {
      updatePreviewWithCustomTags();
    }
  });

  function updateUI(data) {
    platformNameEl.textContent = `${data.platform} (${data.turnCount} turnos)`;
    turnCountEl.textContent = data.turnCount;

    const words = countWords(data.markdown);
    wordCountEl.textContent = words.toLocaleString();

    updatePreviewWithCustomTags();
  }

  function updatePreviewWithCustomTags() {
    if (!currentData) return;
    
    const markdownWithTags = applyCustomTags(currentData.markdown, customTagsInput.value);
    previewTextEl.textContent = markdownWithTags.substring(0, 300) + '...\n\n[Texto completo listo para exportar]';
  }

  // BOTÓN 0: SINCRONIZAR AHORA CON OBSIDIAN REST API
  if (btnSyncNow) {
    btnSyncNow.addEventListener('click', () => {
      if (!currentData) {
        alert('No se detectó ninguna conversación activa.');
        return;
      }

      const finalMarkdown = applyCustomTags(currentData.markdown, customTagsInput.value);
      const dataToSync = { ...currentData, markdown: finalMarkdown };
      const folder = vaultFolderInput.value.trim();

      const originalHTML = btnSyncNow.innerHTML;
      btnSyncNow.innerHTML = `<span style="color: #38BDF8;">⏳ Sincronizando...</span>`;

      let responded = false;
      const timeoutTimer = setTimeout(() => {
        if (!responded) {
          responded = true;
          btnSyncNow.innerHTML = originalHTML;
          alert('No se recibió respuesta de Obsidian. Verifica que Obsidian esté abierto con el plugin Local REST API activo.');
        }
      }, 4500);

      chrome.runtime.sendMessage({
        action: 'AUTO_SYNC_NOTE',
        data: dataToSync,
        apiKey: apiKeyInput.value.trim(),
        vaultFolder: folder
      }, (res) => {
        if (responded) return;
        responded = true;
        clearTimeout(timeoutTimer);

        if (res && res.success) {
          const displayFolder = folder || 'Raíz';
          btnSyncNow.innerHTML = `<span style="color: #38BDF8;">✓ Sincronizado en ${displayFolder}!</span>`;
          setTimeout(() => { btnSyncNow.innerHTML = originalHTML; }, 2500);
        } else {
          btnSyncNow.innerHTML = originalHTML;
          const errMsg = res && res.error ? res.error : 'Error de autenticación u Obsidian cerrado';
          alert(`❌ No se pudo sincronizar en Obsidian: ${errMsg}`);
        }
      });
    });
  }

  // BOTÓN 1: DESCARGAR .MD
  btnDownload.addEventListener('click', () => {
    if (!currentData) {
      alert('No se detectó ninguna conversación activa.');
      return;
    }

    const finalMarkdown = applyCustomTags(currentData.markdown, customTagsInput.value);
    const filename = currentData.filename || `${currentData.platform}_${sanitizeFilename(currentData.title)}.md`;

    chrome.runtime.sendMessage({
      action: 'DOWNLOAD_FILE',
      content: finalMarkdown,
      filename: filename
    }, (res) => {
      if (res && res.success) {
        showFeedback(btnDownload, '¡Descargado!');
      } else {
        downloadBlob(finalMarkdown, filename);
        showFeedback(btnDownload, '¡Descargado!');
      }
    });
  });

  // BOTÓN 2: COPIAR AL PORTAPAPELES
  btnCopy.addEventListener('click', async () => {
    if (!currentData) {
      alert('No se detectó ninguna conversación activa.');
      return;
    }

    const finalMarkdown = applyCustomTags(currentData.markdown, customTagsInput.value);
    try {
      await navigator.clipboard.writeText(finalMarkdown);
      showFeedback(btnCopy, '¡Copiado!');
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  });

  // BOTÓN 3: EXPORTAR A OBSIDIAN (URI Protocol)
  btnObsidian.addEventListener('click', () => {
    if (!currentData) {
      alert('No se detectó ninguna conversación activa.');
      return;
    }

    const finalMarkdown = applyCustomTags(currentData.markdown, customTagsInput.value);
    const safeTitle = sanitizeFilename(currentData.title);
    
    const uri = `obsidian://new?name=${encodeURIComponent(safeTitle)}&content=${encodeURIComponent(finalMarkdown)}`;
    chrome.tabs.create({ url: uri });
    showFeedback(btnObsidian, '¡Abriendo!');
  });

  function applyCustomTags(markdown, tagsString) {
    if (!tagsString || !tagsString.trim()) return markdown;

    const tagsArray = tagsString
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    if (tagsArray.length === 0) return markdown;

    const formattedTags = tagsArray.map(t => `  - ${t}`).join('\n');
    return markdown.replace(/tags:\n(\s*-\s*.*\n)+/, `tags:\n${formattedTags}\n`);
  }

  function countWords(str) {
    if (!str) return 0;
    const matches = str.match(/\S+/g);
    return matches ? matches.length : 0;
  }

  function sanitizeFilename(name) {
    return name
      .replace(/[\/\?%\*:|"<>]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 40);
  }

  function downloadBlob(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showFeedback(btn, message) {
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span style="color: #38BDF8;">${message}</span>`;
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2500);
  }
});
