/**
 * SLIDECONTROL V3 — CONTROLADOR DA TELA-GLOBO
 * Sincronização de navegação em trilhas esféricas e hotkeys
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
      }
    }, 400);

    this.bindNavigationButtons();
    this.bindZoneButtons();
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

  onRowChanged(rowIndex) {
    const zoneIds = ['btn-zone-north', 'btn-zone-equator', 'btn-zone-south'];
    zoneIds.forEach((id, idx) => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle('active', idx === rowIndex);
    });
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
      }
      if (e.key === 'F3') {
        e.preventDefault();
        window.projectionSync.toggleClearText();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        window.projectionSync.toggleLogo();
      }
      if (e.key === 'F11') {
        e.preventDefault();
        window.projectionSync.openDisplayWindow();
      }
    });
  }
}

window.globeApp = new GlobeApp();
