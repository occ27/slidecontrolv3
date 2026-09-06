/**
 * SLIDECONTROL V3 — PROJECTION SYNC SERVICE
 * High-performance, zero-latency BroadcastChannel sync between Console and Display
 */

class ProjectionSyncService {
  constructor() {
    this.channel = new BroadcastChannel('slidecontrol_orbital_v3');
    this.isDisplayConnected = false;
    let initialLogoUrl = null;
    if (window.electronAPI && typeof window.electronAPI.getPref === 'function') {
      initialLogoUrl = window.electronAPI.getPref('slideState_logoUrl') || null;
    }
    
    this.currentState = {
      isBlackout: false,
      isClearText: false,
      isLogo: false,
      logoUrl: initialLogoUrl,
      currentSlide: {
        header: 'SLIDECONTROL V3',
        text: 'Bem-vindo ao Culto',
        subtitle: 'Sistema de Projeção Orbital',
        theme: 'general'
      }
    };

    this.initListeners();
  }

  initListeners() {
    this.channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.action === 'DISPLAY_CONNECTED' || msg.action === 'RETORNO_CONNECTED') {
        if (msg.action === 'DISPLAY_CONNECTED') {
          this.isDisplayConnected = true;
          this.updateDisplayStatusUI(true);
        }

        // Synchronize current slide to newly connected display
        this.sendCurrentSlide();
        
        if (this.currentState.logoUrl) {
          this.channel.postMessage({
            action: 'SET_LOGO',
            url: this.currentState.logoUrl
          });
        }

        this.channel.postMessage({
          action: 'TOGGLE_LOGO',
          active: this.currentState.isLogo
        });
        
        this.channel.postMessage({
          action: 'TOGGLE_BLACKOUT',
          active: this.currentState.isBlackout
        });
        
        this.channel.postMessage({
          action: 'TOGGLE_CLEAR_TEXT',
          active: this.currentState.isClearText
        });
      }
      
      if (msg.action === 'SET_BG_FIT' && (!msg.target || msg.target === 'telao')) {
        if (window.updateOnAirCardBg) {
          window.updateOnAirCardBg();
        }
      }
    };

    // Ping display
    this.channel.postMessage({ action: 'CONSOLE_PING', timestamp: Date.now() });
  }

  updateDisplayStatusUI(online) {
    const indicator = document.getElementById('display-status-indicator');
    if (indicator) {
      if (online) {
        indicator.classList.add('online');
        indicator.textContent = 'TELÃO: ONLINE (1080p)';
      } else {
        indicator.classList.remove('online');
        indicator.textContent = 'TELÃO: AGUARDANDO CONEXÃO';
      }
    }
  }

  projectSlide(slideData) {
    this.currentState.currentSlide = slideData;
    this.currentState.isBlackout = false;
    this.currentState.isLogo = false;

    this.channel.postMessage({
      action: 'PROJECT_SLIDE',
      header: slideData.header,
      text: slideData.text,
      subtitle: slideData.subtitle,
      theme: slideData.theme || 'general'
    });

    this.updateMiniPreview(slideData);

    // Reset emergency button states in UI
    const blackoutBtn = document.getElementById('btn-blackout');
    const logoBtn = document.getElementById('btn-logo');
    if (blackoutBtn) blackoutBtn.classList.remove('active');
    if (logoBtn) logoBtn.classList.remove('active');
  }

  sendCurrentSlide() {
    if (this.currentState.currentSlide) {
      this.channel.postMessage({
        action: 'PROJECT_SLIDE',
        header: this.currentState.currentSlide.header,
        text: this.currentState.currentSlide.text,
        subtitle: this.currentState.currentSlide.subtitle,
        theme: this.currentState.currentSlide.theme || 'general'
      });
    }
  }

  toggleBlackout() {
    this.currentState.isBlackout = !this.currentState.isBlackout;
    this.channel.postMessage({
      action: 'TOGGLE_BLACKOUT',
      active: this.currentState.isBlackout
    });

    const btn = document.getElementById('btn-blackout');
    if (btn) btn.classList.toggle('active', this.currentState.isBlackout);
    const qbtn = document.getElementById('btn-quick-blackout');
    if (qbtn) qbtn.classList.toggle('active', this.currentState.isBlackout);

    this.updatePreviewTags();
    return this.currentState.isBlackout;
  }

  toggleClearText() {
    this.currentState.isClearText = !this.currentState.isClearText;
    this.channel.postMessage({
      action: 'TOGGLE_CLEAR_TEXT',
      active: this.currentState.isClearText
    });

    const btn = document.getElementById('btn-clear-text');
    if (btn) btn.classList.toggle('active', this.currentState.isClearText);
    const qbtn = document.getElementById('btn-quick-clear');
    if (qbtn) qbtn.classList.toggle('active', this.currentState.isClearText);

    this.updatePreviewTags();
    return this.currentState.isClearText;
  }


  setOfficialLogo(url) {
    this.currentState.logoUrl = url;
    if (window.electronAPI && typeof window.electronAPI.setPref === 'function') {
      window.electronAPI.setPref('slideState_logoUrl', url);
    }
    this.channel.postMessage({
      action: 'SET_LOGO',
      url: url
    });
  }

  toggleLogo() {
    this.currentState.isLogo = !this.currentState.isLogo;
    this.channel.postMessage({
      action: 'TOGGLE_LOGO',
      active: this.currentState.isLogo
    });

    const btn = document.getElementById('btn-logo');
    if (btn) btn.classList.toggle('active', this.currentState.isLogo);
    const qbtn = document.getElementById('btn-quick-logo');
    if (qbtn) qbtn.classList.toggle('active', this.currentState.isLogo);

    this.updatePreviewTags();
    return this.currentState.isLogo;
  }

  showAlert(text, duration = 10) {
    this.channel.postMessage({
      action: 'SHOW_ALERT',
      text: text,
      duration: duration
    });
  }

  updateMiniPreview(slideData) {
    const textEl = document.getElementById('preview-slide-text');
    const subEl = document.getElementById('preview-slide-sub');

    if (textEl) textEl.textContent = slideData.text;
    if (subEl) subEl.textContent = slideData.header || slideData.subtitle || '';

    this.updatePreviewTags();
  }

  updatePreviewTags() {
    const tagEl = document.getElementById('preview-onair-tag');
    if (!tagEl) return;

    if (this.currentState.isBlackout) {
      tagEl.innerHTML = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444;margin-right:6px;"></span>BLACKOUT NO AR';
      tagEl.style.color = '#ef4444';
    } else if (this.currentState.isLogo) {
      tagEl.innerHTML = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#00f0ff;margin-right:6px;"></span>LOGO NO AR';
      tagEl.style.color = '#00f0ff';
    } else if (this.currentState.isClearText) {
      tagEl.innerHTML = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#f59e0b;margin-right:6px;"></span>TEXTO OCULTO';
      tagEl.style.color = '#f59e0b';
    } else {
      tagEl.innerHTML = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;margin-right:6px;"></span>AO VIVO NO TELÃO';
      tagEl.style.color = '#10b981';
    }
  }

  async openDisplayWindow(monitorId = null) {
    if (window.electronAPI && typeof window.electronAPI.assignScreen === 'function') {
      await window.electronAPI.assignScreen('telao', monitorId);
      return;
    }
    const displayUrl = 'display.html';
    const features = 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no';
    window.open(displayUrl, 'SlideControlDisplayWindow', features);
  }
}

window.projectionSync = new ProjectionSyncService();
