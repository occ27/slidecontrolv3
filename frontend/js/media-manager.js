/**
 * SLIDECONTROL V3 — MEDIA MANAGER
 * Gerenciador de Planos de Fundo (Presets, Nuvem, Uploads e QR Code Móvel)
 */

const MEDIA_API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:8767" : "";

class MediaManager {
  constructor() {
    this.currentBgTarget = "telao"; // "telao" ou "retorno"
    this.activeTab = "bg-color";
    this.currentCustomPath = "";
    this.selectedCustomItems = new Set();
    this.isSelectionMode = false;
    this.clipboardItems = null;
    this.qrStatusInterval = null;
    this.qrMediaToken = "";
    this.qrCodeObj = null;

    this.currentBgTarget = "telao"; // "telao" | "retorno"
    this.currentBgContext = "general"; // "general" | "bible"
    this.cloudMediaType = "video";
    this.cloudCurrentCategory = "Geral";

    this.channel = new BroadcastChannel("slidecontrol_orbital_v3");

    this.init();
  }

  init() {
    this.setupTargets();
    this.setupTabs();
    this.setupColorPalette();
    this.setupCloudModal();
    this.setupUploadsControls();

    // Carrega categorias iniciais
    this.loadLocalCategories("image");
    this.loadLocalCategories("video");
    this.loadLocalBackgrounds("image", "Todas");
    this.loadLocalBackgrounds("video", "Todas");

    // Modal open / close buttons
    const btnOpen = document.getElementById("btn-open-bg-modal");
    const modalBg = document.getElementById("bg-picker-modal");
    const btnClose = document.getElementById("btn-close-bg-modal");

    if (btnOpen && modalBg) {
      btnOpen.addEventListener("click", () => {
        this.refreshUI();
        modalBg.classList.remove("hidden");
      });
    }

    if (btnClose && modalBg) {
      btnClose.addEventListener("click", () => modalBg.classList.add("hidden"));
    }

    if (modalBg) {
      modalBg.addEventListener("click", (e) => {
        if (e.target === modalBg) modalBg.classList.add("hidden");
      });
    }

    // Restaura última aba usada
    if (window.electronAPI && typeof window.electronAPI.getPref === "function") {
      const savedTab = window.electronAPI.getPref("activeBgTab");
      if (savedTab) {
        this.switchTab(savedTab);
      }
    }
  }

  setupTargets() {
    document.querySelectorAll(".bg-target-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        this.currentBgTarget = tab.dataset.target || "telao";
        document.querySelectorAll(".bg-target-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.refreshUI();
      });
    });
  }

  getCurrentContext() {
    if (window.orbitalEngine && typeof window.orbitalEngine.activeRow === "number") {
      return window.orbitalEngine.activeRow === 0 ? "bible" : "general";
    }
    const currentTheme = window.projectionSync?.currentState?.currentSlide?.theme;
    if (currentTheme === "bible") return "bible";
    return "general";
  }

  updateTrackBadge() {
    const pill = document.getElementById("bg-modal-track-pill");
    if (!pill) return;
    const isBible = this.currentBgContext === "bible";
    if (isBible) {
      pill.textContent = "📖 Trilha: Bíblia";
      pill.style.background = "rgba(168, 85, 247, 0.2)";
      pill.style.border = "1px solid rgba(168, 85, 247, 0.45)";
      pill.style.color = "#c084fc";
    } else {
      pill.textContent = "🌐 Trilha: Louvor & Culto";
      pill.style.background = "rgba(0, 240, 255, 0.15)";
      pill.style.border = "1px solid rgba(0, 240, 255, 0.35)";
      pill.style.color = "#00f0ff";
    }
  }

  setupTabs() {
    document.querySelectorAll(".bg-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tabName = btn.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll(".bg-tab-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tabName);
    });
    document.querySelectorAll(".bg-tab-pane").forEach(p => {
      p.classList.toggle("active", p.id === tabName);
    });

    if (window.electronAPI && typeof window.electronAPI.setPref === "function") {
      window.electronAPI.setPref("activeBgTab", tabName);
    }

    if (tabName === "bg-local") {
      this.loadCustomBackgrounds();
    }
  }

  setupColorPalette() {
    const predefinedColors = [
      "#000000", "#0a0a0a", "#141414", "#1e1e1e", "#2a2a2a",
      "#0f172a", "#1e1b4b", "#312e81", "#4c1d95", "#581c87",
      "#064e3b", "#065f46", "#15803d", "#166534", "#14532d",
      "#450a0a", "#7f1d1d", "#991b1b", "#b91c1c", "#c2410c",
      "#1e3a8a", "#1d4ed8", "#2563eb", "#0284c7", "#00F0FF"
    ];

    const grid = document.getElementById("bg-color-grid");
    if (!grid) return;
    grid.innerHTML = "";

    predefinedColors.forEach(color => {
      const el = document.createElement("div");
      el.className = "bg-item color-item";
      el.style.backgroundColor = color;
      el.dataset.color = color;
      el.title = color;

      el.addEventListener("click", () => {
        this.applyBackground("color", color);
      });

      grid.appendChild(el);
    });
  }

  async loadLocalCategories(mediaType) {
    try {
      const res = await fetch(`${MEDIA_API_BASE}/api/backgrounds/presets/categories?media_type=${mediaType}`);
      if (!res.ok) return;
      const cats = await res.json();
      const selectId = mediaType === "image" ? "local-image-category-select" : "local-video-category-select";
      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML = "";
        cats.forEach(c => {
          const opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          select.appendChild(opt);
        });
        select.onchange = (e) => this.loadLocalBackgrounds(mediaType, e.target.value);
      }
    } catch (e) {
      console.error("Erro ao carregar categorias locais:", e);
    }
  }


  async deletePreset(url, mediaType) {
    if (!confirm("Tem certeza que deseja excluir esta mídia do seu computador?")) return;
    const filename = decodeURIComponent(url.split("/").pop());
    try {
      const res = await fetch(`${MEDIA_API_BASE}/api/backgrounds/presets/${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (res.ok) {
        const selectId = mediaType === "image" ? "local-image-category-select" : "local-video-category-select";
        const selectEl = document.getElementById(selectId);
        this.loadLocalBackgrounds(mediaType || "image", selectEl ? selectEl.value : "Todas");
      }
    } catch (e) {
      console.error("Erro ao excluir", e);
    }
  }

  async loadLocalBackgrounds(mediaType, category = "Todas") {
    const gridId = mediaType === "image" ? "bg-image-grid" : "bg-video-grid";
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = "";

    try {
      const res = await fetch(`${MEDIA_API_BASE}/api/backgrounds/presets?media_type=${mediaType}&category=${encodeURIComponent(category)}&limit=120`);
      if (!res.ok) return;
      const data = await res.json();

      if (!data.items || data.items.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;color:var(--text-muted);text-align:center;padding:30px;font-size:13px;">Nenhuma mídia encontrada nesta categoria. Clique em "Buscar mais no Servidor" para baixar novos fundos da Nuvem.</div>';
        return;
      }

      data.items.forEach(item => {
        const el = document.createElement("div");
        el.className = "bg-item media-item";
        el.title = item.title;
        el.dataset.url = item.url;
        el.dataset.kind = mediaType;

        if (mediaType === "image") {
          const img = document.createElement("img");
          img.src = item.url;
          img.loading = "lazy";
          img.style.cssText = "width:100%;height:100%;object-fit:cover;";
          el.appendChild(img);

          const btnLogo = document.createElement("button");
          btnLogo.className = "set-logo-btn";
          btnLogo.title = "Definir como Logo Oficial";
          btnLogo.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path stroke-linecap="round" stroke-linejoin="round" d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" /></svg>`;
          btnLogo.addEventListener("click", (e) => {
            e.stopPropagation();
            if (window.projectionSync) window.projectionSync.setOfficialLogo(item.url);
            document.querySelectorAll(".set-logo-btn").forEach(b => b.classList.remove("selected"));
            btnLogo.classList.add("selected");
          });
          el.appendChild(btnLogo);

          const btnDel = document.createElement("button");
          btnDel.className = "delete-preset-btn";
          btnDel.title = "Excluir mídia";
          btnDel.innerHTML = `🗑️`;
          btnDel.addEventListener("click", (e) => { e.stopPropagation(); this.deletePreset(item.url, mediaType); });
          el.appendChild(btnDel);

          el.addEventListener("click", () => this.applyBackground("image", item.url));
        } else {
          // Thumbnail do vídeo
          const img = document.createElement("img");
          img.src = `${MEDIA_API_BASE}/api/backgrounds/presets/thumbnail/${encodeURIComponent(item.name)}`;
          img.loading = "lazy";
          img.style.cssText = "width:100%;height:100%;object-fit:cover;position:absolute;inset:0;transition:opacity 0.2s;";
          img.onerror = () => { img.style.display = "none"; };
          el.appendChild(img);

          // Ícone de play
          const playIcon = document.createElement("div");
          playIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:28px;height:28px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.8));"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)"/><polygon points="10,8 17,12 10,16" fill="white"/></svg>`;
          playIcon.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;transition:opacity 0.2s;";
          el.appendChild(playIcon);

          // Video hover preview
          const vid = document.createElement("video");
          vid.muted = true;
          vid.loop = true;
          vid.preload = "none";
          vid.style.cssText = "width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0;transition:opacity 0.25s;";
          el.appendChild(vid);

          el.addEventListener("mouseenter", () => {
            vid.src = item.url;
            vid.load();
            vid.play().catch(() => {});
            vid.style.opacity = "1";
            img.style.opacity = "0";
            playIcon.style.opacity = "0";
          });

          el.addEventListener("mouseleave", () => {
            vid.pause();
            vid.style.opacity = "0";
            img.style.opacity = "1";
            playIcon.style.opacity = "1";
          });

          const btnDel = document.createElement("button");
          btnDel.className = "delete-preset-btn";
          btnDel.title = "Excluir mídia";
          btnDel.innerHTML = `🗑️`;
          btnDel.addEventListener("click", (e) => { e.stopPropagation(); this.deletePreset(item.url, mediaType); });
          el.appendChild(btnDel);

          el.addEventListener("click", () => this.applyBackground("video", item.url));
        }

        grid.appendChild(el);
      });

      this.highlightActiveSelection();
    } catch (e) {
      console.error("Erro ao carregar presets:", e);
    }
  }

  setupCloudModal() {
    const cloudModal = document.getElementById("cloud-media-modal");
    const btnClose = document.getElementById("btn-close-cloud-modal");

    if (btnClose && cloudModal) {
      btnClose.addEventListener("click", () => cloudModal.classList.add("hidden"));
    }
    if (cloudModal) {
      cloudModal.addEventListener("click", (e) => {
        if (e.target === cloudModal) cloudModal.classList.add("hidden");
      });
    }

    document.querySelectorAll(".btn-search-cloud").forEach(btn => {
      btn.addEventListener("click", () => {
        this.cloudMediaType = btn.dataset.type || "video";
        this.cloudCurrentCategory = "Geral";
        if (cloudModal) cloudModal.classList.remove("hidden");

        const badge = document.getElementById("cloud-media-type-badge");
        if (badge) badge.textContent = this.cloudMediaType === "image" ? "Imagens" : "Vídeos";

        this.loadCloudCategories();
      });
    });
  }

  async loadCloudCategories() {
    const list = document.getElementById("cloud-categories-list");
    if (!list) return;
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">Carregando...</div>';

    try {
      const res = await fetch(`${MEDIA_API_BASE}/api/backgrounds/cloud/categories?media_type=${this.cloudMediaType}`);
      if (!res.ok) throw new Error("Falha ao buscar categorias da nuvem");
      const cats = await res.json();

      list.innerHTML = "";
      if (cats.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px;">Nenhuma categoria encontrada</div>';
        return;
      }

      if (!cats.includes(this.cloudCurrentCategory)) {
        this.cloudCurrentCategory = cats[0];
      }

      cats.forEach(c => {
        const el = document.createElement("div");
        el.className = "cloud-category-item" + (c === this.cloudCurrentCategory ? " active" : "");
        el.textContent = c;
        el.addEventListener("click", () => {
          this.cloudCurrentCategory = c;
          document.querySelectorAll(".cloud-category-item").forEach(i => i.classList.remove("active"));
          el.classList.add("active");
          this.loadCloudMedia();
        });
        list.appendChild(el);
      });

      this.loadCloudMedia();
    } catch (e) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:12px;">Erro ao carregar categorias da nuvem</div>';
    }
  }

  async loadCloudMedia() {
    const grid = document.getElementById("cloud-media-grid");
    const emptyState = document.getElementById("cloud-empty-state");
    const loadingSpinner = document.getElementById("cloud-loading-spinner");
    const title = document.getElementById("cloud-current-category-title");

    if (title) title.textContent = `Categoria: ${this.cloudCurrentCategory}`;
    if (!grid) return;

    grid.innerHTML = "";
    if (emptyState) emptyState.classList.add("hidden");
    if (loadingSpinner) loadingSpinner.classList.remove("hidden");

    try {
      const res = await fetch(`${MEDIA_API_BASE}/api/backgrounds/cloud/category/${encodeURIComponent(this.cloudCurrentCategory)}?media_type=${this.cloudMediaType}`);
      if (loadingSpinner) loadingSpinner.classList.add("hidden");
      if (!res.ok) throw new Error();
      const items = await res.json();

      if (items.length === 0) {
        if (emptyState) emptyState.classList.remove("hidden");
        return;
      }

      items.forEach(item => {
        const el = document.createElement("div");
        el.className = "bg-item needs-download";
        el.style.position = "relative";

        const thumbUrl = item.thumbnail || item.url;
        if (this.cloudMediaType === "image") {
          el.style.backgroundImage = `url("${thumbUrl}")`;
          el.style.backgroundSize = "cover";
          el.style.backgroundPosition = "center";
        } else {
          const img = document.createElement("img");
          img.src = thumbUrl;
          img.style.cssText = "width:100%;height:100%;object-fit:cover;position:absolute;inset:0;";
          img.onerror = () => { img.style.display = "none"; };
          el.appendChild(img);
        }

        // Overlay de download
        const dlOverlay = document.createElement("div");
        dlOverlay.className = "bg-item-download";
        dlOverlay.innerHTML = `
          <div class="bg-item-download-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span style="font-size:11px; font-weight:600; margin-top:4px;">Baixar</span>
          </div>
        `;

        el.appendChild(dlOverlay);

        el.addEventListener("click", async () => {
          dlOverlay.innerHTML = '<div class="bg-item-spinner" style="width:24px;height:24px;border:3px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>';
          try {
            const dlRes = await fetch(`${MEDIA_API_BASE}/api/backgrounds/presets/download`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: item.name,
                url: item.url,
                category: this.cloudCurrentCategory
              })
            });
            if (dlRes.ok) {
              dlOverlay.innerHTML = '<span style="color:#10b981;font-size:11px;font-weight:700;">✓ Baixado</span>';
              setTimeout(() => {
                this.loadLocalCategories(this.cloudMediaType);
                this.loadLocalBackgrounds(this.cloudMediaType, this.cloudCurrentCategory);
              }, 600);
            } else {
              dlOverlay.innerHTML = '<span style="color:#ef4444;font-size:11px;">Erro</span>';
            }
          } catch (err) {
            dlOverlay.innerHTML = '<span style="color:#ef4444;font-size:11px;">Erro</span>';
          }
        });

        grid.appendChild(el);
      });
    } catch (e) {
      if (loadingSpinner) loadingSpinner.classList.add("hidden");
      if (emptyState) emptyState.classList.remove("hidden");
    }
  }

  setupUploadsControls() {
    this.osInfo = { os: "mac", fileManager: "Finder" };
    this.detectSystemInfo();

    const inputUpload = document.getElementById("bg-upload-input");
    if (inputUpload) {
      inputUpload.addEventListener("change", async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const formData = new FormData();
          formData.append("file", file);
          formData.append("path", this.currentCustomPath || "");

          try {
            await fetch(`${MEDIA_API_BASE}/api/media/upload`, {
              method: "POST",
              body: formData
            });
          } catch (err) {
            console.error("Erro no upload do arquivo:", file.name, err);
          }
        }
        inputUpload.value = "";
        this.loadCustomBackgrounds();
      });
    }

    const searchInput = document.getElementById("bg-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", () => this.loadCustomBackgrounds());
    }

    this.setupDragAndDrop();
    this.setupWindowFocusSync();
  }

  async detectSystemInfo() {
    try {
      const res = await fetch(`${MEDIA_API_BASE}/api/media/custom/system-info`);
      if (res.ok) {
        const data = await res.json();
        this.osInfo = {
          os: data.os || "mac",
          fileManager: data.file_manager || "Finder"
        };
        this.updateOSButtonLabels();
      }
    } catch (e) {
      const isMac = navigator.platform?.toUpperCase().indexOf("MAC") >= 0 || navigator.userAgent.indexOf("Mac") >= 0;
      this.osInfo = {
        os: isMac ? "mac" : "win",
        fileManager: isMac ? "Finder" : "Explorador de Arquivos"
      };
      this.updateOSButtonLabels();
    }
  }

  updateOSButtonLabels() {
    const label = document.getElementById("label-open-folder-os");
    const tipName = document.getElementById("custom-os-name-tip");
    const fmName = this.osInfo?.fileManager || "Finder";

    if (tipName) tipName.textContent = fmName;
    if (label) {
      if (this.currentCustomPath) {
        const folderName = this.currentCustomPath.split("/").filter(Boolean).pop() || "";
        label.textContent = `📂 Abrir "${folderName}" no ${fmName}`;
      } else {
        label.textContent = `📂 Abrir no ${fmName}`;
      }
    }
  }

  setupDragAndDrop() {
    const dropZone = document.getElementById("bg-local");
    const overlay = document.getElementById("bg-custom-drop-overlay");
    if (!dropZone) return;

    let dragCounter = 0;

    dropZone.addEventListener("dragenter", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (overlay) {
        overlay.classList.remove("hidden");
        overlay.classList.add("active");
      }
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (overlay) {
        overlay.classList.remove("hidden");
        overlay.classList.add("active");
      }
    });

    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (overlay) {
          overlay.classList.add("hidden");
          overlay.classList.remove("active");
        }
      }
    });

    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      if (overlay) {
        overlay.classList.add("hidden");
        overlay.classList.remove("active");
      }

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", this.currentCustomPath || "");

        try {
          await fetch(`${MEDIA_API_BASE}/api/media/upload`, {
            method: "POST",
            body: formData
          });
        } catch (err) {
          console.error("Erro no upload do arquivo arrastado:", file.name, err);
        }
      }
      this.loadCustomBackgrounds();
    });
  }

  setupWindowFocusSync() {
    window.addEventListener("focus", () => {
      const modal = document.getElementById("bg-picker-modal");
      const pane = document.getElementById("bg-local");
      if (modal && !modal.classList.contains("hidden") && pane && pane.classList.contains("active")) {
        this.loadCustomBackgrounds();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const modal = document.getElementById("bg-picker-modal");
        const pane = document.getElementById("bg-local");
        if (modal && !modal.classList.contains("hidden") && pane && pane.classList.contains("active")) {
          this.loadCustomBackgrounds();
        }
      }
    });
  }

  async openCustomFolderInOS(subPath = null) {
    const target = subPath !== null ? subPath : (this.currentCustomPath || "");

    if (window.electronAPI && typeof window.electronAPI.openUploadsFolder === "function") {
      try {
        const res = await window.electronAPI.openUploadsFolder(target);
        if (res?.success) return;
      } catch (err) {
        console.warn("Electron openUploadsFolder falhou, usando fallback FastAPI:", err);
      }
    }

    try {
      const fd = new FormData();
      fd.append("path", target);
      await fetch(`${MEDIA_API_BASE}/api/media/custom/open-folder`, {
        method: "POST",
        body: fd
      });
    } catch (e) {
      console.error("Erro ao abrir pasta no SO:", e);
    }
  }

  async revealCustomItemInOS(subPath) {
    if (!subPath) return;

    if (window.electronAPI && typeof window.electronAPI.revealItemInFolder === "function") {
      try {
        const res = await window.electronAPI.revealItemInFolder(subPath);
        if (res?.success) return;
      } catch (err) {
        console.warn("Electron revealItemInFolder falhou, usando fallback FastAPI:", err);
      }
    }

    try {
      const fd = new FormData();
      fd.append("path", subPath);
      await fetch(`${MEDIA_API_BASE}/api/media/custom/reveal-item`, {
        method: "POST",
        body: fd
      });
    } catch (e) {
      console.error("Erro ao revelar item no SO:", e);
    }
  }

  async deleteCustomItem(subPath, name) {
    const itemName = name || subPath.split("/").filter(Boolean).pop() || subPath;
    if (!confirm(`Deseja realmente excluir "${itemName}"?`)) return;

    if (window.electronAPI && typeof window.electronAPI.trashItem === "function") {
      try {
        const res = await window.electronAPI.trashItem(subPath);
        if (res?.success) {
          this.loadCustomBackgrounds();
          return;
        }
      } catch (err) {
        console.warn("Electron trashItem falhou, usando API delete:", err);
      }
    }

    try {
      const res = await fetch(`${MEDIA_API_BASE}/api/media/custom/item?path=${encodeURIComponent(subPath)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        this.loadCustomBackgrounds();
      } else {
        alert("Erro ao excluir item.");
      }
    } catch (e) {
      console.error("Erro ao excluir item:", e);
      alert("Erro ao excluir item.");
    }
  }

  async loadCustomBackgrounds() {
    const customGrid = document.getElementById("bg-custom-grid");
    const breadcrumbsEl = document.getElementById("custom-breadcrumbs");
    const statsEl = document.getElementById("custom-folder-stats");
    if (!customGrid) return;

    this.updateOSButtonLabels();

    if (breadcrumbsEl) {
      let breadcrumbHTML = `<button class="icon-btn" title="Ir para início (Raiz)" onclick="window.mediaManager.navigateToCustomFolder('')" style="cursor:pointer; background:none; border:none; padding:4px 6px; color:var(--text-main); display:inline-flex; align-items:center; gap:4px; font-weight:600; border-radius:4px;">
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
        <span>Raiz</span>
      </button>`;

      if (this.currentCustomPath) {
        const parts = this.currentCustomPath.split("/").filter(Boolean);
        let accumPath = "";
        parts.forEach((part, index) => {
          accumPath += (accumPath ? "/" : "") + part;
          const currentAccum = accumPath;
          const isLast = index === parts.length - 1;
          breadcrumbHTML += `<span style="color:var(--text-muted); padding:0 2px;">/</span> <button class="icon-btn" onclick="window.mediaManager.navigateToCustomFolder('${currentAccum}')" style="cursor:pointer; background:${isLast ? "rgba(0,240,255,0.12)" : "none"}; border:none; padding:3px 6px; font-size:12px; font-weight:${isLast ? "700" : "500"}; color:${isLast ? "var(--accent)" : "var(--text-main)"}; border-radius:4px;">${part}</button>`;
        });
      }
      breadcrumbsEl.innerHTML = breadcrumbHTML;
    }

    const qInput = document.getElementById("bg-search-input");
    const q = qInput ? qInput.value.trim() : "";
    let url = `${MEDIA_API_BASE}/api/media/custom?path=${encodeURIComponent(this.currentCustomPath || "")}`;
    if (q) {
      url = `${MEDIA_API_BASE}/api/media/custom?query=${encodeURIComponent(q)}`;
    }

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const items = await res.json();

      customGrid.innerHTML = "";

      if (statsEl) {
        const count = items.length;
        statsEl.textContent = `${count} ${count === 1 ? "item" : "itens"}`;
      }

      // Se estiver em subpasta e sem busca, adiciona card "Voltar" (..)
      if (this.currentCustomPath && !q) {
        const backCard = document.createElement("div");
        backCard.className = "bg-item custom-folder-card";
        backCard.title = "Voltar para pasta anterior";
        backCard.innerHTML = `
          <svg style="width:34px; height:34px; color:var(--accent); margin-bottom:4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
          <span style="font-size:12px; font-weight:700; color:var(--text-main);">.. (Voltar)</span>
        `;
        const parentParts = this.currentCustomPath.split("/").filter(Boolean).slice(0, -1);
        const parentPath = parentParts.join("/");
        backCard.addEventListener("click", () => this.navigateToCustomFolder(parentPath));
        customGrid.appendChild(backCard);
      }

      if (items.length === 0 && !this.currentCustomPath) {
        customGrid.innerHTML = `
          <div style="grid-column: 1/-1; color: var(--text-muted); text-align: center; padding: 35px 20px; font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <svg style="width:48px; height:48px; color:rgba(255,255,255,0.2);" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
            <div>Nenhum arquivo ou pasta encontrado.</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.5);">Clique em <b>"Abrir no Finder"</b> para adicionar pastas e vídeos diretamente pelo seu computador, ou arraste arquivos para esta tela.</div>
          </div>
        `;
        return;
      }

      const fmLabel = this.osInfo?.fileManager || "Finder";

      items.forEach(item => {
        const el = document.createElement("div");
        el.className = "bg-item media-item";
        const targetPath = item.path || (this.currentCustomPath ? `${this.currentCustomPath}/${item.name}` : item.name);
        el.dataset.path = targetPath;
        el.dataset.isdir = item.is_dir ? "true" : "false";

        // Ações contextuais rápidas no hover (Abrir/Revelar no SO + Excluir)
        const actionsEl = document.createElement("div");
        actionsEl.className = "custom-item-actions";

        if (item.is_dir) {
          el.classList.add("custom-folder-card");
          el.innerHTML = `
            <svg style="width:44px; height:44px; color:var(--accent); margin-bottom:6px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
            </svg>
            <span style="font-size:12px; font-weight:600; color:var(--text-main); width:85%; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</span>
          `;

          // Botão abrir no SO
          const btnReveal = document.createElement("button");
          btnReveal.className = "custom-item-btn";
          btnReveal.title = `Abrir pasta "${item.name}" no ${fmLabel}`;
          btnReveal.innerHTML = `📂`;
          btnReveal.addEventListener("click", (e) => {
            e.stopPropagation();
            this.openCustomFolderInOS(targetPath);
          });
          actionsEl.appendChild(btnReveal);

          // Botão excluir pasta
          const btnDel = document.createElement("button");
          btnDel.className = "custom-item-btn btn-delete";
          btnDel.title = `Excluir pasta "${item.name}"`;
          btnDel.innerHTML = `🗑️`;
          btnDel.addEventListener("click", (e) => {
            e.stopPropagation();
            this.deleteCustomItem(targetPath, item.name);
          });
          actionsEl.appendChild(btnDel);

          el.appendChild(actionsEl);
          el.addEventListener("click", () => this.navigateToCustomFolder(targetPath));
        } else {
          const ext = item.name.split(".").pop().toLowerCase();
          const isVideo = ["mp4", "webm", "mov", "mkv", "avi"].includes(ext);

          if (isVideo) {
            const img = document.createElement("img");
            img.src = `${MEDIA_API_BASE}/api/media/custom/thumbnail/${encodeURIComponent(targetPath)}`;
            img.style.cssText = "width:100%;height:100%;object-fit:cover;position:absolute;inset:0;";
            img.onerror = () => { img.style.display = "none"; };
            el.appendChild(img);

            const playIcon = document.createElement("div");
            playIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:28px;height:28px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.8));"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)"/><polygon points="10,8 17,12 10,16" fill="white"/></svg>`;
            playIcon.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;";
            el.appendChild(playIcon);

            el.addEventListener("click", () => this.applyBackground("video", item.url));
          } else {
            const img = document.createElement("img");
            img.src = item.url;
            img.style.cssText = "width:100%;height:100%;object-fit:cover;";
            el.appendChild(img);

            const btnLogo = document.createElement("button");
            btnLogo.className = "set-logo-btn";
            btnLogo.title = "Definir como Logo Oficial";
            btnLogo.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path stroke-linecap="round" stroke-linejoin="round" d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" /></svg>`;
            btnLogo.addEventListener("click", (e) => {
              e.stopPropagation();
              if (window.projectionSync) window.projectionSync.setOfficialLogo(item.url);
              document.querySelectorAll(".set-logo-btn").forEach(b => b.classList.remove("selected"));
              btnLogo.classList.add("selected");
            });
            el.appendChild(btnLogo);

            el.addEventListener("click", () => this.applyBackground("image", item.url));
          }

          // Nome do arquivo
          const labelEl = document.createElement("div");
          labelEl.className = "custom-item-label";
          labelEl.textContent = item.name;
          labelEl.title = item.name;
          el.appendChild(labelEl);

          // Botão revelar no SO
          const btnReveal = document.createElement("button");
          btnReveal.className = "custom-item-btn";
          btnReveal.title = `Revelar "${item.name}" no ${fmLabel}`;
          btnReveal.innerHTML = `👁️`;
          btnReveal.addEventListener("click", (e) => {
            e.stopPropagation();
            this.revealCustomItemInOS(targetPath);
          });
          actionsEl.appendChild(btnReveal);

          // Botão excluir arquivo
          const btnDel = document.createElement("button");
          btnDel.className = "custom-item-btn btn-delete";
          btnDel.title = `Excluir "${item.name}"`;
          btnDel.innerHTML = `🗑️`;
          btnDel.addEventListener("click", (e) => {
            e.stopPropagation();
            this.deleteCustomItem(targetPath, item.name);
          });
          actionsEl.appendChild(btnDel);

          el.appendChild(actionsEl);
        }

        customGrid.appendChild(el);
      });

      this.highlightActiveSelection();
    } catch (e) {
      console.error("Erro ao carregar uploads:", e);
    }
  }

  navigateToCustomFolder(path) {
    this.currentCustomPath = path;
    this.loadCustomBackgrounds();
  }

  async createNewCustomFolder() {
    const name = prompt("Nome da nova pasta:");
    if (!name || !name.trim()) return;

    const formData = new FormData();
    formData.append("path", this.currentCustomPath || "");
    formData.append("folder_name", name.trim());

    try {
      const res = await fetch(`${MEDIA_API_BASE}/api/media/custom/folder`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        this.loadCustomBackgrounds();
      }
    } catch (err) {
      alert("Erro ao criar pasta.");
    }
  }

  async openQRMediaModal() {
    const modal = document.getElementById("modal-qr-media-upload");
    const qrContainer = document.getElementById("qrcode-media-container");
    const status = document.getElementById("qr-media-status-text");
    if (!modal || !qrContainer) return;

    try {
      if (typeof QRCode === "undefined") throw new Error("Biblioteca QRCode indisponível");

      const ipResponse = await fetch(`${MEDIA_API_BASE}/api/desktop/local-ip`);
      const ipData = await ipResponse.json();
      const ip = ipData.ip || "127.0.0.1";

      const tokenResponse = await fetch(`${MEDIA_API_BASE}/api/media/qr-media-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true })
      });
      const tokenData = await tokenResponse.json();
      this.qrMediaToken = tokenData.token || "";

      const port = window.location.port || "8767";
      const uploadUrl = `http://${ip}:${port}/api/media/mobile-upload?path=${encodeURIComponent(this.currentCustomPath || "")}&token=${encodeURIComponent(this.qrMediaToken)}`;

      qrContainer.innerHTML = "";
      this.qrCodeObj = new QRCode(qrContainer, {
        text: uploadUrl,
        width: 220,
        height: 220,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });

      modal.classList.remove("hidden");
      if (status) status.textContent = `Destino: ${this.currentCustomPath || "Raiz (Meus Uploads)"}`;

      clearInterval(this.qrStatusInterval);
      let lastReceivedCount = 0;
      this.qrStatusInterval = setInterval(async () => {
        try {
          const resp = await fetch(`${MEDIA_API_BASE}/api/media/qr-media-status?token=${encodeURIComponent(this.qrMediaToken)}`);
          if (!resp.ok) return;
          const data = await resp.json();
          if (data.received_count !== lastReceivedCount) {
            lastReceivedCount = data.received_count;
            this.loadCustomBackgrounds();
          }
          if (status) {
            if (data.status === "receiving") {
              status.textContent = `Recebendo arquivos do celular... (${data.received_count} recebidos)`;
            } else if (data.received_count > 0) {
              status.textContent = `${data.received_count} arquivo(s) recebidos! Aguardando novos envios.`;
            }
          }
        } catch (e) {}
      }, 1000);
    } catch (err) {
      console.error("Erro ao gerar QR Code:", err);
      alert("Não foi possível gerar o QR Code de envio móvel: " + err.message);
    }
  }

  closeQRMediaModal() {
    const modal = document.getElementById("modal-qr-media-upload");
    if (modal) modal.classList.add("hidden");
    clearInterval(this.qrStatusInterval);
    this.qrStatusInterval = null;
  }

  applyBackground(kind, url) {
    this.currentBgContext = this.getCurrentContext();
    const isRetorno = this.currentBgTarget === "retorno";
    const isBible = this.currentBgContext === "bible";

    let prefKindKey = "";
    let prefUrlKey = "";

    if (isBible) {
      prefKindKey = isRetorno ? "slideState_bible_bgKindRetorno" : "slideState_bible_bgKind";
      prefUrlKey = isRetorno ? "slideState_bible_bgUrlRetorno" : "slideState_bible_bgUrl";
    } else {
      prefKindKey = isRetorno ? "slideState_songs_bgKindRetorno" : "slideState_songs_bgKind";
      prefUrlKey = isRetorno ? "slideState_songs_bgUrlRetorno" : "slideState_songs_bgUrl";
      // Também grava chaves legadas para compatibilidade
      if (window.electronAPI && typeof window.electronAPI.setPref === "function") {
        window.electronAPI.setPref(isRetorno ? "slideState_bgKindRetorno" : "slideState_bgKind", kind);
        window.electronAPI.setPref(isRetorno ? "slideState_bgUrlRetorno" : "slideState_bgUrl", url);
      }
      localStorage.setItem(isRetorno ? "slideState_bgKindRetorno" : "slideState_bgKind", kind);
      localStorage.setItem(isRetorno ? "slideState_bgUrlRetorno" : "slideState_bgUrl", url);
    }

    if (window.electronAPI && typeof window.electronAPI.setPref === "function") {
      window.electronAPI.setPref(prefKindKey, kind);
      window.electronAPI.setPref(prefUrlKey, url);
    }
    localStorage.setItem(prefKindKey, kind);
    localStorage.setItem(prefUrlKey, url);

    // Se a trilha configurada for a que está ativa no momento, atualiza telas ao vivo
    const activeTheme = window.projectionSync?.currentState?.currentSlide?.theme || "general";
    const matchesCurrentSlide = (isBible && activeTheme === "bible") || (!isBible && activeTheme !== "bible");

    if (matchesCurrentSlide) {
      this.channel.postMessage({
        action: "SET_BACKGROUND",
        target: this.currentBgTarget,
        kind: kind,
        url: url
      });

      if (!isRetorno && window.updateOnAirCardBg) {
        window.updateOnAirCardBg();
      }
      if (!isRetorno && window.slideTelemetry && typeof window.slideTelemetry.syncMiniPreviewBg === 'function') {
        window.slideTelemetry.syncMiniPreviewBg(activeTheme);
      }
    }

    this.highlightActiveSelection();
  }

  highlightActiveSelection() {
    let currentKind = "";
    let currentUrl = "";

    const isRetorno = this.currentBgTarget === "retorno";
    const isBible = this.currentBgContext === "bible";

    const getP = (k) => {
      if (window.electronAPI && typeof window.electronAPI.getPref === "function") {
        const v = window.electronAPI.getPref(k);
        if (v !== null && v !== undefined) return v;
      }
      return localStorage.getItem(k) || "";
    };

    if (isBible) {
      currentKind = getP(isRetorno ? "slideState_bible_bgKindRetorno" : "slideState_bible_bgKind") || "video";
      currentUrl = getP(isRetorno ? "slideState_bible_bgUrlRetorno" : "slideState_bible_bgUrl") || "/frontend/presets/B%C3%ADblia/B%C3%ADblia_207784_medium.mp4";
    } else {
      currentKind = getP(isRetorno ? "slideState_songs_bgKindRetorno" : "slideState_songs_bgKind") || getP(isRetorno ? "slideState_bgKindRetorno" : "slideState_bgKind") || "video";
      currentUrl = getP(isRetorno ? "slideState_songs_bgUrlRetorno" : "slideState_songs_bgUrl") || getP(isRetorno ? "slideState_bgUrlRetorno" : "slideState_bgUrl") || "/frontend/presets/Vertical/Vertical_174033-850286651_medium.mp4";
    }

    document.querySelectorAll(".bg-item").forEach(el => {
      el.classList.remove("active");
      if (el.classList.contains("color-item") && currentKind === "color") {
        if (el.dataset.color === currentUrl) el.classList.add("active");
      } else if (el.dataset.url === currentUrl) {
        el.classList.add("active");
      }
    });
  }

  refreshUI() {
    this.currentBgContext = this.getCurrentContext();
    this.updateTrackBadge();
    this.highlightActiveSelection();
  }
}

// Funções globais chamadas pelo HTML
window.openQRMediaModal = () => window.mediaManager?.openQRMediaModal();
window.closeQRMediaModal = () => window.mediaManager?.closeQRMediaModal();
window.createNewCustomFolder = () => window.mediaManager?.createNewCustomFolder();
window.openCustomFolderInOS = (path) => window.mediaManager?.openCustomFolderInOS(path);
window.revealCustomItemInOS = (path) => window.mediaManager?.revealCustomItemInOS(path);
window.deleteCustomItem = (path, name) => window.mediaManager?.deleteCustomItem(path, name);

window.addEventListener("DOMContentLoaded", () => {
  window.mediaManager = new MediaManager();
});
