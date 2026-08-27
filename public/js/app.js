/**
 * LUDO REAL-TIME FRONTEND APPLICATION SCRIPT (LUDO 6IX)
 * Manages Socket.io events, DOM Board Rendering, Yard Badges, Live Chat & Floating Animations
 */

document.addEventListener('DOMContentLoaded', () => {
  // Persistent Player Identity Key in LocalStorage
  function getOrCreatePlayerId() {
    let id = localStorage.getItem('ludo_player_id');
    if (!id) {
      id = 'pid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('ludo_player_id', id);
    }
    return id;
  }
  const myPlayerId = getOrCreatePlayerId();

  // Socket.io Connection with Fast Reconnection & Serverless Fallback
  let socket = null;
  let isOfflineMode = false;
  let connectErrorCount = 0;

  try {
    if (typeof io !== 'undefined') {
      // Connect to window.LUDO_SERVER_URL if specified, otherwise current origin
      const serverUrl = window.LUDO_SERVER_URL || window.location.origin;
      socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 4,
        reconnectionDelay: 1000,
        timeout: 5000
      });
    } else {
      enableOfflineFallbackMode();
    }
  } catch (e) {
    enableOfflineFallbackMode();
  }

  // Application State
  let myRoomCode = null;
  let myColor = null;
  let currentRoomState = null;
  let isMuted = false;
  let unreadChatCount = 0;

  // DOM Elements
  const ludoBoard = document.getElementById('ludoBoard');
  const boardPokeOverlay = document.getElementById('boardPokeOverlay');
  const lobbyModal = document.getElementById('lobbyModal');
  const createRoomForm = document.getElementById('createRoomForm');
  const joinRoomForm = document.getElementById('joinRoomForm');
  const tabCreateRoom = document.getElementById('tabCreateRoom');
  const tabJoinRoom = document.getElementById('tabJoinRoom');

  const connectionStatus = document.getElementById('connectionStatus');
  const roomCodeDisplayContainer = document.getElementById('roomCodeDisplayContainer');
  const roomCodeText = document.getElementById('roomCodeText');
  const copyInviteLinkBtn = document.getElementById('copyInviteLinkBtn');
  const toggleAudioBtn = document.getElementById('toggleAudioBtn');

  const turnBanner = document.getElementById('turnBanner');
  const turnText = document.getElementById('turnText');
  const diceCube = document.getElementById('diceCube');
  const diceHintText = document.getElementById('diceHintText');
  const diceValueDisplay = document.getElementById('diceValueDisplay');

  const playerCount = document.getElementById('playerCount');
  const playersList = document.getElementById('playersList');
  const startGameBtn = document.getElementById('startGameBtn');

  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatBadge = document.getElementById('chatBadge');
  const mobileChatBadge = document.getElementById('mobileChatBadge');

  // Webhook Modal Elements
  const openWebhookBtn = document.getElementById('openWebhookBtn');
  const webhookModal = document.getElementById('webhookModal');
  const closeWebhookBtn = document.getElementById('closeWebhookBtn');
  const cancelWebhookBtn = document.getElementById('cancelWebhookBtn');
  const webhookForm = document.getElementById('webhookForm');
  const modalWebhookUrl = document.getElementById('modalWebhookUrl');
  const testWebhookBtn = document.getElementById('testWebhookBtn');
  const webhookTestBadge = document.getElementById('webhookTestBadge');

  // Victory Modal Elements
  const victoryModal = document.getElementById('victoryModal');
  const victorySubtitle = document.getElementById('victorySubtitle');
  const rankingsList = document.getElementById('rankingsList');
  const closeVictoryBtn = document.getElementById('closeVictoryBtn');

  // Check URL parameters for ?room=ROOMCODE
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    document.getElementById('joinRoomCode').value = roomParam.trim().toUpperCase();
    tabJoinRoom.click();
  }

  // Build 15x15 Ludo Board Grid
  buildBoardGrid();

  // ==========================================================================
  // BOARD GRID GENERATION (REALISTIC WITH YARD BADGES & BASE COLORED SPOTS)
  // ==========================================================================

  function buildBoardGrid() {
    ludoBoard.innerHTML = '';

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (r < 6 && c < 6 && r === 0 && c === 0) {
          createBaseYard('red', 0, 0);
        } else if (r < 6 && c > 8 && r === 0 && c === 9) {
          createBaseYard('green', 0, 9);
        } else if (r > 8 && c > 8 && r === 9 && c === 9) {
          createBaseYard('yellow', 9, 9);
        } else if (r > 8 && c < 6 && r === 9 && c === 0) {
          createBaseYard('blue', 9, 0);
        } else if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
          if (r === 6 && c === 6) createCenterHome();
        } else if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c > 8) || (r > 8 && c < 6)) {
          continue;
        } else {
          createPathCell(r, c);
        }
      }
    }
  }

  function createBaseYard(color, row, col) {
    const baseCell = document.createElement('div');
    baseCell.className = `cell cell-base ${color}-base`;
    baseCell.id = `yard_${color}`;
    baseCell.style.gridRow = `${row + 1} / span 6`;
    baseCell.style.gridColumn = `${col + 1} / span 6`;

    // Yard Home Player Badge (Avatar + Name Overlay on Board)
    const badge = document.createElement('div');
    badge.className = `yard-badge yard-badge-${color}`;
    badge.id = `yard_badge_${color}`;
    badge.innerHTML = `
      <img src="assets/avatars/avatar1.png" class="yard-badge-img" id="yard_avatar_${color}">
      <span class="yard-badge-name" id="yard_name_${color}">${color.toUpperCase()}</span>
    `;
    baseCell.appendChild(badge);

    const inner = document.createElement('div');
    inner.className = 'base-inner';

    for (let i = 0; i < 4; i++) {
      const spot = document.createElement('div');
      spot.className = `base-spot base-spot-${color}`;
      spot.id = `base_spot_${color}_${i}`;
      inner.appendChild(spot);
    }

    baseCell.appendChild(inner);
    ludoBoard.appendChild(baseCell);
  }

  function createCenterHome() {
    const centerCell = document.createElement('div');
    centerCell.className = 'center-home';
    centerCell.id = 'cell_7_7';

    centerCell.innerHTML = `
      <div class="center-triangle-red"></div>
      <div class="center-triangle-green"></div>
      <div class="center-triangle-yellow"></div>
      <div class="center-triangle-blue"></div>
    `;

    ludoBoard.appendChild(centerCell);
  }

  function createPathCell(r, c) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.id = `cell_${r}_${c}`;
    cell.style.gridRow = `${r + 1}`;
    cell.style.gridColumn = `${c + 1}`;

    if (r === 6 && c >= 1 && c <= 5) cell.classList.add('path-red');
    if (r === 7 && c >= 1 && c <= 5) cell.classList.add('home-red');
    if (r === 6 && c === 1) addStarIcon(cell, 'start-red');

    if (c === 8 && r >= 1 && r <= 5) cell.classList.add('path-green');
    if (c === 7 && r >= 1 && r <= 5) cell.classList.add('home-green');
    if (r === 1 && c === 8) addStarIcon(cell, 'start-green');

    if (r === 8 && c >= 9 && c <= 13) cell.classList.add('path-yellow');
    if (r === 7 && c >= 9 && c <= 13) cell.classList.add('home-yellow');
    if (r === 8 && c === 13) addStarIcon(cell, 'start-yellow');

    if (c === 6 && r >= 9 && r <= 13) cell.classList.add('path-blue');
    if (c === 7 && r >= 9 && r <= 13) cell.classList.add('home-blue');
    if (r === 13 && c === 6) addStarIcon(cell, 'start-blue');

    if ((r === 2 && c === 6) || (r === 6 && c === 12) || (r === 12 && c === 8) || (r === 8 && c === 2)) {
      addStarIcon(cell);
    }

    ludoBoard.appendChild(cell);
  }

  function addStarIcon(cell, extraClass = '') {
    cell.classList.add('safe-star');
    if (extraClass) cell.classList.add(extraClass);
    const starSvg = document.createElement('div');
    starSvg.className = 'star-svg-icon';
    starSvg.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="#fbbf24" stroke="#d97706" stroke-width="1">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    `;
    cell.appendChild(starSvg);
  }

  // ==========================================================================
  // RENDER BOARD STATE & TOKENS
  // ==========================================================================

  function getMyColor(roomState) {
    if (!roomState || !roomState.players) return myColor;
    const me = roomState.players.find(p => p.socketId === socket?.id || p.playerId === myPlayerId || p.id === 'p1');
    if (me) {
      myColor = me.color;
      return me.color;
    }
    return myColor;
  }

  function renderBoard(roomState) {
    document.querySelectorAll('.token').forEach(el => el.remove());

    if (!roomState || !roomState.boardState) return;

    const playerColor = getMyColor(roomState);
    const currentPlayer = roomState.players[roomState.currentTurnIndex];
    const isMyTurn = (currentPlayer && currentPlayer.color === playerColor && roomState.gameStarted);
    const cellTokenMap = {};

    // ONLY render tokens for colors of PLAYERS WHO ACTUALLY JOINED THE MATCH!
    const activePlayerColors = roomState.players.map(p => p.color);

    activePlayerColors.forEach(color => {
      if (!roomState.boardState[color]) return;

      roomState.boardState[color].forEach((step, tokenIndex) => {
        const [r, c] = LudoEngine.getTokenCell(color, step, tokenIndex);

        let parentContainer = null;
        if (step === 0) {
          parentContainer = document.getElementById(`base_spot_${color}_${tokenIndex}`);
        } else {
          parentContainer = document.getElementById(`cell_${r}_${c}`);
        }

        if (!parentContainer) return;

        const tokenEl = document.createElement('div');
        tokenEl.className = `token ${color}`;
        tokenEl.dataset.color = color;
        tokenEl.dataset.index = tokenIndex;
        tokenEl.innerHTML = `<span class="token-num">${tokenIndex + 1}</span>`;

        // CRITICAL FIX: Only glow and allow clicks on tokens belonging STRICTLY to playerColor!
        if (color === playerColor && isMyTurn && roomState.hasRolled && roomState.diceValue) {
          const validMoves = calculateValidMoves(roomState, playerColor, roomState.diceValue);
          if (validMoves.includes(tokenIndex)) {
            tokenEl.classList.add('can-move');
            tokenEl.addEventListener('click', (e) => {
              e.stopPropagation();
              SoundFX.playMove();
              if (isOfflineMode) {
                handleLocalMove(playerColor, tokenIndex, roomState.diceValue);
              } else {
                socket.emit('move_token', { roomCode: myRoomCode, tokenIndex });
              }
            });
          }
        }

        const cellId = parentContainer.id;
        if (!cellTokenMap[cellId]) cellTokenMap[cellId] = [];
        cellTokenMap[cellId].push(tokenEl);
      });
    });

      tokens.forEach(tok => container.appendChild(tok));
    });

    // Step-by-step hopping animation when a token advances
    if (previousBoardState) {
      activePlayerColors.forEach(color => {
        if (!roomState.boardState[color] || !previousBoardState[color]) return;
        roomState.boardState[color].forEach((newStep, tokenIdx) => {
          const oldStep = previousBoardState[color][tokenIdx] || 0;
          if (newStep > oldStep && oldStep > 0) {
            animateTokenHop(color, tokenIdx, oldStep, newStep);
          }
        });
      });
    }
    previousBoardState = JSON.parse(JSON.stringify(roomState.boardState));
  }

  let previousBoardState = null;

  function animateTokenHop(color, tokenIndex, startStep, endStep) {
    if (startStep >= endStep) return;

    let currentStep = startStep;
    const interval = setInterval(() => {
      currentStep++;
      const [r, c] = LudoEngine.getTokenCell(color, currentStep, tokenIndex);
      let targetCell = (currentStep === 0)
        ? document.getElementById(`base_spot_${color}_${tokenIndex}`)
        : document.getElementById(`cell_${r}_${c}`);

      const tokenEl = document.querySelector(`.token.${color}[data-index="${tokenIndex}"]`);
      if (tokenEl && targetCell) {
        tokenEl.classList.add('hopping');
        targetCell.appendChild(tokenEl);
        SoundFX.playStep();
        setTimeout(() => tokenEl.classList.remove('hopping'), 110);
      }

      if (currentStep >= endStep) {
        clearInterval(interval);
      }
    }, 150);
  }

  function calculateValidMoves(roomState, color, dice) {
    const tokens = roomState.boardState[color];
    const valid = [];
    tokens.forEach((step, idx) => {
      if (step === 57) return;
      if (step === 0) {
        if (dice === 6) valid.push(idx);
      } else {
        if (step + dice <= 57) valid.push(idx);
      }
    });
    return valid;
  }

  // ==========================================================================
  // RENDER UI PANELS, AVATARS, YARD BADGES & HOST CONTROLS
  // ==========================================================================

  function updateUI(roomState) {
    currentRoomState = roomState;
    myRoomCode = roomState.code;

    // Room Header Code Display
    if (roomState.code && roomState.code !== 'OFFLINE') {
      roomCodeText.innerText = roomState.code;
      roomCodeDisplayContainer.classList.remove('hidden');
    } else if (isOfflineMode) {
      roomCodeText.innerText = 'OFFLINE';
      roomCodeDisplayContainer.classList.remove('hidden');
    } else {
      roomCodeDisplayContainer.classList.add('hidden');
    }

    // Players Count & List
    playerCount.innerText = roomState.players.length;
    renderPlayersList(roomState);

    // Update 4 Yard Player Badges on Board
    ['red', 'green', 'yellow', 'blue'].forEach(color => {
      const p = roomState.players.find(player => player.color === color);
      const nameEl = document.getElementById(`yard_name_${color}`);
      const avatarEl = document.getElementById(`yard_avatar_${color}`);
      const badgeEl = document.getElementById(`yard_badge_${color}`);

      if (p) {
        if (nameEl) nameEl.innerText = p.name;
        if (avatarEl) {
          avatarEl.src = (p.avatar && p.avatar.includes('/')) ? p.avatar : 'assets/avatars/avatar1.png';
          avatarEl.style.display = 'inline-block';
        }
        if (badgeEl) {
          badgeEl.style.opacity = '1';
          const isTurn = roomState.gameStarted && roomState.players[roomState.currentTurnIndex]?.color === color;
          badgeEl.classList.toggle('active-turn-yard', isTurn);
        }
      } else {
        if (nameEl) nameEl.innerText = 'OPEN';
        if (avatarEl) avatarEl.style.display = 'none';
        if (badgeEl) {
          badgeEl.style.opacity = '0.35';
          badgeEl.classList.remove('active-turn-yard');
        }
      }
    });

    // Turn Banner & Tap Dice Hint
    const currentPlayer = roomState.players[roomState.currentTurnIndex];
    if (!roomState.gameStarted) {
      turnBanner.className = 'turn-banner color-red';
      turnText.innerText = 'Waiting for game host to start...';
      diceHintText.innerText = 'Waiting for Host...';
    } else {
      turnBanner.className = `turn-banner color-${currentPlayer.color}`;
      const playerColor = getMyColor(roomState);
      const isMyTurn = (currentPlayer.color === playerColor);
      const avatarHtml = (currentPlayer.avatar && currentPlayer.avatar.includes('/'))
        ? `<img src="${currentPlayer.avatar}" class="player-avatar-img" style="width:22px;height:22px;margin-right:4px;">`
        : `<span>${currentPlayer.avatar || '👤'}</span>`;

      turnText.innerHTML = isMyTurn ? `${avatarHtml} <span>YOUR TURN (${currentPlayer.color.toUpperCase()})</span>` : `${avatarHtml} <span>${currentPlayer.name}'s Turn (${currentPlayer.color.toUpperCase()})</span>`;

      if (isMyTurn && !roomState.hasRolled) {
        diceHintText.innerText = '👉 Tap Dice to Roll!';
      } else if (isMyTurn && roomState.hasRolled) {
        diceHintText.innerText = 'Select a glowing token!';
      } else {
        diceHintText.innerText = `Waiting for ${currentPlayer.name}...`;
      }
    }

    // Dice Value Display
    if (roomState.diceValue) {
      diceValueDisplay.innerText = roomState.diceValue;
      set3DDiceFace(roomState.diceValue);
    } else {
      diceValueDisplay.innerText = '-';
      set3DDiceFace(1);
    }

    renderBoard(roomState);

    if (roomState.winners && roomState.winners.length > 0) {
      showVictoryModal(roomState);
    }
  }

  function renderPlayersList(roomState) {
    playersList.innerHTML = '';

    const me = roomState.players.find(p => p.socketId === socket?.id || p.id === 'p1');
    const amIHost = me ? me.isHost : false;
    const amICoHost = me ? me.isCoHost : false;

    // Prominent Match Mode Banner (e.g. 👥 2-Player Match)
    const matchHeader = document.createElement('div');
    matchHeader.className = 'match-mode-header';
    matchHeader.innerHTML = `
      <div class="match-mode-badge">
        <span>👥 ${roomState.players.length}-PLAYER MATCH MODE</span>
        ${!roomState.gameStarted ? `<small>(Only these ${roomState.players.length} joined player(s) will play)</small>` : `<small class="live-hint">🟢 MATCH IN PROGRESS</small>`}
      </div>
    `;
    playersList.appendChild(matchHeader);

    roomState.players.forEach(p => {
      const card = document.createElement('div');
      const isTurn = roomState.gameStarted && roomState.players[roomState.currentTurnIndex]?.color === p.color;
      card.className = `player-card ${isTurn ? 'active-turn' : ''}`;

      const isMe = (p.socketId === socket?.id || p.id === 'p1');
      const avatarSrc = (p.avatar && p.avatar.includes('/')) ? p.avatar : 'assets/avatars/avatar1.png';

      card.innerHTML = `
        <div class="player-info">
          <img src="${avatarSrc}" class="player-avatar-img" alt="Avatar">
          <span class="color-dot ${p.color}" title="Home Base: ${p.color.toUpperCase()}"></span>
          <span class="player-name">${p.name} ${isMe ? '(You)' : ''}</span>
          <div class="player-tags">
            ${p.isHost ? '<span class="tag tag-host">HOST</span>' : ''}
            ${p.isCoHost ? '<span class="tag tag-cohost">CO-HOST</span>' : ''}
            ${p.isBot ? '<span class="tag tag-bot">BOT</span>' : ''}
          </div>
        </div>
        <div class="player-actions-row">
          ${!isMe ? `
            <button class="btn-poke" data-color="${p.color}" title="Poke ${p.name}!">
              👉 Poke
            </button>
          ` : ''}
          ${amIHost && !isMe && !p.isBot ? `
            <select class="host-action-dropdown" data-socket="${p.socketId}">
              <option value="">⚙️ Manage</option>
              <option value="transfer">👑 Make Host</option>
              <option value="cohost">${p.isCoHost ? '❌ Remove Co-Host' : '🎖️ Make Co-Host'}</option>
            </select>
          ` : ''}
        </div>
      `;

      // Poke Button Listener
      const pokeBtn = card.querySelector('.btn-poke');
      if (pokeBtn) {
        pokeBtn.addEventListener('click', () => {
          SoundFX.playClick();
          const targetColor = pokeBtn.dataset.color;
          if (socket && !isOfflineMode) {
            socket.emit('send_poke', { roomCode: myRoomCode, targetColor, pokeType: 'punch' });
          } else {
            triggerBoardPokeAnimation({ senderName: me?.name || 'Player', senderColor: myColor, targetColor, pokeType: 'punch' });
          }
        });
      }

      // Host Manage Dropdown Listener
      const hostSelect = card.querySelector('.host-action-dropdown');
      if (hostSelect) {
        hostSelect.addEventListener('change', (e) => {
          const action = e.target.value;
          const targetSocket = hostSelect.dataset.socket;
          if (action === 'transfer') {
            if (confirm(`Transfer Host privileges to ${p.name}?`)) {
              socket.emit('transfer_host', { roomCode: myRoomCode, targetSocketId: targetSocket });
            }
          } else if (action === 'cohost') {
            socket.emit('toggle_cohost', { roomCode: myRoomCode, targetSocketId: targetSocket });
          }
          hostSelect.value = '';
        });
      }

      playersList.appendChild(card);
    });

    if (roomState.players.length < 4 && !roomState.gameStarted) {
      if (amIHost || amICoHost) {
        const addBotBtn = document.createElement('button');
        addBotBtn.className = 'btn btn-secondary btn-block empty-slot';
        addBotBtn.innerHTML = '+ Add AI Bot';
        addBotBtn.addEventListener('click', () => {
          SoundFX.playClick();
          if (socket) socket.emit('add_bot', { roomCode: myRoomCode });
        });
        playersList.appendChild(addBotBtn);
      }
    }

    if (me && (me.isHost || me.isCoHost) && !roomState.gameStarted) {
      startGameBtn.classList.remove('hidden');
    } else {
      startGameBtn.classList.add('hidden');
    }
  }

  function set3DDiceFace(val) {
    const face = (val && val >= 1 && val <= 6) ? val : 1;
    diceCube.className = `dice-cube clickable-dice show-${face}`;
  }

  function triggerRollAnimation(val) {
    SoundFX.playRoll();
    diceCube.classList.add('rolling');
    setTimeout(() => {
      diceCube.classList.remove('rolling');
      set3DDiceFace(val);
    }, 600);
  }

  function showVictoryModal(roomState) {
    victoryModal.classList.remove('hidden');
    SoundFX.playWin();

    rankingsList.innerHTML = '';
    roomState.winners.forEach((color, idx) => {
      const player = roomState.players.find(p => p.color === color);
      const row = document.createElement('div');
      row.className = 'log-entry';
      row.innerHTML = `<strong>#${idx + 1} ${player ? player.name : color}</strong> (${color.toUpperCase()})`;
      rankingsList.appendChild(row);
    });
  }

  // ==========================================================================
  // FLOATING BOARD ANIMATIONS & POKES
  // ==========================================================================

  function showFloatingBoardBubble({ sender, color, text }) {
    SoundFX.playClick();
    const bubble = document.createElement('div');
    bubble.className = `floating-board-bubble bubble-${color || 'red'}`;
    bubble.innerHTML = `<strong>${sender}:</strong> ${text}`;

    boardPokeOverlay.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2600);
  }

  function triggerBoardPokeAnimation({ senderName, senderColor, targetColor, pokeType }) {
    SoundFX.playPoke();

    const pokes = {
      punch: '🥊 PUNCH!',
      tomato: '🍅 TOMATO!',
      lightning: '⚡ LIGHTNING!',
      bomb: '💣 BOMB!',
      water: '💦 WATER SPLASH!'
    };

    const text = pokes[pokeType] || '🥊 POKED!';
    showFloatingBoardBubble({ sender: senderName || 'Player', color: senderColor || 'red', text: `${text} 👉 ${targetColor ? targetColor.toUpperCase() : ''}` });
  }

  // ==========================================================================
  // EVENT LISTENERS (TAP DICE, AVATARS, CHAT TAUNTS)
  // ==========================================================================

  // TAP DIRECTLY ON 3D DICE CUBE TO ROLL
  diceCube.addEventListener('click', () => {
    if (!currentRoomState || !currentRoomState.gameStarted) return;
    const currentPlayer = currentRoomState.players[currentRoomState.currentTurnIndex];
    const playerColor = getMyColor(currentRoomState);
    if (!currentPlayer || currentPlayer.color !== playerColor || currentRoomState.hasRolled) return;

    if (isOfflineMode) {
      handleLocalRoll();
    } else if (socket) {
      socket.emit('roll_dice', { roomCode: myRoomCode });
    }
  });

  const cancelMatchBtn = document.getElementById('cancelMatchBtn');

  // Cancel Match / Return Home
  cancelMatchBtn.addEventListener('click', () => {
    if (confirm('Cancel this match and return to home to start fresh?')) {
      SoundFX.playClick();
      if (socket && myRoomCode && myRoomCode !== 'OFFLINE') {
        socket.emit('leave_room', { roomCode: myRoomCode });
      }
      myRoomCode = null;
      localStorage.removeItem('ludo_room_code');
      currentRoomState = null;
      roomCodeDisplayContainer.classList.add('hidden');
      document.querySelectorAll('.token').forEach(el => el.remove());
      lobbyModal.classList.remove('hidden');
    }
  });

  // Start Game Button
  startGameBtn.addEventListener('click', () => {
    SoundFX.playClick();
    if (socket && !isOfflineMode) {
      socket.emit('start_game', { roomCode: myRoomCode });
    } else {
      currentRoomState.gameStarted = true;
      updateUI(currentRoomState);
    }
  });

  // Tab switching inside lobby
  tabCreateRoom.addEventListener('click', () => {
    tabCreateRoom.classList.add('active');
    tabJoinRoom.classList.remove('active');
    createRoomForm.classList.add('active');
    joinRoomForm.classList.remove('active');
  });

  tabJoinRoom.addEventListener('click', () => {
    tabJoinRoom.classList.add('active');
    tabCreateRoom.classList.remove('active');
    joinRoomForm.classList.add('active');
    createRoomForm.classList.remove('active');
  });

  // Avatar Selection Listeners
  document.querySelectorAll('.avatar-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const parent = chip.parentElement;
      parent.querySelectorAll('.avatar-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Color circle selection in Create / Join form
  document.querySelectorAll('.color-circle').forEach(circle => {
    circle.addEventListener('click', () => {
      const parent = circle.parentElement;
      parent.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
      circle.classList.add('active');
    });
  });

  // Create Room submit
  createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const playerName = document.getElementById('createPlayerName').value.trim();
    const preferredColor = createRoomForm.querySelector('input[name="createColor"]:checked')?.value || 'red';
    const avatar = createRoomForm.querySelector('input[name="createAvatar"]:checked')?.value || 'assets/avatars/avatar1.png';

    localStorage.setItem('ludo_player_name', playerName);
    if (socket && !isOfflineMode) {
      socket.emit('create_room', { playerId: myPlayerId, playerName, preferredColor, avatar });
    } else {
      enableOfflineFallbackMode();
    }
  });

  // Join Room submit
  joinRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const playerName = document.getElementById('joinPlayerName').value.trim();
    const roomCode = document.getElementById('joinRoomCode').value.trim().toUpperCase();
    const preferredColor = joinRoomForm.querySelector('input[name="joinColor"]:checked')?.value || 'green';
    const avatar = joinRoomForm.querySelector('input[name="joinAvatar"]:checked')?.value || 'assets/avatars/avatar2.png';

    localStorage.setItem('ludo_player_name', playerName);
    if (socket && !isOfflineMode) {
      socket.emit('join_room', { roomCode, playerId: myPlayerId, playerName, preferredColor, avatar });
    } else {
      enableOfflineFallbackMode();
    }
  });

  // Toggle Mute
  toggleAudioBtn.addEventListener('click', () => {
    isMuted = SoundFX.toggleMute();
    toggleAudioBtn.classList.toggle('muted', isMuted);
  });

  // Copy Invite Link
  copyInviteLinkBtn.addEventListener('click', () => {
    const inviteUrl = `${window.location.origin}?room=${myRoomCode}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      copyInviteLinkBtn.title = 'Copied!';
      setTimeout(() => { copyInviteLinkBtn.title = 'Copy Invite Link'; }, 2000);
    });
  });

  // Webhook Modal Open / Close
  openWebhookBtn.addEventListener('click', () => {
    webhookModal.classList.remove('hidden');
    if (currentRoomState) {
      modalWebhookUrl.value = currentRoomState.webhookUrl || '';
    }
  });

  closeWebhookBtn.addEventListener('click', () => webhookModal.classList.add('hidden'));
  cancelWebhookBtn.addEventListener('click', () => webhookModal.classList.add('hidden'));

  // Test Webhook
  testWebhookBtn.addEventListener('click', () => {
    const url = modalWebhookUrl.value.trim();
    if (!url) return alert('Enter a Webhook URL to test');

    webhookTestBadge.innerText = 'Testing...';
    webhookTestBadge.className = 'test-result-badge';
    webhookTestBadge.classList.remove('hidden');

    if (socket) socket.emit('test_webhook', { webhookUrl: url });
  });

  // Save Webhook Settings
  webhookForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const webhookUrl = modalWebhookUrl.value.trim();
    const events = {
      MATCH_START: document.getElementById('evtMatchStart').checked,
      DICE_ROLL: document.getElementById('evtDiceRoll').checked,
      TOKEN_CAPTURED: document.getElementById('evtTokenCaptured').checked,
      TOKEN_HOME: document.getElementById('evtTokenHome').checked,
      MATCH_VICTORY: document.getElementById('evtMatchVictory').checked
    };

    if (socket) socket.emit('update_webhook', { roomCode: myRoomCode, webhookUrl, events });
    webhookModal.classList.add('hidden');
  });

  // Quick Taunt Chips Click Listeners
  document.querySelectorAll('.taunt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SoundFX.playClick();
      const msg = btn.dataset.msg;
      if (isOfflineMode) {
        showFloatingBoardBubble({ sender: 'You', color: myColor || 'red', text: msg });
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-msg';
        msgEl.innerHTML = `<span class="sender" style="color: var(--color-${myColor || 'red'})">You:</span> <span>${msg}</span>`;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else if (msg && myRoomCode && socket) {
        socket.emit('send_chat', { roomCode: myRoomCode, message: msg });
      }
    });
  });

  // Meme Voice Pack Click Listeners
  document.querySelectorAll('.voice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SoundFX.playClick();
      const title = btn.dataset.title;
      const voiceUrl = btn.dataset.voice;

      if (isOfflineMode) {
        SoundFX.playVoiceClip(voiceUrl);
        showFloatingBoardBubble({ sender: 'You', color: myColor || 'red', text: title });
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-msg voice-chat-msg';
        msgEl.innerHTML = `<span class="sender" style="color: var(--color-${myColor || 'red'})">You:</span> <span>${title} 🔊</span>`;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } else if (socket && myRoomCode) {
        socket.emit('send_chat', { roomCode: myRoomCode, message: title, voiceUrl });
      }
    });
  });

  // Live Chat Submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg && myRoomCode && socket) {
      socket.emit('send_chat', { roomCode: myRoomCode, message: msg });
      chatInput.value = '';
    }
  });

  // Mobile Bottom Navigation Tab Switching
  const gameContainer = document.querySelector('.game-container');
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SoundFX.playClick();
      document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      gameContainer.className = `game-container view-${view}`;

      if (view === 'chat') {
        unreadChatCount = 0;
        chatBadge.innerText = '0';
        chatBadge.classList.add('hidden');
        mobileChatBadge.innerText = '0';
        mobileChatBadge.classList.add('hidden');
      }
    });
  });

  if (window.innerWidth <= 768) {
    gameContainer.classList.add('view-board');
  }

  closeVictoryBtn.addEventListener('click', () => {
    victoryModal.classList.add('hidden');
    lobbyModal.classList.remove('hidden');
  });

  // ==========================================================================
  // OFFLINE GAME ENGINE & SOCKET RESPONSES
  // ==========================================================================

  function enableOfflineFallbackMode() {
    if (isOfflineMode) return;
    isOfflineMode = true;
    console.log('[Ludo Engine] Standalone Offline Mode Enabled');

    connectionStatus.className = 'status-indicator';
    connectionStatus.querySelector('.status-text').innerText = 'Offline Mode';

    currentRoomState = {
      code: 'OFFLINE',
      players: [
        { id: 'p1', socketId: 'p1', name: 'Player 1', color: 'red', avatar: 'assets/avatars/avatar1.png', isHost: true, isBot: false, connected: true },
        { id: 'p2', socketId: 'p2', name: 'Player 2', color: 'yellow', avatar: 'assets/avatars/avatar2.png', isHost: false, isBot: false, connected: true }
      ],
      gameStarted: true,
      currentTurnIndex: 0,
      diceValue: null,
      hasRolled: false,
      consecutiveSixes: 0,
      boardState: {
        red: [0, 0, 0, 0],
        green: [0, 0, 0, 0],
        yellow: [0, 0, 0, 0],
        blue: [0, 0, 0, 0]
      },
      winners: [],
      logs: ['🎮 Game running in Standalone Offline Mode']
    };

    myRoomCode = 'OFFLINE';
    myColor = 'red';
    lobbyModal.classList.add('hidden');
    updateUI(currentRoomState);
  }

  const COLOR_START_OFFLINE = { red: 0, green: 13, yellow: 26, blue: 39 };
  const SAFE_TILES_OFFLINE = [0, 8, 13, 21, 26, 34, 39, 47];

  function getGlobalTrackOffline(color, step) {
    if (step < 1 || step > 51) return null;
    return (COLOR_START_OFFLINE[color] + step - 1) % 52;
  }

  function handleLocalRoll() {
    if (!currentRoomState || !currentRoomState.gameStarted) return;
    const currentPlayer = currentRoomState.players[currentRoomState.currentTurnIndex];
    const dice = Math.floor(Math.random() * 6) + 1;
    currentRoomState.diceValue = dice;
    currentRoomState.hasRolled = true;

    if (dice === 6) {
      currentRoomState.consecutiveSixes = (currentRoomState.consecutiveSixes || 0) + 1;
      if (currentRoomState.consecutiveSixes >= 3) {
        currentRoomState.logs.push(`⚠️ ${currentPlayer.name} rolled 3 consecutive 6s! Turn forfeited.`);
        advanceLocalTurn(false);
        triggerRollAnimation(dice);
        updateUI(currentRoomState);
        return;
      }
    } else {
      currentRoomState.consecutiveSixes = 0;
    }

    currentRoomState.logs.push(`🎲 ${currentPlayer.name} rolled ${dice}`);
    triggerRollAnimation(dice);

    const validMoves = calculateValidMoves(currentRoomState, currentPlayer.color, dice);

    if (validMoves.length === 0) {
      currentRoomState.logs.push(`No valid moves for ${currentPlayer.name}`);
      updateUI(currentRoomState);
      setTimeout(() => {
        advanceLocalTurn(false);
        updateUI(currentRoomState);
      }, 1400);
      return;
    }

    const allInBase = validMoves.every(idx => currentRoomState.boardState[currentPlayer.color][idx] === 0);
    if (validMoves.length === 1 || (allInBase && dice === 6)) {
      handleLocalMove(currentPlayer.color, validMoves[0], dice);
      return;
    }

    updateUI(currentRoomState);
  }

  function handleLocalMove(color, tokenIndex, dice) {
    const currentStep = currentRoomState.boardState[color][tokenIndex];
    let newStep = currentStep === 0 ? (dice === 6 ? 1 : 0) : currentStep + dice;
    if (newStep === 0 || newStep > 57) return;

    currentRoomState.boardState[color][tokenIndex] = newStep;
    const player = currentRoomState.players.find(p => p.color === color);
    let grantExtraTurn = (dice === 6);

    // Reached Home
    if (newStep === 57) {
      grantExtraTurn = true;
      currentRoomState.logs.push(`🎉 ${player ? player.name : color} reached HOME!`);
      const allHome = currentRoomState.boardState[color].every(s => s === 57);
      if (allHome && !currentRoomState.winners.includes(color)) {
        currentRoomState.winners.push(color);
      }
    }

    // Capture check
    const newGlobal = getGlobalTrackOffline(color, newStep);
    if (newGlobal !== null && !SAFE_TILES_OFFLINE.includes(newGlobal)) {
      currentRoomState.players.forEach(opp => {
        if (opp.color === color) return;
        currentRoomState.boardState[opp.color].forEach((oppStep, oppIdx) => {
          if (getGlobalTrackOffline(opp.color, oppStep) === newGlobal) {
            currentRoomState.boardState[opp.color][oppIdx] = 0; // Send back to base!
            grantExtraTurn = true;
            currentRoomState.logs.push(`⚔️ ${player ? player.name : color} captured ${opp.name}'s token!`);
          }
        });
      });
    }

    if (currentRoomState.winners.length >= currentRoomState.players.length - 1 && currentRoomState.players.length > 1) {
      currentRoomState.gameStarted = false;
    }

    advanceLocalTurn(grantExtraTurn);
    updateUI(currentRoomState);
  }

  function advanceLocalTurn(grantExtraTurn) {
    if (grantExtraTurn) {
      currentRoomState.hasRolled = false;
      currentRoomState.diceValue = null;
      return;
    }

    currentRoomState.consecutiveSixes = 0;
    currentRoomState.hasRolled = false;
    currentRoomState.diceValue = null;
    currentRoomState.currentTurnIndex = (currentRoomState.currentTurnIndex + 1) % currentRoomState.players.length;
    myColor = currentRoomState.players[currentRoomState.currentTurnIndex].color;
  }

  if (socket) {
    socket.on('connect_error', (err) => {
      connectErrorCount++;
      connectionStatus.className = 'status-indicator';
      connectionStatus.querySelector('.status-text').innerText = 'Connecting...';

      // If serverless (Vercel) fails Socket.io polling with 400 Bad Request, fall back smoothly to Standalone Offline Mode
      if (connectErrorCount >= 3 || window.location.protocol === 'file:') {
        console.warn('[Socket.io] Backend serverless/polling connection failed. Enabling Offline Mode.', err);
        socket.disconnect();
        enableOfflineFallbackMode();
      }
    });

    socket.on('connect', () => {
      isOfflineMode = false;
      connectionStatus.className = 'status-indicator online';
      connectionStatus.querySelector('.status-text').innerText = 'Connected';

      const savedRoom = localStorage.getItem('ludo_room_code');
      if (savedRoom && savedRoom !== 'OFFLINE' && myPlayerId) {
        socket.emit('rejoin_room', { roomCode: savedRoom, playerId: myPlayerId });
      }
    });

    socket.on('rejoin_failed', () => {
      console.log('[Rejoin Failed] Cleared expired room code');
      myRoomCode = null;
      localStorage.removeItem('ludo_room_code');
      roomCodeDisplayContainer.classList.add('hidden');
      lobbyModal.classList.remove('hidden');
    });

    socket.on('disconnect', () => {
      connectionStatus.className = 'status-indicator';
      connectionStatus.querySelector('.status-text').innerText = 'Reconnecting...';
    });

    socket.on('room_created', ({ roomCode, playerColor, roomState }) => {
      myRoomCode = roomCode;
      myColor = playerColor;
      localStorage.setItem('ludo_room_code', roomCode);
      lobbyModal.classList.add('hidden');
      updateUI(roomState);
    });

    socket.on('room_joined', ({ roomCode, playerColor, roomState }) => {
      myRoomCode = roomCode;
      myColor = playerColor;
      localStorage.setItem('ludo_room_code', roomCode);
      lobbyModal.classList.add('hidden');
      updateUI(roomState);
    });

    socket.on('game_state_update', (roomState) => {
      if (roomState.diceValue && (!currentRoomState || currentRoomState.diceValue !== roomState.diceValue)) {
        triggerRollAnimation(roomState.diceValue);
      }
      updateUI(roomState);
    });

    socket.on('webhook_test_result', ({ success, message }) => {
      webhookTestBadge.innerText = success ? `HTTP 200 OK` : `Error: ${message}`;
      webhookTestBadge.className = `test-result-badge ${success ? 'success' : 'error'}`;
      webhookTestBadge.classList.remove('hidden');
    });

    socket.on('chat_message', ({ sender, color, text, voiceUrl }) => {
      const msgEl = document.createElement('div');
      msgEl.className = `chat-msg ${voiceUrl ? 'voice-chat-msg' : ''}`;
      msgEl.innerHTML = `<span class="sender" style="color: var(--color-${color})">${sender}:</span> <span>${text} ${voiceUrl ? '🔊' : ''}</span>`;
      chatMessages.appendChild(msgEl);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      if (voiceUrl) {
        SoundFX.playVoiceClip(voiceUrl);
      }
      showFloatingBoardBubble({ sender, color, text });
    });

    socket.on('player_poked', (data) => {
      triggerBoardPokeAnimation(data);
    });

    socket.on('error_message', (msg) => {
      alert(`Notice: ${msg}`);
    });
  }
});
