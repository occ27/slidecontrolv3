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
    setTimeout(() => this.updateMasterButtonsUI(), 200);
  }

  updateDisplayStatusUI(online) {
    const indicator = document.getElementById('display-status-indicator');
    const hwStatus = document.getElementById('hw-telao-status');
    if (indicator) {
      if (online) {
        indicator.classList.add('status-live');
        indicator.textContent = 'ONLINE';
      } else {
        indicator.classList.remove('status-live');
        indicator.textContent = 'DESCONECTADO';
      }
    }
    if (hwStatus) {
      hwStatus.textContent = online ? 'Ativo (1080p)' : 'Aguardando Janela';
    }
  }

  getPref(key, defaultValue = null) {
    try {
      if (window.electronAPI && typeof window.electronAPI.getPref === 'function') {
        const val = window.electronAPI.getPref(key);
        if (val !== null && val !== undefined) return val;
      }
      const local = localStorage.getItem(key);
      if (local !== null && local !== undefined) {
        try { return JSON.parse(local); } catch (e) { return local; }
      }
    } catch (e) {}
    return defaultValue;
  }

  getBackgroundForTheme(theme = 'general') {
    if (theme === 'bible') {
      const bTelaoKind = this.getPref('slideState_bible_bgKind') || 'video';
      const bTelaoUrl = this.getPref('slideState_bible_bgUrl') || '/frontend/presets/B%C3%ADblia/B%C3%ADblia_207784_medium.mp4';
      const bRetornoKind = this.getPref('slideState_bible_bgKindRetorno') || 'video';
      const bRetornoUrl = this.getPref('slideState_bible_bgUrlRetorno') || '/frontend/presets/B%C3%ADblia/B%C3%ADblia_207784_medium.mp4';
      return {
        telao: { kind: bTelaoKind, url: bTelaoUrl },
        retorno: { kind: bRetornoKind, url: bRetornoUrl }
      };
    } else {
      // Louvor ou Geral
      const sTelaoKind = this.getPref('slideState_songs_bgKind') || this.getPref('slideState_bgKind') || 'video';
      const sTelaoUrl = this.getPref('slideState_songs_bgUrl') || this.getPref('slideState_bgUrl') || '/frontend/presets/Vertical/Vertical_174033-850286651_medium.mp4';
      const sRetornoKind = this.getPref('slideState_songs_bgKindRetorno') || this.getPref('slideState_bgKindRetorno') || 'video';
      const sRetornoUrl = this.getPref('slideState_songs_bgUrlRetorno') || this.getPref('slideState_bgUrlRetorno') || '/frontend/presets/Vertical/Vertical_174033-850286651_medium.mp4';
      return {
        telao: { kind: sTelaoKind, url: sTelaoUrl },
        retorno: { kind: sRetornoKind, url: sRetornoUrl }
      };
    }
  }

  updateMasterButtonsUI() {
    const bBlackout = document.getElementById('btn-blackout');
    const qBlackout = document.getElementById('btn-quick-blackout');
    if (bBlackout) bBlackout.classList.toggle('active', !!this.currentState.isBlackout);
    if (qBlackout) qBlackout.classList.toggle('active', !!this.currentState.isBlackout);

    const bClear = document.getElementById('btn-clear-text');
    const qClear = document.getElementById('btn-quick-clear');
    if (bClear) bClear.classList.toggle('active', !!this.currentState.isClearText);
    if (qClear) qClear.classList.toggle('active', !!this.currentState.isClearText);

    const bLogo = document.getElementById('btn-logo');
    const qLogo = document.getElementById('btn-quick-logo');
    if (bLogo) bLogo.classList.toggle('active', !!this.currentState.isLogo);
    if (qLogo) qLogo.classList.toggle('active', !!this.currentState.isLogo);
  }

  projectSlide(slideData) {
    this.currentState.currentSlide = slideData;

    const theme = slideData.theme || 'general';
    const bg = this.getBackgroundForTheme(theme);

    const textStyle = this.getPref('slideState_textStyle') || 'ts-holy-default';
    const fontFamily = this.getPref('slideState_fontFamily') || '';
    const fontWeight = this.getPref('slideState_fontWeight') || '';
    const fontSize = parseInt(this.getPref('slideState_fontSize')) || 52;
    const captionFontSize = this.getPref('slideState_captionFontSize') || 'clamp(13px, 1.4vw, 22px)';
    const linesLimit = this.getPref('slideState_linesLimit') || '0';

    const textStyleRetorno = this.getPref('slideState_textStyleRetorno') || 'ts-holy-default';
    const fontFamilyRetorno = this.getPref('slideState_fontFamilyRetorno') || '';
    const fontWeightRetorno = this.getPref('slideState_fontWeightRetorno') || '';
    const fontSizeRetorno = parseInt(this.getPref('slideState_fontSizeRetorno')) || 52;
    const captionFontSizeRetorno = this.getPref('slideState_captionFontSizeRetorno') || 'clamp(13px, 1.4vw, 22px)';

    this.channel.postMessage({
      action: 'PROJECT_SLIDE',
      header: slideData.header,
      text: slideData.text,
      subtitle: slideData.subtitle,
      theme: theme,
      bgKind: bg.telao.kind,
      bgUrl: bg.telao.url,
      bgKindRetorno: bg.retorno.kind,
      bgUrlRetorno: bg.retorno.url,
      nextText: slideData.nextText || '',
      isBlackout: this.currentState.isBlackout,
      isClearText: this.currentState.isClearText,
      isLogo: this.currentState.isLogo,
      textStyle,
      fontFamily,
      fontWeight,
      fontSize,
      captionFontSize,
      linesLimit,
      textStyleRetorno,
      fontFamilyRetorno,
      fontWeightRetorno,
      fontSizeRetorno,
      captionFontSizeRetorno
    });

    this.updateMiniPreview(slideData);
    this.updateMasterButtonsUI();
  }

  sendCurrentSlide() {
    if (this.currentState.currentSlide) {
      const theme = this.currentState.currentSlide.theme || 'general';
      const bg = this.getBackgroundForTheme(theme);

      const textStyle = this.getPref('slideState_textStyle') || 'ts-holy-default';
      const fontFamily = this.getPref('slideState_fontFamily') || '';
      const fontWeight = this.getPref('slideState_fontWeight') || '';
      const fontSize = parseInt(this.getPref('slideState_fontSize')) || 52;
      const captionFontSize = this.getPref('slideState_captionFontSize') || 'clamp(13px, 1.4vw, 22px)';
      const linesLimit = this.getPref('slideState_linesLimit') || '0';

      const textStyleRetorno = this.getPref('slideState_textStyleRetorno') || 'ts-holy-default';
      const fontFamilyRetorno = this.getPref('slideState_fontFamilyRetorno') || '';
      const fontWeightRetorno = this.getPref('slideState_fontWeightRetorno') || '';
      const fontSizeRetorno = parseInt(this.getPref('slideState_fontSizeRetorno')) || 52;
      const captionFontSizeRetorno = this.getPref('slideState_captionFontSizeRetorno') || 'clamp(13px, 1.4vw, 22px)';

      this.channel.postMessage({
        action: 'PROJECT_SLIDE',
        header: this.currentState.currentSlide.header,
        text: this.currentState.currentSlide.text,
        subtitle: this.currentState.currentSlide.subtitle,
        theme: theme,
        bgKind: bg.telao.kind,
        bgUrl: bg.telao.url,
        bgKindRetorno: bg.retorno.kind,
        bgUrlRetorno: bg.retorno.url,
        nextText: this.currentState.currentSlide.nextText || '',
        isBlackout: this.currentState.isBlackout,
        isClearText: this.currentState.isClearText,
        isLogo: this.currentState.isLogo,
        textStyle,
        fontFamily,
        fontWeight,
        fontSize,
        captionFontSize,
        linesLimit,
        textStyleRetorno,
        fontFamilyRetorno,
        fontWeightRetorno,
        fontSizeRetorno,
        captionFontSizeRetorno
      });
    }
  }

  toggleBlackout() {
    this.currentState.isBlackout = !this.currentState.isBlackout;
    this.channel.postMessage({
      action: 'TOGGLE_BLACKOUT',
      active: this.currentState.isBlackout
    });

    this.updateMasterButtonsUI();
    this.updatePreviewTags();
    return this.currentState.isBlackout;
  }

  toggleClearText() {
    this.currentState.isClearText = !this.currentState.isClearText;
    this.channel.postMessage({
      action: 'TOGGLE_CLEAR_TEXT',
      active: this.currentState.isClearText
    });

    this.updateMasterButtonsUI();
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

    this.updateMasterButtonsUI();
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
    const titleEl = document.getElementById('node-title-display');

    if (textEl && slideData.text) textEl.textContent = slideData.text;
    if (subEl) subEl.textContent = slideData.subtitle || '';
    if (titleEl) titleEl.textContent = slideData.header || slideData.tag || 'Slide Ativo';

    if (window.slideTelemetry && typeof window.slideTelemetry.syncMiniPreviewBg === 'function') {
      window.slideTelemetry.syncMiniPreviewBg();
    }

    this.updatePreviewTags();
  }

  updatePreviewTags() {
    const tagEl = document.getElementById('preview-onair-tag');
    const overlayStatus = document.getElementById('preview-overlay-status');
    const overlayMsg = document.getElementById('preview-overlay-msg');
    const previewText = document.getElementById('preview-slide-text');

    if (this.currentState.isBlackout) {
      if (tagEl) {
        tagEl.innerHTML = '<span class="signal-dot" style="background:#ef4444;box-shadow:0 0 6px #ef4444;"></span><span>BLACKOUT NO AR</span>';
        tagEl.style.color = '#ef4444';
      }
      if (overlayStatus) {
        overlayStatus.style.display = 'flex';
        overlayStatus.className = 'live-overlay-status blackout';
        if (overlayMsg) overlayMsg.textContent = '⚫ BLACKOUT ATIVO';
      }
    } else if (this.currentState.isLogo) {
      if (tagEl) {
        tagEl.innerHTML = '<span class="signal-dot" style="background:#00f0ff;box-shadow:0 0 6px #00f0ff;"></span><span>LOGO NO AR</span>';
        tagEl.style.color = '#00f0ff';
      }
      if (overlayStatus) {
        overlayStatus.style.display = 'flex';
        overlayStatus.className = 'live-overlay-status logo';
        if (overlayMsg) overlayMsg.textContent = '⛪ LOGO NO AR';
      }
    } else if (this.currentState.isClearText) {
      if (tagEl) {
        tagEl.innerHTML = '<span class="signal-dot" style="background:#f59e0b;box-shadow:0 0 6px #f59e0b;"></span><span>TEXTO OCULTO</span>';
        tagEl.style.color = '#f59e0b';
      }
      if (overlayStatus) {
        overlayStatus.style.display = 'none';
      }
    } else {
      if (tagEl) {
        tagEl.innerHTML = '<span class="signal-dot"></span><span>AO VIVO NO TELÃO</span>';
        tagEl.style.color = 'var(--accent-emerald)';
      }
      if (overlayStatus) overlayStatus.style.display = 'none';
    }

    if (previewText) {
      previewText.style.visibility = this.currentState.isClearText ? 'hidden' : 'visible';
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
