/**
 * SLIDECONTROL V3 — TEXT STYLE MANAGER
 * Gerenciador modular de Modelos de Texto e Tipografia
 * Suporte a Telão e Retorno independentes, 19 modelos visuais e sincronização em tempo real via BroadcastChannel
 */

class TextStyleManager {
  constructor() {
    this.channel = new BroadcastChannel('slidecontrol_orbital_v3');
    this.currentTarget = 'telao'; // 'telao' | 'retorno'

    this.fontsList = [
      "Padrão do Modelo", "Arial", "Arial Black", "Montserrat", "Roboto", "Inter",
      "Open Sans", "Lato", "Helvetica Neue", "Times New Roman", "Georgia",
      "Merriweather", "Playfair Display", "Lora", "Great Vibes", "Alex Brush", "Pacifico",
      "Permanent Marker", "Londrina Sketch", "Cabin Sketch", "Bungee Shade"
    ];

    this.state = {
      // Telão
      textStyle: 'ts-holy-default',
      fontFamily: '',
      fontWeight: '',
      fontSize: 52,
      captionFontSize: 'clamp(13px, 1.4vw, 22px)',
      linesLimit: '0',

      // Retorno
      textStyleRetorno: 'ts-holy-default',
      fontFamilyRetorno: '',
      fontWeightRetorno: '',
      fontSizeRetorno: 52,
      captionFontSizeRetorno: 'clamp(13px, 1.4vw, 22px)'
    };

    this.loadPreferences();
    this.init();
  }

  getPref(key, fallback = null) {
    try {
      if (window.electronAPI && typeof window.electronAPI.getPref === 'function') {
        const val = window.electronAPI.getPref(key);
        if (val !== undefined && val !== null) return val;
      }
      const local = localStorage.getItem(key);
      if (local !== null) return local;
    } catch (e) {
      console.warn('[TextStyleManager] Erro ao ler pref:', key, e);
    }
    return fallback;
  }

  setPref(key, value) {
    try {
      if (window.electronAPI && typeof window.electronAPI.setPref === 'function') {
        window.electronAPI.setPref(key, value);
      }
      localStorage.setItem(key, String(value));
    } catch (e) {
      console.warn('[TextStyleManager] Erro ao salvar pref:', key, e);
    }
  }

  getCurrentTrackContext() {
    if (window.orbitalEngine && typeof window.orbitalEngine.activeRow === 'number') {
      return window.orbitalEngine.activeRow === 0 ? 'bible' : 'general';
    }
    const currentTheme = window.projectionSync?.currentState?.currentSlide?.theme;
    if (currentTheme === 'bible') return 'bible';
    return 'general';
  }

  updateTrackBadge() {
    const pill = document.getElementById('ts-modal-track-pill');
    if (!pill) return;
    const isBible = this.getCurrentTrackContext() === 'bible';
    if (isBible) {
      pill.textContent = '📖 Trilha: Bíblia';
      pill.style.background = 'rgba(168, 85, 247, 0.2)';
      pill.style.border = '1px solid rgba(168, 85, 247, 0.45)';
      pill.style.color = '#c084fc';
    } else {
      pill.textContent = '🌐 Trilha: Louvor & Culto';
      pill.style.background = 'rgba(0, 240, 255, 0.15)';
      pill.style.border = '1px solid rgba(0, 240, 255, 0.35)';
      pill.style.color = '#00f0ff';
    }
  }

  loadPreferences() {
    const isBible = this.getCurrentTrackContext() === 'bible';

    if (isBible) {
      // Telão Bíblia (Bíblia NUNCA limita linhas)
      this.state.textStyle = this.getPref('slideState_bible_textStyle', 'ts-holy-default');
      this.state.fontFamily = this.getPref('slideState_bible_fontFamily', '');
      this.state.fontWeight = this.getPref('slideState_bible_fontWeight', '');
      this.state.fontSize = parseInt(this.getPref('slideState_bible_fontSize', 52)) || 52;
      this.state.captionFontSize = this.getPref('slideState_bible_captionFontSize', 'clamp(13px, 1.4vw, 22px)');
      this.state.linesLimit = '0';

      // Retorno Bíblia
      this.state.textStyleRetorno = this.getPref('slideState_bible_textStyleRetorno', 'ts-holy-default');
      this.state.fontFamilyRetorno = this.getPref('slideState_bible_fontFamilyRetorno', '');
      this.state.fontWeightRetorno = this.getPref('slideState_bible_fontWeightRetorno', '');
      this.state.fontSizeRetorno = parseInt(this.getPref('slideState_bible_fontSizeRetorno', 52)) || 52;
      this.state.captionFontSizeRetorno = this.getPref('slideState_bible_captionFontSizeRetorno', 'clamp(13px, 1.4vw, 22px)');
    } else {
      // Telão Louvor & Geral (com fallback para chave original slideState_)
      this.state.textStyle = this.getPref('slideState_songs_textStyle') || this.getPref('slideState_textStyle', 'ts-holy-default');
      this.state.fontFamily = this.getPref('slideState_songs_fontFamily') || this.getPref('slideState_fontFamily', '');
      this.state.fontWeight = this.getPref('slideState_songs_fontWeight') || this.getPref('slideState_fontWeight', '');
      this.state.fontSize = parseInt(this.getPref('slideState_songs_fontSize') || this.getPref('slideState_fontSize', 52)) || 52;
      this.state.captionFontSize = this.getPref('slideState_songs_captionFontSize') || this.getPref('slideState_captionFontSize', 'clamp(13px, 1.4vw, 22px)');
      this.state.linesLimit = this.getPref('slideState_songs_linesLimit') || this.getPref('slideState_linesLimit', '0');

      // Retorno Louvor & Geral
      this.state.textStyleRetorno = this.getPref('slideState_songs_textStyleRetorno') || this.getPref('slideState_textStyleRetorno', 'ts-holy-default');
      this.state.fontFamilyRetorno = this.getPref('slideState_songs_fontFamilyRetorno') || this.getPref('slideState_fontFamilyRetorno', '');
      this.state.fontWeightRetorno = this.getPref('slideState_songs_fontWeightRetorno') || this.getPref('slideState_fontWeightRetorno', '');
      this.state.fontSizeRetorno = parseInt(this.getPref('slideState_songs_fontSizeRetorno') || this.getPref('slideState_fontSizeRetorno', 52)) || 52;
      this.state.captionFontSizeRetorno = this.getPref('slideState_songs_captionFontSizeRetorno') || this.getPref('slideState_captionFontSizeRetorno', 'clamp(13px, 1.4vw, 22px)');
    }
  }

  savePreferences() {
    const isBible = this.getCurrentTrackContext() === 'bible';

    if (isBible) {
      // Telão Bíblia
      this.setPref('slideState_bible_textStyle', this.state.textStyle);
      this.setPref('slideState_bible_fontFamily', this.state.fontFamily);
      this.setPref('slideState_bible_fontWeight', this.state.fontWeight);
      this.setPref('slideState_bible_fontSize', this.state.fontSize);
      this.setPref('slideState_bible_captionFontSize', this.state.captionFontSize);
      this.setPref('slideState_bible_linesLimit', '0');

      // Retorno Bíblia
      this.setPref('slideState_bible_textStyleRetorno', this.state.textStyleRetorno);
      this.setPref('slideState_bible_fontFamilyRetorno', this.state.fontFamilyRetorno);
      this.setPref('slideState_bible_fontWeightRetorno', this.state.fontWeightRetorno);
      this.setPref('slideState_bible_fontSizeRetorno', this.state.fontSizeRetorno);
      this.setPref('slideState_bible_captionFontSizeRetorno', this.state.captionFontSizeRetorno);
    } else {
      // Telão Louvor
      this.setPref('slideState_songs_textStyle', this.state.textStyle);
      this.setPref('slideState_songs_fontFamily', this.state.fontFamily);
      this.setPref('slideState_songs_fontWeight', this.state.fontWeight);
      this.setPref('slideState_songs_fontSize', this.state.fontSize);
      this.setPref('slideState_songs_captionFontSize', this.state.captionFontSize);
      this.setPref('slideState_songs_linesLimit', this.state.linesLimit);

      // Retorno Louvor
      this.setPref('slideState_songs_textStyleRetorno', this.state.textStyleRetorno);
      this.setPref('slideState_songs_fontFamilyRetorno', this.state.fontFamilyRetorno);
      this.setPref('slideState_songs_fontWeightRetorno', this.state.fontWeightRetorno);
      this.setPref('slideState_songs_fontSizeRetorno', this.state.fontSizeRetorno);
      this.setPref('slideState_songs_captionFontSizeRetorno', this.state.captionFontSizeRetorno);

      // Salva chaves legadas para compatibilidade
      this.setPref('slideState_textStyle', this.state.textStyle);
      this.setPref('slideState_fontFamily', this.state.fontFamily);
      this.setPref('slideState_fontWeight', this.state.fontWeight);
      this.setPref('slideState_fontSize', this.state.fontSize);
      this.setPref('slideState_captionFontSize', this.state.captionFontSize);
      this.setPref('slideState_linesLimit', this.state.linesLimit);
      this.setPref('slideState_textStyleRetorno', this.state.textStyleRetorno);
      this.setPref('slideState_fontFamilyRetorno', this.state.fontFamilyRetorno);
      this.setPref('slideState_fontWeightRetorno', this.state.fontWeightRetorno);
      this.setPref('slideState_fontSizeRetorno', this.state.fontSizeRetorno);
      this.setPref('slideState_captionFontSizeRetorno', this.state.captionFontSizeRetorno);
    }
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.bindUI());
    } else {
      this.bindUI();
    }
  }

  bindUI() {
    this.modal = document.getElementById('text-style-modal');
    this.btnOpen = document.getElementById('btn-open-text-style-modal');
    this.btnClose = document.getElementById('btn-close-text-style-modal');

    if (this.btnOpen) {
      this.btnOpen.onclick = () => this.openModal();
    }

    if (this.btnClose) {
      this.btnClose.onclick = () => this.closeModal();
    }

    if (this.modal) {
      this.modal.onclick = (e) => {
        if (e.target === this.modal) this.closeModal();
      };
    }

    // Tecla ESC fecha modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
        this.closeModal();
      }
    });

    // Abas de Alvo: Telão vs Retorno
    document.querySelectorAll('.ts-target-tab').forEach(tab => {
      tab.onclick = () => {
        const target = tab.dataset.target;
        if (target) this.setTarget(target);
      };
    });

    // Font Picker Custom
    this.setupFontPicker();

    // Peso da Fonte
    const weightSelect = document.getElementById('ts-font-weight-select');
    if (weightSelect) {
      weightSelect.onchange = (e) => {
        this.applyTextStyle('fontWeight', e.target.value);
      };
    }

    // Limite de Linhas
    const linesSelect = document.getElementById('ts-lines-limit-select');
    if (linesSelect) {
      linesSelect.onchange = (e) => {
        this.applyTextStyle('linesLimit', e.target.value);
      };
    }

    // Tamanho da Legenda
    const captionSelect = document.getElementById('ts-caption-font-size-select');
    if (captionSelect) {
      captionSelect.onchange = (e) => {
        this.applyTextStyle('captionFontSize', e.target.value);
      };
    }

    // Slider de Tamanho da Fonte
    const slider = document.getElementById('ts-font-size-slider');
    if (slider) {
      slider.oninput = (e) => {
        const val = parseInt(e.target.value) || 52;
        this.applyTextStyle('fontSize', val);
      };
    }

    // Botão Reset do Tamanho (52px)
    const resetBtn = document.getElementById('btn-reset-font-size');
    if (resetBtn) {
      resetBtn.onclick = () => {
        const DEFAULT_SIZE = 52;
        this.applyTextStyle('fontSize', DEFAULT_SIZE);
      };
    }

    // Cards de Modelos de Texto
    document.querySelectorAll('.ts-card').forEach(card => {
      card.onclick = () => {
        const val = card.dataset.value;
        if (val) this.applyTextStyle('textStyle', val);
      };
    });

    // Transmite estilo salvo inicialmente
    setTimeout(() => {
      this.broadcastStyle('telao');
      this.broadcastStyle('retorno');
    }, 500);
  }

  setupFontPicker() {
    const fontWrapper = document.getElementById('font-picker-wrapper');
    const fontTrigger = document.getElementById('ts-font-picker-trigger');
    const fontValueLabel = document.getElementById('ts-font-picker-value');
    const fontOptions = document.getElementById('ts-font-picker-options');

    if (!fontTrigger || !fontOptions) return;

    fontOptions.innerHTML = '';
    this.fontsList.forEach(font => {
      const el = document.createElement('div');
      el.className = 'ts-font-option-item';
      el.textContent = font;
      if (font !== 'Padrão do Modelo') {
        el.style.fontFamily = font;
      }

      el.onclick = () => {
        const val = font === 'Padrão do Modelo' ? '' : font;
        fontValueLabel.textContent = font;
        fontValueLabel.style.fontFamily = val;
        fontOptions.classList.add('hidden');
        this.applyTextStyle('fontFamily', val);
      };
      fontOptions.appendChild(el);
    });

    fontTrigger.onclick = (e) => {
      e.stopPropagation();
      fontOptions.classList.toggle('hidden');
    };

    document.addEventListener('click', (e) => {
      if (fontWrapper && !fontWrapper.contains(e.target)) {
        fontOptions.classList.add('hidden');
      }
    });
  }

  openModal() {
    if (!this.modal) return;
    this.loadPreferences();
    this.refreshTsModalUI();
    this.modal.classList.remove('hidden');
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.classList.add('hidden');
    const fontOptions = document.getElementById('ts-font-picker-options');
    if (fontOptions) fontOptions.classList.add('hidden');
  }

  setTarget(target) {
    this.currentTarget = target;
    this.refreshTsModalUI();
  }

  applyTextStyle(prop, value) {
    const isRetorno = this.currentTarget === 'retorno';
    const key = isRetorno ? (prop + 'Retorno') : prop;
    this.state[key] = value;

    this.savePreferences();
    this.refreshTsModalUI();
    this.broadcastStyle(this.currentTarget);
  }

  broadcastStyle(target) {
    const isRetorno = target === 'retorno';
    const isBible = this.getCurrentTrackContext() === 'bible';
    const payload = {
      action: 'SET_TEXT_STYLE',
      target: target,
      textStyle: isRetorno ? this.state.textStyleRetorno : this.state.textStyle,
      fontFamily: isRetorno ? this.state.fontFamilyRetorno : this.state.fontFamily,
      fontWeight: isRetorno ? this.state.fontWeightRetorno : this.state.fontWeight,
      fontSize: isRetorno ? this.state.fontSizeRetorno : this.state.fontSize,
      captionFontSize: isRetorno ? this.state.captionFontSizeRetorno : this.state.captionFontSize,
      linesLimit: (isRetorno || isBible) ? '0' : this.state.linesLimit
    };

    const activeTheme = window.projectionSync?.currentState?.currentSlide?.theme || 'general';
    const matchesCurrentSlide = (isBible && activeTheme === 'bible') || (!isBible && activeTheme !== 'bible');
    if (matchesCurrentSlide) {
      this.channel.postMessage(payload);
    }
  }

  refreshTsModalUI() {
    this.updateTrackBadge();
    const isRetorno = this.currentTarget === 'retorno';
    const isBible = this.getCurrentTrackContext() === 'bible';

    // Abas de destino
    document.querySelectorAll('.ts-target-tab').forEach(tab => {
      if (tab.dataset.target === this.currentTarget) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Fonte selecionada
    const fontValueLabel = document.getElementById('ts-font-picker-value');
    if (fontValueLabel) {
      const curFont = isRetorno ? this.state.fontFamilyRetorno : this.state.fontFamily;
      fontValueLabel.textContent = curFont || 'Padrão do Modelo';
      fontValueLabel.style.fontFamily = curFont || '';
    }

    // Peso
    const weightSelect = document.getElementById('ts-font-weight-select');
    if (weightSelect) {
      weightSelect.value = (isRetorno ? this.state.fontWeightRetorno : this.state.fontWeight) || '';
    }

    // Limite de Linhas (Apenas Telão de Louvor/Geral - Oculto no Retorno E na Bíblia)
    const linesContainer = document.getElementById('ts-lines-limit-container');
    if (linesContainer) {
      linesContainer.style.display = (isRetorno || isBible) ? 'none' : 'flex';
    }
    const linesSelect = document.getElementById('ts-lines-limit-select');
    if (linesSelect) {
      linesSelect.value = (isRetorno || isBible ? '0' : this.state.linesLimit) || '0';
    }

    // Tamanho da Legenda
    const captionSelect = document.getElementById('ts-caption-font-size-select');
    if (captionSelect) {
      captionSelect.value = (isRetorno ? this.state.captionFontSizeRetorno : this.state.captionFontSize) || 'clamp(13px, 1.4vw, 22px)';
    }

    // Slider de Tamanho da Fonte
    const slider = document.getElementById('ts-font-size-slider');
    const label = document.getElementById('ts-font-size-value');
    if (slider) {
      const val = isRetorno ? this.state.fontSizeRetorno : this.state.fontSize;
      slider.value = val;
      if (label) label.textContent = val;

      const min = parseInt(slider.min) || 24;
      const max = parseInt(slider.max) || 120;
      const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
      const accentColor = isRetorno ? '#0284c7' : '#00f0ff';
      slider.style.background = `linear-gradient(to right, ${accentColor} ${pct}%, rgba(255, 255, 255, 0.15) ${pct}%)`;
    }

    // Card ativo
    const activeStyle = isRetorno ? this.state.textStyleRetorno : this.state.textStyle;
    document.querySelectorAll('.ts-card').forEach(card => {
      if (card.dataset.value === activeStyle) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  getCurrentStyles() {
    return {
      textStyle: this.state.textStyle,
      fontFamily: this.state.fontFamily,
      fontWeight: this.state.fontWeight,
      fontSize: this.state.fontSize,
      captionFontSize: this.state.captionFontSize,
      linesLimit: this.state.linesLimit,
      textStyleRetorno: this.state.textStyleRetorno,
      fontFamilyRetorno: this.state.fontFamilyRetorno,
      fontWeightRetorno: this.state.fontWeightRetorno,
      fontSizeRetorno: this.state.fontSizeRetorno,
      captionFontSizeRetorno: this.state.captionFontSizeRetorno
    };
  }
}

// Instância global disponível para console e outros módulos
window.TextStyleManager = TextStyleManager;
window.textStyleManager = new TextStyleManager();
