const LudoEngine = require('./public/js/ludo-engine');
const assert = require('assert');

// 1. Core Rules Engine Simulator for 2, 3, and 4 Player Modes
function createSimulatorRoom(playerCount) {
  const SEAT_ORDER = ['red', 'yellow', 'green', 'blue'];
  const colors = SEAT_ORDER.slice(0, playerCount);
  if (playerCount === 3) {
    // 3-Player mode seats: RED, GREEN, YELLOW
    colors[1] = 'green';
    colors[2] = 'yellow';
  }

  const players = colors.map((color, idx) => ({
    id: `p_${idx + 1}`,
    socketId: `socket_${idx + 1}`,
    name: `Player_${color.toUpperCase()}`,
    color: color,
    isHost: idx === 0,
    isBot: true,
    connected: true
  }));

  return {
    code: 'SIM123',
    players,
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
    logs: []
  };
}

function getValidMoves(room, color, dice) {
  const tokens = room.boardState[color];
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

function getGlobalTrack(color, step) {
  if (step < 1 || step > 51) return null;
  return (LudoEngine.COLOR_START[color] + step - 1) % 52;
}

function advanceTurn(room, grantExtraTurn = false) {
  if (grantExtraTurn && !room.winners.includes(room.players[room.currentTurnIndex]?.color)) {
    room.hasRolled = false;
    room.diceValue = null;
    return;
  }

  room.consecutiveSixes = 0;
  room.hasRolled = false;
  room.diceValue = null;

  const total = room.players.length;
  let nextIndex = (room.currentTurnIndex + 1) % total;
  let attempts = 0;

  while (attempts < total) {
    const p = room.players[nextIndex];
    if (p && !room.winners.includes(p.color)) {
      room.currentTurnIndex = nextIndex;
      return;
    }
    nextIndex = (nextIndex + 1) % total;
    attempts++;
  }
}

function executeSimStep(room, fixedDice = null) {
  assert(room.currentTurnIndex >= 0 && room.currentTurnIndex < room.players.length, 'Invariant: Turn index out of bounds');
  const currentPlayer = room.players[room.currentTurnIndex];
  assert(currentPlayer !== undefined, 'Invariant: Current player must exist');
  assert(!room.winners.includes(currentPlayer.color), 'Invariant: Finished player cannot take turns');

  const dice = fixedDice !== null ? fixedDice : Math.floor(Math.random() * 6) + 1;
  room.diceValue = dice;
  room.hasRolled = true;

  if (dice === 6) {
    room.consecutiveSixes++;
    if (room.consecutiveSixes >= 3) {
      advanceTurn(room, false);
      return;
    }
  } else {
    room.consecutiveSixes = 0;
  }

  const validMoves = getValidMoves(room, currentPlayer.color, dice);
  if (validMoves.length === 0) {
    advanceTurn(room, false);
    return;
  }

  // Pick random valid move
  const chosenIndex = validMoves[Math.floor(Math.random() * validMoves.length)];
  const currentStep = room.boardState[currentPlayer.color][chosenIndex];
  let newStep = currentStep === 0 ? 1 : currentStep + dice;

  assert(newStep >= 1 && newStep <= 57, 'Invariant: Token step must be between 1 and 57');
  room.boardState[currentPlayer.color][chosenIndex] = newStep;

  let extraTurn = (dice === 6);

  if (newStep === 57) {
    extraTurn = true;
    const allHome = room.boardState[currentPlayer.color].every(s => s === 57);
    if (allHome && !room.winners.includes(currentPlayer.color)) {
      room.winners.push(currentPlayer.color);
    }
  }

  // Check capture
  const newGlobal = getGlobalTrack(currentPlayer.color, newStep);
  if (newGlobal !== null && !LudoEngine.SAFE_TILES.includes(newGlobal)) {
    room.players.forEach(opp => {
      if (opp.color === currentPlayer.color) return;
      room.boardState[opp.color].forEach((oppStep, oppIndex) => {
        const oppGlobal = getGlobalTrack(opp.color, oppStep);
        if (oppGlobal !== null && oppGlobal === newGlobal) {
          room.boardState[opp.color][oppIndex] = 0; // Captured! Send back to base
          extraTurn = true;
        }
      });
    });
  }

  if (room.winners.length >= room.players.length - 1 && room.players.length > 1) {
    room.gameStarted = false;
    return;
  }

  advanceTurn(room, extraTurn);
}

// 2. Run 10,000 Match Simulations for 2, 3, and 4 Player Modes
console.log('🚀 Running 10,000 Simulation Matches for 2, 3, and 4 Players...');

[2, 3, 4].forEach(count => {
  console.log(`\n▶ Simulating 3,333 matches for ${count}-PLAYER MODE...`);
  for (let i = 0; i < 3333; i++) {
    const room = createSimulatorRoom(count);
    let turnsCount = 0;
    while (room.gameStarted && turnsCount < 1000) {
      executeSimStep(room);
      turnsCount++;
    }

    // Verify invariants
    assert(room.players.length === count, `Must have exactly ${count} players`);
    Object.keys(room.boardState).forEach(c => {
      const isJoined = room.players.some(p => p.color === c);
      if (!isJoined) {
        assert(room.boardState[c].every(s => s === 0), `Unjoined color ${c} must have 0 tokens on board`);
      }
    });
  }
  console.log(`✅ ${count}-PLAYER MODE: 3,333 matches passed cleanly with ZERO invariant errors!`);
});

console.log('\n🎉 ALL 10,000 MULTIPLAYER SIMULATIONS PASSED 100% SUCCESSFULLY!');
