// public/js/game.js
const socket = io();

const config = {
  type: Phaser.AUTO,
  width: 6400,
  height: 4800,
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: { preload, create, update },
  scale: { mode: Phaser.Scale.RESIZE },
};

const game = new Phaser.Game(config);
let cursors, player;
const otherPlayers = {};
let lastUpdateTime = 0;
let lastPlayerPosition = { x: 1500, y: 900 };
let joystick,
  joystickToggle = false;
const showButton = document.getElementById("showButton");

// Preload assets
function preload() {
  this.load.image("tiles", "/assets/t1.png");
  this.load.tilemapCSV("wall", "/assets/one_wall.csv");
  this.load.tilemapCSV("floor", "/assets/one_floor.csv");
  this.load.spritesheet("dude", "/assets/Character 1.png", {
    frameWidth: 16,
    frameHeight: 16,
  });
  this.load.plugin(
    "rexvirtualjoystickplugin",
    "https://cdn.jsdelivr.net/npm/phaser3-rex-plugins/dist/rexvirtualjoystickplugin.min.js",
    true
  );
}

// Create name label helper (used for both local and remote players)
function createNameLabel(scene, name, x, y) {
  const nameBackground = scene.add.graphics();
  nameBackground.fillStyle(0x000000, 0.5);
  nameBackground.fillRoundedRect(-50, -20, 100, 30, 10);
  const nameText = scene.add
    .text(0, -10, name, {
      fontSize: "18px",
      fill: "#fff",
      fontFamily: "Arial",
    })
    .setOrigin(0.5);
  return scene.add.container(x, y - 60, [nameBackground, nameText]);
}

// Create game scene
function create() {
  // Create tilemaps and layers
  const wallMap = this.make.tilemap({
    key: "wall",
    tileWidth: 32,
    tileHeight: 32,
  });
  const floorMap = this.make.tilemap({
    key: "floor",
    tileWidth: 32,
    tileHeight: 32,
  });
  const tileset = wallMap.addTilesetImage("tiles");
  floorMap.createLayer(0, tileset, 0, 0);
  const wallLayer = wallMap
    .createLayer(0, tileset, 0, 0)
    .setCollisionByExclusion([-1]);

  // Create local player
  player = this.physics.add
    .sprite(3500, 1900, "dude")
    .setScale(8)
    .setCollideWorldBounds(true);
  this.physics.add.collider(player, wallLayer);

  // Create name label for local player
  const localNameLabel = createNameLabel(this, userId, player.x, player.y);
  this.events.on("update", () => {
    localNameLabel.setPosition(player.x, player.y - 80);
  });

  // Camera settings
  const camera = this.cameras.main;
  camera.startFollow(player).setZoom(0.4);
  camera.setBounds(0, 0, wallMap.widthInPixels, wallMap.heightInPixels);
  this.physics.world.setBounds(
    0,
    0,
    wallMap.widthInPixels,
    wallMap.heightInPixels
  );

  // Joystick setup
  joystick = this.plugins.get("rexvirtualjoystickplugin").add(this, {
    x: 2000,
    y: this.cameras.main.height + 100,
    radius: 80,
    base: this.add.circle(0, 0, 70, 0x888888),
    thumb: this.add.circle(0, 0, 50, 0xcccccc),
  });
  joystick.base.setVisible(joystickToggle);
  joystick.thumb.setVisible(joystickToggle);
  showButton.addEventListener("click", () => {
    joystickToggle = !joystickToggle;
    joystick.base.setVisible(joystickToggle);
    joystick.thumb.setVisible(joystickToggle);
  });

  // Swipe controls
  this.input.on("pointerdown", (pointer) => {
    this.startX = pointer.x;
    this.startY = pointer.y;
  });
  this.input.on("pointerup", (pointer) => {
    handleSwipe.call(this, pointer);
  });

  // Pinch zoom (mobile)
  let lastDistance = 0;
  this.input.on("pointermove", (pointer) => {
    if (pointer.pointerType === "touch" && pointer.pointers.length === 2) {
      let touch1 = pointer.pointers[0];
      let touch2 = pointer.pointers[1];
      let distance = Phaser.Math.Distance.Between(
        touch1.x,
        touch1.y,
        touch2.x,
        touch2.y
      );
      if (lastDistance !== 0) {
        let zoomChange = (distance - lastDistance) * 0.015;
        camera.setZoom(Phaser.Math.Clamp(camera.zoom + zoomChange, 0.4, 1.2));
      }
      lastDistance = distance;
    }
  });
  this.input.on("pointerup", () => {
    lastDistance = 0;
  });

  // Keyboard controls
  cursors = this.input.keyboard.createCursorKeys();
  this.input.on("wheel", (_, __, ___, deltaY) => {
    camera.setZoom(Phaser.Math.Clamp(camera.zoom - deltaY * 0.001, 0.4, 1.2));
  });

  // Socket: update positions from other players
  socket.on("updatePosition", (data) => {
    if (data.id === socket.id) return;
    if (!otherPlayers[data.id]) {
      const otherSprite = this.physics.add
        .sprite(data.x, data.y, "dude")
        .setScale(8)
        .setCollideWorldBounds(true);
      createPlayerAnimation.call(this, otherSprite, data.spriteNum);
      otherSprite.setImmovable(true);
      // Create name label for other player
      const nameLabel = createNameLabel(
        this,
        data.playerName,
        otherSprite.x,
        otherSprite.y
      );
      otherSprite.nameLabel = nameLabel;
      this.add.existing(nameLabel);
      otherPlayers[data.id] = otherSprite;
      this.physics.add.collider(player, otherSprite);
      Object.values(otherPlayers).forEach((existingPlayer) => {
        this.physics.add.collider(otherSprite, existingPlayer);
      });
    } else {
      // Tween update for smoother movement and label repositioning
      this.tweens.add({
        targets: otherPlayers[data.id],
        x: data.x,
        y: data.y,
        duration: 100,
        ease: "Linear",
        onUpdate: () => {
          if (otherPlayers[data.id].nameLabel) {
            otherPlayers[data.id].nameLabel.setPosition(
              otherPlayers[data.id].x,
              otherPlayers[data.id].y - 60
            );
          }
        },
      });
    }
    updatePlayerAnimation.call(this, otherPlayers[data.id], data.x, data.y);
  });

  socket.on("playerDisconnected", (id) => {
    if (otherPlayers[id]) {
      if (otherPlayers[id].nameLabel) otherPlayers[id].nameLabel.destroy();
      otherPlayers[id].destroy();
      delete otherPlayers[id];
    }
  });

  // Local player animation setup
  createPlayerAnimation.call(this, player, spriteNum);
}

// Swipe input handler
function handleSwipe(pointer) {
  const deltaX = pointer.x - this.startX;
  const deltaY = pointer.y - this.startY;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);
  const speedFactor = 2.5;
  if (absDeltaX > absDeltaY) {
    if (deltaX > 30) {
      player.setVelocityX(1200 * speedFactor);
      player.anims.play("right", true);
    } else if (deltaX < -30) {
      player.setVelocityX(-1200 * speedFactor);
      player.anims.play("left", true);
    }
  } else {
    if (deltaY > 30) {
      player.setVelocityY(1200 * speedFactor);
      player.anims.play("down", true);
    } else if (deltaY < -30) {
      player.setVelocityY(-1200 * speedFactor);
      player.anims.play("up", true);
    }
  }
  setTimeout(() => {
    player.setVelocity(0);
    player.anims.stop();
  }, 10000);
}

// Create player animations for all directions
function createPlayerAnimation(sprite, spriteNum) {
  function createAnimation(key, baseOffset, adjustedSpriteNum) {
    let frame = adjustedSpriteNum * 3 + baseOffset;
    sprite.anims.create({
      key,
      frames: sprite.anims.generateFrameNumbers("dude", {
        frames: [frame, frame + 1, frame + 2],
      }),
      frameRate: 10,
      repeat: 0,
    });
  }
  spriteNum = spriteNum - 1;
  const adjustedSpriteNum = spriteNum % 5;
  const offsetGroup = Math.floor(spriteNum / 5);
  const offsets = { down: 0, left: 15, right: 30, up: 45 };
  const groupOffset = offsetGroup * 60;
  createAnimation("down", offsets.down + groupOffset, adjustedSpriteNum);
  createAnimation("left", offsets.left + groupOffset, adjustedSpriteNum);
  createAnimation("right", offsets.right + groupOffset, adjustedSpriteNum);
  createAnimation("up", offsets.up + groupOffset, adjustedSpriteNum);
}

// Update player animation based on movement
function updatePlayerAnimation(sprite, newX, newY) {
  const velocityX = newX - sprite.x;
  const velocityY = newY - sprite.y;
  const distanceMoved = Math.sqrt(
    velocityX * velocityX + velocityY * velocityY
  );
  if (distanceMoved > 5) {
    if (Math.abs(velocityX) > Math.abs(velocityY))
      sprite.anims.play(velocityX > 0 ? "right" : "left", true);
    else sprite.anims.play(velocityY > 0 ? "down" : "up", true);
  } else {
    sprite.anims.stop();
  }
}

// Main update loop
let count = 0;
const callCooldown = {};
const activeCalls = {};
const PROXIMITY_THRESHOLD = 200;
const CALL_DELAY = 1500;
const DISCONNECT_DELAY = 1000;
const UPDATE_INTERVAL = 100;

function update(time) {
  if (count === 0) {
    player.anims.play("down", true);
    count++;
  }
  const speed = 960;
  player.setVelocity(0);

  // Joystick input
  if (joystick.force > 0) {
    const angle = joystick.angle;
    const radians = Phaser.Math.DegToRad(angle);
    player.setVelocityX(Math.cos(radians) * speed);
    player.setVelocityY(Math.sin(radians) * speed);
    if (angle >= -45 && angle <= 45) player.anims.play("right", true);
    else if (angle > 45 && angle < 135) player.anims.play("down", true);
    else if (angle >= 135 || angle <= -135) player.anims.play("left", true);
    else if (angle > -135 && angle < -45) player.anims.play("up", true);
  } else if (cursors.left.isDown) {
    player.setVelocityX(-speed);
    player.anims.play("left", true);
  } else if (cursors.right.isDown) {
    player.setVelocityX(speed);
    player.anims.play("right", true);
  } else if (cursors.up.isDown) {
    player.setVelocityY(-speed);
    player.anims.play("up", true);
  } else if (cursors.down.isDown) {
    player.setVelocityY(speed);
    player.anims.play("down", true);
  } else {
    player.anims.stop();
  }

  // Proximity handling for WebRTC calls (if applicable)
  Object.keys(otherPlayers).forEach((id) => {
    const other = otherPlayers[id];
    if (other.nameLabel) other.nameLabel.setPosition(other.x, other.y - 60);
    const distance = Phaser.Math.Distance.Between(
      player.x,
      player.y,
      other.x,
      other.y
    );
    if (distance <= PROXIMITY_THRESHOLD) {
      if (!callCooldown[id] && !activeCalls[id]) {
        console.log(`Near player: ${id}`);
        callCooldown[id] = true;
        setTimeout(() => {
          startCallWithPlayer(id);
          activeCalls[id] = true;
          delete callCooldown[id];
        }, CALL_DELAY);
      }
    } else if (activeCalls[id]) {
      console.log(`Moving away from player: ${id}`);
      if (distance > PROXIMITY_THRESHOLD + 20) {
        endCallWithPlayer(id);
        delete activeCalls[id];
      } else {
        setTimeout(() => {
          if (
            Phaser.Math.Distance.Between(player.x, player.y, other.x, other.y) >
            PROXIMITY_THRESHOLD
          ) {
            endCallWithPlayer(id);
            delete activeCalls[id];
          }
        }, DISCONNECT_DELAY);
      }
    }
  });

  // Emit position update at regular intervals
  if (player.x !== lastPlayerPosition.x || player.y !== lastPlayerPosition.y) {
    if (time - lastUpdateTime > UPDATE_INTERVAL) {
      socket.emit("updatePosition", {
        id: socket.id,
        x: player.x,
        y: player.y,
        spriteNum: spriteNum,
        playerName: userId,
      });
      lastPlayerPosition = { x: player.x, y: player.y };
      lastUpdateTime = time;
    }
  }
}

// Clean up on exit
function closeGame() {
  socket.emit("main-disconnect");
  socket.disconnect();
  game.destroy(true);
}
