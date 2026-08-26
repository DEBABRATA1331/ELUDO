/**
 * LUDO REAL-TIME FRONTEND APPLICATION SCRIPT
 * Manages Socket.io events, DOM Board Rendering, 3D Dice Animations & UI Interaction
 */

document.addEventListener('DOMContentLoaded', () => {
  // Socket.io Connection
  const socket = io();

  // Application State
  let myRoomCode = null;
  let myColor = null;
  let currentRoomState = null;
  let isMuted = false;

  // DOM Elements
  const ludoBoard = document.getElementById('ludoBoard');
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
  const rollDiceBtn = document.getElementById('rollDiceBtn');
  const diceResultText = document.getElementById('diceResultText');
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
  // BOARD GRID GENERATION
  // ==========================================================================

  function buildBoardGrid() {
    ludoBoard.innerHTML = '';

    // Create 15x15 Cells
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Handle 6x6 Bases
        if (r < 6 && c < 6 && r === 0 && c === 0) {
          createBaseYard('red', 0, 0);
        } else if (r < 6 && c > 8 && r === 0 && c === 9) {
          createBaseYard('green', 0, 9);
        } else if (r > 8 && c > 8 && r === 9 && c === 9) {
          createBaseYard('yellow', 9, 9);
        } else if (r > 8 && c < 6 && r === 9 && c === 0) {
          createBaseYard('blue', 9, 0);
        } else if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
          // Center 3x3 Home Triangle Area
          if (r === 6 && c === 6) createCenterHome();
        } else if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c > 8) || (r > 8 && c < 6)) {
          // Inside 6x6 Base area (handled by base yard span)
          continue;
        } else {
          // Regular Path Tile
          createPathCell(r, c);
        }
      }
    }
  }

  function createBaseYard(color, row, col) {
    const baseCell = document.createElement('div');
    baseCell.className = `cell cell-base ${color}-base`;
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

    // Color path classes & safe spot markers
    if (r === 6 && c >= 1 && c <= 5) cell.classList.add('path-red');
    if (r === 7 && c >= 1 && c <= 5) cell.classList.add('home-red');
    if (r === 6 && c === 1) cell.classList.add('start-red', 'safe-star');

    if (c === 8 && r >= 1 && r <= 5) cell.classList.add('path-green');
    if (c === 7 && r >= 1 && r <= 5) cell.classList.add('home-green');
    if (r === 1 && c === 8) cell.classList.add('start-green', 'safe-star');

    if (r === 8 && c >= 9 && c <= 13) cell.classList.add('path-yellow');
    if (r === 7 && c >= 9 && c <= 13) cell.classList.add('home-yellow');
    if (r === 8 && c === 13) cell.classList.add('start-yellow', 'safe-star');

    if (c === 6 && r >= 9 && r <= 13) cell.classList.add('path-blue');
    if (c === 7 && r >= 9 && r <= 13) cell.classList.add('home-blue');
    if (r === 13 && c === 6) cell.classList.add('start-blue', 'safe-star');

    // Additional Star Safe Spots
    if ((r === 2 && c === 6) || (r === 6 && c === 12) || (r === 12 && c === 8) || (r === 8 && c === 2)) {
      cell.classList.add('safe-star');
    }

    ludoBoard.appendChild(cell);
  }

  // ==========================================================================
  // RENDER BOARD STATE & TOKENS
  // ==========================================================================

  function renderBoard(roomState) {
    // Clear all existing tokens from board
    document.querySelectorAll('.token').forEach(el => el.remove());

    if (!roomState || !roomState.boardState) return;

    const currentPlayer = roomState.players[roomState.currentTurnIndex];
    const isMyTurn = (currentPlayer && currentPlayer.color === myColor && roomState.gameStarted);

    // Map cells to tokens for stacking multiple tokens on same tile
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
        tokenEl.innerText = tokenIndex + 1;

        // Check if move is valid for this token
        if (isMyTurn && roomState.hasRolled && roomState.diceValue) {
          const validMoves = calculateValidMoves(roomState, myColor, roomState.diceValue);
          if (validMoves.includes(tokenIndex)) {
            tokenEl.classList.add('can-move');
            tokenEl.addEventListener('click', (e) => {
              e.stopPropagation();
              SoundFX.playMove();
              socket.emit('move_token', { roomCode: myRoomCode, tokenIndex });
            });
          }
        }

        const cellId = parentContainer.id;
        if (!cellTokenMap[cellId]) cellTokenMap[cellId] = [];
        cellTokenMap[cellId].push(tokenEl);
      });
    });

    // Append tokens to DOM & handle stacking styling
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
  // RENDER UI PANELS & CONTROLS
  // ==========================================================================

  function updateUI(roomState) {
    currentRoomState = roomState;
    myRoomCode = roomState.code;

    // Room Header
    roomCodeText.innerText = roomState.code;
    roomCodeDisplayContainer.classList.remove('hidden');

    // Players Count & List
    playerCount.innerText = roomState.players.length;
    renderPlayersList(roomState);

    // Turn Banner
    const currentPlayer = roomState.players[roomState.currentTurnIndex];
    if (!roomState.gameStarted) {
      turnBanner.className = 'turn-banner color-red';
      turnText.innerText = 'Waiting for game host to start...';
      rollDiceBtn.disabled = true;
    } else {
      turnBanner.className = `turn-banner color-${currentPlayer.color}`;
      const isMyTurn = (currentPlayer.color === myColor);
      turnText.innerText = isMyTurn ? `🎯 YOUR TURN (${currentPlayer.color.toUpperCase()})` : `⏳ ${currentPlayer.name}'s Turn (${currentPlayer.color.toUpperCase()})`;

      rollDiceBtn.disabled = !(isMyTurn && !roomState.hasRolled);
    }

    // Dice Value Display
    if (roomState.diceValue) {
      diceValueDisplay.innerText = roomState.diceValue;
      set3DDiceFace(roomState.diceValue);
    } else {
      diceValueDisplay.innerText = '-';
    }

    // Webhook Feed Status
    if (roomState.webhookUrl) {
      webhookTargetUrl.innerText = `Webhook Target: ${roomState.webhookUrl}`;
    } else {
      webhookTargetUrl.innerText = 'Webhook Target: Not Configured';
    }

    // Render Logs & Chat
    renderLogs(roomState.logs);

    // Render Board Tokens
    renderBoard(roomState);

    // Check Victory
    if (roomState.winners && roomState.winners.length > 0) {
      showVictoryModal(roomState);
    }
  }

  function renderPlayersList(roomState) {
    playersList.innerHTML = '';

    roomState.players.forEach(p => {
      const card = document.createElement('div');
      const isTurn = roomState.gameStarted && roomState.players[roomState.currentTurnIndex]?.color === p.color;
      card.className = `player-card ${isTurn ? 'active-turn' : ''}`;

      const homeTokens = roomState.boardState[p.color] ? roomState.boardState[p.color].filter(s => s === 57).length : 0;

      card.innerHTML = `
        <div class="player-info">
          <span class="color-dot ${p.color}"></span>
          <span class="player-name">${p.name} ${p.color === myColor ? '(You)' : ''}</span>
          <div class="player-tags">
            ${p.isHost ? '<span class="tag tag-host">HOST</span>' : ''}
            ${p.isBot ? '<span class="tag tag-bot">BOT</span>' : ''}
          </div>
        </div>
        <div class="player-progress">
          🏠 ${homeTokens}/4 Home
        </div>
      `;
      playersList.appendChild(card);
    });

    // Add open slots
    if (roomState.players.length < 4 && !roomState.gameStarted) {
      const isHost = roomState.players.find(p => p.socketId === socket.id)?.isHost;
      if (isHost) {
        const addBotBtn = document.createElement('button');
        addBotBtn.className = 'btn btn-secondary btn-block empty-slot';
        addBotBtn.innerHTML = '🤖 + Add AI Bot';
        addBotBtn.addEventListener('click', () => {
          SoundFX.playClick();
          socket.emit('add_bot', { roomCode: myRoomCode });
        });
        playersList.appendChild(addBotBtn);
      }
    }

    // Start Game Button visibility
    const me = roomState.players.find(p => p.socketId === socket.id);
    if (me && me.isHost && !roomState.gameStarted) {
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
    diceCube.className = `dice-cube show-${val}`;
  }

  function triggerRollAnimation(val) {
    SoundFX.playRoll();
    diceCube.classList.add('rolling');
    setTimeout(() => {
      diceCube.classList.remove('rolling');
      set3DDiceFace(val);
    }, 600);
  }

  function addWebhookLog(event, data) {
    const entry = document.createElement('div');
    entry.className = 'log-entry code-font';
    entry.innerHTML = `<strong>[${new Date().toLocaleTimeString()}] ${event}</strong><br>${JSON.stringify(data)}`;
    webhookFeedContainer.prepend(entry);
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
  // EVENT LISTENERS
  // ==========================================================================

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

  // Create Room submit
  createRoomForm.addEventListener('click', () => SoundFX.playClick());
  createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const playerName = document.getElementById('createPlayerName').value.trim();
    const webhookUrl = document.getElementById('createWebhookUrl').value.trim();
    socket.emit('create_room', { playerName, webhookUrl });
  });

  // Join Room submit
  joinRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const playerName = document.getElementById('joinPlayerName').value.trim();
    const roomCode = document.getElementById('joinRoomCode').value.trim().toUpperCase();
    socket.emit('join_room', { roomCode, playerName });
  });

  // Roll Dice Button
  rollDiceBtn.addEventListener('click', () => {
    if (rollDiceBtn.disabled) return;
    socket.emit('roll_dice', { roomCode: myRoomCode });
  });

  // Start Game Button
  startGameBtn.addEventListener('click', () => {
    SoundFX.playClick();
    socket.emit('start_game', { roomCode: myRoomCode });
  });

  // Toggle Mute
  toggleAudioBtn.addEventListener('click', () => {
    isMuted = SoundFX.toggleMute();
    toggleAudioBtn.innerText = isMuted ? '🔇' : '🔊';
  });

  // Copy Invite Link
  copyInviteLinkBtn.addEventListener('click', () => {
    const inviteUrl = `${window.location.origin}?room=${myRoomCode}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      copyInviteLinkBtn.innerText = '✅ Copied!';
      setTimeout(() => { copyInviteLinkBtn.innerText = '📋 Copy Link'; }, 2000);
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

    socket.emit('test_webhook', { webhookUrl: url });
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

    socket.emit('update_webhook', { roomCode: myRoomCode, webhookUrl, events });
    webhookModal.classList.add('hidden');
  });

  // Live Chat Submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg && myRoomCode) {
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
    });
  });

  // Default Mobile View
  if (window.innerWidth <= 768) {
    gameContainer.classList.add('view-board');
  }

  // Sidebar Tab Switching
  document.querySelectorAll('.panel-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.panel-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.dataset.tab;
      document.getElementById(targetId).classList.add('active');
    });
  });

  closeVictoryBtn.addEventListener('click', () => {
    victoryModal.classList.add('hidden');
    lobbyModal.classList.remove('hidden');
  });

  // ==========================================================================
  // SOCKET.IO RESPONSES
  // ==========================================================================

  socket.on('connect', () => {
    connectionStatus.className = 'status-indicator online';
    connectionStatus.querySelector('.status-text').innerText = 'Connected';
  });

  socket.on('disconnect', () => {
    connectionStatus.className = 'status-indicator';
    connectionStatus.querySelector('.status-text').innerText = 'Disconnected';
  });

  socket.on('room_created', ({ roomCode, playerColor, roomState }) => {
    myRoomCode = roomCode;
    myColor = playerColor;
    lobbyModal.classList.add('hidden');
    updateUI(roomState);
    addWebhookLog('ROOM_CREATED', { roomCode, playerColor });
  });

  socket.on('room_joined', ({ roomCode, playerColor, roomState }) => {
    myRoomCode = roomCode;
    myColor = playerColor;
    lobbyModal.classList.add('hidden');
    updateUI(roomState);
    addWebhookLog('ROOM_JOINED', { roomCode, playerColor });
  });

  socket.on('game_state_update', (roomState) => {
    if (roomState.diceValue && (!currentRoomState || currentRoomState.diceValue !== roomState.diceValue)) {
      triggerRollAnimation(roomState.diceValue);
    }
    updateUI(roomState);
  });

  socket.on('webhook_test_result', ({ success, statusCode, message }) => {
    webhookTestBadge.innerText = success ? `✅ ${message || 'HTTP 200 OK'}` : `❌ Error: ${message}`;
    webhookTestBadge.className = `test-result-badge ${success ? 'success' : 'error'}`;
    webhookTestBadge.classList.remove('hidden');
  });

  socket.on('chat_message', ({ sender, color, text, time }) => {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg';
    msgEl.innerHTML = `<span class="sender" style="color: var(--color-${color})">${sender}:</span> <span>${text}</span>`;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  socket.on('error_message', (msg) => {
    alert(`Notice: ${msg}`);
  });
});
