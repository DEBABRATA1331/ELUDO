/**
 * LUDO REAL-TIME FRONTEND APPLICATION SCRIPT
 * Manages Socket.io events, DOM Board Rendering, Avatars, Host Controls, Quick Taunts & Board Poke Animations
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

  // Socket.io Connection with Fast Reconnection Options & Graceful Offline Fallback
  let socket = null;
  let isOfflineMode = false;

  try {
    if (typeof io !== 'undefined') {
      socket = io({
        reconnection: true,
        reconnectionAttempts: 50,
        reconnectionDelay: 500,
        reconnectionDelayMax: 1500,
        timeout: 10000
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

  const logsContainer = document.getElementById('logsContainer');
  const webhookFeedContainer = document.getElementById('webhookFeedContainer');
  const webhookTargetUrl = document.getElementById('webhookTargetUrl');
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
  // BOARD GRID GENERATION (REALISTIC)
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

    const inner = document.createElement('div');
    inner.className = 'base-inner';

    for (let i = 0; i < 4; i++) {
      const spot = document.createElement('div');
      spot.className = 'base-spot';
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

    Object.keys(roomState.boardState).forEach(color => {
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

        if (isMyTurn && roomState.hasRolled && roomState.diceValue) {
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

    Object.keys(cellTokenMap).forEach(cellId => {
      const container = document.getElementById(cellId);
      if (!container) return;

      const tokens = cellTokenMap[cellId];
      if (tokens.length > 1 && !cellId.startsWith('base_spot_')) {
        container.classList.add('cell-multi-tokens');
      } else {
        container.classList.remove('cell-multi-tokens');
      }

      tokens.forEach(tok => container.appendChild(tok));
    });
  }

  function calculateValidMoves(roomState, color, dice) {
    const tokens = roomState.boardState[color];
    const valid = [];
    tokens.forEach((step, idx) => {
      if (step === 57) return;
      if (step === 0 && dice === 6) valid.push(idx);
      else if (step > 0 && step + dice <= 57) valid.push(idx);
    });
    return valid;
  }

  // ==========================================================================
  // RENDER UI PANELS, AVATARS & HOST CONTROLS
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

    // Webhook Target
    if (roomState.webhookUrl) {
      webhookTargetUrl.innerText = `Webhook Target: ${roomState.webhookUrl}`;
    } else {
      webhookTargetUrl.innerText = 'Webhook Target: Not Configured';
    }

    renderLogs(roomState.logs);
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

    // Strictly enforce ONLY Host / Co-Host can start match
    if (me && (me.isHost || me.isCoHost) && !roomState.gameStarted) {
      startGameBtn.classList.remove('hidden');
    } else {
      startGameBtn.classList.add('hidden');
    }
  }

  function renderLogs(logs) {
    logsContainer.innerHTML = '';
    logs.slice().reverse().forEach(log => {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerText = log;
      logsContainer.appendChild(entry);
    });
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
  // POKE BOARD ANIMATIONS
  // ==========================================================================

  function triggerBoardPokeAnimation({ senderName, senderColor, targetColor, pokeType }) {
    SoundFX.playPoke();

    const pokes = {
      punch: '🥊',
      tomato: '🍅',
      lightning: '⚡',
      bomb: '💣',
      water: '💦'
    };

    const emoji = pokes[pokeType] || '🥊';
    const pokeEl = document.createElement('div');
    pokeEl.className = 'flying-poke-item';
    pokeEl.innerText = emoji;

    // Position targets based on home bases (red top-left, green top-right, yellow bottom-right, blue bottom-left)
    const posMap = {
      red: { top: '25%', left: '25%' },
      green: { top: '25%', left: '75%' },
      yellow: { top: '75%', left: '75%' },
      blue: { top: '75%', left: '25%' }
    };

    const targetPos = posMap[targetColor] || { top: '50%', left: '50%' };
    pokeEl.style.top = targetPos.top;
    pokeEl.style.left = targetPos.left;

    boardPokeOverlay.appendChild(pokeEl);
    setTimeout(() => pokeEl.remove(), 1400);
  }

  // ==========================================================================
  // EVENT LISTENERS (TAP DICE, AVATARS, CHAT TAUNTS)
  // ==========================================================================

  // TAP DIRECTLY ON 3D DICE CUBE TO ROLL
  diceCube.addEventListener('click', () => {
    if (!currentRoomState || !currentRoomState.gameStarted) return;
    const currentPlayer = currentRoomState.players[currentRoomState.currentTurnIndex];
    if (!currentPlayer || currentPlayer.color !== myColor || currentRoomState.hasRolled) return;

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
      if (msg && myRoomCode && socket && !isOfflineMode) {
        socket.emit('send_chat', { roomCode: myRoomCode, message: msg });
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

  // Sidebar Tab Switching & Unread Counter Reset
  document.querySelectorAll('.panel-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.panel-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'chatBox') {
        unreadChatCount = 0;
        chatBadge.innerText = '0';
        chatBadge.classList.add('hidden');
        mobileChatBadge.innerText = '0';
        mobileChatBadge.classList.add('hidden');
      }
    });
  });

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

  function handleLocalRoll() {
    const dice = Math.floor(Math.random() * 6) + 1;
    currentRoomState.diceValue = dice;
    currentRoomState.hasRolled = true;
    currentRoomState.logs.push(`🎲 Rolled ${dice}`);
    triggerRollAnimation(dice);
    updateUI(currentRoomState);
  }

  function handleLocalMove(color, tokenIndex, dice) {
    const currentStep = currentRoomState.boardState[color][tokenIndex];
    let newStep = currentStep === 0 ? 1 : currentStep + dice;
    if (newStep <= 57) {
      currentRoomState.boardState[color][tokenIndex] = newStep;
      currentRoomState.hasRolled = false;
      currentRoomState.diceValue = null;
      currentRoomState.currentTurnIndex = (currentRoomState.currentTurnIndex + 1) % currentRoomState.players.length;
      myColor = currentRoomState.players[currentRoomState.currentTurnIndex].color;
      updateUI(currentRoomState);
    }
  }

  if (socket) {
    socket.on('connect_error', () => {
      connectionStatus.className = 'status-indicator';
      connectionStatus.querySelector('.status-text').innerText = 'Connecting...';
      if (window.location.protocol === 'file:') {
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

    socket.on('chat_message', ({ sender, color, text }) => {
      const msgEl = document.createElement('div');
      msgEl.className = 'chat-msg';
      msgEl.innerHTML = `<span class="sender" style="color: var(--color-${color})">${sender}:</span> <span>${text}</span>`;
      chatMessages.appendChild(msgEl);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      // Update Unread Counter if Chat tab is not active
      const isChatTabActive = document.getElementById('chatBox').classList.contains('active');
      if (!isChatTabActive) {
        unreadChatCount++;
        chatBadge.innerText = unreadChatCount;
        chatBadge.classList.remove('hidden');
        mobileChatBadge.innerText = unreadChatCount;
        mobileChatBadge.classList.remove('hidden');
      }
    });

    socket.on('player_poked', (data) => {
      triggerBoardPokeAnimation(data);
    });

    socket.on('error_message', (msg) => {
      alert(`Notice: ${msg}`);
    });
  }
});
