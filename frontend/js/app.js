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
      this.engine.setRow(1);
      this.engine.snapToCard(1, 0);
      if (window.slideTelemetry) {
        window.slideTelemetry.appendLog('SISTEMA', 'Globo recentralizado no Equador', 'info');
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
          window.slideTelemetry.appendLog('CABINE', 'Logo Oficial alternada (F4)', 'info');
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
      if (e.key === 'F4') {
        e.preventDefault();
        window.projectionSync.toggleLogo();
        if (window.slideTelemetry) {
          window.slideTelemetry.appendLog('CABINE', 'Logo Oficial alternada (F4)', 'info');
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
