import React, { useEffect, useRef, useState } from "react";
import "./App.css";

/*
  Simple React game implementing:
  - Dual obstacles (top + bottom pipe) moving left with a gap
  - Player can move left/right with ArrowLeft/ArrowRight
  - Player can jump (Space or ArrowUp)
  - Score increments when player passes an obstacle pair
  - Collision detection and restart
*/

const GAME_WIDTH = 700;
const GAME_HEIGHT = 500;
const PLAYER_SIZE = 34; // square player
const GRAVITY = 0.9;
const JUMP_VELOCITY = -14;
const HORIZ_SPEED = 6;
const OBSTACLE_WIDTH = 70;
const GAP_MIN = 120; // min gap height
const GAP_MAX = 180; // max gap height
const OBSTACLE_INTERVAL = 1600; // ms between obstacle spawns
const OBSTACLE_SPEED = 3.2; // px per frame ~ adjust for difficulty

function randomBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function App() {
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(
    parseInt(localStorage.getItem("sudoku_game_best") || "0", 10)
  );
  const [gameOver, setGameOver] = useState(false);

  const playerRef = useRef({
    x: GAME_WIDTH / 4,
    y: GAME_HEIGHT / 2,
    vy: 0,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
  });

  const obstaclesRef = useRef([]); // each obstacle: { x, gapTop, gapHeight, passed }
  const keysRef = useRef({});
  const lastSpawnRef = useRef(0);
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Reset game
  const resetGame = () => {
    playerRef.current = {
      x: GAME_WIDTH / 4,
      y: GAME_HEIGHT / 2,
      vy: 0,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
    };
    obstaclesRef.current = [];
    setScore(0);
    setGameOver(false);
    lastSpawnRef.current = 0;
  };

  // Start game
  const startGame = () => {
    resetGame();
animationRef.current && cancelAnimationFrame(animationRef.current);
setRunning(true);

    lastTimeRef.current = null;
    animationRef.current = requestAnimationFrame(loop);
  };

  // End / stop
  const stopGame = (didLose = true) => {
    setRunning(false);
    setGameOver(didLose);
    if (score > best) {
      setBest(score);
    localStorage.getItem("react_jump_best"));
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  // Keyboard handlers
  useEffect(() => {
    const onKeyDown = (e) => {
      keysRef.current[e.code] = true;
      // Prevent arrow keys from scrolling page
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code)
      ) {
        e.preventDefault();
      }
      // Jump on keydown of Space or ArrowUp
if (running && (e.code === "Space" || e.code === "ArrowUp")) {
  playerRef.current.vy = JUMP_VELOCITY;
  playerRef.current.y -= 2; // instant lift
}

      }
      // restart on Enter if game over
      if (!running && gameOver && e.code === "Enter") {
        startGame();
      }
    };
    const onKeyUp = (e) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, gameOver]);

  // Main game loop: physics + obstacles + collisions
  const loop = (timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // spawn obstacles based on ms interval
    if (timestamp - lastSpawnRef.current > OBSTACLE_INTERVAL || lastSpawnRef.current === 0) {
      spawnObstacle();
      lastSpawnRef.current = timestamp;
    }

    updatePlayer(dt);
    updateObstacles(dt);
    detectCollisions();

    // schedule next frame if still running
    if (running) {
      animationRef.current = requestAnimationFrame(loop);
    }
  };

  // Spawn an obstacle pair at right edge with random gap
  const spawnObstacle = () => {
    const gapH = randomBetween(GAP_MIN, GAP_MAX);
    const gapTop = randomBetween(40, GAME_HEIGHT - gapH - 40);
    obstaclesRef.current.push({
      x: GAME_WIDTH + 20,
      gapTop,
      gapHeight: gapH,
      width: OBSTACLE_WIDTH,
      speed: OBSTACLE_SPEED + Math.random() * 0.4,
      passed: false,
      id: Date.now() + Math.random(),
    });
    // keep list manageable
    if (obstaclesRef.current.length > 10) {
      obstaclesRef.current.shift();
    }
  };

  // Update player position & handle left/right controls
  const updatePlayer = (dt) => {
    const p = playerRef.current;
    // horizontal
    if (keysRef.current["ArrowLeft"]) {
      p.x -= HORIZ_SPEED;
    }
    if (keysRef.current["ArrowRight"]) {
      p.x += HORIZ_SPEED;
    }
    // bounds clamp
    p.x = Math.max(0, Math.min(GAME_WIDTH - p.width, p.x));

    // gravity & vertical
p.vy += GRAVITY * Math.min(dt / 16.6667, 2); // smooth gravity scaling
p.y += p.vy * (dt / 16.6667);

// clamp vertical position
p.y = Math.max(0, Math.min(GAME_HEIGHT - p.height, p.y));

// floor and ceiling (optional redundancy)
if (p.y + p.height > GAME_HEIGHT) {
  p.y = GAME_HEIGHT - p.height;
  p.vy = 0;
}
if (p.y < 0) {
  p.y = 0;
  p.vy = 0;
}


  // Update obstacles positions, scoring
  const updateObstacles = (dt) => {
    const list = obstaclesRef.current;
    for (let ob of list) {
      ob.x -= ob.speed * (dt / 16.6667);
      // scoring: when obstacle's right edge passes player's left edge and not yet counted
      if (!ob.passed && ob.x + ob.width < playerRef.current.x) {
        ob.passed = true;
        setScore((s) => s + 1);
      }
    }
    // remove off-screen obstacles
    obstaclesRef.current = list.filter((o) => o.x + o.width > -50);
  };

  // AABB collision detection between player and pipe rectangles
  const detectCollisions = () => {
    const p = playerRef.current;
    for (let ob of obstaclesRef.current) {
      // top rect: from x..x+width, y=0..gapTop
      const topRect = {
        x: ob.x,
        y: 0,
        w: ob.width,
        h: ob.gapTop,
      };
      // bottom rect: x..x+width, y=gapTop+gapHeight..GAME_HEIGHT
      const bottomRect = {
        x: ob.x,
        y: ob.gapTop + ob.gapHeight,
        w: ob.width,
        h: GAME_HEIGHT - (ob.gapTop + ob.gapHeight),
      };
      // check intersection with player rectangle
      if (rectIntersect(p, topRect) || rectIntersect(p, bottomRect)) {
        stopGame(true);
        return;
      }
    }
  };

  const rectIntersect = (p, r) => {
    return !(
      p.x + p.width < r.x ||
      p.x > r.x + r.w ||
      p.y + p.height < r.y ||
      p.y > r.y + r.h
    );
  };

  // Draw/canvas using DOM + inline styles - react will re-render UI on state changes
  // But the player and obstacles are drawn via refs and using requestAnimationFrame for smoothness
  // We'll use a local 'tick' RAF to force re-render at ~60fps while running
  const [, forceRerender] = useState(0);
  useEffect(() => {
    let raf = null;
    const tick = () => {
      if (running) {
        forceRerender((n) => n + 1);
        raf = requestAnimationFrame(tick);
      }
    };
    if (running) {
      raf = requestAnimationFrame(tick);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [running]);

  // cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // UI handlers
  const onStartClick = () => startGame();
  const onRestartClick = () => startGame();

  // Render helpers convert world coords to inline CSS
 const renderPlayerStyle = () => {
  const p = playerRef.current;
  return {
    left: `${p.x}px`,
    top: `${p.y}px`,
    width: `${p.width}px`,
    height: `${p.height}px`,
    background: p.vy < 0 
      ? 'radial-gradient(circle at 30% 30%, #ffdd57, #fff)' 
      : 'radial-gradient(circle at 30% 30%, #fff, #ffdd57)', // change color when jumping
  };
};


  const renderObstacleStyle = (o, top = true) => {
    if (top) {
      return {
        left: `${o.x}px`,
        top: `0px`,
        width: `${o.width}px`,
        height: `${o.gapTop}px`,
      };
    } else {
      const bottomTop = o.gapTop + o.gapHeight;
      return {
        left: `${o.x}px`,
        top: `${bottomTop}px`,
        width: `${o.width}px`,
        height: `${GAME_HEIGHT - bottomTop}px`,
      };
    }
  };

  return (
    <div className="app-root">
      <h2>React Jump-Through Pipes — Assignment 3</h2>
      <div className="hud">
        <div>Score: <strong>{score}</strong></div>
        <div>Best: <strong>{best}</strong></div>
        <div className="controls">
          <span>Controls: ArrowLeft / ArrowRight (move) • Space / ArrowUp (jump)</span>
        </div>
      </div>

      <div
  className="game-area"
  ref={(el) => el && el.focus()} // auto-focus for keyboard
  style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
  tabIndex={0}
>

        {/* Player */}
        <div className="player" style={renderPlayerStyle()} />

        {/* Obstacles */}
        {obstaclesRef.current.map((o, idx) => (
  <React.Fragment key={o.id}>
    {/* Shadow for next obstacle */}
    {idx === 0 && <div className="pipe top" style={{
      ...renderObstacleStyle(o, true),
      opacity: 0.5
    }} />}
    {idx === 0 && <div className="pipe bottom" style={{
      ...renderObstacleStyle(o, false),
      opacity: 0.5
    }} />}
    <div className="pipe top" style={renderObstacleStyle(o, true)} />
    <div className="pipe bottom" style={renderObstacleStyle(o, false)} />
  </React.Fragment>
))}


        {/* overlay messages */}
        {!running && !gameOver && (
          <div className="overlay">
            <div>Press Start to play</div>
            <button onClick={onStartClick}>Start</button>
          </div>
        )}
        {gameOver && (
          <div className="overlay">
            <div>Game Over</div>
            <div>Score: {score}</div>
            <button onClick={onRestartClick}>Restart</button>
          </div>
        )}
      </div>

      <div className="footer">
        <small>Record a 1–3 minute demo showing movement, jump, and scoring. Commit your code frequently to GitHub.</small>
      </div>
    </div>
  );
}

export default App;








