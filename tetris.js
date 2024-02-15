const canvas = document.getElementById('game');
const previewCanvases = document.querySelectorAll('.preview-canvas');
const scoreDisplays = document.querySelectorAll('.score-display');
const context = canvas.getContext('2d');
const grid = 32;
let tetrominoSequence = [];

// keep track of what is in every cell of the game using a 2d array
// tetris playfield is 10x20, with a few rows offscreen
let playfield = [];
let AllLinesRemoved = 0;
let isGamePaused = true;
let btnStart = document.getElementById('btn_start');
let btnPause = document.getElementById('btn_pause');
let gameSpeed = 15;
let frameCount = 0;
let isGameOver = false;
let checkingScore = false;
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;
let rotateFlag = true;
let interval;
let nextTetromino;
let tetromino;
let lastTimeStamp = 0;
let touchStartTime;
let isDownwardMovementTriggered = false;

// how to draw each tetromino
const tetrominos = {
  'I': [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  'J': [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  'L': [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  'O': [
    [1, 1],
    [1, 1],
  ],
  'S': [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  'Z': [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  'T': [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ]
};

// color of each tetromino
const colors = {
  'I': 'rgba(128, 0, 0)',
  'O': 'rgba(0, 0, 128)',
  'T': 'rgba(160, 32, 240)',
  'S': 'rgba(0, 128, 0)',
  'Z': 'rgba(255, 0, 0)',
  'J': 'rgba(0, 0, 255)',
  'L': 'rgba(0, 128, 128)'
};

btnPause.disabled = true;

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateSequence() {
  const sequence = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

  while (sequence.length) {
    const rand = getRandomInt(0, sequence.length - 1);
    const name = sequence.splice(rand, 1)[0];
    tetrominoSequence.push(name);
  }
}

// get the next tetromino in the sequence
function getNextTetromino() {
  if (tetrominoSequence.length === 0) {
    generateSequence();
  }

  const name = tetrominoSequence.pop();
  const matrix = tetrominos[name];

  // I and O start centered, all others start in left-middle
  const col = playfield[0].length / 2 - Math.ceil(matrix[0].length / 2);

  // I starts on row 21 (-1), all others start on row 22 (-2)
  const row = name === 'I' ? -1 : -2;

  return {
    name: name,      // name of the piece (L, O, etc.)
    matrix: matrix,  // the current rotation matrix
    row: row,        // current row (starts offscreen)
    col: col         // current col
  };
}

// rotate an NxN matrix 90deg
function rotate(matrix) {
  const matrixSize = matrix.length - 1;
  return matrix.map((row, i) =>
    row.map((_, j) => matrix[matrixSize - j][i])
  );
}

// check to see if the new matrix/row/col is valid
function isValidMove(matrix, cellRow, cellCol) {
  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[row].length; col++) {
      if (matrix[row][col] && (
        // outside the game bounds
        cellCol + col < 0 ||
        cellCol + col >= playfield[0].length ||
        cellRow + row >= playfield.length ||
        // collides with another piece
        playfield[cellRow + row][cellCol + col])
      ) {
        return false;
      }
    }
  }

  return true;
}

// place the tetromino on the playfield
function placeTetromino() {
  let linesRemoved = 0;
  for (let row = 0; row < tetromino.matrix.length; row++) {
    for (let col = 0; col < tetromino.matrix[row].length; col++) {
      if (tetromino.matrix[row][col]) {

        // game over if piece has any part offscreen
        if (tetromino.row + row < 0) {
          return showGameOver();
        }

        playfield[tetromino.row + row][tetromino.col + col] = tetromino.name;
      }
    }
  }

  // check for line clears starting from the bottom and working our way up
  for (let row = playfield.length - 1; row >= 0;) {
    if (playfield[row].every(cell => !!cell)) {
      // drop every row above this one
      for (let r = row; r >= 0; r--) {
        for (let c = 0; c < playfield[r].length; c++) {
          playfield[r][c] = playfield[r - 1][c];
        }
      }
      linesRemoved++;
    } else {
      row--;
    }
  }

  if (linesRemoved > 0) {
    AllLinesRemoved += linesRemoved;
    if (AllLinesRemoved % 10 === 0) checkingScore = false;
    scoreDisplays.forEach(scoreDisplay => {
      scoreDisplay.innerText = `Score: ${AllLinesRemoved}`;
    });
  }

  tetromino = nextTetromino;
  nextTetromino = getNextTetromino();

  previewCanvases.forEach(previewCanvas => {
    drawPreview(previewCanvas);
  });
}

function drawPreview(previewCanvas) {
  const previewContext = previewCanvas.getContext('2d');
  const blockSize = previewCanvas.width / 4;
  previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const name = nextTetromino.name;
  previewContext.fillStyle = colors[name];

  const xOffset = (previewCanvas.width - nextTetromino.matrix[0].length * blockSize) / 2;
  const yOffset = (previewCanvas.height - nextTetromino.matrix.length * blockSize) / 2;

  for (let row = 0; row < nextTetromino.matrix.length; row++) {
    for (let col = 0; col < nextTetromino.matrix[row].length; col++) {
      if (nextTetromino.matrix[row][col]) {
        previewContext.fillRect(col * blockSize + xOffset, 
          row * blockSize + yOffset, 
          blockSize - 1, blockSize - 1
        );
      }
    }
  }
}

function drawDownPreview() {
  const blockSize = canvas.width / playfield[0].length;
  const previewTetromino = {
    ...tetromino,
    row: getGhostPieceRow(tetromino.matrix, tetromino.row, tetromino.col)
  };
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawMatrix(playfield, { x: 0, y: 0 }, blockSize, context);
  drawMatrix(previewTetromino.matrix, { 
      x: previewTetromino.col, 
      y: previewTetromino.row
    }, 
    blockSize,
    context,
    colors[previewTetromino.name], 
    true
  );
}

function getGhostPieceRow(matrix, row, col) {
  while (isValidMove(matrix, row, col)) row++;
  return row - 1;
}

function drawMatrix(matrix, offset, blockSize, context, color, ghost = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        context.fillStyle = ghost ? color.slice(0, -1) + ', 0.3)' : colors[value];
        context.fillRect((offset.x + x) * blockSize, 
          (offset.y + y) * blockSize, blockSize - 1, blockSize - 1);
        context.strokeStyle = "rgba(0, 0, 0, 0)";
        context.strokeRect((offset.x + x) * blockSize, 
          (offset.y + y) * blockSize, blockSize - 1, blockSize - 1);
      }
    });
  });
}

// show the game over screen
function showGameOver() {
  clearInterval(interval);
  isGameOver = true;

  context.fillStyle = 'black';
  context.globalAlpha = 0.75;
  context.fillRect(0, canvas.height / 2 - 30, canvas.width, 90);

  context.globalAlpha = 1;
  context.fillStyle = 'white';
  context.font = '36px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('GAME OVER!', canvas.width / 2,
    canvas.height / 2);
  context.fillText('Score: ' + AllLinesRemoved, canvas.width / 2,
    canvas.height / 2 + 40);
  btnStart.disabled = false;
}

function showGamePaused() {
  if (isGameOver) return;
  context.fillStyle = 'black';
  context.globalAlpha = 0.75;
  context.fillRect(0, canvas.height / 2 - 30, canvas.width, 55);

  context.globalAlpha = 1;
  context.fillStyle = 'white';
  context.font = '36px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
}

function checkScore() {
  if (checkingScore) return;

  checkingScore = true;

  if (AllLinesRemoved % 10 === 0 && AllLinesRemoved > 0) {
    gameSpeed--;
    clearInterval(interval);
    interval = setInterval(loop, gameSpeed);
  }
}

// game loop
function loop() {
  window.status = isGamePaused;
  if (isGamePaused) return;

  context.clearRect(0, 0, canvas.width, canvas.height);

  checkScore();

  // draw the playfield
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 10; col++) {
      if (playfield[row][col]) {
        const name = playfield[row][col];
        context.fillStyle = colors[name];

        // drawing 1 px smaller than the grid creates a grid effect
        context.fillRect(col * grid, row * grid, grid - 1, grid - 1);
      }
    }
  }

  // draw the active tetromino
  if (tetromino) {
    drawDownPreview();
    // tetromino falls every 35 frames
    if (++frameCount > 35) {
      tetromino.row++;
      frameCount = 0;

      // place piece if it runs into anything
      if (!isValidMove(tetromino.matrix, tetromino.row, tetromino.col)) {
        tetromino.row--;
        placeTetromino();
      }
    }

    context.fillStyle = colors[tetromino.name];

    for (let row = 0; row < tetromino.matrix.length; row++) {
      for (let col = 0; col < tetromino.matrix[row].length; col++) {
        if (tetromino.matrix[row][col]) {

          // drawing 1 px smaller than the grid creates a grid effect
          context.fillRect((tetromino.col + col) * grid, 
            (tetromino.row + row) * grid, grid - 1, grid - 1);
        }
      }
    }
  }
}

function downOne() {
  const row = tetromino.row + 1;
  if (!isValidMove(tetromino.matrix, row, tetromino.col)) {
    tetromino.row = row - 1;

    placeTetromino();
    return true;
  }
  tetromino.row = row;
  return false;
}

function toggleGamePause() {
  if (isGameOver) return;
  isGamePaused = !isGamePaused;

  if (!isGamePaused) {
    btnPause.innerText = 'Pause';
    window.status = false;
    canvas.focus();
  } else {
    showGamePaused();
    btnPause.innerText = 'Resume';
  }
}

function init() {
  clearInterval(interval);
  playfield = [];
  gameSpeed = 15;

  // populate the empty state
  for (let row = -2; row < 20; row++) {
    playfield[row] = [];

    for (let col = 0; col < 10; col++) {
      playfield[row][col] = 0;
    }
  }

  isGameOver = false;
  AllLinesRemoved = 0;
  scoreDisplays.forEach(scoreDisplay => {
    scoreDisplay.innerText = `Score: ${AllLinesRemoved}`;
  });
  isGamePaused = false;
  tetrominoSequence = [];
  tetromino = getNextTetromino();
  nextTetromino = getNextTetromino();

  previewCanvases.forEach(previewCanvas => {
    drawPreview(previewCanvas);
  });
  drawDownPreview();
}

function gameStart(time = gameSpeed) {
  // start the game
  init();
  interval = setInterval(loop, time);
  btnPause.innerText = 'Pause';
  btnStart.innerText = 'Restart';
  btnPause.disabled = false;
  canvas.focus();
}

btnStart.addEventListener('click', () => {
  gameStart();
});

btnPause.addEventListener('click', () => {
  toggleGamePause();
});

// listen to keyboard events to move the active tetromino
document.addEventListener('keydown', (event) => {
  if (isGameOver) return;

  if (isGamePaused) {
    if (event.key !== 'Escape' && event.key !== 'p') {
      event.preventDefault();
      return;
    }
  }

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowRight':
      const col = event.key === 'ArrowLeft'
        ? tetromino.col - 1
        : tetromino.col + 1;

      if (isValidMove(tetromino.matrix, tetromino.row, col)) {
        tetromino.col = col;
      }
      break;

    case 'ArrowUp':
      const matrix = rotate(tetromino.matrix);
      if (isValidMove(matrix, tetromino.row, tetromino.col)) {
        tetromino.matrix = matrix;
      }
      break;

    case 'ArrowDown':
      downOne();
      break;

    case ' ':
      event.preventDefault();
      while (!downOne()) { }
      break;

    case 'Escape':
    case 'p':
      toggleGamePause();
      break;
  }
});

// Touch screen support
canvas.addEventListener('touchstart', (event) => {
  if (isGamePaused) return;
  event.preventDefault();

  touchStartTime = Date.now();
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
});

canvas.addEventListener('touchmove', (event) => {
  if (isGamePaused) return;
  event.preventDefault();

  rotateFlag = false;
  touchEndX = event.touches[0].clientX;
  touchEndY = event.touches[0].clientY;

  const timeStamp = event.timeStamp;
  const deltaTime = timeStamp - lastTimeStamp;
  lastTimeStamp = timeStamp;

  // Calculate the horizontal distance moved
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;

  // Determine the direction of the movement
  if (Math.abs(deltaX) > 20) {
    const col = deltaX > 0 ? tetromino.col + 1 : tetromino.col - 1;
    if (isValidMove(tetromino.matrix, tetromino.row, col)) {
      tetromino.col = col;
    }
    // Reset the touch start coordinate
    touchStartX = touchEndX;
  } else if (deltaY > 40 && deltaTime > 9 && !isDownwardMovementTriggered) {
    // Add a delay to the downward movement
    while (!downOne());
    touchStartY = touchEndY;
    isDownwardMovementTriggered = true;
  }
});

canvas.addEventListener('touchend', (event) => {
  isDownwardMovementTriggered = false;
  if (isGamePaused) return;
  if (!tetromino) return;
  event.preventDefault();

  const touchEndTime = Date.now();
  const touchDuration = touchEndTime - touchStartTime;

  // Define your threshold for a fast click (in milliseconds)
  const fastClickThreshold = 150;

  if (touchDuration > fastClickThreshold) return;

  const matrix = rotate(tetromino.matrix);

  if (isValidMove(matrix, tetromino.row, tetromino.col)) {
    tetromino.matrix = matrix;
  }

  rotateFlag = rotateFlag ? true : !rotateFlag;
});
