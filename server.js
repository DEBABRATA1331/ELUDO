const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Constants & Ludo Rules Data
const COLORS = ['red', 'green', 'yellow', 'blue'];
const COLOR_START = { red: 0, green: 13, yellow: 26, blue: 39 };
const SAFE_TILES = [0, 8, 13, 21, 26, 34, 39, 47];

// In-Memory Room Database
const rooms = {};

// Helper: Webhook Dispatcher
async function dispatchWebhook(room, eventType, data) {
  if (!room.webhookUrl) return;
  if (room.webhookEvents && room.webhookEvents[eventType] === false) return;

  const payload = {
    event: eventType,
    roomCode: room.code,
    timestamp: new Date().toISOString(),
    game: {
      players: room.players.map(p => ({ name: p.name, color: p.color, isBot: p.isBot })),
      currentTurn: room.players[room.currentTurnIndex]?.color,
      status: room.gameStarted ? (room.winner ? 'finished' : 'in_progress') : 'waiting'
    },
    details: data
  };

  try {
    // Dynamic import of fetch or standard http/https POST
    const url = new URL(room.webhookUrl);
    const transport = url.protocol === 'https:' ? require('https') : require('http');
    const postData = JSON.stringify(payload);

    const req = transport.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Ludo-Webhook-Engine/1.0'
      },
      timeout: 5000
    });

    req.on('error', (err) => {
      console.log(`[Webhook Error] Room ${room.code}:`, err.message);
    });

    req.write(postData);
    req.end();
  } catch (err) {
    console.log(`[Webhook Invalid URL] Room ${room.code}:`, err.message);
  }
}

// Convert player token step to global track index
function getGlobalTrackIndex(color, step) {
  if (step < 1 || step > 51) return null;
  return (COLOR_START[color] + step - 1) % 52;
}

// Generate unique 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms[code] ? generateRoomCode() : code;
}

// Calculate valid moves for a given dice roll
function getValidMoves(room, color, dice) {
  const tokens = room.boardState[color];
  const validIndices = [];

  tokens.forEach((step, index) => {
    if (step === 57) return; // Already in Home center
    if (step === 0) {
      // Token in base requires 6 to enter
      if (dice === 6) validIndices.push(index);
    } else {
      // Token on track or home corridor
      if (step + dice <= 57) {
        validIndices.push(index);
      }
    }
  });

  return validIndices;
}

// Initialize room state
function createRoomState(code, hostName, webhookUrl = '') {
  return {
    code,
    players: [
      {
        id: null,
        socketId: null,
        name: hostName || 'Host',
        color: 'red',
        isHost: true,
        isBot: false,
        connected: true
      }
    ],
    gameStarted: false,
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
    webhookUrl: webhookUrl,
    webhookEvents: {
      MATCH_START: true,
      DICE_ROLL: true,
      TOKEN_CAPTURED: true,
      TOKEN_HOME: true,
      MATCH_VICTORY: true
    },
    logs: [`Room ${code} created by ${hostName || 'Host'}`]
  };
}

// Advance turn to next active color
function advanceTurn(room, extraTurn = false) {
  if (extraTurn && !room.winners.includes(room.players[room.currentTurnIndex]?.color)) {
    room.hasRolled = false;
    room.diceValue = null;
    return;
  }

  room.consecutiveSixes = 0;
  room.hasRolled = false;
  room.diceValue = null;

  let nextIndex = (room.currentTurnIndex + 1) % room.players.length;
  let attempts = 0;
  // Skip players who have already finished all tokens
  while (room.winners.includes(room.players[nextIndex]?.color) && attempts < room.players.length) {
    nextIndex = (nextIndex + 1) % room.players.length;
    attempts++;
  }

  room.currentTurnIndex = nextIndex;

  // Auto-play for Bot turn
  const currentPlayer = room.players[room.currentTurnIndex];
  if (currentPlayer && currentPlayer.isBot && !room.winners.includes(currentPlayer.color)) {
    setTimeout(() => handleBotTurn(room), 1000);
  }
}

// Handle AI Bot auto turn logic
function handleBotTurn(room) {
  if (!room.gameStarted) return;
  const currentPlayer = room.players[room.currentTurnIndex];
  if (!currentPlayer || !currentPlayer.isBot) return;

  // 1. Roll dice
  const dice = Math.floor(Math.random() * 6) + 1;
  room.diceValue = dice;
  room.hasRolled = true;

  if (dice === 6) {
    room.consecutiveSixes++;
    if (room.consecutiveSixes >= 3) {
      room.logs.push(`🤖 Bot (${currentPlayer.name}) rolled 3 consecutive 6s! Turn forfeited.`);
      advanceTurn(room, false);
      io.to(room.code).emit('game_state_update', room);
      return;
    }
  } else {
    room.consecutiveSixes = 0;
  }

  dispatchWebhook(room, 'DICE_ROLL', { player: currentPlayer.name, color: currentPlayer.color, dice });
  const validMoves = getValidMoves(room, currentPlayer.color, dice);

  if (validMoves.length === 0) {
    room.logs.push(`🤖 Bot (${currentPlayer.name}) rolled ${dice} (No valid moves)`);
    io.to(room.code).emit('game_state_update', room);
    setTimeout(() => {
      advanceTurn(room, false);
      io.to(room.code).emit('game_state_update', room);
    }, 1200);
    return;
  }

  // 2. Select best token to move
  // Priority: 1) Reaching Home 2) Capturing opponent 3) Exit base 4) Advance farthest token
  let chosenTokenIndex = validMoves[0];
  let maxScore = -1;

  validMoves.forEach(tokenIndex => {
    let score = 0;
    const currentStep = room.boardState[currentPlayer.color][tokenIndex];
    const newStep = currentStep === 0 ? 1 : currentStep + dice;

    if (newStep === 57) score += 1000; // Reach home
    if (currentStep === 0 && dice === 6) score += 500; // Exit base

    // Check capture potential
    const newGlobalTrack = getGlobalTrackIndex(currentPlayer.color, newStep);
    if (newGlobalTrack !== null && !SAFE_TILES.includes(newGlobalTrack)) {
      for (const p of room.players) {
        if (p.color === currentPlayer.color) continue;
        room.boardState[p.color].forEach(oppStep => {
          const oppGlobal = getGlobalTrackIndex(p.color, oppStep);
          if (oppGlobal === newGlobalTrack) score += 800; // Capture opponent!
        });
      }
    }

    score += newStep; // Farthest advance
    if (score > maxScore) {
      maxScore = score;
      chosenTokenIndex = tokenIndex;
    }
  });

  io.to(room.code).emit('game_state_update', room);

  setTimeout(() => {
    executeMove(room, currentPlayer.color, chosenTokenIndex, dice);
  }, 1000);
}

// Execute movement logic for a token
function executeMove(room, color, tokenIndex, dice) {
  const currentStep = room.boardState[color][tokenIndex];
  let newStep = currentStep;

  if (currentStep === 0) {
    if (dice === 6) newStep = 1;
    else return;
  } else {
    newStep = currentStep + dice;
    if (newStep > 57) return; // Overshoot
  }

  room.boardState[color][tokenIndex] = newStep;
  const player = room.players.find(p => p.color === color);
  let grantExtraTurn = (dice === 6);
  let capturedToken = false;

  // Check if token reached Home Center (57)
  if (newStep === 57) {
    grantExtraTurn = true;
    room.logs.push(`🎉 ${player.name} (${color.toUpperCase()}) reached HOME with token #${tokenIndex + 1}!`);
    dispatchWebhook(room, 'TOKEN_HOME', { player: player.name, color, tokenIndex });

    // Check if player won
    const allHome = room.boardState[color].every(s => s === 57);
    if (allHome && !room.winners.includes(color)) {
      room.winners.push(color);
      room.logs.push(`🏆 ${player.name} (${color.toUpperCase()}) finished in place #${room.winners.length}!`);
      dispatchWebhook(room, 'MATCH_VICTORY', { player: player.name, color, rank: room.winners.length });
    }
  }

  // Check capture on main track
  const newGlobalTrack = getGlobalTrackIndex(color, newStep);
  if (newGlobalTrack !== null && !SAFE_TILES.includes(newGlobalTrack)) {
    room.players.forEach(oppPlayer => {
      if (oppPlayer.color === color) return;
      room.boardState[oppPlayer.color].forEach((oppStep, oppIndex) => {
        const oppGlobal = getGlobalTrackIndex(oppPlayer.color, oppStep);
        if (oppGlobal !== null && oppGlobal === newGlobalTrack) {
          // CAPTURE!
          room.boardState[oppPlayer.color][oppIndex] = 0; // Send back to base
          capturedToken = true;
          grantExtraTurn = true;
          room.logs.push(`⚔️ ${player.name} (${color.toUpperCase()}) captured ${oppPlayer.name}'s token!`);
          dispatchWebhook(room, 'TOKEN_CAPTURED', {
            attacker: player.name,
            victim: oppPlayer.name,
            victimColor: oppPlayer.color
          });
        }
      });
    });
  }

  advanceTurn(room, grantExtraTurn);
  io.to(room.code).emit('game_state_update', room);
}

// Helper to find available unassigned colors
function getAvailableColor(room) {
  const taken = room.players.map(p => p.color);
  return COLORS.find(c => !taken.includes(c)) || 'red';
}

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // 1. Create Room
  socket.on('create_room', ({ playerId, playerName, webhookUrl, preferredColor }) => {
    const code = generateRoomCode();
    const room = createRoomState(code, playerName, webhookUrl);
    
    room.players[0].playerId = playerId || socket.id;
    room.players[0].socketId = socket.id;
    if (preferredColor && COLORS.includes(preferredColor)) {
      room.players[0].color = preferredColor;
    }

    rooms[code] = room;
    socket.join(code);

    socket.emit('room_created', { roomCode: code, playerColor: room.players[0].color, roomState: room });
    console.log(`[Room Created] Code: ${code}, Host: ${playerName}, PlayerID: ${room.players[0].playerId}`);
  });

  // 2. Join Room / Re-bind existing player
  socket.on('join_room', ({ roomCode, playerId, playerName, preferredColor }) => {
    const code = roomCode.trim().toUpperCase();
    const room = rooms[code];

    if (!room) {
      return socket.emit('error_message', 'Room not found. Check the code!');
    }

    // Check if player already exists in room (e.g. page refresh / link click)
    const existingPlayer = playerId ? room.players.find(p => p.playerId === playerId) : null;
    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      if (playerName) existingPlayer.name = playerName;
      socket.join(code);

      room.logs.push(`⚡ ${existingPlayer.name} reconnected`);
      socket.emit('room_joined', { roomCode: code, playerColor: existingPlayer.color, roomState: room });
      return io.to(code).emit('game_state_update', room);
    }

    if (room.gameStarted) {
      return socket.emit('error_message', 'Game already in progress!');
    }
    if (room.players.length >= 4) {
      return socket.emit('error_message', 'Room is full (max 4 players)!');
    }

    const assignedColor = (preferredColor && !room.players.some(p => p.color === preferredColor))
      ? preferredColor
      : getAvailableColor(room);

    const newPlayer = {
      id: socket.id,
      playerId: playerId || socket.id,
      socketId: socket.id,
      name: playerName || `Player ${room.players.length + 1}`,
      color: assignedColor,
      isHost: false,
      isBot: false,
      connected: true
    };

    room.players.push(newPlayer);
    room.logs.push(`${newPlayer.name} joined as ${assignedColor.toUpperCase()}`);
    socket.join(code);

    socket.emit('room_joined', { roomCode: code, playerColor: assignedColor, roomState: room });
    io.to(code).emit('game_state_update', room);
  });

  // 3. Dedicated Rejoin Handshake (Page Reload / Network Drop)
  socket.on('rejoin_room', ({ roomCode, playerId }) => {
    const code = roomCode ? roomCode.trim().toUpperCase() : '';
    const room = rooms[code];

    if (!room || !playerId) {
      return socket.emit('rejoin_failed', { message: 'Room not found or expired' });
    }

    const existingPlayer = room.players.find(p => p.playerId === playerId);
    if (existingPlayer) {
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      socket.join(code);

      room.logs.push(`⚡ ${existingPlayer.name} reconnected to game`);
      socket.emit('room_joined', { roomCode: code, playerColor: existingPlayer.color, roomState: room });
      io.to(code).emit('game_state_update', room);
    } else {
      socket.emit('rejoin_failed', { message: 'Player session not found in room' });
    }
  });

  // Leave / Cancel Match Handler
  socket.on('leave_room', ({ roomCode }) => {
    const code = roomCode ? roomCode.trim().toUpperCase() : '';
    const room = rooms[code];
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex !== -1) {
      const leavingPlayer = room.players.splice(playerIndex, 1)[0];
      socket.leave(code);
      room.logs.push(`🚪 ${leavingPlayer.name} left the match`);

      if (room.players.length === 0) {
        delete rooms[code];
      } else {
        if (leavingPlayer.isHost) {
          const nextHost = room.players.find(p => p.connected && !p.isBot);
          if (nextHost) nextHost.isHost = true;
        }
        io.to(code).emit('game_state_update', room);
      }
    }
  });

  // Select / Change Color in Lobby
  socket.on('select_color', ({ roomCode, color }) => {
    const room = rooms[roomCode];
    if (!room || room.gameStarted) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) return;

    const isTaken = room.players.some(p => p.color === color && p.socketId !== socket.id);
    if (isTaken) {
      return socket.emit('error_message', 'That color/home is already picked by another player!');
    }

    const oldColor = player.color;
    player.color = color;
    room.logs.push(`${player.name} switched home base from ${oldColor.toUpperCase()} to ${color.toUpperCase()}`);
    io.to(roomCode).emit('game_state_update', room);
  });

  // 4. Add AI Bot
  socket.on('add_bot', ({ roomCode, preferredColor }) => {
    const room = rooms[roomCode];
    if (!room || room.gameStarted || room.players.length >= 4) return;

    const assignedColor = (preferredColor && !room.players.some(p => p.color === preferredColor))
      ? preferredColor
      : getAvailableColor(room);

    const botNames = ['RoboRoller', 'LudoMaster AI', 'CyberPawn', 'ByteRunner'];
    const botName = botNames[room.players.length - 1] || `Bot ${room.players.length + 1}`;

    const botPlayer = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      playerId: `bot_${Date.now()}`,
      socketId: null,
      name: botName,
      color: assignedColor,
      isHost: false,
      isBot: true,
      connected: true
    };

    room.players.push(botPlayer);
    room.logs.push(`🤖 ${botName} added as ${assignedColor.toUpperCase()}`);
    io.to(roomCode).emit('game_state_update', room);
  });

  // 4. Remove Player / Bot
  socket.on('remove_player', ({ roomCode, color }) => {
    const room = rooms[roomCode];
    if (!room || room.gameStarted) return;

    const index = room.players.findIndex(p => p.color === color);
    if (index !== -1 && !room.players[index].isHost) {
      const removed = room.players.splice(index, 1)[0];
      // Reassign colors to remaining players
      room.players.forEach((p, i) => {
        p.color = COLORS[i];
      });
      room.logs.push(`Removed ${removed.name}`);
      io.to(roomCode).emit('game_state_update', room);
    }
  });

  // 5. Start Game
  socket.on('start_game', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;
    if (room.players.length < 2) {
      return socket.emit('error_message', 'At least 2 players (or 1 player + 1 bot) are required!');
    }

    room.gameStarted = true;
    room.currentTurnIndex = 0;
    room.logs.push('🚀 Game Started! Good luck players!');
    dispatchWebhook(room, 'MATCH_START', { totalPlayers: room.players.length });

    io.to(roomCode).emit('game_state_update', room);

    // If first player is bot
    if (room.players[0].isBot) {
      setTimeout(() => handleBotTurn(room), 1000);
    }
  });

  // 6. Roll Dice
  socket.on('roll_dice', ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room || !room.gameStarted || room.hasRolled) return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || currentPlayer.socketId !== socket.id) {
      return socket.emit('error_message', 'Not your turn!');
    }

    const dice = Math.floor(Math.random() * 6) + 1;
    room.diceValue = dice;
    room.hasRolled = true;

    if (dice === 6) {
      room.consecutiveSixes++;
      if (room.consecutiveSixes >= 3) {
        room.logs.push(`⚠️ ${currentPlayer.name} rolled 3 consecutive 6s! Turn forfeited.`);
        advanceTurn(room, false);
        return io.to(roomCode).emit('game_state_update', room);
      }
    } else {
      room.consecutiveSixes = 0;
    }

    room.logs.push(`🎲 ${currentPlayer.name} (${currentPlayer.color.toUpperCase()}) rolled ${dice}`);
    dispatchWebhook(room, 'DICE_ROLL', { player: currentPlayer.name, color: currentPlayer.color, dice });

    const validMoves = getValidMoves(room, currentPlayer.color, dice);

    if (validMoves.length === 0) {
      room.logs.push(`No valid moves available for ${currentPlayer.name}`);
      io.to(roomCode).emit('game_state_update', room);
      setTimeout(() => {
        advanceTurn(room, false);
        io.to(roomCode).emit('game_state_update', room);
      }, 1500);
      return;
    }

    // Auto-move if only 1 valid token
    if (validMoves.length === 1 && room.boardState[currentPlayer.color][validMoves[0]] === 0 && dice === 6) {
      // Auto move out of base
      executeMove(room, currentPlayer.color, validMoves[0], dice);
      return;
    }

    io.to(roomCode).emit('game_state_update', room);
  });

  // 7. Move Token
  socket.on('move_token', ({ roomCode, tokenIndex }) => {
    const room = rooms[roomCode];
    if (!room || !room.gameStarted || !room.hasRolled) return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || currentPlayer.socketId !== socket.id) return;

    const dice = room.diceValue;
    const validMoves = getValidMoves(room, currentPlayer.color, dice);

    if (!validMoves.includes(tokenIndex)) {
      return socket.emit('error_message', 'Invalid token move selection!');
    }

    executeMove(room, currentPlayer.color, tokenIndex, dice);
  });

  // 8. Update Webhook Settings
  socket.on('update_webhook', ({ roomCode, webhookUrl, events }) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.webhookUrl = webhookUrl;
    if (events) room.webhookEvents = events;
    room.logs.push('⚙️ Webhook settings updated');
    socket.emit('webhook_updated', { success: true });
    io.to(roomCode).emit('game_state_update', room);
  });

  // 9. Test Webhook Endpoint
  socket.on('test_webhook', async ({ webhookUrl }) => {
    if (!webhookUrl) return socket.emit('webhook_test_result', { success: false, message: 'URL is required' });

    try {
      const url = new URL(webhookUrl);
      const transport = url.protocol === 'https:' ? require('https') : require('http');
      const postData = JSON.stringify({
        event: 'TEST_EVENT',
        message: 'Ludo Real-Time Webhook Connection Successful!',
        timestamp: new Date().toISOString()
      });

      const req = transport.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000
      });

      req.on('response', (res) => {
        socket.emit('webhook_test_result', {
          success: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          message: `Webhook responded with HTTP status ${res.statusCode}`
        });
      });

      req.on('error', (err) => {
        socket.emit('webhook_test_result', { success: false, message: err.message });
      });

      req.write(postData);
      req.end();
    } catch (err) {
      socket.emit('webhook_test_result', { success: false, message: err.message });
    }
  });

  // 10. Chat Message
  socket.on('send_chat', ({ roomCode, message }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.socketId === socket.id);
    if (player && message.trim()) {
      const chatItem = {
        sender: player.name,
        color: player.color,
        text: message.trim().substring(0, 150),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      io.to(roomCode).emit('chat_message', chatItem);
    }
  });

  // 11. Disconnect Handler & Host Migration
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    Object.values(rooms).forEach(room => {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.connected = false;
        room.logs.push(`⚠️ ${player.name} disconnected (Reconnecting...)`);

        // Automatic Host Migration if original Host drops
        if (player.isHost) {
          player.isHost = false;
          const nextHost = room.players.find(p => p.connected && !p.isBot);
          if (nextHost) {
            nextHost.isHost = true;
            room.logs.push(`👑 Host transferred to ${nextHost.name}`);
          }
        }

        io.to(room.code).emit('game_state_update', room);
      }
    });
  });
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🎯 LUDO REALTIME GAME SERVER RUNNING`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
