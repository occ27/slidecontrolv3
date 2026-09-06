/**
 * SlideControl V3 — Gerenciador Visual de Telas Multi-Monitor
 * Arquitetura portada e aprimorada do SlideControl V2 com suporte a Drag & Drop nativo.
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnManageScreens = document.getElementById('btn-manage-screens');
  const btnCloseScreenManager = document.getElementById('btn-close-screen-manager');
  const modalScreenManager = document.getElementById('modal-screen-manager');
  const screenList = document.getElementById('screen-list');

  if (btnManageScreens) {
    btnManageScreens.addEventListener('click', () => {
      if (modalScreenManager) {
        modalScreenManager.classList.remove('hidden');
        loadScreens();
      }
    });
  }

  if (btnCloseScreenManager) {
    btnCloseScreenManager.addEventListener('click', () => {
      if (modalScreenManager) {
        modalScreenManager.classList.add('hidden');
        if (screenList) screenList.innerHTML = '';
      }
    });
  }

  if (modalScreenManager) {
    modalScreenManager.addEventListener('click', (e) => {
      if (e.target === modalScreenManager) {
        modalScreenManager.classList.add('hidden');
        if (screenList) screenList.innerHTML = '';
      }
    });
  }

  // Atalho F10 ou shift+M para abrir o gerenciador
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F10' || (e.shiftKey && e.key === 'T')) {
      e.preventDefault();
      if (modalScreenManager) {
        if (modalScreenManager.classList.contains('hidden')) {
          modalScreenManager.classList.remove('hidden');
          loadScreens();
        } else {
          modalScreenManager.classList.add('hidden');
          if (screenList) screenList.innerHTML = '';
        }
      }
    }
  });

  async function loadScreens() {
    if (!screenList) return;
    screenList.innerHTML = '<div style="color: rgba(255,255,255,0.6); text-align: center; padding: 20px;">Detectando monitores conectados...</div>';

    // Suporte a Electron ou modo de demonstração no Navegador
    if (!window.electronAPI || !window.electronAPI.getScreens) {
      screenList.innerHTML = `
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; text-align: center;">
          <p style="color: #00f0ff; font-weight: 600; margin-bottom: 8px;">ℹ️ Modo Navegador Web Detectado</p>
          <p style="color: rgba(255,255,255,0.7); font-size: 13px;">O gerenciamento de telas físicas de alta precisão funciona no <strong>App Desktop Electron nativo</strong>.</p>
        </div>
      `;
      return;
    }

    try {
      const monitors = await window.electronAPI.getScreens();
      const openScreens = await window.electronAPI.getOpenScreens();
      const isTelaoOpen = openScreens.includes('telao');
      const isRetornoOpen = openScreens.includes('retorno');

      let assignedTelao = window.electronAPI.getPref('slideState_monitor_telao');
      let assignedRetorno = window.electronAPI.getPref('slideState_monitor_retorno');

      screenList.innerHTML = '';

      // Barra de ferramentas superior: Botão Identificar Telas
      const topBar = document.createElement('div');
      topBar.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;';

      const btnIdentify = document.createElement('button');
      btnIdentify.className = 'hud-btn';
      btnIdentify.innerHTML = '<span>⚡ Identificar Monitores Físicos</span>';
      btnIdentify.style.cssText = 'background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.4); color: #00f0ff; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;';
      btnIdentify.onclick = () => window.electronAPI.identifyScreens();
      topBar.appendChild(btnIdentify);

      const tipText = document.createElement('span');
      tipText.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.5);';
      tipText.textContent = '💡 Dica: Arraste a tag do Telão ou Retorno para o monitor desejado.';
      topBar.appendChild(tipText);

      screenList.appendChild(topBar);

      // Calcular limites virtuais de todos os monitores conectados
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      monitors.forEach(m => {
        minX = Math.min(minX, m.bounds.x);
        minY = Math.min(minY, m.bounds.y);
        maxX = Math.max(maxX, m.bounds.x + m.bounds.width);
        maxY = Math.max(maxY, m.bounds.y + m.bounds.height);
      });
      const totalVW = Math.max(1, maxX - minX);
      const totalVH = Math.max(1, maxY - minY);

      const modalWidth = modalScreenManager.querySelector('.modal-content')?.clientWidth || 760;
      let availW = Math.min(modalWidth - 48, 860);
      let CONTAINER_W = availW;
      let CONTAINER_H = Math.round(CONTAINER_W * (totalVH / totalVW));

      const MAX_HEIGHT = 280;
      if (CONTAINER_H > MAX_HEIGHT) {
        CONTAINER_H = MAX_HEIGHT;
        CONTAINER_W = Math.round(CONTAINER_H * (totalVW / totalVH));
      }

      const scaleFactor = CONTAINER_W / totalVW;

      function getAspectLabel(w, h) {
        const r = w / h;
        if (Math.abs(r - 16 / 9) < 0.04) return "16:9";
        if (Math.abs(r - 16 / 10) < 0.07) return "16:10";
        if (Math.abs(r - 4 / 3) < 0.04) return "4:3";
        if (Math.abs(r - 21 / 9) < 0.08) return "21:9";
        if (Math.abs(r - 3 / 2) < 0.04) return "3:2";
        return `${r.toFixed(2)}:1`;
      }

      const visualContainer = document.createElement('div');
      visualContainer.style.cssText = `
        position: relative; width: ${CONTAINER_W}px; height: ${CONTAINER_H}px;
        margin: 0 auto 16px; background: rgba(5, 10, 20, 0.6); border-radius: 12px;
        border: 1px solid rgba(0, 240, 255, 0.2); box-sizing: border-box; overflow: hidden;
      `;

      // Renderizar retângulos em escala para cada monitor
      monitors.forEach((m, i) => {
        const thumbX = Math.round((m.bounds.x - minX) * scaleFactor);
        const thumbY = Math.round((m.bounds.y - minY) * scaleFactor);
        const thumbW = Math.round(m.bounds.width * scaleFactor);
        const thumbH = Math.round(m.bounds.height * scaleFactor);

        const monAspect = getAspectLabel(m.bounds.width, m.bounds.height);
        const monDiv = document.createElement('div');
        monDiv.style.cssText = `
          position: absolute; left: ${thumbX}px; top: ${thumbY}px;
          width: ${thumbW}px; height: ${thumbH}px;
          border: 2px solid rgba(0, 240, 255, 0.35); border-radius: 8px;
          background: radial-gradient(circle at center, #0f172a 0%, #030712 100%);
          box-sizing: border-box; display: flex; align-items: center; justify-content: center;
          overflow: hidden; transition: all 0.2s; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        monDiv.innerHTML = `
          <div style="position:absolute; top:8px; left:8px; display:flex; align-items:center; gap:6px; z-index:10;">
            <span style="background: rgba(0, 240, 255, 0.2); color:#00f0ff; border: 1px solid rgba(0,240,255,0.4); padding:2px 8px; border-radius:4px; font-size:11px; font-weight: 700;">
              Monitor ${i + 1} (${m.bounds.width}×${m.bounds.height})
            </span>
            <span style="background: rgba(255, 255, 255, 0.08); color:rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.15); padding:2px 6px; border-radius:4px; font-size:10px; font-weight: 600;">
              ${monAspect}
            </span>
          </div>
        `;

        if (m.isOperador) {
          const operadorTag = document.createElement('div');
          operadorTag.style.cssText = `position: absolute; bottom: 8px; right: 8px; background: #10b981; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; z-index: 50; display: flex; align-items: center; gap: 4px; pointer-events: none;`;
          operadorTag.innerHTML = `⚙️ Operador`;
          monDiv.appendChild(operadorTag);
        }

        // Preview ao vivo em iframe se for monitor atribuído
        if (String(assignedTelao) === String(m.id) && isTelaoOpen) {
          const iframeScale = thumbW / m.bounds.width;
          const iframe = document.createElement('iframe');
          iframe.src = 'display.html?mode=screen-manager';
          iframe.style.cssText = `position: absolute; top: 0; left: 0; width: ${m.bounds.width}px; height: ${m.bounds.height}px; transform: scale(${iframeScale}); transform-origin: top left; border: none; pointer-events: none; opacity: 0.85; z-index: 1;`;
          monDiv.appendChild(iframe);
        }

        if (String(assignedRetorno) === String(m.id) && isRetornoOpen) {
          const iframeScale = thumbW / m.bounds.width;
          const iframe = document.createElement('iframe');
          iframe.src = 'retorno.html?mode=screen-manager';
          iframe.style.cssText = `position: absolute; top: 0; left: 0; width: ${m.bounds.width}px; height: ${m.bounds.height}px; transform: scale(${iframeScale}); transform-origin: top left; border: none; pointer-events: none; opacity: 0.85; z-index: 1;`;
          monDiv.appendChild(iframe);
        }

        // Eventos de Drag and Drop
        monDiv.addEventListener('dragover', (e) => {
          e.preventDefault();
          monDiv.style.borderColor = '#00f0ff';
          monDiv.style.background = 'rgba(0, 240, 255, 0.1)';
        });

        monDiv.addEventListener('dragleave', () => {
          monDiv.style.borderColor = 'rgba(255, 255, 255, 0.25)';
          monDiv.style.background = '#070d18';
        });

        monDiv.addEventListener('drop', async (e) => {
          e.preventDefault();
          monDiv.style.borderColor = 'rgba(255, 255, 255, 0.25)';
          monDiv.style.background = '#070d18';
          const tagId = e.dataTransfer.getData('text/plain');

          if (tagId === 'telao') {
            window.electronAPI.setPref('slideState_monitor_telao', m.id);
            await window.electronAPI.assignScreen('telao', m.id);
            loadScreens();
          } else if (tagId === 'retorno') {
            window.electronAPI.setPref('slideState_monitor_retorno', m.id);
            await window.electronAPI.assignScreen('retorno', m.id);
            loadScreens();
          }
        });

        visualContainer.appendChild(monDiv);
      });

      // Zona de Tags Arrastáveis abaixo da área de monitores
      const tagZone = document.createElement('div');
      tagZone.style.cssText = `display: flex; gap: 14px; justify-content: center; align-items: center; margin: 0 auto 16px; padding: 10px 16px; background: rgba(5, 10, 20, 0.7); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 10px; max-width: ${Math.max(CONTAINER_W, 400)}px; box-sizing: border-box;`;

      // Tag Telão
      const telaoTag = document.createElement('div');
      telaoTag.draggable = true;
      telaoTag.style.cssText = `
        background: ${isTelaoOpen ? '#0284c7' : 'rgba(255,255,255,0.15)'};
        color: #fff; padding: 5px 12px; border-radius: 6px; cursor: grab; font-size: 13px; font-weight: 700;
        display: flex; align-items: center; gap: 8px; z-index: 50; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      `;
      telaoTag.innerHTML = `<span>🖥️ Telão ${isTelaoOpen ? '(No Ar)' : '(Inativo)'}</span>`;

      if (isTelaoOpen) {
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = "&times;";
        closeBtn.title = "Fechar Telão";
        closeBtn.style.cssText = "cursor: pointer; background: rgba(255,255,255,0.25); border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 900;";
        closeBtn.onclick = async (e) => {
          e.stopPropagation();
          await window.electronAPI.closeScreen('telao');
          loadScreens();
        };
        telaoTag.appendChild(closeBtn);
      }

      telaoTag.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', 'telao'));

      if (assignedTelao && isTelaoOpen) {
        const assignedMonitor = monitors.findIndex(m => String(m.id) === String(assignedTelao));
        if (assignedMonitor !== -1) {
          const m = monitors[assignedMonitor];
          const thumbX = Math.round((m.bounds.x - minX) * scaleFactor);
          const thumbY = Math.round((m.bounds.y - minY) * scaleFactor);
          telaoTag.style.position = 'absolute';
          telaoTag.style.left = `${thumbX + 10}px`;
          telaoTag.style.top = `${thumbY + 34}px`;
          visualContainer.appendChild(telaoTag);
        } else {
          tagZone.appendChild(telaoTag);
        }
      } else {
        tagZone.appendChild(telaoTag);
      }

      // Tag Retorno
      const retornoTag = document.createElement('div');
      retornoTag.draggable = true;
      retornoTag.style.cssText = `
        background: ${isRetornoOpen ? '#9333ea' : 'rgba(255,255,255,0.15)'};
        color: #fff; padding: 5px 12px; border-radius: 6px; cursor: grab; font-size: 13px; font-weight: 700;
        display: flex; align-items: center; gap: 8px; z-index: 50; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      `;
      retornoTag.innerHTML = `<span>🎤 Retorno ${isRetornoOpen ? '(No Ar)' : '(Inativo)'}</span>`;

      if (isRetornoOpen) {
        const closeBtn = document.createElement('span');
        closeBtn.innerHTML = "&times;";
        closeBtn.title = "Fechar Retorno";
        closeBtn.style.cssText = "cursor: pointer; background: rgba(255,255,255,0.25); border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 900;";
        closeBtn.onclick = async (e) => {
          e.stopPropagation();
          await window.electronAPI.closeScreen('retorno');
          loadScreens();
        };
        retornoTag.appendChild(closeBtn);
      }

      retornoTag.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', 'retorno'));

      if (assignedRetorno && isRetornoOpen) {
        const assignedMonitor = monitors.findIndex(m => String(m.id) === String(assignedRetorno));
        if (assignedMonitor !== -1) {
          const m = monitors[assignedMonitor];
          const thumbX = Math.round((m.bounds.x - minX) * scaleFactor);
          const thumbY = Math.round((m.bounds.y - minY) * scaleFactor);
          retornoTag.style.position = 'absolute';
          retornoTag.style.left = `${thumbX + 10}px`;
          const topOffset = (assignedTelao === assignedRetorno && isTelaoOpen) ? 68 : 34;
          retornoTag.style.top = `${thumbY + topOffset}px`;
          visualContainer.appendChild(retornoTag);
        } else {
          tagZone.appendChild(retornoTag);
        }
      } else {
        tagZone.appendChild(retornoTag);
      }

      screenList.appendChild(visualContainer);
      screenList.appendChild(tagZone);

      // Vincular preferências de checkboxes
      setupConfigPreferences();

    } catch (err) {
      screenList.innerHTML = `<div style="color: #ef4444; padding: 12px;">Erro ao carregar monitores: ${err.message}</div>`;
    }
  }

  function setupConfigPreferences() {
    const configs = [
      { id: 'telao-cfg-text', key: 'slideState_cfg_telao_text', def: true },
      { id: 'telao-cfg-footer', key: 'slideState_cfg_telao_footer', def: true },
      { id: 'retorno-cfg-clock', key: 'slideState_cfg_retorno_clock', def: true },
      { id: 'retorno-cfg-current', key: 'slideState_cfg_retorno_current', def: true },
      { id: 'retorno-cfg-next', key: 'slideState_cfg_retorno_next', def: true }
    ];

    configs.forEach(item => {
      const el = document.getElementById(item.id);
      if (el && window.electronAPI) {
        const saved = window.electronAPI.getPref(item.key);
        el.checked = saved !== null ? saved : item.def;
        el.onchange = () => {
          window.electronAPI.setPref(item.key, el.checked);
        };
      }
    });

    setupBgFitPickers();
  }

  function setupBgFitPickers() {
    setupBgFitPicker('telao-bg-fit-picker', 'telao');
    setupBgFitPicker('retorno-bg-fit-picker', 'retorno');
  }

  function setupBgFitPicker(pickerId, target) {
    const picker = document.getElementById(pickerId);
    if (!picker) return;

    const btns = picker.querySelectorAll('.bg-fit-option');
    const storageKey = 'slideState_bgFit_' + target;

    const applyVisual = (value) => {
      btns.forEach(b => b.classList.toggle('active', b.dataset.value === value));
    };

    const savedFit = (window.electronAPI && window.electronAPI.getPref(storageKey)) || 'width';
    applyVisual(savedFit);

    btns.forEach(btn => {
      btn.onclick = () => {
        const value = btn.dataset.value;
        applyVisual(value);
        if (window.electronAPI) {
          window.electronAPI.setPref(storageKey, value);
        }
        // Broadcast instantâneo para os displays
        const channel = new BroadcastChannel('slidecontrol_orbital_v3');
        channel.postMessage({ action: 'SET_BG_FIT', target, value });
      };
    });
  }
});
