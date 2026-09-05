/**
 * SLIDECONTROL V3 — TELEMETRY & HUD INSPECTOR ENGINE
 * Visualizador de ondas em tempo real, telemetria de transmissão e logs do sistema.
 */

class SlideControlTelemetry {
  constructor() {
    this.canvas = document.getElementById('waveform-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.points = [];
    this.maxPoints = 50;
    this.phase = 0;
    this.frequency = 0.06;
    this.amplitude = 20;
    this.noiseScale = 6;
    this.startTime = Date.now();

    this.initWaveform();
    this.startClock();
    this.animateWaveform();
    this.bindPanelEvents();
  }

  initWaveform() {
    for (let i = 0; i < this.maxPoints; i++) {
      this.points.push(0);
    }
  }

  startClock() {
    const uptimeEl = document.getElementById('uptime-display');
    const throughputEl = document.getElementById('global-throughput');

    setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const hrs = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');

      if (uptimeEl) uptimeEl.textContent = `${hrs}:${mins}:${secs}`;

      if (throughputEl) {
        const val = (60.0 + (Math.random() - 0.5) * 0.4).toFixed(1);
        throughputEl.textContent = `${val} FPS`;
      }
    }, 1000);
  }

  stepWaveform() {
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

    // Grid suave
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let y = 12; y < height; y += 18) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
    }
    this.ctx.stroke();

    // Linha de centro
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, centerY);
    this.ctx.lineTo(width, centerY);
    this.ctx.stroke();

    // Linha de sinal luminoso (ciano brilhante)
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

  updateInspector(data) {
    const tagEl = document.getElementById('node-type-badge');
    const titleEl = document.getElementById('node-title-display');
    const descEl = document.getElementById('node-desc-display');

    if (tagEl) {
      tagEl.textContent = data.tag || 'SLIDE_PROJEÇÃO';
      if (data.theme === 'bible') {
        tagEl.style.color = 'var(--accent-violet)';
      } else if (data.theme === 'control') {
        tagEl.style.color = 'var(--accent-amber)';
      } else {
        tagEl.style.color = 'var(--accent-cyan)';
      }
    }
    if (titleEl) {
      titleEl.textContent = data.title || 'Slide Ativo';
    }
    if (descEl) {
      const preview = data.text ? data.text.split('\n')[0] : 'Controles Mestres de Transmissão';
      descEl.textContent = preview;
    }

    // Se o inspetor estiver oculto, pode abrir automaticamente ao selecionar
    const inspector = document.getElementById('process-inspector');
    if (inspector) {
      inspector.classList.remove('hidden-panel');
    }
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
    // Botão de fechar/ocultar painel direito
    const closeBtn = document.getElementById('close-inspector-btn');
    const inspector = document.getElementById('process-inspector');
    if (closeBtn && inspector) {
      closeBtn.addEventListener('click', () => {
        inspector.classList.toggle('hidden-panel');
      });
    }

    // Botão mestre no topo para alternar painéis
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
