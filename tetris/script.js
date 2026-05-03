window.addEventListener('load', () => {
  const config = {
    colors: {
      background: getCSSVariable('game-background'),
      emptySquare: getCSSVariable('empty-square'),
      activeSquare: getCSSVariable('active-square'),
      inactiveSquare: getCSSVariable('inactive-square'),
    },
    width: 10,
    height: 16,
    gameSpeed: 1000, // ms
    lineClearAnimationDuration: 240, // ms
    redrawSpeed: 1000 / 60, // ms
    figures: [
      [
        [1, 1],
        [1, 1],
      ],
      [
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 1, 1],
        [1, 1, 0],
      ],
      [
        [0, 1, 0],
        [1, 1, 1],
      ],
      [
        [1, 0, 0],
        [1, 1, 1],
      ],
      [
        [1, 1, 1, 1],
      ],
      [
        [1],
        [1],
        [1],
        [1],
      ],
      [
        [1],
      ]
    ]
  };

  const initialState = {
    filledElements: createEmptyMatrix(config.width, config.height),
    currentFigure: null, // { shape: [[1,1], [1,1]], position: {x,y}, rotation: 0, rotatedShape: [[1,1], [1,1]], firstPosition: true }
    lastTick: Date.now(),
    pause: false,
    gameover: false,
    score: 0,
    lineCheckPending: false,
    lineClearAnimation: null,
    touchDownPosition: null,
    moveMiddlePosition: null,
    colors: deepCopy(config.colors),

    volume: 0.5,
    enableSound: true,
  };
  const notSavedState = {
    showMenu: true,
    showGame: true,
    gameStarted: false,
    savedGameExists: false,
  }

  // init
  // state wil be saved in localStorage
  let state = deepCopy(initialState);
  let squareSize = 1; // px
  let ps = () => squareSize / 10; // pixel size

  const canvas = $('canvas');
  resizeCanvas();
  const ctx = canvas.getContext('2d');

  notSavedState.savedGameExists = !!localStorage.getItem('game');
  checkElementsState();

  const aciton = () => {
    updateLineClearAnimation();
    resolvePendingLineCheck();
    drawCurrentFrame();

    if (!state.pause && !state.gameover && !state.lineClearAnimation) {
      if (Date.now() - state.lastTick > config.gameSpeed) {
        fallFigure();

        state.lastTick = Date.now();
      }
    }

    setTimeout(() => {
      requestAnimationFrame(aciton);
    }, config.redrawSpeed);
  };
  requestAnimationFrame(aciton);

  function resizeCanvas() {
    const clientWidth = window.innerWidth - 120; // 120px width of sidebar
    const clientHeight = window.innerHeight;
    const ratio = config.width / config.height;

    if (clientWidth / clientHeight > ratio) {
      squareSize = clientHeight / config.height;
      canvas.height = clientHeight;
      canvas.width = squareSize * config.width;
    } else {
      squareSize = clientWidth / config.width;
      canvas.width = clientWidth;
      canvas.height = squareSize * config.height;
    }
  }

  // drawing elements
  function drawCurrentFrame() {
    selectColors();

    drawMesh();
    drawCurrentFigure();
    drawFallenFigures();
  }

  function selectColors() {
    let brightness = 1;

    if (state.gameover) {
      brightness = 0.5;
    }

    if (state.pause && !state.gameover) {
      brightness = Math.sin(Date.now() / 250) / 2 / 4 + 0.75;
    }

    if (!state.pause && !state.gameover) {
      brightness = 1;
    }

    Object.keys(state.colors).forEach(color => {
      state.colors[color] = hexColorBrightness(config.colors[color], brightness);
    });
  }

  function removeLines() {
    if (state.lineClearAnimation) return false;

    const rowsToClear = [];

    for (let i = 0; i < config.height; i++) {
      if (state.filledElements.every(line => line[i] == 1)) {
        rowsToClear.push(i);
      }
    }

    if (rowsToClear.length > 0) {
      state.lineClearAnimation = {
        rows: rowsToClear,
        removedLines: rowsToClear.length,
        startedAt: Date.now(),
      };
      state.lineCheckPending = false;
      return true;
    }

    return false;
  }

  function resolvePendingLineCheck() {
    if (!state.lineCheckPending || state.lineClearAnimation) return;
    if (removeLines()) return;

    state.lineCheckPending = false;
  }

  function drawCurrentFigure() {
    if (!state.currentFigure && (state.lineClearAnimation || state.lineCheckPending)) return;
    if (state.currentFigure) drawFigure();
    if (!state.currentFigure) {
      const figure = getRandomFigure();
      const tl = Math.round((config.width - figure[0].length) / 2); // top left position of figure
      state.currentFigure = {
        shape: figure,
        position: { x: tl, y: 0 },
        rotation: 0,
        rotatedShape: figure,
        firstPosition: true
      };
      drawFigure();
    }
  }

  function drawFallenFigures() {
    const animation = state.lineClearAnimation;
    const animationProgress = getLineClearAnimationProgress();

    for (let i = 0; i < config.width; i++) {
      for (let j = 0; j < config.height; j++) {
        if (state.filledElements[i][j] == 1) {
          if (animation && animation.rows.includes(j)) {
            drawClearingSquare(i, j, animationProgress);
          } else {
            drawSquare(i, j, state.colors.inactiveSquare);
          }
        }
      }
    }
  };

  function drawFigure() {
    const { x, y } = state.currentFigure.position;
    const { rotatedShape } = state.currentFigure;

    for (let i = 0; i < rotatedShape.length; i++) {
      for (let j = 0; j < rotatedShape[i].length; j++) {
        if (rotatedShape[i][j] == 1) {
          drawSquare(x + j, y + i, state.colors.activeSquare);
        }
      }
    }
  }

  function drawSquare(_x, _y, color) {
    const size = squareSize;
    const { x, y } = getAbsolutePosition(_x, _y);
    const p = ps() / 2;

    ctx.fillStyle = state.colors.background;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = color;
    ctx.fillRect(x + p, y + p, size - 2*p, size - 2*p);
  }

  function drawClearingSquare(_x, _y, progress) {
    const size = squareSize;
    const { x, y } = getAbsolutePosition(_x, _y);
    const p = ps() / 2;
    const flashBrightness = 0.8 + Math.abs(Math.sin(progress * Math.PI * 4)) * 0.2;
    const flashColor = hexColorBrightness(config.colors.activeSquare, flashBrightness);
    const collapse = Math.min(progress, 1);
    const innerWidth = Math.max(size * (1 - collapse) - 2 * p, 0);
    const offsetX = x + (size - innerWidth) / 2;

    ctx.fillStyle = state.colors.background;
    ctx.fillRect(x, y, size, size);

    if (innerWidth <= 0) return;

    ctx.fillStyle = flashColor;
    ctx.fillRect(offsetX, y + p, innerWidth, size - 2 * p);
  }

  function drawMesh() {
    for (let i = 0; i < config.width; i++) {
      for (let j = 0; j < config.height; j++) {
        drawSquare(i, j, state.colors.emptySquare);
      }
    }
  }

  // calculations
  function hexColorBrightness(hexColor, brightness) {
    const rgb = hexToRgb(hexColor);
    const newRgb = rgb.map(color => {
      const newColor = Math.round(color * brightness);

      if (newColor > 255) {
        console.warn('color is out of range');
        return 255;
      }
      if (newColor < 0) {
        console.warn('color is out of range');
        return 0;
      }
      return newColor;
    });
    return rgbToHex(newRgb);
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  function rgbToHex(rgb) {
    const r = rgb[0].toString(16).padStart(2, '0');
    const g = rgb[1].toString(16).padStart(2, '0');
    const b = rgb[2].toString(16).padStart(2, '0');
    return '#' + r + g + b;
  }

  function getLineClearAnimationProgress() {
    if (!state.lineClearAnimation) return 0;
    const elapsed = Date.now() - state.lineClearAnimation.startedAt;
    return Math.min(elapsed / config.lineClearAnimationDuration, 1);
  }

  function updateLineClearAnimation() {
    if (!state.lineClearAnimation) return;
    if (getLineClearAnimationProgress() < 1) return;

    commitLineClearAnimation();
  }

  function commitLineClearAnimation() {
    const { rows, removedLines } = state.lineClearAnimation;
    const rowsToClear = new Set(rows);

    state.filledElements = state.filledElements.map(line => {
      const remainingSquares = line.filter((_, rowIndex) => !rowsToClear.has(rowIndex));
      const clearedSquares = Array.from({ length: removedLines }, () => 0);

      return clearedSquares.concat(remainingSquares);
    });

    const rawScore = removedLines * 100 * Math.sqrt(removedLines);
    state.score += Math.round(rawScore / 10) * 10;
    state.lineClearAnimation = null;
    state.lineCheckPending = true;
    state.lastTick = Date.now();
    $('#score').innerText = state.score;
  }

  function fallFigure() {
    if (canFall(state.currentFigure)) {
      state.currentFigure.position.y++;
      state.currentFigure.firstPosition = false;
    } else {
      if (state.currentFigure.firstPosition) {
        state.gameover = true;
        showMenu();
      }
      const coordinates = getFigureCoordinates(state.currentFigure);
      coordinates.forEach(({ x, y }) => state.filledElements[x][y] = 1);
      state.currentFigure = null;
      state.lineCheckPending = true;
    }
  }

  function canMoveLeft(figure) {
    if (!figure) return false;
    const coordinates = getFigureCoordinates(figure);
    return coordinates.every(({ x, y }) => {
      return state.filledElements[x - 1] && state.filledElements[x - 1][y] == 0;
    });
  }

  function canMoveRight(figure) {
    if (!figure) return false;
    const coordinates = getFigureCoordinates(figure);
    return coordinates.every(({ x, y }) => {
      return state.filledElements[x + 1] && state.filledElements[x + 1][y] == 0;
    });
  }

  function canFall(figure) {
    if (!figure) return false;
    let canFall = true;
    const coordinates = getFigureCoordinates(figure);
    coordinates.forEach(({ x, y }) => {
      if (y == config.height - 1) canFall = false;
      if (state.filledElements[x][y + 1] != 0) canFall = false;
    });
    return canFall;
  }

  function canRotate(figure) {
    const rotatedShape = getRotatedShapeOfFigure(figure, state.currentFigure.rotation + 1);
    const coordinates = getFigureCoordinates({ ...figure, rotatedShape });
    return coordinates.every(({ x, y }) => {
      return state.filledElements[x] && state.filledElements[x][y] == 0;
    });
  }

  function getAbsolutePosition(x, y) {
    return {
      x: x * squareSize,
      y: y * squareSize,
    };
  }

  function createEmptyMatrix(width, height) {
    const a = [];
    for (let i = 0; i < width; i++) {
      const b = [];
      for (let j = 0; j < height; j++) {
        b.push(0);
      }
      a.push(b);
    }

    return a;
  }

  function getRandomFigure() {
    const index = Math.floor(Math.random() * config.figures.length);
    return config.figures[index];
  }

  function getFigureCoordinates(figure) {
    if (!figure) return [];
    const { x, y } = figure.position;
    const { rotatedShape } = figure;
    const coordinates = [];
    for (let i = 0; i < rotatedShape.length; i++) {
      for (let j = 0; j < rotatedShape[i].length; j++) {
        if (rotatedShape[i][j] == 1) {
          coordinates.push({ x: x + j, y: y + i });
        }
      }
    }

    return coordinates;
  }

  function getRotatedShapeOfFigure(figure, arbitraryRotation) {
    const { shape } = figure;
    const rotation = arbitraryRotation || figure.rotation;
    let rotatedShape = [];

    if (rotation == 0) return shape;
    if (rotation == 1) {
      rotatedShape = createEmptyMatrix(shape[0].length, shape.length);

      for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
          rotatedShape[j][shape.length - 1 - i] = shape[i][j];
        }
      }
      return rotatedShape;
    }
    if (rotation == 2) {
      rotatedShape = createEmptyMatrix(shape.length, shape[0].length);

      for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
          rotatedShape[shape.length - 1 - i][shape[i].length - 1 - j] = shape[i][j];
        }
      }
      return rotatedShape;
    }
    if (rotation == 3) {
      rotatedShape = createEmptyMatrix(shape[0].length, shape.length);

      for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
          rotatedShape[shape[i].length - 1 - j][i] = shape[i][j];
        }
      }
      return rotatedShape;
    }

    return shape;
  }

  function saveGame() {
    localStorage.setItem('game', JSON.stringify(state));
  }

  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /////////////////////////////////
  // actions
  /////////////////////////////////
  function showMenu() {
    notSavedState.showMenu = true;
    pauseGame();
    checkElementsState();
  }

  function pauseGame() {
    state.pause = true;
    checkElementsState();
  }

  function continueGame() {
    state.pause = false;
    state.lastTick = Date.now();
    checkElementsState();
  }

  function togglePause() {
    if (state.gameover || state.lineClearAnimation) return;

    if (state.pause) {
      continueGame();
    } else {
      pauseGame();
    }
  }

  function restartGame() {
    state = deepCopy(initialState);
    state.lastTick = Date.now();
    checkElementsState();
    drawCurrentFrame();
  }

  function loadGame() {
    const game = localStorage.getItem('game');
    if (game) {
      state = JSON.parse(game);
      state.lineCheckPending = true;
      state.lastTick = Date.now();
      $('#score').innerText = state.score;
      drawCurrentFrame();
      notSavedState.gameStarted = true;
    }
    checkElementsState();
  }

  function saveCurrentGame() {
    if (!notSavedState.gameStarted || state.gameover) return;

    saveGame();
    notSavedState.savedGameExists = true;
    checkElementsState();
  }

  function loadSavedGame() {
    if (!notSavedState.savedGameExists) return;

    loadGame();
  }

  function restartCurrentGame() {
    if (!notSavedState.gameStarted) return;

    restartGame();
    if (notSavedState.showMenu) pauseGame();
    checkElementsState();
  }

  function startGame() {
    notSavedState.showMenu = false;
    notSavedState.showGame = true;
    state.pause = false;
    checkElementsState();

    // start game and continue for every next click
    if (!notSavedState.gameStarted) restartGame();
    notSavedState.gameStarted = true;
  }

  function triggerPrimaryAction() {
    if (state.gameover || state.lineClearAnimation) return;

    if (!notSavedState.gameStarted || notSavedState.showMenu) {
      startGame();
      return;
    }

    togglePause();
  }

  function pressLeft() {
    if (canMoveLeft(state.currentFigure)) {
      --state.currentFigure.position.x;
    }
  }

  function pressRight() {
    if (canMoveRight(state.currentFigure)) {
      ++state.currentFigure.position.x;
    }
  }

  function pressDown() {
    if (canFall(state.currentFigure)) {
      ++state.currentFigure.position.y;
      state.currentFigure.firstPosition = false;
    }
  }

  function pressUp() {
    if (canRotate(state.currentFigure)) {
      state.currentFigure.rotation = (state.currentFigure.rotation + 1) % 4;
      state.currentFigure.rotatedShape = getRotatedShapeOfFigure(state.currentFigure);
    }
  }

  function checkElementsState() {
    $('#menu').classList.toggle('hidden', !notSavedState.showMenu);
    $('#game').classList.toggle('hidden', !notSavedState.showGame);

    $('#load-button').classList.toggle('hidden', !notSavedState.savedGameExists);
    $('#save-button').classList.toggle('hidden', !notSavedState.gameStarted || state.gameover);
    $('#start-button').classList.toggle('hidden', state.gameover);
    $('#restart-button').classList.toggle('hidden', !notSavedState.gameStarted);

    $('#pause-button').innerText = state.pause ? 'Resume' : 'Pause';
    $('#start-button').innerText = notSavedState.gameStarted ? 'Continue' : 'Start';

    $('#score').innerText = state.score;
  }

  /////////////////////////////////
  // event listeners
  /////////////////////////////////
  window.addEventListener('resize', (e) => {
    resizeCanvas();
  });

  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const hasShortcutModifier = e.ctrlKey || e.metaKey;

    if (key === 'q' && !hasShortcutModifier) {
      e.preventDefault();
      saveCurrentGame();
      return;
    }

    if (key === 'e' && !hasShortcutModifier) {
      e.preventDefault();
      loadSavedGame();
      return;
    }

    if (key === 'r' && !hasShortcutModifier) {
      e.preventDefault();
      restartCurrentGame();
      return;
    }

    if (key === 'enter' || key === 'p' || e.key === ' ') {
      e.preventDefault();
      triggerPrimaryAction();
      return;
    }

    if (state.pause || state.gameover || state.lineClearAnimation) return;

    if (e.key === 'ArrowLeft' || e.key === 'a') {
      pressLeft(true);
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      pressRight(true);
    } else if (e.key === 'ArrowDown' || e.key === 's') {
      pressDown(true);
    } else if (e.key === 'ArrowUp' || e.key === 'w') {
      pressUp(true);
    }
  }, true);

  document.body.addEventListener('touchstart', (e) => {
    if (state.pause || state.gameover || state.lineClearAnimation) return;

    const { clientX, clientY } = e.touches[0];
    state.touchDownPosition = { x: clientX, y: clientY };
    state.moveMiddlePosition = { x: clientX, y: clientY };
  });

  document.body.addEventListener('touchmove', (e) => {
    if (state.pause || state.gameover || state.lineClearAnimation) return;

    const { clientX, clientY } = e.touches[0];
    const { x, y } = state.moveMiddlePosition;
    const threshold = ps() * 6;
    const dx = clientX - x;
    const dy = clientY - y;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > threshold) {
        pressRight(true);
        state.moveMiddlePosition.x = clientX;
        state.moveMiddlePosition.y = clientY;
      } else if (dx < -threshold) {
        pressLeft(true);
        state.moveMiddlePosition.x = clientX;
        state.moveMiddlePosition.y = clientY;
      }
    } else {
      if (dy > threshold) {
        pressDown(true);
        state.moveMiddlePosition.x = clientX;
        state.moveMiddlePosition.y = clientY;
      }
    }
  });

  document.body.addEventListener('touchend', (e) => {
    if (state.pause || state.gameover || state.lineClearAnimation) return;

    const trashold = 5; // px
    const { clientX, clientY } = e.changedTouches[0];
    const { x, y } = state.touchDownPosition;

    if (Math.abs(clientX - x) < trashold && Math.abs(clientY - y) < trashold) {
      pressUp(true);
    }
  });


  /////////////////////////////////
  // display buttons
  /////////////////////////////////
  $('#pause-button').addEventListener('click', (e) => {
    togglePause();
    checkElementsState();
  });

  $('#save-button').addEventListener('click', (e) => {
    saveCurrentGame();
  });

  $('#load-button').addEventListener('click', (e) => {
    loadSavedGame();
  });

  $('#restart-button').addEventListener('click', (e) => {
    restartCurrentGame();
  });

  $('#menu-button').addEventListener('click', (e) => {
    showMenu();
  });

  $('#start-button').addEventListener('click', (e) => {
    startGame();
  });
});

// helpers
function $(selector) {
  return document.querySelector(selector);
}

function getCSSVariable(name) {
  return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
}
