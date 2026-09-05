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
      const c = new THREE.Color().lerpColors(
        new THREE.Color(0x00f0ff),
        new THREE.Color(0xa855f7),
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

    // Anel Norte (Bíblia)
    const northRingGeo = new THREE.TorusGeometry(rParallel, 1.4, 8, 120);
    const northRingMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.22
    });
    const northRing = new THREE.Mesh(northRingGeo, northRingMat);
    northRing.position.y = yParallel;
    northRing.rotation.x = Math.PI / 2;
    this.sceneWebGL.add(northRing);

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
      { tag: 'JOÃO 3:16', title: 'Bíblia Sagrada', text: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.', theme: 'bible' },
      { tag: 'JOÃO 3:17', title: 'Bíblia Sagrada', text: 'Porque Deus enviou o seu Filho ao mundo, não para que condenasse o mundo, mas para que o mundo fosse salvo por ele.', theme: 'bible' },
      { tag: 'SALMOS 23:1-3', title: 'Bíblia Sagrada', text: 'O Senhor é o meu pastor; nada me faltará.\nDeitar-me faz em verdes pastos, guia-me mansamente a águas tranqüilas.\nRefrigera a minha alma.', theme: 'bible' },
      { tag: 'FILIPENSES 4:13', title: 'Bíblia Sagrada', text: 'Posso todas as coisas naquele que me fortalece.\n\nE a paz de Deus guardará os vossos corações.', theme: 'bible' },
      { tag: '1 CORÍNTIOS 13:13', title: 'Bíblia Sagrada', text: 'Agora, pois, permanecem a fé, a esperança e o amor, estes três;\nmas o maior destes é o amor.', theme: 'bible' },
      { tag: 'ROMANOS 8:28', title: 'Bíblia Sagrada', text: 'E sabemos que todas as coisas concorrem para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito.', theme: 'bible' }
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

  createCardDOM(data, rowIdx, cardIdx) {
    const el = document.createElement('div');
    el.className = `globe-card theme-${data.theme}`;

    if (data.isControlCard) {
      el.innerHTML = `
        <div class="card-top-row">
          <span class="card-tag">CABINE MASTER</span>
          <span class="card-status-badge">PRONTO</span>
        </div>
        <div class="control-buttons-grid">
          <button class="ctrl-btn danger" onclick="window.projectionSync.toggleBlackout()">⚫ BLACKOUT [F2]</button>
          <button class="ctrl-btn warning" onclick="window.projectionSync.toggleClearText()">🔲 LIMPAR TEXTO [F3]</button>
          <button class="ctrl-btn" onclick="window.projectionSync.toggleLogo()">🔷 LOGO OFICIAL [F4]</button>
          <button class="ctrl-btn" onclick="window.projectionSync.openDisplayWindow()">🖥️ ABRIR TELÃO [F11]</button>
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
          <button class="ctrl-btn" onclick="window.projectionSync.showAlert('Veículo placa ABC-1234 com farol aceso')">🚗 Farol Aceso</button>
          <button class="ctrl-btn" onclick="window.projectionSync.showAlert('Mãe do berçário, favor comparecer')">👶 Berçário</button>
          <button class="ctrl-btn" onclick="window.projectionSync.showAlert('Por favor, desliguem os alarmes de carro')">⚠️ Alarme Disparado</button>
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
          <button class="ctrl-btn" style="width:100%;" onclick="window.projectionSync.showAlert('Pastores: 5 minutos restantes')">✉️ Avisar 5 min Restantes</button>
        </div>
      `;
    } else if (data.isHardwareCard) {
      el.innerHTML = `
        <div class="card-top-row">
          <span class="card-tag">SAÍDAS DE VÍDEO</span>
          <span class="card-status-badge" style="color:#10b981;">1080p @ 60Hz</span>
        </div>
        <div style="font-size:0.85rem; color:#cbd5e1; line-height:1.4;">
          • Telão Projetor: HDMI 1 (Conectado)<br>
          • Retorno Púlpito: HDMI 2 (Conectado)<br>
          • Latência de Projeção: 0ms (Local)
        </div>
        <div class="card-footer">
          <button class="btn-project-card" style="width:100%;" onclick="window.projectionSync.openDisplayWindow()">🖥️ Abrir Janela do Telão</button>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div class="card-top-row">
          <span class="card-tag">${data.tag}</span>
          <span class="card-status-badge">SLIDE</span>
        </div>
        <div class="card-main-text">${data.text}</div>
        <div class="card-footer">
          <span class="card-subtext">${data.title}</span>
          <button class="btn-project-card">🔴 PROJETAR</button>
        </div>
      `;
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

  // AÇÃO AO CLICAR EM QUALQUER CARD VISÍVEL NO GLOBO
  onCardClicked(data, cardEl, rowIdx, cardIdx) {
    if (this.hasDragged) return; // Ignora clique se o usuário estava arrastando a tela

    // 1. Se o card clicado está em outra linha (ex: na Bíblia acima ou nos Controles abaixo),
    // traz essa linha imediatamente para o centro do Equador!
    if (rowIdx !== this.activeRow) {
      this.setRow(rowIdx);
    }

    // 2. Alinha horizontalmente o cartão clicado exatamente no centro da visão
    this.snapToCard(rowIdx, cardIdx);

    // 3. Se for um slide de conteúdo (com texto), projeta imediatamente no telão
    if (data.text) {
      document.querySelectorAll('.globe-card').forEach(c => c.classList.remove('on-air'));
      cardEl.classList.add('on-air');

      window.projectionSync.projectSlide({
        header: data.tag,
        text: data.text,
        subtitle: data.title,
        theme: data.theme
      });

      const pill = document.getElementById('on-air-pill-text');
      if (pill) pill.textContent = `${data.tag} — ${data.title}`;

      if (window.slideTelemetry) {
        window.slideTelemetry.updateInspector(data);
        window.slideTelemetry.appendLog(data.tag, `Projetado no Telão: "${data.title}"`, 'success');
      }
    } else {
      if (window.slideTelemetry) {
        window.slideTelemetry.updateInspector(data);
      }
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
        const verticalDelta = (totalDeltaY / 280);
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

  stepRowHorizontal(direction = 1) {
    const activeRowObj = this.rows[this.activeRow];
    const newIdx = activeRowObj.scrollIndex + direction;
    this.snapToCard(this.activeRow, Math.round(newIdx));
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
