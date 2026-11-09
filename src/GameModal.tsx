import { useEffect, useRef } from 'react'
import Phaser from 'phaser'

export type MiniGame = 'flappy' | 'snake'
type Direction = 'up' | 'down' | 'left' | 'right'
type GridPoint = { x: number; y: number }

const GAME_WIDTH = 640
const GAME_HEIGHT = 460
const SNAKE_COLUMNS = 24
const SNAKE_ROWS = 14
const SNAKE_CELL = 25
const SNAKE_ORIGIN_X = 20
const SNAKE_ORIGIN_Y = 80

class FlappyBirdScene extends Phaser.Scene {
  private bird!: Phaser.Physics.Arcade.Image
  private scoreText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private pipes: Array<{ top: Phaser.GameObjects.Rectangle; bottom: Phaser.GameObjects.Rectangle; scored: boolean }> = []
  private score = 0
  private started = false
  private ended = false

  constructor() {
    super('FlappyBirdScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#b9e8ef')
    this.add.ellipse(108, 94, 92, 28, 0xffffff, 0.65)
    this.add.ellipse(490, 138, 126, 34, 0xffffff, 0.48)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 16, GAME_WIDTH, 32, 0x80a967)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 34, GAME_WIDTH, 4, 0x597c49)

    if (!this.textures.exists('soda-bird')) {
      const birdTexture = this.make.graphics({ x: 0, y: 0 })
      birdTexture.fillStyle(0xffc857)
      birdTexture.fillCircle(18, 18, 16)
      birdTexture.fillStyle(0x28251f)
      birdTexture.fillCircle(24, 13, 3)
      birdTexture.fillStyle(0xf08045)
      birdTexture.fillTriangle(29, 18, 39, 22, 29, 25)
      birdTexture.generateTexture('soda-bird', 40, 40)
      birdTexture.destroy()
    }

    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT - 32)
    this.bird = this.physics.add.image(142, 215, 'soda-bird')
    this.bird.setCircle(15).setCollideWorldBounds(true).setBounce(0)
    const birdBody = this.bird.body as Phaser.Physics.Arcade.Body
    birdBody.setAllowGravity(false)
    this.bird.setGravityY(900)

    this.scoreText = this.add.text(24, 18, '0', {
      color: '#18313a',
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '38px',
      fontStyle: 'bold',
    })
    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'TAP OR PRESS SPACE', {
      color: '#18313a',
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#ffffff',
      strokeThickness: 5,
    }).setOrigin(0.5)

    this.time.addEvent({ delay: 1450, loop: true, callback: this.spawnPipes, callbackScope: this })
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.flap, this)
    this.input.keyboard?.on('keydown-SPACE', this.flap, this)
    this.input.keyboard?.on('keydown-UP', this.flap, this)
    this.input.keyboard?.on('keydown-R', () => this.scene.restart())
  }

  update() {
    if (this.ended) return

    if (this.started && (this.bird.y < -20 || this.bird.y > GAME_HEIGHT - 54)) {
      this.endGame()
      return
    }

    this.pipes = this.pipes.filter((pair) => {
      if (!pair.scored && pair.top.x + pair.top.width / 2 < this.bird.x) {
        pair.scored = true
        this.score += 1
        this.scoreText.setText(String(this.score))
      }

      if (pair.top.x < -80) {
        pair.top.destroy()
        pair.bottom.destroy()
        return false
      }

      return true
    })
  }

  private flap() {
    if (this.ended) {
      this.scene.restart()
      return
    }
    if (!this.started) {
      this.started = true
      const birdBody = this.bird.body as Phaser.Physics.Arcade.Body
      birdBody.setAllowGravity(true)
      this.statusText.setVisible(false)
    }

    this.bird.setVelocityY(-350)
  }

  private spawnPipes() {
    if (!this.started || this.ended) return

    const gapSize = 154
    const gapCenter = Phaser.Math.Between(160, GAME_HEIGHT - 150)
    const topHeight = gapCenter - gapSize / 2
    const bottomStart = gapCenter + gapSize / 2
    const bottomHeight = GAME_HEIGHT - 32 - bottomStart
    const x = GAME_WIDTH + 44
    const top = this.add.rectangle(x, topHeight / 2, 68, topHeight, 0x398b55).setStrokeStyle(3, 0x286b41)
    const bottom = this.add.rectangle(x, bottomStart + bottomHeight / 2, 68, bottomHeight, 0x398b55).setStrokeStyle(3, 0x286b41)

    ;[top, bottom].forEach((pipe) => {
      this.physics.add.existing(pipe)
      const body = pipe.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setImmovable(true)
      body.setVelocityX(-225)
      this.physics.add.collider(this.bird, pipe, () => this.endGame())
    })

    this.pipes.push({ top, bottom, scored: false })
  }

  private endGame() {
    if (this.ended) return
    this.ended = true
    this.physics.world.pause()
    this.statusText
      .setText(`GAME OVER  ·  ${this.score}\nTAP OR PRESS R TO RESTART`)
      .setVisible(true)
  }
}

class SnakeScene extends Phaser.Scene {
  private board!: Phaser.GameObjects.Graphics
  private scoreText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private snake: GridPoint[] = []
  private food: GridPoint = { x: 0, y: 0 }
  private direction: Direction = 'right'
  private nextDirection: Direction = 'right'
  private score = 0
  private ended = false
  private pointerStart: Phaser.Math.Vector2 | null = null

  constructor() {
    super('SnakeScene')
  }

  create() {
    this.cameras.main.setBackgroundColor('#101814')
    this.snake = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }]
    this.direction = 'right'
    this.nextDirection = 'right'
    this.score = 0
    this.ended = false
    this.food = this.randomFood()
    this.board = this.add.graphics()
    this.scoreText = this.add.text(22, 20, 'SCORE  0', {
      color: '#eef4e9',
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '21px',
      fontStyle: 'bold',
    })
    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      color: '#eef4e9',
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '23px',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#101814',
      strokeThickness: 6,
    }).setOrigin(0.5).setVisible(false)
    this.drawBoard()
    this.time.addEvent({ delay: 135, loop: true, callback: this.step, callbackScope: this })

    const keyboard = this.input.keyboard
    keyboard?.on('keydown-UP', () => this.setDirection('up'))
    keyboard?.on('keydown-DOWN', () => this.setDirection('down'))
    keyboard?.on('keydown-LEFT', () => this.setDirection('left'))
    keyboard?.on('keydown-RIGHT', () => this.setDirection('right'))
    keyboard?.on('keydown-W', () => this.setDirection('up'))
    keyboard?.on('keydown-S', () => this.setDirection('down'))
    keyboard?.on('keydown-A', () => this.setDirection('left'))
    keyboard?.on('keydown-D', () => this.setDirection('right'))
    keyboard?.on('keydown-R', () => this.scene.restart())

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.pointerStart = new Phaser.Math.Vector2(pointer.x, pointer.y)
    })
    this.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (!this.pointerStart) return
      const deltaX = pointer.x - this.pointerStart.x
      const deltaY = pointer.y - this.pointerStart.y
      this.pointerStart = null

      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 18) {
        if (this.ended) this.scene.restart()
        return
      }
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        this.setDirection(deltaX < 0 ? 'left' : 'right')
      } else {
        this.setDirection(deltaY < 0 ? 'up' : 'down')
      }
    })
  }

  setDirection(direction: Direction) {
    const opposites: Record<Direction, Direction> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    }

    if (direction !== opposites[this.direction]) {
      this.nextDirection = direction
    }
  }

  private step() {
    if (this.ended) return
    this.direction = this.nextDirection

    const head = this.snake[0]
    const nextHead = { ...head }
    if (this.direction === 'up') nextHead.y -= 1
    if (this.direction === 'down') nextHead.y += 1
    if (this.direction === 'left') nextHead.x -= 1
    if (this.direction === 'right') nextHead.x += 1

    const eating = nextHead.x === this.food.x && nextHead.y === this.food.y
    const collisionBody = eating ? this.snake : this.snake.slice(0, -1)
    const hitBody = collisionBody.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y)
    const hitWall = nextHead.x < 0 || nextHead.y < 0 || nextHead.x >= SNAKE_COLUMNS || nextHead.y >= SNAKE_ROWS

    if (hitWall || hitBody) {
      this.endGame()
      return
    }

    this.snake.unshift(nextHead)
    if (eating) {
      this.score += 1
      this.scoreText.setText(`SCORE  ${this.score}`)
      if (this.snake.length === SNAKE_COLUMNS * SNAKE_ROWS) {
        this.endGame(true)
        return
      }
      this.food = this.randomFood()
    } else {
      this.snake.pop()
    }

    this.drawBoard()
  }

  private randomFood(): GridPoint {
    let point: GridPoint
    do {
      point = {
        x: Phaser.Math.Between(0, SNAKE_COLUMNS - 1),
        y: Phaser.Math.Between(0, SNAKE_ROWS - 1),
      }
    } while (this.snake.some((segment) => segment.x === point.x && segment.y === point.y))

    return point
  }

  private drawBoard() {
    const width = SNAKE_COLUMNS * SNAKE_CELL
    const height = SNAKE_ROWS * SNAKE_CELL
    this.board.clear()
    this.board.fillStyle(0x17231d)
    this.board.fillRoundedRect(SNAKE_ORIGIN_X, SNAKE_ORIGIN_Y, width, height, 8)
    this.board.lineStyle(1, 0x26372e, 0.65)
    for (let column = 0; column <= SNAKE_COLUMNS; column += 1) {
      const x = SNAKE_ORIGIN_X + column * SNAKE_CELL
      this.board.lineBetween(x, SNAKE_ORIGIN_Y, x, SNAKE_ORIGIN_Y + height)
    }
    for (let row = 0; row <= SNAKE_ROWS; row += 1) {
      const y = SNAKE_ORIGIN_Y + row * SNAKE_CELL
      this.board.lineBetween(SNAKE_ORIGIN_X, y, SNAKE_ORIGIN_X + width, y)
    }

    this.board.fillStyle(0xf17d65)
    this.board.fillCircle(
      SNAKE_ORIGIN_X + this.food.x * SNAKE_CELL + SNAKE_CELL / 2,
      SNAKE_ORIGIN_Y + this.food.y * SNAKE_CELL + SNAKE_CELL / 2,
      8,
    )
    this.snake.forEach((segment, index) => {
      this.board.fillStyle(index === 0 ? 0xb8df7a : 0x83b95e)
      this.board.fillRoundedRect(
        SNAKE_ORIGIN_X + segment.x * SNAKE_CELL + 2,
        SNAKE_ORIGIN_Y + segment.y * SNAKE_CELL + 2,
        SNAKE_CELL - 4,
        SNAKE_CELL - 4,
        5,
      )
    })
  }

  private endGame(won = false) {
    this.ended = true
    this.statusText
      .setText(`${won ? 'BOARD CLEARED' : 'GAME OVER'}  ·  ${this.score}\nTAP OR PRESS R TO RESTART`)
      .setVisible(true)
  }
}

type GameModalProps = {
  game: MiniGame
  onClose: () => void
}

export default function GameModal({ game, onClose }: GameModalProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const snakeSceneRef = useRef<SnakeScene | null>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const scene = game === 'flappy' ? new FlappyBirdScene() : new SnakeScene()
    snakeSceneRef.current = game === 'snake' ? scene as SnakeScene : null

    const phaserGame = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: stage,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      autoFocus: false,
      backgroundColor: game === 'flappy' ? '#b9e8ef' : '#101814',
      render: { antialias: true },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: { debug: false },
      },
      scene: [scene],
    })
    phaserGame.events.once(Phaser.Core.Events.READY, () => stage.focus({ preventScroll: true }))

    return () => {
      phaserGame.destroy(true)
      snakeSceneRef.current = null
    }
  }, [game])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const title = game === 'flappy' ? 'Flappy Bird' : 'Snake'

  return (
    <div
      className="mini-game-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="mini-game-dialog" role="dialog" aria-modal="true" aria-labelledby="mini-game-title">
        <header className="mini-game-header">
          <div>
            <p className="eyebrow mini-eyebrow">Mini game</p>
            <h2 id="mini-game-title">{title}</h2>
          </div>
          <button type="button" className="mini-game-close" onClick={onClose} aria-label="Close game">
            ×
          </button>
        </header>
        <div
          ref={stageRef}
          className={`phaser-stage phaser-stage-${game}`}
          tabIndex={0}
          aria-label={`${title} game area`}
          onKeyDown={(event) => {
            if (event.code === 'Space') event.preventDefault()
          }}
        />
        {game === 'snake' && (
          <div className="snake-direction-controls" role="group" aria-label="Snake direction controls">
            <button type="button" className="snake-direction-up" onClick={() => snakeSceneRef.current?.setDirection('up')} aria-label="Move up">↑</button>
            <button type="button" onClick={() => snakeSceneRef.current?.setDirection('left')} aria-label="Move left">←</button>
            <button type="button" onClick={() => snakeSceneRef.current?.setDirection('down')} aria-label="Move down">↓</button>
            <button type="button" onClick={() => snakeSceneRef.current?.setDirection('right')} aria-label="Move right">→</button>
          </div>
        )}
        <p className="mini-game-instructions">
          {game === 'flappy'
            ? 'Tap or press Space to flap. Avoid pipes. After game over, tap to restart.'
            : 'Use the arrows, WASD, swipe, or direction pad. Eat fruit and avoid collisions. After game over, tap the board to restart.'}
        </p>
      </section>
    </div>
  )
}