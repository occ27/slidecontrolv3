/**
 * SLIDECONTROL V3 — TELEMETRY & HUD INSPECTOR ENGINE
 * Visualizador de ondas em tempo real, telemetria de transmissão e logs do sistema.
 */

class SlideControlTelemetry {
  constructor() {
    this.canvas = document.getElementById('waveform-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.startTime = Date.now();

    this.startClock();
    if (this.canvas && this.ctx) {
      this.points = [];
      this.maxPoints = 50;
      this.phase = 0;
      this.frequency = 0.06;
      this.amplitude = 20;
      this.noiseScale = 6;
      this.initWaveform();
      this.animateWaveform();
    }
    this.bindPanelEvents();
  }

  initWaveform() {
    for (let i = 0; i < (this.maxPoints || 50); i++) {
      this.points.push(0);
    }
  }

  startClock() {
    const clockEl = document.getElementById('clock-display');
    const uptimeEl = document.getElementById('uptime-display');

    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour12: false });
      if (clockEl) clockEl.textContent = timeStr;

      if (uptimeEl) {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
        uptimeEl.textContent = `${hrs}:${mins}:${secs}`;
      }
    };

    updateTime();
    setInterval(updateTime, 1000);
  }

  stepWaveform() {
    if (!this.points) return;
    this.phase += this.frequency;
    const baseSine = Math.sin(this.phase) * this.amplitude;
    const harmonic = Math.sin(this.phase * 2.3) * (this.amplitude * 0.35);
    const noise = (Math.random() - 0.5) * this.noiseScale;
    const newY = baseSine + harmonic + noise;

    this.points.shift();
    this.points.push(newY);
  }

  drawWaveform() {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2;
    const stepX = width / (this.maxPoints - 1);

    this.ctx.clearRect(0, 0, width, height);

    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let y = 12; y < height; y += 18) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
    }
    this.ctx.stroke();

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, centerY);
    this.ctx.lineTo(width, centerY);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2;
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = '#00f0ff';

    for (let i = 0; i < this.points.length; i++) {
      const x = i * stepX;
      const y = centerY + this.points[i];
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * stepX;
        const prevY = centerY + this.points[i - 1];
        const cx = (prevX + x) / 2;
        const cy = (prevY + y) / 2;
        this.ctx.quadraticCurveTo(prevX, prevY, cx, cy);
      }
    }
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  animateWaveform() {
    if (!this.canvas || !this.ctx) return;
    this.stepWaveform();
    this.drawWaveform();
    requestAnimationFrame(() => this.animateWaveform());
  }

  updateCoordinates(latDeg, lonDeg, isMoving = false) {
    const latEl = document.getElementById('coord-lat');
    const lonEl = document.getElementById('coord-lon');
    const velEl = document.getElementById('coord-velocity');
    const orbEl = document.getElementById('coord-orbit');

    if (latEl) {
      const dir = latDeg > 0.5 ? 'Norte' : (latDeg < -0.5 ? 'Sul' : 'Equador');
      latEl.textContent = `${latDeg >= 0 ? '+' : ''}${latDeg.toFixed(1)}° (${dir})`;
    }
    if (lonEl) {
      lonEl.textContent = `${lonDeg >= 0 ? '+' : ''}${lonDeg.toFixed(1)}°`;
    }
    if (velEl) {
      velEl.textContent = isMoving ? 'ORBITANDO' : 'ESTÁVEL';
      velEl.className = `coord-value ${isMoving ? 'highlight-amber' : ''}`;
    }
    if (orbEl) {
      orbEl.textContent = 'NO AR';
      orbEl.className = 'coord-value highlight';
    }
  }

  updateInspector(data, activeChunkIdx = 0, chunks = null, linesLimit = 0) {
    const tagEl = document.getElementById('node-type-badge');
    const titleEl = document.getElementById('node-title-display');
    const descEl = document.getElementById('node-desc-display');
    const subEl = document.getElementById('preview-slide-sub');
    const previewTextEl = document.getElementById('preview-slide-text');
    const chunkSection = document.getElementById('lines-chunk-section');
    const chunkBadge = document.getElementById('inspector-lines-limit-badge');
    const slicesList = document.getElementById('inspector-lines-slices');

    if (tagEl) {
      tagEl.textContent = data.tag || 'SLIDE';
    }

    const isSong = data.theme === 'song';
    const isBible = data.theme === 'bible';

    if (titleEl) {
      if (isSong && chunks && chunks.length > 1) {
        titleEl.textContent = `${data.tag || 'LOUVOR'} [${activeChunkIdx + 1}/${chunks.length}]`;
      } else {
        titleEl.textContent = data.tag || data.title || 'Slide Ativo';
      }
    }

    if (subEl) {
      subEl.textContent = data.title || '';
    }

    if (descEl) {
      const preview = data.text ? data.text.split('\n')[0] : 'Controles Mestres de Transmissão';
      descEl.textContent = preview;
    }

    // Atualiza a mini-prévia com o chunk atual projetado (ou texto completo)
    if (previewTextEl) {
      if (chunks && chunks[activeChunkIdx]) {
        previewTextEl.textContent = chunks[activeChunkIdx].text;
      } else if (data.text) {
        previewTextEl.textContent = data.text;
      }
    }

    // Fatiador de Linhas Interativo no Painel Inspetor
    if (chunkSection && slicesList) {
      if (isSong && chunks && chunks.length > 1) {
        chunkSection.style.display = 'flex';
        if (chunkBadge) {
          const limit = parseInt(linesLimit) || 1;
          chunkBadge.textContent = `${limit} ${limit === 1 ? 'LINHA' : 'LINHAS'}`;
        }

        slicesList.innerHTML = '';
        chunks.forEach((chunk, idx) => {
          const item = document.createElement('div');
          item.className = `line-slice-item ${idx === activeChunkIdx ? 'active' : ''}`;
          item.dataset.chunkIdx = idx;
          item.title = `Projetar fatia ${idx + 1} de ${chunks.length}`;

          const cleanText = chunk.text.replace(/\n+/g, ' • ');
          item.innerHTML = `
            <span class="slice-idx-badge">${idx + 1}</span>
            <span class="slice-content-text">${cleanText}</span>
          `;

          item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.orbitalEngine) {
              window.orbitalEngine.jumpToChunk(idx);
            }
          });

          slicesList.appendChild(item);
        });
      } else {
        chunkSection.style.display = 'none';
      }
    }

    // Sincroniza a camada de fundo na mini prévia
    this.syncMiniPreviewBg();

    const inspector = document.getElementById('process-inspector');
    if (inspector) {
      inspector.classList.remove('hidden-panel');
    }
  }

  updateActiveSlice(activeChunkIdx, chunkText, totalChunks = 1) {
    const previewTextEl = document.getElementById('preview-slide-text');
    if (previewTextEl && chunkText) {
      previewTextEl.textContent = chunkText;
    }

    const titleEl = document.getElementById('node-title-display');
    if (titleEl && totalChunks > 1) {
      const currentTitle = titleEl.textContent || '';
      const baseTag = currentTitle.split(' [')[0] || 'LOUVOR';
      titleEl.textContent = `${baseTag} [${activeChunkIdx + 1}/${totalChunks}]`;
    }

    const slicesList = document.getElementById('inspector-lines-slices');
    if (slicesList) {
      const items = slicesList.querySelectorAll('.line-slice-item');
      items.forEach((item, idx) => {
        item.classList.toggle('active', idx === activeChunkIdx);
      });
    }
  }

  syncMiniPreviewBg(theme = null) {
    const miniBg = document.getElementById('live-preview-bg-layer');
    if (!miniBg) return;

    let kind = null;
    let url = null;
    const activeTheme = theme || window.projectionSync?.currentState?.currentSlide?.theme || 'general';

    if (window.projectionSync && typeof window.projectionSync.getBackgroundForTheme === 'function') {
      const bg = window.projectionSync.getBackgroundForTheme(activeTheme);
      if (bg && bg.telao) {
        kind = bg.telao.kind;
        url = bg.telao.url;
      }
    }

    if (!kind || !url) {
      if (window.electronAPI && typeof window.electronAPI.getPref === 'function') {
        kind = window.electronAPI.getPref('slideState_bgKind');
        url = window.electronAPI.getPref('slideState_bgUrl');
      }
    }

    if (kind && url) {
      if (kind === 'color') {
        miniBg.style.backgroundImage = 'none';
        miniBg.style.backgroundColor = url;
      } else if (kind === 'image') {
        miniBg.style.backgroundColor = 'transparent';
        miniBg.style.backgroundImage = `url("${url}")`;
        miniBg.style.backgroundSize = 'cover';
        miniBg.style.backgroundPosition = 'center';
      } else if (kind === 'video') {
        miniBg.style.backgroundColor = activeTheme === 'bible' ? 'rgba(168, 85, 247, 0.22)' : 'rgba(0, 240, 255, 0.18)';
        miniBg.style.backgroundImage = 'none';
      }
      return;
    }
    // Fallback padrão elegante
    miniBg.style.background = 'radial-gradient(circle at center, rgba(14, 28, 56, 0.9) 0%, rgba(3, 7, 18, 0.95) 100%)';
  }

  appendLog(tag, message, type = 'info') {
    const terminal = document.getElementById('node-log-terminal');
    if (!terminal) return;

    const timestamp = new Date().toTimeString().split(' ')[0];
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = `[${timestamp}] [${tag}] ${message}`;

    terminal.appendChild(line);

    while (terminal.children.length > 25) {
      terminal.removeChild(terminal.firstChild);
    }

    terminal.scrollTop = terminal.scrollHeight;
  }

  bindPanelEvents() {
    const closeBtn = document.getElementById('close-inspector-btn');
    const inspector = document.getElementById('process-inspector');
    if (closeBtn && inspector) {
      closeBtn.addEventListener('click', () => {
        inspector.classList.toggle('hidden-panel');
      });
    }

    const togglePanelsBtn = document.getElementById('btn-toggle-panels');
    const leftPanel = document.getElementById('hud-left-panel');
    if (togglePanelsBtn) {
      togglePanelsBtn.addEventListener('click', () => {
        const isHidden = inspector && inspector.classList.contains('hidden-panel');
        if (inspector) inspector.classList.toggle('hidden-panel', !isHidden);
        if (leftPanel) leftPanel.classList.toggle('hidden-panel', !isHidden);
      });
    }
  }
}

window.slideTelemetry = new SlideControlTelemetry();
