// Game state container
const gameState = {
  score: 0,
  wickets: 0,
  ballsFaced: 0,
  target: 30, // Chasing 30 runs in 1 over (6 balls)
  highScore: 0
};

export function getGameState() {
  return gameState;
}

export function initGameState() {
  gameState.score = 0;
  gameState.wickets = 0;
  gameState.ballsFaced = 0;
  // Randomize target between 24 and 36 runs to make replayability more fun
  gameState.target = 24 + Math.floor(Math.random() * 13);
  
  // Load high score from localStorage
  const savedHighScore = localStorage.getItem('hyper_cricket_highscore');
  if (savedHighScore !== null) {
    gameState.highScore = parseInt(savedHighScore, 10);
  } else {
    gameState.highScore = 0;
  }
  
  updateGameState();
}

export function recordRuns(runs) {
  if (gameState.ballsFaced >= 6 || gameState.wickets >= 10) return;
  gameState.score += runs;
  gameState.ballsFaced++;
  
  // Check high score update
  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score;
    localStorage.setItem('hyper_cricket_highscore', gameState.highScore.toString());
  }
  
  updateGameState();
}

export function recordWicket() {
  if (gameState.ballsFaced >= 6 || gameState.wickets >= 10) return;
  gameState.wickets++;
  gameState.ballsFaced++;
  updateGameState();
}

export function recordDotBall() {
  if (gameState.ballsFaced >= 6 || gameState.wickets >= 10) return;
  gameState.ballsFaced++;
  updateGameState();
}

export function updateGameState() {
  // 1. Runs / Wickets
  const runsWicketsEl = document.getElementById('score-runs-wickets');
  if (runsWicketsEl) {
    runsWicketsEl.textContent = `${gameState.score}/${gameState.wickets}`;
  }
  
  // 2. Overs display
  const oversEl = document.getElementById('score-overs');
  if (oversEl) {
    const completedOvers = Math.floor(gameState.ballsFaced / 6);
    const fractionalBalls = gameState.ballsFaced % 6;
    oversEl.textContent = `(${completedOvers}.${fractionalBalls} Overs)`;
  }
  
  // 3. Strikes Left (out of 6 balls total in Super Over)
  const strikesEl = document.getElementById('strikes-display');
  if (strikesEl) {
    const ballsRemaining = Math.max(0, 6 - gameState.ballsFaced);
    strikesEl.textContent = `${ballsRemaining} Ball${ballsRemaining !== 1 ? 's' : ''}`;
  }
  
  // 4. Target display
  const targetEl = document.getElementById('target-display');
  if (targetEl) {
    targetEl.textContent = `${gameState.target} Runs`;
  }
  
  // 5. High Score display
  const highscoreEl = document.getElementById('highscore-display');
  if (highscoreEl) {
    highscoreEl.textContent = gameState.highScore;
  }
}
