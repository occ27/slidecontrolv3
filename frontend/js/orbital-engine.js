/**
 * SLIDECONTROL V3 — O MOTOR DE TRILHAS ESFÉRICAS PERFEITAS
 * - Texto 100% legível (SEM espelhamento/mirroring)
 * - TODOS os cards visíveis na tela são CLICÁVEIS!
 * - Ao clicar em QUALQUER card visível, o sistema traz aquele card e seu anel
 *   imediatamente para o centro do Equador e projeta no telão.
 */

class SphericalSurfaceEngine {
  constructor(webglContainerId, css3dContainerId) {
    this.webglContainer = document.getElementById(webglContainerId);
    this.css3dContainer = document.getElementById(css3dContainerId);

    this.radius = 820; // Raio da esfera em pixels
    this.cardAngleStep = THREE.MathUtils.degToRad(34); // ~34° entre cartões

    // ── 3 TRILHAS DE LATITUDE ──
    // 0: Norte (Bíblia Sagrada)
    // 1: Equador (Louvor & Slides)
    // 2: Sul (Cabine & Controles)
    this.activeRow = 1;
    this.verticalOffset = 1.0; // Posição vertical contínua (0, 1 ou 2)

    this.activeChunkIndex = 0;
    this.activeCardObj = null;

    this.rows = [
      { id: 'bible', name: 'Bíblia Sagrada', scrollIndex: 0, targetScroll: 0, cards: [] },
      { id: 'songs', name: 'Louvor & Slides', scrollIndex: 0, targetScroll: 0, cards: [] },
      { id: 'controls', name: 'Cabine & Controles', scrollIndex: 0, targetScroll: 0, cards: [] }
    ];

    // Controle de interação por arrasto
    this.isDragging = false;
    this.hasDragged = false;
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.dragAxis = null;
    this.dragStartScroll = 0;
    this.dragStartVertical = 0;
    this.lastWheelTime = 0;
    window.orbitalEngine = this;

    this.initRenderers();
    this.createAtmosphereSphere();
    this.populateAllRows();
    this.initEvents();
    this.updateCardPositions();
    this.animate();
  }

  initRenderers() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 4000);
    this.camera.position.set(0, 0, 1680);

    // Cena WebGL fixa
    this.sceneWebGL = new THREE.Scene();
    this.rendererWebGL = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.rendererWebGL.setSize(width, height);
    this.rendererWebGL.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webglContainer.appendChild(this.rendererWebGL.domElement);

    // Cena CSS3D (Cartões)
    this.sceneCSS = new THREE.Scene();
    this.rendererCSS = new THREE.CSS3DRenderer();
    this.rendererCSS.setSize(width, height);
    this.css3dContainer.appendChild(this.rendererCSS.domElement);

    this.tracksGroupCSS = new THREE.Group();
    this.sceneCSS.add(this.tracksGroupCSS);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  createAtmosphereSphere() {
    const particleCount = 1800;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      positions[i * 3] = this.radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = this.radius * Math.cos(phi);
      positions[i * 3 + 2] = this.radius * Math.sin(phi) * Math.sin(theta);

      const latRatio = Math.abs(positions[i * 3 + 1] / this.radius);
      const isNorth = positions[i * 3 + 1] > 0;
      const targetColor = isNorth ? new THREE.Color(0x8b5cf6) : new THREE.Color(0xf59e0b);
      const c = new THREE.Color().lerpColors(
        new THREE.Color(0x00f0ff),
        targetColor,
        latRatio
      );

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(geo, mat);
    this.sceneWebGL.add(this.points);

    // Anel central de palco luminoso no Equador
    const stageRingGeo = new THREE.TorusGeometry(this.radius * 1.008, 2.0, 8, 120);
    const stageRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35
    });
    this.stageRing = new THREE.Mesh(stageRingGeo, stageRingMat);
    this.stageRing.rotation.x = Math.PI / 2;
    this.sceneWebGL.add(this.stageRing);

    // Anéis de contorno esférico nos paralelos Norte (Bíblia) e Sul (Controles)
    const latAngle = THREE.MathUtils.degToRad(24.5);
    const rParallel = this.radius * Math.cos(latAngle) * 1.006;
    const yParallel = this.radius * Math.sin(latAngle);

    // Anel Norte (Bíblia) — Tom de ametista suave com halo celestial
    const northRingGeo = new THREE.TorusGeometry(rParallel, 1.3, 8, 120);
    const northRingMat = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.32
    });
    const northRing = new THREE.Mesh(northRingGeo, northRingMat);
    northRing.position.y = yParallel;
    northRing.rotation.x = Math.PI / 2;
    this.sceneWebGL.add(northRing);

    // Halo difuso para suavizar visualmente o Polo Norte
    const northHaloGeo = new THREE.TorusGeometry(rParallel, 3.2, 8, 120);
    const northHaloMat = new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      transparent: true,
      opacity: 0.12
    });
    const northHalo = new THREE.Mesh(northHaloGeo, northHaloMat);
    northHalo.position.y = yParallel;
    northHalo.rotation.x = Math.PI / 2;
    this.sceneWebGL.add(northHalo);

    // Anel Sul (Controles)
    const southRingGeo = new THREE.TorusGeometry(rParallel, 1.4, 8, 120);
    const southRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.22
    });
    const southRing = new THREE.Mesh(southRingGeo, southRingMat);
    southRing.position.y = -yParallel;
    southRing.rotation.x = Math.PI / 2;
    this.sceneWebGL.add(southRing);
  }

  populateAllRows() {
    // ── TRILHA 0: BÍBLIA SAGRADA (NORTE) ──
    const bibleData = [
      { tag: 'JOÃO 3:16', title: 'Bíblia Sagrada', reference: 'João 3:16 — ACF', text: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.', theme: 'bible', verseNum: 16, bookName: 'João', chapterNum: 3, version: 'ACF' },
      { tag: 'JOÃO 3:17', title: 'Bíblia Sagrada', reference: 'João 3:17 — ACF', text: 'Porque Deus enviou o seu Filho ao mundo, não para que condenasse o mundo, mas para que o mundo fosse salvo por ele.', theme: 'bible', verseNum: 17, bookName: 'João', chapterNum: 3, version: 'ACF' },
      { tag: 'SALMOS 23:1-3', title: 'Bíblia Sagrada', reference: 'Salmos 23:1-3 — ACF', text: 'O Senhor é o meu pastor; nada me faltará.\nDeitar-me faz em verdes pastos, guia-me mansamente a águas tranqüilas.\nRefrigera a minha alma.', theme: 'bible', verseNum: '1-3', bookName: 'Salmos', chapterNum: 23, version: 'ACF' },
      { tag: 'FILIPENSES 4:13', title: 'Bíblia Sagrada', reference: 'Filipenses 4:13 — ACF', text: 'Posso todas as coisas naquele que me fortalece.\n\nE a paz de Deus guardará os vossos corações.', theme: 'bible', verseNum: 13, bookName: 'Filipenses', chapterNum: 4, version: 'ACF' },
      { tag: '1 CORÍNTIOS 13:13', title: 'Bíblia Sagrada', reference: '1 Coríntios 13:13 — ACF', text: 'Agora, pois, permanecem a fé, a esperança e o amor, estes três;\nmas o maior destes é o amor.', theme: 'bible', verseNum: 13, bookName: '1 Coríntios', chapterNum: 13, version: 'ACF' },
      { tag: 'ROMANOS 8:28', title: 'Bíblia Sagrada', reference: 'Romanos 8:28 — ACF', text: 'E sabemos que todas as coisas concorrem para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito.', theme: 'bible', verseNum: 28, bookName: 'Romanos', chapterNum: 8, version: 'ACF' }
    ];

    // ── TRILHA 1: LOUVOR & SLIDES DO CULTO (EQUADOR) ──
    const songsData = [
      { tag: 'ESTROFE 1', title: 'Porque Ele Vive', text: 'Deus enviou seu Filho amado\nPara morrer em meu lugar\nNa cruz pagou por meus pecados\nMas o sepulcro vazio está porque Ele vive', theme: 'song' },
      { tag: 'REFRÃO', title: 'Porque Ele Vive', text: 'Porque Ele vive, eu posso crer no amanhã\nPorque Ele vive, temor não há\nMas eu bem sei, eu sei que a minha vida\nEstá nas mãos do meu Jesus, que vivo está', theme: 'song' },
      { tag: 'ESTROFE 2', title: 'Porque Ele Vive', text: 'E quando, enfim, chegar a hora\nEm que a morte enfrentarei\nSem medo, então, terei vitória\nIrei nas glórias ver meu Jesus, que vivo está', theme: 'song' },
      { tag: 'REFRÃO FINAL', title: 'Porque Ele Vive', text: 'Porque Ele vive, eu posso crer no amanhã\nPorque Ele vive, temor não há!\nEstá nas mãos do meu Jesus, que vivo está!', theme: 'song' },
      { tag: 'ESTROFE 1', title: 'Grandioso És Tu', text: 'Senhor meu Deus, quando eu maravilhado\nFico a pensar nas obras de tuas mãos\nNo céu azul de estrelas pontilhado\nO teu poder mostrando a criação', theme: 'song' },
      { tag: 'REFRÃO', title: 'Grandioso És Tu', text: 'Então minh’alma canta a ti, Senhor\nGrandioso és tu! Grandioso és tu!\nEntão minh’alma canta a ti, Senhor\nGrandioso és tu! Grandioso és tu!', theme: 'song' },
      { tag: 'ABERTURA', title: 'Culto de Celebração', text: 'Sejam todos bem-vindos à Casa do Senhor!\n\n"Alegrei-me quando me disseram:\nVamos à casa do Senhor." (Sl 122:1)', theme: 'song' },
      { tag: 'ORAÇÃO', title: 'Intercessão Coletiva', text: 'Momento de Oração e Quebrantamento\n\n"Clama a mim, e responder-te-ei,\ne anunciar-te-ei coisas grandes e ocultas."\n(Jeremias 33:3)', theme: 'song' }
    ];

    // ── TRILHA 2: CABINE & CONTROLES MESTRES (SUL) ──
    const controlsData = [
      { tag: 'CABINE MASTER', title: 'Emergência Telão', isControlCard: true, theme: 'control' },
      { tag: 'ALERTAS RÁPIDOS', title: 'Avisos Overlay', isAlertCard: true, theme: 'control' },
      { tag: 'CRONÔMETRO DO PALCO', title: 'Monitor de Retorno', isStageCard: true, theme: 'control' },
      { tag: 'HARDWARE TELÃO', title: 'Saídas HDMI 1 & 2', isHardwareCard: true, theme: 'control' }
    ];

    [bibleData, songsData, controlsData].forEach((dataList, rowIdx) => {
      dataList.forEach((item, cardIdx) => {
        const cardObj = this.createCardDOM(item, rowIdx, cardIdx);
        this.rows[rowIdx].cards.push(cardObj);
      });
    });

    if (window.slideTelemetry) {
      const activeRowObj = this.rows[this.activeRow];
      const currentLatDeg = (1 - this.verticalOffset) * 24.5;
      const currentLonDeg = -(activeRowObj ? activeRowObj.scrollIndex : 0) * 34.0;
      window.slideTelemetry.updateCoordinates(currentLatDeg, currentLonDeg, this.isDragging);
    }
  }

  // ── CARREGAMENTO DINÂMICO DE VERSÍCULOS DA BÍBLIA NA TRILHA NORTE ──
  loadBibleCards(versesList, bookName, chapterNum, versionAbbrev = 'ACF', focusVerseNum = 1, autoProject = true) {
    if (!versesList || !versesList.length) return;
    const rowIdx = 0; // Trilha Norte
    const row = this.rows[rowIdx];

    // Remove da cena CSS3D os cartões anteriores desta trilha
    row.cards.forEach(card => {
      if (card.object) {
        this.tracksGroupCSS.remove(card.object);
      }
      if (card.element && card.element.parentNode) {
        card.element.parentNode.removeChild(card.element);
      }
    });
    row.cards = [];
    row.scrollIndex = 0;
    row.targetScroll = 0;

    let focusCardIdx = 0;
    versesList.forEach((item, cardIdx) => {
      const vNum = item.verse || (cardIdx + 1);
      const reference = `${bookName} ${chapterNum}:${vNum} — ${versionAbbrev.toUpperCase()}`;
      const data = {
        tag: `${bookName.toUpperCase()} ${chapterNum}:${vNum}`,
        title: `${bookName} ${chapterNum} (${versionAbbrev.toUpperCase()})`,
        reference: reference,
        text: item.text,
        theme: 'bible',
        verseNum: vNum,
        bookName: bookName,
        chapterNum: chapterNum,
        version: versionAbbrev.toUpperCase()
      };
      if (Number(vNum) === Number(focusVerseNum)) {
        focusCardIdx = cardIdx;
      }
      const cardObj = this.createCardDOM(data, rowIdx, cardIdx);
      row.cards.push(cardObj);
    });

    row.scrollIndex = focusCardIdx;
    row.targetScroll = focusCardIdx;

    const badge = document.querySelector('#cat-north .cat-badge');
    if (badge) badge.textContent = versesList.length;

    // Foca na Trilha Norte e centraliza o versículo desejado
    this.setRow(0);
    this.snapToCard(0, focusCardIdx);
    this.updateCardPositions();

    if (autoProject) {
      const targetCard = row.cards[focusCardIdx];
      if (targetCard && targetCard.element) {
        this.onCardClicked(targetCard.data, targetCard.element, 0, focusCardIdx, true);
      }
    }
  }

  createCardDOM(data, rowIdx, cardIdx) {
    const el = document.createElement('div');
    el.className = `globe-card theme-${data.theme}`;
    el.dataset.rowIdx = rowIdx;
    el.dataset.cardIdx = cardIdx;

    if (data.isControlCard) {
      el.innerHTML = `
        <div class="card-top-row">
          <span class="card-tag">CABINE MASTER</span>
          <span class="card-status-badge">PRONTO</span>
        </div>
        <div class="control-buttons-grid">
          <button class="ctrl-btn highlight" onclick="document.getElementById('btn-manage-screens')?.click()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <span>GERENCIAR TELAS</span>
          </button>
          <button id="btn-blackout" class="ctrl-btn danger" onclick="window.projectionSync.toggleBlackout()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /></svg>
            <span>BLACKOUT [F2]</span>
          </button>
          <button id="btn-clear-text" class="ctrl-btn warning" onclick="window.projectionSync.toggleClearText()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
            <span>LIMPAR TEXTO [F3]</span>
          </button>
          <button id="btn-logo" class="ctrl-btn" onclick="window.projectionSync.toggleLogo()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path stroke-linecap="round" stroke-linejoin="round" d="M21 15l-3.086-3.086a2 2 0 00-2.828 0L6 21" /></svg>
            <span>LOGO [ESC]</span>
          </button>
        </div>
        <div class="card-footer">
          <span class="card-subtext">Teclas de atalho ativas</span>
        </div>
      `;
    } else if (data.isAlertCard) {
      el.innerHTML = `
        <div class="card-top-row">
          <span class="card-tag">ALERTAS RÁPIDOS</span>
          <span class="card-status-badge">OVERLAY</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <button class="ctrl-btn" style="justify-content:flex-start;" onclick="window.projectionSync.showAlert('Veículo placa ABC-1234 com farol aceso')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4zM5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11M3 11h18v5H3v-5z" /></svg>
            <span>Farol Aceso</span>
          </button>
          <button class="ctrl-btn" style="justify-content:flex-start;" onclick="window.projectionSync.showAlert('Mãe do berçário, favor comparecer')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <span>Berçário</span>
          </button>
          <button class="ctrl-btn" style="justify-content:flex-start;" onclick="window.projectionSync.showAlert('Por favor, desliguem os alarmes de carro')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span>Alarme Disparado</span>
          </button>
        </div>
        <div class="card-footer">
          <span class="card-subtext">Dispara banner de 10s no rodapé</span>
        </div>
      `;
    } else if (data.isStageCard) {
      el.innerHTML = `
        <div class="card-top-row">
          <span class="card-tag">MONITOR DO PALCO</span>
          <span class="card-status-badge">TEMPO</span>
        </div>
        <div style="text-align:center; padding:8px 0;">
          <div style="font-size:2.2rem; font-weight:800; font-family:monospace; color:#ffffff;">36:40</div>
          <span style="font-size:0.75rem; color:#94a3b8;">Previsão Término da Mensagem: 21h15</span>
        </div>
        <div class="card-footer">
          <button class="ctrl-btn" style="width:100%; justify-content:center;" onclick="window.projectionSync.showAlert('Pastores: 5 minutos restantes')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Avisar 5 min Restantes</span>
          </button>
        </div>
      `;
    } else if (data.isHardwareCard) {
      el.innerHTML = `
        <div class="card-top-row">
          <span class="card-tag">SAÍDAS DE VÍDEO</span>
          <span class="card-status-badge" style="color:#10b981;">NATIVO ELECTRON</span>
        </div>
        <div id="hardware-screens-list" style="font-size:0.82rem; color:#cbd5e1; line-height:1.45; min-height:48px;">
          • Detectando telas do sistema...
        </div>
        <div class="card-footer" style="display:flex; gap:6px;">
          <button class="ctrl-btn" style="flex:1; justify-content:center;" onclick="if(window.electronAPI) window.electronAPI.identifyScreens()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <span>Identificar</span>
          </button>
          <button class="btn-project-card" style="flex:1; justify-content:center;" onclick="window.projectionSync.openDisplayWindow()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <span>Abrir Telão</span>
          </button>
        </div>
      `;

      if (window.electronAPI && typeof window.electronAPI.getScreens === 'function') {
        window.electronAPI.getScreens().then(screens => {
          const list = el.querySelector('#hardware-screens-list');
          if (list) {
            list.innerHTML = screens.map(s => `• Monitor ${s.index}: ${s.bounds.width}x${s.bounds.height} ${s.isOperador ? '<span style="color:#00f0ff;">(Operador)</span>' : '<span style="color:#10b981;">(Telão HDMI)</span>'}`).join('<br>');
          }
        });
      } else {
        const list = el.querySelector('#hardware-screens-list');
        if (list) {
          list.innerHTML = `• Modo Web / Electron Híbrido<br>• Saída Telão via BroadcastChannel<br>• Latência: &lt; 1ms (Local)`;
        }
      }
    } else {
      let linesHtml = '';
      let lineCount = 0;
      if (data.text) {
        const rawLines = data.text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        lineCount = rawLines.length;
        linesHtml = rawLines.map((line, idx) => `<div class="card-line" data-line-idx="${idx}">${line}</div>`).join('');
      }

      const densityClass = lineCount > 6 ? 'dense-lines' : (lineCount > 4 ? 'compact-lines' : '');

      el.innerHTML = `
        <div class="card-top-row">
          <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
            <span class="card-tag">${data.tag}</span>
            <span class="card-chunk-badge" style="display:none;"></span>
          </div>
          <span class="card-status-badge">SLIDE</span>
        </div>
        <div class="card-main-text ${densityClass}">${linesHtml || data.text || ''}</div>
        <div class="card-chunk-steps" style="display:none;"></div>
        <div class="card-footer">
          <span class="card-subtext">${data.title}</span>
          <button class="btn-project-card">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
            <span>PROJETAR</span>
          </button>
        </div>
      `;

      // Linhas clicáveis para salto direto para a fatia correspondente
      el.querySelectorAll('.card-line').forEach(lineEl => {
        lineEl.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const lineIdx = parseInt(lineEl.dataset.lineIdx) || 0;
          this.onLineClicked(rowIdx, cardIdx, lineIdx);
        });
      });

      if (data.theme === 'song' && data.text) {
        const lim = this.getLinesLimit(data.theme);
        const initChunks = this.splitTextIntoChunks(data.text, lim);
        if (initChunks.length > 1) {
          const badge = el.querySelector('.card-chunk-badge');
          if (badge) {
            badge.textContent = `PARTE 1/${initChunks.length}`;
            badge.style.display = 'inline-flex';
          }
          const steps = el.querySelector('.card-chunk-steps');
          if (steps) {
            steps.style.display = 'flex';
            steps.innerHTML = initChunks.map((_, i) => `<span class="card-chunk-step-dot ${i === 0 ? 'active' : ''}"></span>`).join('');
          }
        }
      }
    }

    // ── CLIQUE GLOBAL NO CARD: TRAZ O CARD E SEU ANEL PARA O CENTRO DO GLOBO ──
    el.addEventListener('click', (e) => {
      // Se clicou em um botão interno específico (ex: Blackout, Alertas), deixa o botão agir
      if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('btn-project-card')) {
        // Se a trilha não estava no centro, traz ela também
        if (rowIdx !== this.activeRow) {
          this.setRow(rowIdx);
          this.snapToCard(rowIdx, cardIdx);
        }
        return;
      }

      this.onCardClicked(data, el, rowIdx, cardIdx);
    });

    const cssObj = new THREE.CSS3DObject(el);
    this.tracksGroupCSS.add(cssObj);

    return {
      data,
      element: el,
      object: cssObj,
      rowIdx,
      cardIdx
    };
  }

  // ── MÉTODOS DE CONTROLE E PROJEÇÃO DE LINHAS (CHUNKING) ──

  getLinesLimit(theme) {
    if (theme === 'bible') return 0;
    if (window.electronAPI && typeof window.electronAPI.getPref === 'function') {
      const saved = window.electronAPI.getPref('slideState_songs_linesLimit') || window.electronAPI.getPref('slideState_linesLimit');
      if (saved !== null && saved !== undefined) {
        return parseInt(saved) || 0;
      }
    }
    return 0;
  }

  splitTextIntoChunks(text, limit) {
    if (!text) return [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [{ text: '', lineIndices: [] }];
    const lim = parseInt(limit) || 0;
    if (lim <= 0 || lines.length <= lim) {
      return [{
        text: lines.join('\n'),
        lineIndices: lines.map((_, i) => i)
      }];
    }
    const chunks = [];
    for (let i = 0; i < lines.length; i += lim) {
      const slice = lines.slice(i, i + lim);
      const indices = [];
      for (let k = i; k < Math.min(i + lim, lines.length); k++) {
        indices.push(k);
      }
      chunks.push({
        text: slice.join('\n'),
        lineIndices: indices
      });
    }
    return chunks;
  }

  onLineClicked(rowIdx, cardIdx, lineIdx) {
    if (rowIdx !== this.activeRow) {
      this.setRow(rowIdx);
    }
    this.snapToCard(rowIdx, cardIdx);

    const cardObj = this.rows[rowIdx]?.cards[cardIdx];
    if (!cardObj || !cardObj.data || !cardObj.data.text) return;

    const limit = this.getLinesLimit(cardObj.data.theme);
    const chunks = this.splitTextIntoChunks(cardObj.data.text, limit);
    let targetChunk = 0;
    chunks.forEach((chunk, cIdx) => {
      if (chunk.lineIndices && chunk.lineIndices.includes(lineIdx)) {
        targetChunk = cIdx;
      }
    });

    this.projectCardChunk(cardObj, targetChunk, true);
  }

  jumpToChunk(chunkIndex) {
    if (!this.activeCardObj) return;
    this.projectCardChunk(this.activeCardObj, chunkIndex, true);
  }

  // AÇÃO AO CLICAR EM QUALQUER CARD VISÍVEL NO GLOBO
  onCardClicked(data, cardEl, rowIdx, cardIdx, force = false) {
    if (this.hasDragged && !force) return; // Ignora clique se o usuário estava arrastando a tela

    // 1. Se o card clicado está em outra linha (ex: na Bíblia acima ou nos Controles abaixo),
    // traz essa linha imediatamente para o centro do Equador!
    if (rowIdx !== this.activeRow) {
      this.setRow(rowIdx);
    }

    // 2. Alinha horizontalmente o cartão clicado exatamente no centro da visão
    this.snapToCard(rowIdx, cardIdx);

    // 3. Se for um slide de conteúdo (com texto), projeta a fatia adequada
    if (data.text) {
      const cardObj = this.rows[rowIdx]?.cards[cardIdx];
      if (cardObj) {
        let targetChunk = 0;
        // Se já era o cartão atualmente no ar e tem múltiplas fatias, avançar para a próxima fatia
        if (this.activeCardObj === cardObj && this.getLinesLimit(data.theme) > 0) {
          const chunks = this.splitTextIntoChunks(data.text, this.getLinesLimit(data.theme));
          if (this.activeChunkIndex < chunks.length - 1) {
            targetChunk = this.activeChunkIndex + 1;
          }
        }
        this.projectCardChunk(cardObj, targetChunk, force);
      }
    } else {
      if (window.slideTelemetry) {
        window.slideTelemetry.updateInspector(data);
      }
    }
  }

  projectCardChunk(cardObj, chunkIndex = 0, force = false) {
    if (!cardObj || !cardObj.data) return;
    const data = cardObj.data;
    const isBible = data.theme === 'bible';
    const limit = this.getLinesLimit(data.theme);
    const chunks = this.splitTextIntoChunks(data.text, limit);
    const totalChunks = chunks.length;

    chunkIndex = Math.max(0, Math.min(totalChunks - 1, chunkIndex));
    this.activeChunkIndex = chunkIndex;
    this.activeCardObj = cardObj;

    // Atualiza classe on-air
    document.querySelectorAll('.globe-card').forEach(c => {
      c.classList.remove('on-air');
      const oldBg = c.querySelector('.on-air-bg-layer');
      if (oldBg) oldBg.remove();
    });
    cardObj.element.classList.add('on-air');
    if (window.updateOnAirCardBg) window.updateOnAirCardBg();

    // Destaque visual das linhas ativas no cartão 3D
    const activeIndices = chunks[chunkIndex] ? chunks[chunkIndex].lineIndices : [];
    cardObj.element.querySelectorAll('.card-line').forEach(lEl => {
      const lIdx = parseInt(lEl.dataset.lineIdx);
      if (totalChunks > 1) {
        if (activeIndices.includes(lIdx)) {
          lEl.classList.add('active-chunk');
          lEl.classList.remove('dimmed-chunk');
        } else {
          lEl.classList.remove('active-chunk');
          lEl.classList.add('dimmed-chunk');
        }
      } else {
        lEl.classList.remove('active-chunk', 'dimmed-chunk');
      }
    });

    // Efeito Teleprompter: garante que as linhas ativas fiquem sempre 100% visíveis no centro do cartão
    setTimeout(() => {
      const activeLine = cardObj.element.querySelector('.card-line.active-chunk');
      if (activeLine) {
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    }, 40);

    // Indicador de partes (badge) no cabeçalho do cartão
    const badge = cardObj.element.querySelector('.card-chunk-badge');
    if (badge) {
      if (totalChunks > 1) {
        badge.textContent = `PARTE ${chunkIndex + 1}/${totalChunks}`;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // Indicador de passos/pontos no rodapé do cartão
    const steps = cardObj.element.querySelector('.card-chunk-steps');
    if (steps) {
      if (totalChunks > 1) {
        steps.style.display = 'flex';
        steps.innerHTML = chunks.map((_, i) => `<span class="card-chunk-step-dot ${i === chunkIndex ? 'active' : ''}"></span>`).join('');
      } else {
        steps.style.display = 'none';
      }
    }

    // Cálculo do texto do próximo slide para o Monitor de Retorno
    let nextText = '';
    if (chunkIndex < totalChunks - 1) {
      // Próxima fatia da MESMA estrofe
      nextText = chunks[chunkIndex + 1].text;
    } else {
      // Última fatia: busca a primeira fatia do PRÓXIMO cartão da mesma trilha
      const row = this.rows && this.rows[cardObj.rowIdx];
      if (row && row.cards && row.cards[cardObj.cardIdx + 1] && row.cards[cardObj.cardIdx + 1].data) {
        const nextCard = row.cards[cardObj.cardIdx + 1];
        if (nextCard.data.text) {
          const nextChunks = this.splitTextIntoChunks(nextCard.data.text, this.getLinesLimit(nextCard.data.theme));
          nextText = nextChunks.length > 0 ? nextChunks[0].text : (nextCard.data.text || '');
        }
      }
    }

    const ref = data.reference || (isBible ? `${data.bookName || ''} ${data.chapterNum || ''}:${data.verseNum || ''} — ${data.version || 'ACF'}`.trim() : '');
    const currentChunkText = (chunks[chunkIndex] && chunks[chunkIndex].text) ? chunks[chunkIndex].text : data.text;

    // Projeta no Telão e no Monitor de Retorno
    window.projectionSync.projectSlide({
      header: isBible ? '' : data.tag,
      text: currentChunkText,
      subtitle: isBible ? ref : data.title,
      reference: ref,
      caption: isBible ? ref : (data.title || data.tag),
      theme: data.theme,
      nextText: nextText,
      linesChunked: totalChunks > 1,
      chunkIndex: chunkIndex,
      totalChunks: totalChunks,
      rawText: data.text
    });

    // Atualiza a pílula de status no cabeçalho superior da UI
    const pill = document.getElementById('on-air-pill-text');
    if (pill) {
      if (isBible && ref) {
        pill.textContent = ref;
      } else {
        const partTag = totalChunks > 1 ? ` [${chunkIndex + 1}/${totalChunks}]` : '';
        pill.textContent = `${data.tag}${partTag} — ${data.title}`;
      }
    }

    // Se for Bíblia, atualiza o versículo e salva preferências
    if (isBible && window.bibleService) {
      window.bibleService.selectedVerse = Number(data.verseNum) || 1;
      window.bibleService.savePreferences();
    }

    // Atualiza o painel Inspetor à direita e o log do console
    if (window.slideTelemetry) {
      window.slideTelemetry.updateInspector(data, chunkIndex, chunks, limit);
      const logTag = `${data.tag}${totalChunks > 1 ? ` [${chunkIndex + 1}/${totalChunks}]` : ''}`;
      window.slideTelemetry.appendLog(logTag, `Projetado no Telão: "${(isBible && ref) ? ref : data.title}"`, 'success');
    }
  }

  // ── NAVEGAÇÃO HÍBRIDA POR TECLADO (CHUNKS INTRA-CARD E TRANSIÇÃO NA ÓRBITA) ──
  stepSlide(direction = 1) {
    // Trilha Norte (Bíblia) ou Trilha Sul (Controles)
    if (this.activeRow !== 1) {
      this.stepRowHorizontal(direction, this.activeRow === 0);
      return;
    }

    const activeRowObj = this.rows[this.activeRow];
    if (!activeRowObj || !activeRowObj.cards || !activeRowObj.cards.length) return;

    // Se nenhum card está no ar ou o card ativo é de outra trilha, projeta o central
    if (!this.activeCardObj || this.activeCardObj.rowIdx !== this.activeRow) {
      const currentIdx = Math.max(0, Math.min(activeRowObj.cards.length - 1, Math.round(activeRowObj.scrollIndex)));
      const card = activeRowObj.cards[currentIdx];
      if (card && card.data && card.data.text) {
        this.projectCardChunk(card, 0, true);
      }
      return;
    }

    const card = this.activeCardObj;
    const limit = this.getLinesLimit(card.data.theme);
    const chunks = this.splitTextIntoChunks(card.data.text, limit);
    const totalChunks = chunks.length;

    if (direction === 1) {
      // Avançar (Seta Direita / Espaço)
      if (this.activeChunkIndex < totalChunks - 1) {
        // Avança dentro do mesmo cartão
        this.projectCardChunk(card, this.activeChunkIndex + 1, true);
      } else {
        // Fim da estrofe: gira para o próximo cartão da órbita
        const nextIdx = card.cardIdx + 1;
        if (nextIdx < activeRowObj.cards.length) {
          this.snapToCard(this.activeRow, nextIdx);
          const nextCard = activeRowObj.cards[nextIdx];
          if (nextCard && nextCard.data && nextCard.data.text) {
            this.projectCardChunk(nextCard, 0, true);
          }
        }
      }
    } else if (direction === -1) {
      // Retroceder (Seta Esquerda)
      if (this.activeChunkIndex > 0) {
        // Retrocede dentro do mesmo cartão
        this.projectCardChunk(card, this.activeChunkIndex - 1, true);
      } else {
        // Início da estrofe: retrocede para o cartão anterior na sua última fatia
        const prevIdx = card.cardIdx - 1;
        if (prevIdx >= 0) {
          this.snapToCard(this.activeRow, prevIdx);
          const prevCard = activeRowObj.cards[prevIdx];
          if (prevCard && prevCard.data && prevCard.data.text) {
            const prevChunks = this.splitTextIntoChunks(prevCard.data.text, this.getLinesLimit(prevCard.data.theme));
            const lastChunkIdx = Math.max(0, prevChunks.length - 1);
            this.projectCardChunk(prevCard, lastChunkIdx, true);
          }
        }
      }
    }
  }

  // Notificação de alteração do limite de linhas nas preferências
  onLinesLimitChanged() {
    const songRow = this.rows[1];
    if (songRow && songRow.cards) {
      const limit = this.getLinesLimit('song');
      songRow.cards.forEach(card => {
        if (card.data && card.data.text) {
          const chunks = this.splitTextIntoChunks(card.data.text, limit);
          const badge = card.element.querySelector('.card-chunk-badge');
          if (badge) {
            if (chunks.length > 1) {
              badge.textContent = `PARTE 1/${chunks.length}`;
              badge.style.display = 'inline-flex';
            } else {
              badge.style.display = 'none';
            }
          }
        }
      });
    }

    if (this.activeCardObj && this.activeCardObj.rowIdx === 1) {
      this.projectCardChunk(this.activeCardObj, 0, true);
    }
  }


  updateCardPositions() {
    // Passo angular de latitude entre os anéis na esfera (~24.5°)
    const latitudeStep = THREE.MathUtils.degToRad(24.5);
    const globeRadius = this.radius;

    this.rows.forEach((row, rowIdx) => {
      const diffY = rowIdx - this.verticalOffset;
      const lambda = -diffY * latitudeStep; // Ângulo de latitude (+Norte, -Sul)

      // Raio e altura do paralelo na latitude esférica lambda
      const R_lat = globeRadius * Math.cos(lambda);
      const posY = globeRadius * Math.sin(lambda);

      const isCenterRow = Math.abs(diffY) < 0.35;
      const rowScale = isCenterRow ? 1.0 : 0.82;

      row.cards.forEach(card => {
        const relativeCardOffset = card.cardIdx - row.scrollIndex;
        const thetaRad = relativeCardOffset * this.cardAngleStep;

        // Posição cartesiana 3D perfeitamente assentada na superfície da esfera
        const x = R_lat * Math.sin(thetaRad);
        const z = R_lat * Math.cos(thetaRad);

        card.object.position.set(x, posY, z);

        // Orientação tangencial à esfera:
        // pitch = -lambda (inclina para acompanhar o domo esférico Norte/Sul)
        // yaw = thetaRad (curva suavemente em torno do meridiano)
        card.object.rotation.set(-lambda, thetaRad, 0, "YXZ");

        // Visibilidade no campo de visão frontal
        const isFacingFront = z > 150 && Math.abs(thetaRad) < THREE.MathUtils.degToRad(78);

        if (!isFacingFront || Math.abs(diffY) > 1.35) {
          card.element.style.opacity = "0";
          card.element.style.pointerEvents = "none";
        } else {
          const isPrimeCenter = isCenterRow && Math.abs(relativeCardOffset) < 0.45;
          // Escala natural mantendo perspectiva tridimensional do globo
          const cardScale = rowScale * (0.86 + (z / globeRadius) * 0.14);

          card.object.scale.set(cardScale, cardScale, 1);

          card.element.style.opacity = isCenterRow ? (isPrimeCenter ? "1" : "0.6") : "0.48";
          card.element.style.pointerEvents = "auto"; // ← QUALQUER CARTÃO VISÍVEL É CLICÁVEL!
        }
      });
    });
  }

  initEvents() {
    const dom = this.rendererCSS.domElement;

    dom.addEventListener('pointerdown', e => {
      // Deixa botões internos de cards de controle agirem livremente
      if (e.target.tagName === 'BUTTON') return;
      this.isDragging = true;
      this.hasDragged = false;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dragAxis = null;

      const activeRowObj = this.rows[this.activeRow];
      this.dragStartScroll = activeRowObj.scrollIndex;
      this.dragStartVertical = this.verticalOffset;
    });

    window.addEventListener('pointermove', e => {
      if (!this.isDragging) return;

      const totalDeltaX = e.clientX - this.startX;
      const totalDeltaY = e.clientY - this.startY;

      // Se moveu mais que 6px, marca que foi arrasto (para não disparar clique por acidente)
      if (Math.abs(totalDeltaX) > 14 || Math.abs(totalDeltaY) > 14) {
        this.hasDragged = true;
      }

      if (!this.dragAxis && (Math.abs(totalDeltaX) > 8 || Math.abs(totalDeltaY) > 8)) {
        this.dragAxis = Math.abs(totalDeltaX) >= Math.abs(totalDeltaY) ? 'horizontal' : 'vertical';
      }

      if (this.dragAxis === 'horizontal') {
        const activeRowObj = this.rows[this.activeRow];
        const scrollDelta = -(totalDeltaX / 380);
        activeRowObj.scrollIndex = this.dragStartScroll + scrollDelta;
        activeRowObj.scrollIndex = Math.max(-0.4, Math.min(activeRowObj.cards.length - 0.6, activeRowObj.scrollIndex));
        this.updateCardPositions();
      } else if (this.dragAxis === 'vertical') {
        const verticalDelta = -(totalDeltaY / 280);
        this.verticalOffset = Math.max(-0.2, Math.min(2.2, this.dragStartVertical + verticalDelta));
        this.updateCardPositions();
      }

      this.lastX = e.clientX;
      this.lastY = e.clientY;

      const hint = document.getElementById('center-hint');
      if (hint) hint.style.opacity = '0';
    });

    window.addEventListener('pointerup', () => {
      if (!this.isDragging) return;
      this.isDragging = false;

      if (this.dragAxis === 'horizontal') {
        const activeRowObj = this.rows[this.activeRow];
        const nearestIndex = Math.round(activeRowObj.scrollIndex);
        this.snapToCard(this.activeRow, nearestIndex);
      } else if (this.dragAxis === 'vertical') {
        const nearestRow = Math.max(0, Math.min(2, Math.round(this.verticalOffset)));
        this.setRow(nearestRow);
      }

      this.dragAxis = null;

      // Reseta hasDragged após pequeno delay para evitar que o evento de clique dispare em seguida
      setTimeout(() => {
        this.hasDragged = false;
      }, 80);
    });

    // Roda do mouse (Wheel) com debounce suave
    window.addEventListener('wheel', e => {
      // Permite a rolagem nativa suave se o cursor estiver sobre o texto do cartão ou painéis
      if (e.target && e.target.closest && (
        e.target.closest('.card-main-text') ||
        e.target.closest('.hud-right-inspector') ||
        e.target.closest('.lines-slices-list') ||
        e.target.closest('.modal-card') ||
        e.target.closest('.modal-content')
      )) {
        return;
      }

      const now = performance.now();

      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        if (now - this.lastWheelTime > 320) {
          if (e.deltaY > 25 && this.activeRow < 2) {
            this.lastWheelTime = now;
            this.setRow(this.activeRow + 1);
          } else if (e.deltaY < -25 && this.activeRow > 0) {
            this.lastWheelTime = now;
            this.setRow(this.activeRow - 1);
          }
        }
      } else {
        if (now - this.lastWheelTime > 220) {
          if (e.deltaX > 20) {
            this.lastWheelTime = now;
            this.stepRowHorizontal(1);
          } else if (e.deltaX < -20) {
            this.lastWheelTime = now;
            this.stepRowHorizontal(-1);
          }
        }
      }
    }, { passive: true });
  }

  // ── TRANSIÇÃO VERTICAL: DESLIZA A LINHA DESEJADA PARA O EQUADOR ──
  setRow(rowIndex) {
    if (rowIndex < 0 || rowIndex > 2) return;
    this.activeRow = rowIndex;

    const startVal = this.verticalOffset;
    const targetVal = rowIndex;
    const anim = { t: 0 };

    new TWEEN.Tween(anim)
      .to({ t: 1 }, 420)
      .easing(TWEEN.Easing.Cubic.Out)
      .onUpdate(() => {
        this.verticalOffset = THREE.MathUtils.lerp(startVal, targetVal, anim.t);
        this.updateCardPositions();
      })
      .onComplete(() => {
        this.verticalOffset = targetVal;
        this.updateCardPositions();
      })
      .start();

    if (window.globeApp) {
      window.globeApp.onRowChanged(rowIndex);
    }
  }

  // ── SNAP HORIZONTAL: CENTRALIZA O CARTÃO SELECIONADO NA VISÃO ──
  snapToCard(rowIdx, cardIdx) {
    const rowObj = this.rows[rowIdx];
    const maxIdx = rowObj.cards.length - 1;
    const targetIdx = Math.max(0, Math.min(maxIdx, cardIdx));
    rowObj.targetScroll = targetIdx;

    const startVal = rowObj.scrollIndex;
    const anim = { t: 0 };

    new TWEEN.Tween(anim)
      .to({ t: 1 }, 380)
      .easing(TWEEN.Easing.Cubic.Out)
      .onUpdate(() => {
        rowObj.scrollIndex = THREE.MathUtils.lerp(startVal, targetIdx, anim.t);
        this.updateCardPositions();
      })
      .onComplete(() => {
        rowObj.scrollIndex = targetIdx;
        this.updateCardPositions();
      })
      .start();
  }

  stepRowHorizontal(direction = 1, autoProject = false) {
    const activeRowObj = this.rows[this.activeRow];
    if (!activeRowObj || !activeRowObj.cards || !activeRowObj.cards.length) return;
    const maxIdx = activeRowObj.cards.length - 1;
    const newIdx = Math.max(0, Math.min(maxIdx, Math.round(activeRowObj.scrollIndex + direction)));
    this.snapToCard(this.activeRow, newIdx);

    if (autoProject) {
      const targetCard = activeRowObj.cards[newIdx];
      if (targetCard && targetCard.element) {
        this.onCardClicked(targetCard.data, targetCard.element, this.activeRow, newIdx, true);
      }
    }
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.rendererWebGL.setSize(width, height);
    this.rendererCSS.setSize(width, height);
    this.updateCardPositions();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    TWEEN.update();

    if (this.stageRing) {
      const p = 1 + Math.sin(Date.now() * 0.002) * 0.006;
      this.stageRing.scale.set(p, p, 1);
    }

    this.rendererWebGL.render(this.sceneWebGL, this.camera);
    this.rendererCSS.render(this.sceneCSS, this.camera);
  }
}
