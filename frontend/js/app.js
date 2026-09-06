/**
 * SLIDECONTROL V3 — CONTROLADOR DA TELA-GLOBO
 * Sincronização de navegação em trilhas esféricas, painéis laterais HUD e hotkeys
 */

class GlobeApp {
  constructor() {
    this.engine = null;
    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  init() {
    this.engine = new SphericalSurfaceEngine('webgl-container', 'css3d-container');

    // Transmite o primeiro slide padrão e marca o cartão com borda pulsante
    setTimeout(() => {
      if (this.engine.rows[1] && this.engine.rows[1].cards.length > 0) {
        const firstCard = this.engine.rows[1].cards[0];
        firstCard.element.classList.add('on-air');
        window.projectionSync.projectSlide({
          header: firstCard.data.tag,
          text: firstCard.data.text,
          subtitle: firstCard.data.title,
          theme: firstCard.data.theme
        });

        if (window.slideTelemetry) {
          window.slideTelemetry.updateInspector(firstCard.data);
          window.slideTelemetry.appendLog(firstCard.data.tag, `Inicial: "${firstCard.data.title}" no ar`, 'info');
        }
      }
    }, 400);

    this.bindNavigationButtons();
    this.bindZoneButtons();
    this.bindPanelButtons();
    this.bindKeyboardShortcuts();

    const modalQuit = document.getElementById('modal-quit-confirm');
    if (modalQuit) {
      modalQuit.addEventListener('click', (e) => {
        if (e.target === modalQuit) {
          modalQuit.classList.add('hidden');
        }
      });
    }

    if (window.electronAPI && window.electronAPI.onShowQuitModal) {
      window.electronAPI.onShowQuitModal(() => {
        if (modalQuit) modalQuit.classList.remove('hidden');
      });
    }

    const openBtn = document.getElementById('btn-open-display');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        window.projectionSync.openDisplayWindow();
      });
    }
  }

  bindNavigationButtons() {
    const upBtn = document.getElementById('nav-up');
    const downBtn = document.getElementById('nav-down');
    const leftBtn = document.getElementById('nav-left');
    const rightBtn = document.getElementById('nav-right');
    const centerBtn = document.getElementById('nav-center');

    if (upBtn) upBtn.addEventListener('click', () => {
      this.engine.setRow(Math.max(0, this.engine.activeRow - 1));
    });

    if (downBtn) downBtn.addEventListener('click', () => {
      this.engine.setRow(Math.min(2, this.engine.activeRow + 1));
    });

    if (leftBtn) leftBtn.addEventListener('click', () => {
      this.engine.stepRowHorizontal(-1);
    });

    if (rightBtn) rightBtn.addEventListener('click', () => {
      this.engine.stepRowHorizontal(1);
    });

    if (centerBtn) centerBtn.addEventListener('click', () => {
      const onAirCard = document.querySelector('.globe-card.on-air');
      if (onAirCard) {
        const row = parseInt(onAirCard.dataset.rowIdx, 10);
        const card = parseInt(onAirCard.dataset.cardIdx, 10);
        if (!isNaN(row) && !isNaN(card)) {
          this.engine.setRow(row);
          this.engine.snapToCard(row, card);
          return;
        }
      }
      this.engine.setRow(1);
      this.engine.snapToCard(1, 0);
    });
  }

  bindZoneButtons() {
    const northBtn = document.getElementById('btn-zone-north');
    const eqBtn = document.getElementById('btn-zone-equator');
    const southBtn = document.getElementById('btn-zone-south');

    if (northBtn) northBtn.addEventListener('click', () => this.engine.setRow(0));
    if (eqBtn) eqBtn.addEventListener('click', () => this.engine.setRow(1));
    if (southBtn) southBtn.addEventListener('click', () => this.engine.setRow(2));
  }

  bindPanelButtons() {
    // ── PAINEL ESQUERDO: CATEGORIAS / ZONAS ──
    const catNorth = document.getElementById('cat-north');
    const catEq = document.getElementById('cat-equator');
    const catSouth = document.getElementById('cat-south');

    if (catNorth) catNorth.addEventListener('click', () => this.engine.setRow(0));
    if (catEq) catEq.addEventListener('click', () => this.engine.setRow(1));
    if (catSouth) catSouth.addEventListener('click', () => this.engine.setRow(2));

    // ── PAINEL ESQUERDO: PRESETS DE CÂMERA & RECENTRALIZAR ──
    const preNorth = document.getElementById('preset-north');
    const preEq = document.getElementById('preset-equator');
    const preSouth = document.getElementById('preset-south');
    const resetBtn = document.getElementById('btn-reset-view');

    if (preNorth) preNorth.addEventListener('click', () => this.engine.setRow(0));
    if (preEq) preEq.addEventListener('click', () => this.engine.setRow(1));
    if (preSouth) preSouth.addEventListener('click', () => this.engine.setRow(2));
    if (resetBtn) resetBtn.addEventListener('click', () => {
      let centered = false;
      const onAirCard = document.querySelector('.globe-card.on-air');
      if (onAirCard) {
        const row = parseInt(onAirCard.dataset.rowIdx, 10);
        const card = parseInt(onAirCard.dataset.cardIdx, 10);
        if (!isNaN(row) && !isNaN(card)) {
          this.engine.setRow(row);
          this.engine.snapToCard(row, card);
          centered = true;
        }
      }
      if (!centered) {
        this.engine.setRow(1);
        this.engine.snapToCard(1, 0);
      }
      if (window.slideTelemetry) {
        window.slideTelemetry.appendLog('SISTEMA', centered ? 'Foco retornado ao slide atual' : 'Globo recentralizado no Equador', 'info');
      }
    });

    // ── PAINEL DIREITO: AÇÕES RÁPIDAS ──
    const quickProject = document.getElementById('btn-quick-project');
    const quickBlackout = document.getElementById('btn-quick-blackout');
    const quickClear = document.getElementById('btn-quick-clear');
    const quickLogo = document.getElementById('btn-quick-logo');

    if (quickProject) {
      quickProject.addEventListener('click', () => {
        const row = this.engine.rows[this.engine.activeRow];
        const cardIdx = Math.round(row.scrollIndex);
        const cardObj = row.cards[cardIdx];
        if (cardObj) {
          this.engine.onCardClicked(cardObj.data, cardObj.element, this.engine.activeRow, cardIdx);
        }
      });
    }

    if (quickBlackout) {
      quickBlackout.addEventListener('click', () => {
        window.projectionSync.toggleBlackout();
        if (window.slideTelemetry) {
          window.slideTelemetry.appendLog('CABINE', 'Modo Blackout alternado (F2)', 'warning');
        }
      });
    }

    if (quickClear) {
      quickClear.addEventListener('click', () => {
        window.projectionSync.toggleClearText();
        if (window.slideTelemetry) {
          window.slideTelemetry.appendLog('CABINE', 'Limpar Texto alternado (F3)', 'warning');
        }
      });
    }

    if (quickLogo) {
      quickLogo.addEventListener('click', () => {
        window.projectionSync.toggleLogo();
        if (window.slideTelemetry) {
          window.slideTelemetry.appendLog('CABINE', 'Logo alternada (ESC)', 'info');
        }
      });
    }
  }

  onRowChanged(rowIndex) {
    // Atualiza botões da barra inferior
    const zoneIds = ['btn-zone-north', 'btn-zone-equator', 'btn-zone-south'];
    zoneIds.forEach((id, idx) => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', idx === rowIndex);
    });

    // Atualiza botões do painel esquerdo (Categorias)
    const catIds = ['cat-north', 'cat-equator', 'cat-south'];
    catIds.forEach((id, idx) => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', idx === rowIndex);
    });

    // Atualiza botões de preset
    const presetIds = ['preset-north', 'preset-equator', 'preset-south'];
    presetIds.forEach((id, idx) => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', idx === rowIndex);
    });

    if (window.slideTelemetry) {
      const rowNames = ['Bíblia Sagrada (Norte)', 'Louvor & Slides (Equador)', 'Cabine & Controles (Sul)'];
      window.slideTelemetry.appendLog('ÓRBITA', `Transição de zona para: ${rowNames[rowIndex]}`, 'info');
    }
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', e => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      // Navegação vertical entre linhas (Norte <-> Equador <-> Sul)
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.engine.setRow(Math.max(0, this.engine.activeRow - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.engine.setRow(Math.min(2, this.engine.activeRow + 1));
      }

      // Navegação horizontal na linha ativa (Passar slides daquela categoria)
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.engine.stepRowHorizontal(-1);
      } else if (e.key === 'ArrowRight' || e.code === 'Space') {
        e.preventDefault();
        this.engine.stepRowHorizontal(1);
      }

      // Teclas de Emergência Globais
      if (e.key === 'F2') {
        e.preventDefault();
        window.projectionSync.toggleBlackout();
        if (window.slideTelemetry) {
          window.slideTelemetry.appendLog('CABINE', 'Modo Blackout alternado (F2)', 'warning');
        }
      }
      if (e.key === 'F3') {
        e.preventDefault();
        window.projectionSync.toggleClearText();
        if (window.slideTelemetry) {
          window.slideTelemetry.appendLog('CABINE', 'Limpar Texto alternado (F3)', 'warning');
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        window.projectionSync.toggleLogo();
        if (window.slideTelemetry) {
          window.slideTelemetry.appendLog('CABINE', 'Logo alternada (ESC)', 'info');
        }
      }
      if (e.key === 'F11') {
        e.preventDefault();
        window.projectionSync.openDisplayWindow();
      }
    });
  }
}

window.globeApp = new GlobeApp();

window.updateOnAirCardBg = function() {
  const onAirCard = document.querySelector('.globe-card.on-air');
  if (!onAirCard) return;

  // Remover background layer antigo se existir
  const existingLayer = onAirCard.querySelector('.on-air-bg-layer');
  if (existingLayer) existingLayer.remove();

  if (window.electronAPI && typeof window.electronAPI.getPref === "function") {
    const kind = window.electronAPI.getPref("slideState_bgKind");
    const url = window.electronAPI.getPref("slideState_bgUrl");
    if (kind && url) {
      const bgLayer = document.createElement("div");
      bgLayer.className = "on-air-bg-layer";
      bgLayer.style.cssText = "position:absolute; inset:0; z-index:0; border-radius:inherit; overflow:hidden; opacity:1; pointer-events:none; transition: opacity 0.3s ease;";

      if (kind === "color") {
        bgLayer.style.backgroundColor = url;
      } else if (kind === "image") {
        bgLayer.style.backgroundImage = `url("${url}")`;
        bgLayer.style.backgroundSize = "cover";
        bgLayer.style.backgroundPosition = "center";
      } else if (kind === "video") {
        const vid = document.createElement("video");
        vid.src = url;
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.style.cssText = "width:100%; height:100%; object-fit:cover;";
        bgLayer.appendChild(vid);
      }
      
      // Make sure the contents of the card are positioned above the bg layer
      Array.from(onAirCard.children).forEach(child => {
        if (child.className !== 'on-air-bg-layer') {
            child.style.position = 'relative';
            child.style.zIndex = '1';
            child.style.textShadow = '0 2px 10px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,1)';
        }
      });
      
      onAirCard.insertBefore(bgLayer, onAirCard.firstChild);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const pill = document.getElementById('on-air-pill');
  if (pill) {
    pill.style.cursor = 'pointer';
    pill.title = 'Clique para centralizar o slide atual';
    pill.addEventListener('click', () => {
      const onAirCard = document.querySelector('.globe-card.on-air');
      if (onAirCard && window.globeApp && window.globeApp.engine) {
        const row = parseInt(onAirCard.dataset.rowIdx, 10);
        const card = parseInt(onAirCard.dataset.cardIdx, 10);
        if (!isNaN(row) && !isNaN(card)) {
          window.globeApp.engine.setRow(row);
          window.globeApp.engine.snapToCard(row, card);
        }
      }
    });
    
    // Add hover effect via JS to not mess with CSS files right now
    pill.addEventListener('mouseenter', () => {
      pill.style.background = 'rgba(0, 240, 255, 0.15)';
      pill.style.borderColor = 'rgba(0, 240, 255, 0.4)';
    });
    pill.addEventListener('mouseleave', () => {
      pill.style.background = '';
      pill.style.borderColor = '';
    });
  }
});
