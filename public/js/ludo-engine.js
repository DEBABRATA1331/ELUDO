/**
 * LUDO BOARD GRID & PATH MAPPER
 * 15x15 Grid Layout Definitions
 */

const LudoEngine = (function () {
  const COLOR_START = { red: 0, green: 13, yellow: 26, blue: 39 };
  const SAFE_TILES = [0, 8, 13, 21, 26, 34, 39, 47];

  // 52 Main Track Coordinates [row, col] (0..51)
  const TRACK = [
    [6, 1],  [6, 2],  [6, 3],  [6, 4],  [6, 5],   // 0..4 (Red Start = 0)
    [5, 6],  [4, 6],  [3, 6],  [2, 6],  [1, 6],  [0, 6], // 5..10 (Star = 8)
    [0, 7],                                            // 11
    [0, 8],  [1, 8],  [2, 8],  [3, 8],  [4, 8],  [5, 8], // 12..17 (Green Entry=12, Start=13)
    [6, 9],  [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],// 18..23 (Star = 21)
    [7, 14],                                           // 24
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], // 25..30 (Yellow Entry=25, Start=26)
    [9, 8],  [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],// 31..36 (Star = 34)
    [14, 7],                                           // 37
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], // 38..43 (Blue Entry=38, Start=39)
    [8, 5],  [8, 4],  [8, 3],  [8, 2],  [8, 1],  [8, 0], // 44..49 (Star = 47)
    [7, 0]                                             // 50
    // 51 = [6, 0] (Red Entry)
  ];
  TRACK[51] = [6, 0];

  // Home Corridors (Steps 52..56 -> 5 steps)
  const HOME_CORRIDORS = {
    red:    [[7, 1],  [7, 2],  [7, 3],  [7, 4],  [7, 5]],
    green:  [[1, 7],  [2, 7],  [3, 7],  [4, 7],  [5, 7]],
    yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
    blue:   [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]
  };

  // Home Centers (Step 57)
  const HOME_CENTERS = {
    red:    [7, 6],
    green:  [6, 7],
    yellow: [7, 8],
    blue:   [8, 7]
  };

  // Base Yard Token Coordinates [row, col]
  const BASES = {
    red:    [[2, 2],  [2, 3],  [3, 2],  [3, 3]],
    green:  [[2, 11], [2, 12], [3, 11], [3, 12]],
    yellow: [[11, 11],[11, 12],[12, 11],[12, 12]],
    blue:   [[11, 2], [11, 3], [12, 2], [12, 3]]
  };

  /**
   * Returns [row, col] grid coordinate for a token at a given step (0..57)
   */
  function getTokenCell(color, step, tokenIndex) {
    if (step === 0) {
      return BASES[color][tokenIndex];
    }
    if (step >= 1 && step <= 51) {
      const globalIndex = (COLOR_START[color] + step - 1) % 52;
      return TRACK[globalIndex];
    }
    if (step >= 52 && step <= 56) {
      const corridorIndex = step - 52;
      return HOME_CORRIDORS[color][corridorIndex];
    }
    if (step === 57) {
      return HOME_CENTERS[color];
    }
    return [0, 0];
  }

  /**
   * Check if main track index is a safe star spot
   */
  function isSafeTile(globalTrackIndex) {
    return SAFE_TILES.includes(globalTrackIndex);
  }

  return {
    COLOR_START,
    SAFE_TILES,
    TRACK,
    HOME_CORRIDORS,
    HOME_CENTERS,
    BASES,
    getTokenCell,
    isSafeTile
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LudoEngine;
}
