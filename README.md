# GemiMd Exporter & Auto-Sync v1.3.0 🚀

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-7C3AED?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Obsidian Ready](https://img.shields.io/badge/Obsidian-Local%20REST%20API-38BDF8?style=for-the-badge&logo=obsidian&logoColor=white)](https://obsidian.md/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

> **El puente de memoria definitiva entre tus Inteligencias Artificiales y tu Obsidian Zettelkasten.**  
> Convierte, exporta y sincroniza automáticamente tus conversaciones de **Google Gemini, ChatGPT, Claude, DeepSeek, Perplexity y Copilot** en notas Markdown (`.md`) atómicas y estructuradas.

---

## 📌 ¿Qué es GemiMd?

Las conversaciones con modelos de lenguaje no deben ser efímeras. **GemiMd** es una extensión moderna para Google Chrome y navegadores Chromium que captura tus diálogos con IAs, extrae las imágenes/videos generados, construye metadatos en **YAML Frontmatter** y guarda la nota directamente en tu bóveda de Obsidian en segundo plano sin interrumpir tu flujo de trabajo.

---

## 🤖 Plataformas Soportadas

| Plataforma | Soporte de Extracción | Auto-Sync Vivo | Captura de Medios (B+C) |
|---|---|---|---|
| **Google Gemini** (`gemini.google.com`) | ✅ 100% | ✅ Activo | ✅ Imágenes & Canvas |
| **ChatGPT** (`chatgpt.com`) | ✅ 100% | ✅ Activo | ✅ DALL-E & Código |
| **Claude** (`claude.ai`) | ✅ 100% | ✅ Activo | ✅ Artifacts & Texto |
| **DeepSeek** (`chat.deepseek.com`) | ✅ 100% | ✅ Activo | ✅ Markdown & LaTeX |
| **Perplexity AI** (`perplexity.ai`) | ✅ 100% | ✅ Activo | ✅ Citas & Fuentes |
| **Microsoft Copilot** (`copilot.microsoft.com`) | ✅ 100% | ✅ Activo | ✅ Respuestas |

---

## ✨ Superpoderes & Características Principales

### ⚡ 1. Auto-Sync Vivo & Silencioso
Observa el DOM en tiempo real mientras chateas. Cuando la IA finaliza su respuesta y transcurren 5 segundos de reposo, **GemiMd** envía la nota a tu Obsidian vía **Local REST API** sin abrir pestañas extra ni duplicar archivos.

### 🧠 2. ID Único Anti-Duplicados
Asigna un identificador único basado en la URL de cada chat (`chat_id`). Si revisas o continúas una conversación de hace semanas, **GemiMd** actualiza esa misma nota limpiamente en lugar de generar notas duplicadas.

### 🖼️ 3. Escáner Híbrido de Medios B+C
Extrae automáticamente imágenes generadas (DALL-E, Imagen 3) y videos de YouTube. Construye la referencia local de Obsidian:
```markdown
![[adjuntos/gemimd_img_1785250.png]] <!-- fallback: https://lh3.googleusercontent.com/... -->
```
*Si borras la carpeta de adjuntos para liberar disco, el comentario de fallback web garantiza que la nota nunca se rompa.*

### 🎨 4. Simetría Tipográfica (H4 Mapping)
Mapea los encabezados internos gigantes generados por la IA a subtítulos discretos `#### H4`. De esta forma, las respuestas de la IA mantienen una jerarquía visual armónica con la tipografía de tus preguntas.

### 🏷️ 5. YAML Frontmatter Configurable
Genera cabeceras estandarizadas compatibles con **Dataview** y plugins de Obsidian:
```yaml
---
title: "Arquitectura de Software con Microservicios"
date: "2026-08-17 15:45:00"
source: "https://gemini.google.com/app/e7ea43b6732218a8"
platform: "Gemini"
chat_id: "e7ea43b6732218a8"
tags:
  - zettelkasten
  - ai-memory
  - gemimd
---
```

---

## 📥 Guía de Instalación Paso a Paso

### Opción A: Modo Desarrollador (Carga Local / GitHub)

1. **Clona o descarga este repositorio**:
   ```bash
   git clone https://github.com/Nelxson2099/gemimd.git
   ```
2. **Abre la sección de Extensiones en Chrome**:
   Navega a `chrome://extensions/` en la barra de direcciones (funciona también en Brave, Edge y Opera).
3. **Activa el Modo de Desarrollador**:
   Enciende el interruptor **Modo de desarrollador** (*Developer mode*) ubicado en la esquina superior derecha.
4. **Cargar la Extensión**:
   Haz clic en el botón **Cargar descomprimida** (*Load unpacked*) y selecciona la carpeta raíz del proyecto `GEMIMD`.
5. **Fijar el Icono**:
   Haz clic en el icono de rompecabezas 🧩 en la barra del navegador y presiona el pin 📌 junto a **GemiMd Exporter**.

---

## ⚙️ Configuración de Obsidian Local REST API (Paso a Paso)

Para activar la sincronización automática sin clics hacia Obsidian, sigue esta guía rápida:

1. **Instalar el Plugin en Obsidian**:
   * Abre Obsidian ➔ **Ajustes** ⚙️ ➔ **Plugins de la comunidad** (*Community plugins*).
   * Desactiva el modo restringido (*Restricted mode*) si está activo.
   * Busca e instala **Local REST API** por *codelayers*.
   * Haz clic en **Habilitar** (*Enable*).

2. **Obtener tu API Key / Bearer Token**:
   * En la configuración del plugin **Local REST API**, asegúrate de que el **Servidor HTTP** esté activo (Puerto predeterminado: `27123`).
   * Copia la **API Key / Bearer Token** generada automáticamente.

3. **Conectar GemiMd**:
   * Abre el popup de **GemiMd** desde la barra de tu navegador.
   * Activa el interruptor **⚡ Auto-Sync Vivo**.
   * Pega la API Key en el campo de texto.
   * Especifica tu carpeta destino (ejemplo: `5_Conversaciones`).

---

## ⚡ Los 4 Modos de Exportación

| Modo | Acción en la UI | Descripción |
|---|---|---|
| **⚡ Sincronizar en Vault** | Botón Principal Cyan | Envía la nota inmediatamente a la carpeta configurada en Obsidian vía REST API. |
| **💾 Descargar .MD** | Botón Descargar | Guarda la nota en formato `.md` directamente en tu carpeta de Descargas de Windows/OS. |
| **📋 Copiar MD** | Botón Copiar | Copia el contenido formateado completo con YAML Frontmatter al portapapeles. |
| **🔮 Abrir en Obsidian** | Botón Obsidian URI | Invoca el protocolo nativo `obsidian://new` para abrir la nota en Obsidian de inmediato. |

---

## 🏗️ Estructura del Proyecto (Manifest V3)

```text
GEMIMD/
├── manifest.json                  # Manifest V3 (Permisos, Host Permissions, Icons)
├── background.js                  # Service Worker (Rest API Fetch & Image Handler)
├── content.js                     # Content Script (DOM Parsers para Gemini/ChatGPT/Claude)
├── popup.html                     # Interfaz emergente Glassmorphic
├── popup.css                      # Estilos con CSS Vanilla, Gradiantes y Neón
├── popup.js                       # Lógica interactiva y almacenamiento local
├── landing_presentacion.html      # Landing Page de presentación de la extensión
├── manual_usuario.html            # Manual de usuario interactivo embebido
├── guia_desarrollo_extensiones.html # Guía técnica de desarrollo Manifest V3
└── assets/                        # Iconos redimensionados (16x16, 32x32, 48x48, 128x128, Logo)
```

---

## 🔒 Privacidad & Seguridad Garantizada

* **100% Local & Privado**: Toda la comunicación se realiza exclusivamente entre tu navegador y tu instancia local de Obsidian (`http://127.0.0.1:27123`).
* **Sin Servidores Intermedios**: GemiMd NO posee servidores externos, ni rastreadores, ni analítica de terceros.
* **Código Abierto**: Auditables 100% de los scripts en `content.js` y `background.js`.

---

## 📄 Licencia & Créditos

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.

Desarrollado con ❤️ por **[Nelxson2099](https://github.com/Nelxson2099)** & **Antigravity AI**.  
*Dedicado a la comunidad de Obsidian, Zettelkasten y los apasionados por la IA.*
