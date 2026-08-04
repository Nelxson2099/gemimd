// content.js - Extractor Multi-plataforma de Conversaciones a Markdown (.md)
// Incluye Motor Auto-Sync (Debounce 5s), ID Único de Chat y Escáner Híbrido B+C de Medios

(function () {
  let lastSyncedHash = '';
  let autoSyncTimer = null;
  let currentOptions = { saveImages: true, vaultFolder: '5_Conversaciones' };

  // Listener de mensajes desde el popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_CONVERSATION_MD') {
      try {
        const result = extractFullConversation(request.options || {});
        // Sincronizar inmediatamente si Auto-Sync está activo
        triggerAutoSync();
        sendResponse({ success: true, data: result });
      } catch (err) {
        console.error('[GemiMd Error]:', err);
        sendResponse({ success: false, error: err.message });
      }
    } else if (request.action === 'TRIGGER_SYNC') {
      triggerAutoSync();
      sendResponse({ success: true });
    }
    return true;
  });

  // Escuchar cambios en el DOM y eventos para Auto-Sync automático
  setupAutoSyncObserver();

  // Disparar sincronización inicial tras 2.5s de cargar la página
  setTimeout(() => {
    triggerAutoSync();
  }, 2500);

  // Función principal de extracción
  function extractFullConversation(options) {
    if (options) {
      currentOptions = { ...currentOptions, ...options };
    }
    const hostname = window.location.hostname;
    let platform = 'AI Chat';
    let turns = [];

    if (hostname.includes('gemini.google.com')) {
      platform = 'Gemini';
      turns = parseGeminiChat();
    } else if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
      platform = 'ChatGPT';
      turns = parseChatGPTChat();
    } else if (hostname.includes('claude.ai')) {
      platform = 'Claude';
      turns = parseClaudeChat();
    } else if (hostname.includes('deepseek.com')) {
      platform = 'DeepSeek';
      turns = parseDeepSeekChat();
    } else {
      platform = 'Generic AI';
      turns = parseGenericChat();
    }

    if (!turns || turns.length === 0) {
      turns = parseGenericChat();
    }

    const rawTitle = cleanTitle(document.title || 'Conversación IA');
    const chatId = getChatUniqueId();
    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);

    // Formatear YAML Frontmatter
    let mdContent = `---\n`;
    mdContent += `title: "${rawTitle.replace(/"/g, '\\"')}"\n`;
    mdContent += `date: "${dateStr}"\n`;
    mdContent += `source: "${window.location.href}"\n`;
    mdContent += `platform: "${platform}"\n`;
    mdContent += `chat_id: "${chatId}"\n`;
    mdContent += `tags:\n`;
    mdContent += `  - zettelkasten\n`;
    mdContent += `  - ai-memory\n`;
    mdContent += `  - gemimd\n`;
    mdContent += `---\n\n`;

    mdContent += `# ${rawTitle}\n\n`;

    // Ensamblar la conversación en Markdown
    turns.forEach((turn) => {
      const roleName = turn.role === 'user' ? '👤 Usuario' : `🤖 ${platform}`;
      mdContent += `## ${roleName}\n\n${turn.content.trim()}\n\n---\n\n`;
    });

    // Nombre de archivo persistente basado en ID único
    const safeTitle = sanitizeFilename(rawTitle);
    const filename = `${dateStr.substring(0, 10)}_${platform}_${safeTitle}_${chatId.substring(0, 8)}.md`;

    return {
      title: rawTitle,
      platform: platform,
      chatId: chatId,
      filename: filename,
      turnCount: turns.length,
      markdown: mdContent,
      url: window.location.href
    };
  }

  // --- OBTENER ID ÚNICO DEL CHAT ---
  function getChatUniqueId() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    if (pathname.includes('/app/')) {
      return pathname.split('/app/')[1] || 'gemini_main';
    } else if (pathname.includes('/c/')) {
      return pathname.split('/c/')[1] || 'chatgpt_main';
    } else if (pathname.includes('/chat/')) {
      return pathname.split('/chat/')[1] || 'claude_main';
    }
    
    // Hash como fallback
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i);
      hash |= 0;
    }
    return 'chat_' + Math.abs(hash).toString(36);
  }

  // --- MOTOR AUTO-SYNC (OBSERVA CAMBIOS Y ESPERA 5 SEG DE REPOSO) ---
  function setupAutoSyncObserver() {
    const observer = new MutationObserver(() => {
      clearTimeout(autoSyncTimer);
      autoSyncTimer = setTimeout(() => {
        triggerAutoSync();
      }, 5000); // 5 segundos de reposo tras la generación
    });

    const target = document.querySelector('main') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  function triggerAutoSync() {
    chrome.storage.local.get(['gemiMdAutoSync', 'gemiMdRestApiKey', 'gemiMdSaveImages', 'gemiMdVaultFolder'], (res) => {
      if (!res.gemiMdAutoSync) return; // Solo actuar si el usuario activó Auto-Sync

      const saveImages = res.gemiMdSaveImages !== false;
      const vaultFolder = res.gemiMdVaultFolder || '5_Conversaciones';

      const convData = extractFullConversation({ saveImages, vaultFolder });
      if (!convData || convData.turnCount === 0) return;

      const currentHash = simpleHash(convData.markdown);
      if (currentHash === lastSyncedHash) return; // Cero escritura redundante si no hay cambios

      lastSyncedHash = currentHash;

      // Enviar nota al background para guardado vía Obsidian REST API
      chrome.runtime.sendMessage({
        action: 'AUTO_SYNC_NOTE',
        data: convData,
        apiKey: res.gemiMdRestApiKey || '',
        vaultFolder: vaultFolder
      }, (response) => {
        if (response && response.success) {
          console.log('[GemiMd Auto-Sync] Nota actualizada en Obsidian:', convData.filename);
        }
      });
    });
  }

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }

  // --- PLATFORM PARSERS ---

  function parseGeminiChat() {
    const turns = [];
    const conversationContainers = document.querySelectorAll('user-query, model-response, .conversation-container > div, .message-content');
    
    if (conversationContainers.length > 0) {
      conversationContainers.forEach(container => {
        const isUser = container.tagName.toLowerCase() === 'user-query' || container.querySelector('.user-query-container') || container.classList.contains('user-query');
        const role = isUser ? 'user' : 'assistant';
        const mdText = domToMarkdown(container);
        if (mdText.trim()) {
          turns.push({ role, content: mdText });
        }
      });
    } else {
      const userQueries = document.querySelectorAll('user-query');
      const modelResponses = document.querySelectorAll('model-response');
      const maxLen = Math.max(userQueries.length, modelResponses.length);

      for (let i = 0; i < maxLen; i++) {
        if (userQueries[i]) turns.push({ role: 'user', content: domToMarkdown(userQueries[i]) });
        if (modelResponses[i]) turns.push({ role: 'assistant', content: domToMarkdown(modelResponses[i]) });
      }
    }
    return turns;
  }

  function parseChatGPTChat() {
    const turns = [];
    const messageNodes = document.querySelectorAll('div[data-message-author-role]');
    messageNodes.forEach(node => {
      const roleAttr = node.getAttribute('data-message-author-role');
      const role = roleAttr === 'user' ? 'user' : 'assistant';
      const mdText = domToMarkdown(node);
      if (mdText.trim()) turns.push({ role, content: mdText });
    });
    return turns;
  }

  function parseClaudeChat() {
    const turns = [];
    const allMessages = document.querySelectorAll('.font-user-message, .font-claude-message, [data-is-streaming] > div');
    if (allMessages.length > 0) {
      allMessages.forEach(node => {
        const isUser = node.classList.contains('font-user-message') || node.querySelector('.font-user-message');
        const role = isUser ? 'user' : 'assistant';
        const mdText = domToMarkdown(node);
        if (mdText.trim()) turns.push({ role, content: mdText });
      });
    }
    return turns;
  }

  function parseDeepSeekChat() {
    const turns = [];
    const items = document.querySelectorAll('.ds-markdown, ._83a1523, .chat-item');
    items.forEach(item => {
      const isUser = item.closest('.user-message-wrapper') || item.classList.contains('user-input');
      const role = isUser ? 'user' : 'assistant';
      const mdText = domToMarkdown(item);
      if (mdText.trim()) turns.push({ role, content: mdText });
    });
    return turns;
  }

  function parseGenericChat() {
    const turns = [];
    const mainContent = document.querySelector('main') || document.body;
    const blocks = mainContent.querySelectorAll('.markdown, .prose, article, section');
    blocks.forEach((block, index) => {
      const text = domToMarkdown(block);
      if (text.trim().length > 10) {
        turns.push({
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: text
        });
      }
    });
    return turns;
  }

  // --- HTML / DOM TO MARKDOWN CONVERTER (CON ESCÁNER HÍBRIDO B+C DE MEDIOS) ---
  function domToMarkdown(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);

    // 1. Eliminar elementos basura
    const trash = clone.querySelectorAll('script, style, button, svg, nav, .copy-code-button, [aria-hidden="true"], .visually-hidden, .sr-only, .message-header, header');
    trash.forEach(el => el.remove());

    // 2. Extraer Imágenes (Formato Híbrido B+C con enlace local y fallback web)
    const images = clone.querySelectorAll('img');
    images.forEach((img, idx) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      // Ignorar iconos pequeños o avatares de la UI
      if (src && !src.includes('avatar') && !src.includes('favicon') && img.width > 50) {
        if (currentOptions.saveImages === false) {
          // Si no se guardan imágenes, usar formato Markdown estándar con URL de internet
          const mdImage = `\n\n![Imagen](${src})\n\n`;
          const placeholder = document.createTextNode(mdImage);
          img.parentNode ? img.parentNode.replaceChild(placeholder, img) : null;
        } else {
          const imgName = `gemimd_img_${Date.now()}_${idx}.png`;
          // Construir ruta relativa al vault
          const folderPath = (currentOptions.vaultFolder || '5_Conversaciones').trim().replace(/^\/+|\/+$/g, '');
          const attachmentPath = folderPath ? `${folderPath}/adjuntos/${imgName}` : `adjuntos/${imgName}`;
          // Híbrido B+C: Enlace local de Obsidian + Atributo de fallback web
          const mdImage = `\n\n![[${attachmentPath}]] <!-- fallback: ${src} -->\n\n`;
          const placeholder = document.createTextNode(mdImage);
          img.parentNode ? img.parentNode.replaceChild(placeholder, img) : null;
        }
      }
    });

    // 3. Extraer Videos / YouTube iFrames
    const iframes = clone.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const src = iframe.getAttribute('src') || '';
      if (src.includes('youtube.com') || src.includes('youtu.be')) {
        const mdIframe = `\n\n<iframe src="${src}" width="100%" height="315" frameborder="0" allowfullscreen></iframe>\n\n`;
        const placeholder = document.createTextNode(mdIframe);
        iframe.parentNode ? iframe.parentNode.replaceChild(placeholder, iframe) : null;
      }
    });

    // 4. Bloques de código (<pre><code>)
    const codeBlocks = clone.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
      const codeEl = pre.querySelector('code');
      const language = extractLanguage(pre) || (codeEl ? extractLanguage(codeEl) : '');
      const codeText = (codeEl || pre).innerText || (codeEl || pre).textContent;
      const mdCodeBlock = `\n\`\`\`${language}\n${codeText.trim()}\n\`\`\`\n`;
      const placeholder = document.createTextNode(mdCodeBlock);
      pre.parentNode ? pre.parentNode.replaceChild(placeholder, pre) : null;
    });

    // 5. Código inline (`<code>`)
    const inlineCodes = clone.querySelectorAll('code');
    inlineCodes.forEach(code => {
      const text = code.textContent;
      const placeholder = document.createTextNode(` \`${text}\` `);
      code.parentNode ? code.parentNode.replaceChild(placeholder, code) : null;
    });

    // 6. Listas (ul/ol)
    const listItems = clone.querySelectorAll('li');
    listItems.forEach(li => {
      const parentTag = li.parentNode ? li.parentNode.tagName.toLowerCase() : 'ul';
      const prefix = parentTag === 'ol' ? '1. ' : '- ';
      li.prepend(document.createTextNode(prefix));
    });

    // 7. Encabezados internos (h1, h2, h3...)
    // Mapear encabezados internos a H4 o H5 para que no agranden el texto en Obsidian
    for (let i = 1; i <= 6; i++) {
      const headers = clone.querySelectorAll(`h${i}`);
      headers.forEach(h => {
        const hashes = '####'; // H4 compacto para subtítulos discretos
        h.prepend(document.createTextNode(`\n${hashes} `));
      });
    }

    // 8. Negritas y cursivas
    const bolds = clone.querySelectorAll('b, strong');
    bolds.forEach(b => {
      b.prepend(document.createTextNode('**'));
      b.append(document.createTextNode('**'));
    });

    const italics = clone.querySelectorAll('i, em');
    italics.forEach(it => {
      it.prepend(document.createTextNode('*'));
      it.append(document.createTextNode('*'));
    });

    let outputText = clone.innerText || clone.textContent || '';
    
    outputText = outputText
      .replace(/^(?:#+\s*)?(?:Gemini|ChatGPT|Claude|DeepSeek)\s*dijo/gi, '')
      .replace(/^(?:#+\s*)?Nota de corrección:/gi, '#### 📝 Nota de corrección:')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return outputText;
  }

  function extractLanguage(el) {
    const classList = Array.from(el.classList || []);
    for (const cls of classList) {
      if (cls.startsWith('language-')) return cls.replace('language-', '');
      if (cls.startsWith('lang-')) return cls.replace('lang-', '');
    }
    return '';
  }

  function cleanTitle(title) {
    return title
      .replace(/ - Google Gemini/i, '')
      .replace(/ - ChatGPT/i, '')
      .replace(/ - Claude/i, '')
      .replace(/ - DeepSeek/i, '')
      .replace(/[\/\?%\*:|"<>]/g, '')
      .trim();
  }

  function sanitizeFilename(name) {
    return name
      .replace(/[\/\?%\*:|"<>]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 40);
  }
})();
