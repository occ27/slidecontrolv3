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
    this.bindBibleNavigator();
    this.bindServicePlaylist();
    this.bindQuickAlerts();

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

  // ── INTEGRAÇÃO DO REPERTÓRIO DO CULTO (PLAYLIST) ──
  bindServicePlaylist() {
    const playlistContainer = document.getElementById('service-playlist');
    if (!playlistContainer) return;

    playlistContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.playlist-item');
      if (!item) return;

      const cardIdx = parseInt(item.dataset.cardIdx, 10) || 0;
      const rowIdx = parseInt(item.dataset.rowIdx, 10) || 1;

      // Desliza a esfera para o slide e linha desejada
      this.engine.setRow(rowIdx);
      this.engine.snapToCard(rowIdx, cardIdx);

      // Atualiza visual da lista de repertório
      Array.from(playlistContainer.children).forEach(btn => {
        btn.classList.remove('active');
        const tag = btn.querySelector('.playlist-item-tag');
        if (tag) tag.remove();
      });
      item.classList.add('active');
      const tag = document.createElement('span');
      tag.className = 'playlist-item-tag';
      tag.textContent = 'ATUAL';
      item.appendChild(tag);

      // Projeta o slide inicial daquela seção
      const row = this.engine.rows[rowIdx];
      if (row && row.cards[cardIdx]) {
        const cardObj = row.cards[cardIdx];
        this.engine.onCardClicked(cardObj.data, cardObj.element, rowIdx, cardIdx);
      }
    });
  }

  // ── INTEGRAÇÃO DE ALERTAS RÁPIDOS DE CULTO ──
  bindQuickAlerts() {
    const farolBtn = document.getElementById('btn-alert-farol');
    const bercarioBtn = document.getElementById('btn-alert-bercario');
    const alarmeBtn = document.getElementById('btn-alert-alarme');
    const customInput = document.getElementById('custom-alert-input');
    const sendBtn = document.getElementById('btn-send-custom-alert');

    if (farolBtn) {
      farolBtn.addEventListener('click', () => {
        window.projectionSync.showAlert('🚗 Veículo com farol aceso no estacionamento', 10);
      });
    }

    if (bercarioBtn) {
      bercarioBtn.addEventListener('click', () => {
        window.projectionSync.showAlert('👶 Mãe do berçário, favor comparecer ao local', 10);
      });
    }

    if (alarmeBtn) {
      alarmeBtn.addEventListener('click', () => {
        window.projectionSync.showAlert('🔔 Alarme de veículo disparado no estacionamento', 10);
      });
    }

    const sendCustom = () => {
      if (!customInput) return;
      const text = customInput.value.trim();
      if (!text) return;
      window.projectionSync.showAlert(text, 10);
      customInput.value = '';
    };

    if (sendBtn) sendBtn.addEventListener('click', sendCustom);
    if (customInput) {
      customInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendCustom();
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

  // ── INTEGRAÇÃO E EVENTOS DO NAVEGADOR BÍBLICO ──
  bindBibleNavigator() {
    const modal = document.getElementById('modal-bible-navigator');
    const openBtn = document.getElementById('btn-open-bible-modal');
    const closeBtn = document.getElementById('btn-close-bible-modal');
    const quickInput = document.getElementById('bible-quick-search-input');
    const clearQuickBtn = document.getElementById('btn-clear-bible-input');

    const modalSearchInput = document.getElementById('bible-modal-search-input');
    const searchExecBtn = document.getElementById('btn-bible-search-exec');
    const versionSelect = document.getElementById('bible-version-select');
    const tabOt = document.getElementById('tab-books-ot');
    const tabNt = document.getElementById('tab-books-nt');
    const booksGrid = document.getElementById('bible-books-grid');
    const chaptersGrid = document.getElementById('bible-chapters-grid');
    const versesList = document.getElementById('bible-verses-list');
    const loadGlobeBtn = document.getElementById('btn-load-chapter-to-globe');
    const historyTags = document.getElementById('bible-history-tags');

    let currentTab = 'ot';
    let selectedBookObj = null;
    let selectedChapterNum = 1;

    const openModal = async () => {
      if (!modal) return;
      modal.classList.remove('hidden');
      if (window.bibleService) {
        await window.bibleService.init();
        populateVersions();
        renderBooks();
        renderHistory();
      }
      if (modalSearchInput) modalSearchInput.focus();
    };

    const closeModal = () => {
      if (modal) modal.classList.add('hidden');
    };

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Atalho F4 para abrir/fechar Bíblia
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F4') {
        e.preventDefault();
        if (modal && !modal.classList.contains('hidden')) {
          closeModal();
        } else {
          openModal();
        }
      }
    });

    // ── Input Rápido no Painel Esquerdo ──
    if (quickInput) {
      let debounceTimer = null;
      quickInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (clearQuickBtn) clearQuickBtn.style.display = val ? 'block' : 'none';
        clearTimeout(debounceTimer);
        if (val.length >= 3) {
          debounceTimer = setTimeout(async () => {
            if (!window.bibleService) return;
            const ref = window.bibleService.parseReference(val);
            if (ref) {
              await window.bibleService.loadPassageToOrbital(ref.abbrev, ref.chapter, ref.verse);
            }
          }, 600);
        }
      });

      quickInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(debounceTimer);
          const val = quickInput.value.trim();
          if (!val || !window.bibleService) return;
          const ref = window.bibleService.parseReference(val);
          if (ref) {
            await window.bibleService.loadPassageToOrbital(ref.abbrev, ref.chapter, ref.verse);
            quickInput.blur();
          } else {
            openModal();
            if (modalSearchInput) {
              modalSearchInput.value = val;
              executeSearch(val);
            }
          }
        }
      });

      if (clearQuickBtn) {
        clearQuickBtn.addEventListener('click', () => {
          quickInput.value = '';
          clearQuickBtn.style.display = 'none';
          quickInput.focus();
        });
      }
    }

    // ── Preenchimento das Versões ──
    const populateVersions = () => {
      if (!versionSelect || !window.bibleService) return;
      versionSelect.innerHTML = '';
      window.bibleService.versions.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.abbreviation;
        opt.textContent = `${v.abbreviation.toUpperCase()} — ${v.name}`;
        if (v.abbreviation === window.bibleService.selectedVersion) opt.selected = true;
        versionSelect.appendChild(opt);
      });
    };

    if (versionSelect) {
      versionSelect.addEventListener('change', async () => {
        if (!window.bibleService) return;
        window.bibleService.selectedVersion = versionSelect.value;
        if (selectedBookObj) {
          loadChapterVerses(selectedBookObj.abbrev, selectedChapterNum);
        }
      });
    }

    // ── Abas de Testamento ──
    if (tabOt) tabOt.addEventListener('click', () => {
      currentTab = 'ot';
      tabOt.classList.add('active');
      if (tabNt) tabNt.classList.remove('active');
      renderBooks();
    });

    if (tabNt) tabNt.addEventListener('click', () => {
      currentTab = 'nt';
      tabNt.classList.add('active');
      if (tabOt) tabOt.classList.remove('active');
      renderBooks();
    });

    // ── Renderização dos Livros ──
    const renderBooks = () => {
      if (!booksGrid || !window.bibleService) return;
      booksGrid.innerHTML = '';
      const booksList = currentTab === 'ot'
        ? window.bibleService.getOldTestamentBooks()
        : window.bibleService.getNewTestamentBooks();

      if (!selectedBookObj && booksList.length > 0) {
        selectedBookObj = booksList[0];
      }

      booksList.forEach(b => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bible-book-btn';
        if (selectedBookObj && selectedBookObj.abbrev === b.abbrev) {
          btn.classList.add('active');
        }
        btn.innerHTML = `
          <span>${b.name}</span>
          <span class="book-chapters-badge">${b.chapters} cap</span>
        `;
        btn.addEventListener('click', () => {
          selectedBookObj = b;
          selectedChapterNum = 1;
          Array.from(booksGrid.children).forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          renderChapters(b);
          loadChapterVerses(b.abbrev, 1);
        });
        booksGrid.appendChild(btn);
      });

      if (selectedBookObj) {
        renderChapters(selectedBookObj);
        loadChapterVerses(selectedBookObj.abbrev, selectedChapterNum || 1);
      }
    };

    // ── Renderização dos Capítulos ──
    const renderChapters = (book) => {
      if (!chaptersGrid) return;
      chaptersGrid.innerHTML = '';
      const titleEl = document.getElementById('bible-selected-book-title');
      const subEl = document.getElementById('bible-selected-book-sub');
      if (titleEl) titleEl.textContent = book.name.toUpperCase();
      if (subEl) subEl.textContent = `${book.chapters} capítulos`;

      for (let i = 1; i <= book.chapters; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bible-chapter-btn';
        if (Number(selectedChapterNum) === i) btn.classList.add('active');
        btn.textContent = i;
        btn.addEventListener('click', () => {
          selectedChapterNum = i;
          Array.from(chaptersGrid.children).forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          loadChapterVerses(book.abbrev, i);
        });
        chaptersGrid.appendChild(btn);
      }
    };

    // ── Carregamento da Prévia dos Versículos ──
    const loadChapterVerses = async (bookAbbrev, chapterNum) => {
      if (!versesList || !window.bibleService) return;
      versesList.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;"><div class="spinner" style="margin:0 auto 10px;"></div>Carregando versículos...</div>';

      const data = await window.bibleService.getChapter(bookAbbrev, chapterNum);
      if (!data || !data.verses) {
        versesList.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;">Erro ao carregar versículos.</div>';
        return;
      }

      const vTitle = document.getElementById('bible-verses-header-title');
      const vSub = document.getElementById('bible-verses-header-sub');
      const badge = document.getElementById('bible-current-ref-badge');
      const refStr = `${data.book} ${chapterNum}`;
      if (vTitle) vTitle.textContent = refStr.toUpperCase();
      if (vSub) vSub.textContent = `${data.verses.length} versículos (${window.bibleService.selectedVersion.toUpperCase()})`;
      if (badge) badge.textContent = refStr;

      versesList.innerHTML = '';
      data.verses.forEach(v => {
        const item = document.createElement('div');
        item.className = 'bible-verse-item';
        item.innerHTML = `
          <div class="bible-verse-num">${v.verse}</div>
          <div class="bible-verse-text">${v.text}</div>
          <div class="bible-verse-actions">
            <button class="hud-btn-sm" style="background:#a855f7; border-color:#c084fc; color:#fff; padding:3px 8px; font-size:0.75rem;" title="Projetar este versículo imediatamente">
              PROJETAR
            </button>
          </div>
        `;
        item.addEventListener('click', async () => {
          await window.bibleService.loadPassageToOrbital(bookAbbrev, chapterNum, v.verse);
          closeModal();
          window.projectionSync.projectSlide({
            header: `${data.book.toUpperCase()} ${chapterNum}:${v.verse}`,
            text: v.text,
            subtitle: `${data.book} ${chapterNum} (${window.bibleService.selectedVersion.toUpperCase()})`,
            theme: 'bible'
          });
          const pill = document.getElementById('on-air-pill-text');
          if (pill) pill.textContent = `${data.book} ${chapterNum}:${v.verse}`;
        });
        versesList.appendChild(item);
      });
    };

    // ── Botão "Carregar no Globo 3D" ──
    if (loadGlobeBtn) {
      loadGlobeBtn.addEventListener('click', async () => {
        if (selectedBookObj && window.bibleService) {
          await window.bibleService.loadPassageToOrbital(selectedBookObj.abbrev, selectedChapterNum || 1, 1);
          closeModal();
        }
      });
    }

    // ── Busca no Modal ──
    const executeSearch = async (query) => {
      const q = (query || (modalSearchInput ? modalSearchInput.value : '')).trim();
      if (!q || !window.bibleService) return;

      const ref = window.bibleService.parseReference(q);
      if (ref) {
        const b = window.bibleService.books.find(item => item.abbrev === ref.abbrev);
        if (b) {
          selectedBookObj = b;
          selectedChapterNum = ref.chapter;
          currentTab = b.book_order <= 39 ? 'ot' : 'nt';
          if (currentTab === 'ot') {
            if (tabOt) tabOt.classList.add('active');
            if (tabNt) tabNt.classList.remove('active');
          } else {
            if (tabNt) tabNt.classList.add('active');
            if (tabOt) tabOt.classList.remove('active');
          }
          renderBooks();
          renderChapters(b);
          await loadChapterVerses(b.abbrev, ref.chapter);
          return;
        }
      }

      if (versesList) {
        versesList.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">Buscando ocorrências...</div>';
      }
      const results = await window.bibleService.search(q);
      if (!versesList) return;
      versesList.innerHTML = '';

      const vTitle = document.getElementById('bible-verses-header-title');
      const vSub = document.getElementById('bible-verses-header-sub');
      if (vTitle) vTitle.textContent = `BUSCA: "${q.toUpperCase()}"`;
      if (vSub) vSub.textContent = `${results.length} resultados encontrados`;

      if (results.length === 0) {
        versesList.innerHTML = '<div style="padding:30px;text-align:center;color:#94a3b8;">Nenhum versículo encontrado para essa pesquisa.</div>';
        return;
      }

      results.forEach(res => {
        const item = document.createElement('div');
        item.className = 'bible-verse-item';
        const refStr = res.verse.reference || `${res.book.name} ${res.chapter.number}:${res.verse.number}`;
        item.innerHTML = `
          <div class="bible-verse-num" style="font-size:0.7rem; min-width:60px;">${refStr}</div>
          <div class="bible-verse-text">${res.verse.text}</div>
          <div class="bible-verse-actions">
            <button class="hud-btn-sm" style="background:#a855f7; border-color:#c084fc; color:#fff; padding:3px 8px; font-size:0.75rem;">
              PROJETAR
            </button>
          </div>
        `;
        item.addEventListener('click', async () => {
          await window.bibleService.loadPassageToOrbital(res.book.abbrev, res.chapter.number, res.verse.number);
          closeModal();
          window.projectionSync.projectSlide({
            header: refStr.toUpperCase(),
            text: res.verse.text,
            subtitle: `${res.book.name} (${window.bibleService.selectedVersion.toUpperCase()})`,
            theme: 'bible'
          });
          const pill = document.getElementById('on-air-pill-text');
          if (pill) pill.textContent = refStr;
        });
        versesList.appendChild(item);
      });
    };

    if (searchExecBtn) searchExecBtn.addEventListener('click', () => executeSearch());
    if (modalSearchInput) {
      modalSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeSearch();
        }
      });
    }

    // ── Histórico Recente ──
    const renderHistory = () => {
      if (!historyTags || !window.bibleService) return;
      historyTags.innerHTML = '';
      const list = window.bibleService.getHistory();
      if (list.length === 0) {
        historyTags.innerHTML = '<span style="font-size:0.75rem; color:#64748b;">Nenhuma passagem recente.</span>';
        return;
      }
      list.slice(0, 8).forEach(h => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bible-history-chip';
        chip.textContent = `${h.book} ${h.chapter}:${h.verse}`;
        chip.addEventListener('click', async () => {
          await window.bibleService.loadPassageToOrbital(h.abbrev, h.chapter, h.verse, h.version);
          closeModal();
        });
        historyTags.appendChild(chip);
      });
    };
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
      const fitMode = window.electronAPI.getPref('slideState_bgFit_telao') || 'cover';
      let bgSize = 'cover';
      let objFit = 'cover';
      if (fitMode === 'contain') { bgSize = 'contain'; objFit = 'contain'; }
      else if (fitMode === 'stretch') { bgSize = '100% 100%'; objFit = 'fill'; }
      else if (fitMode === 'width') { bgSize = '100% auto'; objFit = 'cover'; }

      const bgLayer = document.createElement("div");
      bgLayer.className = "on-air-bg-layer";
      bgLayer.style.cssText = "position:absolute; inset:0; z-index:0; border-radius:inherit; overflow:hidden; opacity:1; pointer-events:none; transition: opacity 0.3s ease;";

      if (kind === "color") {
        bgLayer.style.backgroundColor = url;
      } else if (kind === "image") {
        bgLayer.style.backgroundImage = `url("${url}")`;
        bgLayer.style.backgroundSize = bgSize;
        bgLayer.style.backgroundPosition = "center";
        bgLayer.style.backgroundRepeat = "no-repeat";
      } else if (kind === "video") {
        const vid = document.createElement("video");
        vid.src = url;
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.style.cssText = `width:100%; height:100%; object-fit:${objFit};`;
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
  if (window.slideTelemetry && typeof window.slideTelemetry.syncMiniPreviewBg === 'function') {
    window.slideTelemetry.syncMiniPreviewBg();
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

window.updateCardAspectRatio = async function() {
  if (window.electronAPI && typeof window.electronAPI.getScreens === 'function') {
    const telaoMonitorId = window.electronAPI.getPref('slideState_monitor_telao');
    if (!telaoMonitorId) return;
    const screens = await window.electronAPI.getScreens();
    const telaoScreen = screens.find(s => String(s.id) === String(telaoMonitorId));
    if (telaoScreen) {
      const ratio = telaoScreen.bounds.width / telaoScreen.bounds.height;
      document.documentElement.style.setProperty('--card-aspect-ratio', ratio);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (window.updateCardAspectRatio) {
    window.updateCardAspectRatio();
  }
});
