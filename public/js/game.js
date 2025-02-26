const socket = io();



const config = {
  type: Phaser.AUTO,
  width: 6400,
  height: 4800,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
};

const game = new Phaser.Game(config);

let cursors;
let player;
const otherPlayers = {};
let lastUpdateTime = 0;
let lastPlayerPosition = { x: 1500, y: 900 };
let joystick;
let joystickToogle = false;
const showButton = document.getElementById("showButton");

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

function create() {
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

  player = this.physics.add
    .sprite(3500, 2000, "dude")
    .setScale(5.5)
    .setCollideWorldBounds(true);
  this.physics.add.collider(player, wallLayer);

  // Create shadow (same as before)
  let shadow = this.add.graphics();
  shadow.fillStyle(0x000000, 0.3);
  shadow.fillEllipse(0, 0, 40, 20);
  shadow.depth = player.depth - 1; // ensures shadow is behind

  let shadowContainer = this.add.container(player.x, player.y + 20, [shadow]);

  // ✅ Create a background for the name label
  let nameBackground = this.add.graphics();
  nameBackground.fillStyle(0x000000, 0.5); // Semi-transparent black
  nameBackground.fillRoundedRect(-50, -20, 100, 30, 10); // Background shape

  // ✅ Create the text
  let nameText = this.add
    .text(0, -10, userId, {
      fontSize: "18px",
      fill: "#fff",
      fontFamily: "Arial",
    })
    .setOrigin(0.5);

  // ✅ Create a container that holds the text and background
  let nameLabelContainer = this.add.container(player.x, player.y - 60, [
    nameBackground,
    nameText,
  ]);

  // ✅ Update both shadow and name label positions in the update event
  this.events.on("update", () => {
    shadowContainer.setPosition(player.x, player.y + 25);
    nameLabelContainer.setPosition(player.x, player.y - 60);
  });

  const camera = this.cameras.main;
  camera.startFollow(player).setZoom(0.4);
  camera.setBounds(0, 0, wallMap.widthInPixels, wallMap.heightInPixels);
  this.physics.world.setBounds(
    0,
    0,
    wallMap.widthInPixels,
    wallMap.heightInPixels
  );

  joystick = this.plugins.get("rexvirtualjoystickplugin").add(this, {
    x: 1680,
    y: this.cameras.main.height + 100,
    radius: 80,
    base: this.add.circle(0, 0, 70, 0x888888),
    thumb: this.add.circle(0, 0, 50, 0xcccccc),
  });

  joystick.base.setVisible(joystickToogle);
  joystick.thumb.setVisible(joystickToogle);

  showButton.addEventListener("click", () => {
    joystickToogle = !joystickToogle;
    joystick.base.setVisible(joystickToogle);
    joystick.thumb.setVisible(joystickToogle);
  });


  this.input.on("pointerdown", (pointer) => {
    this.startX = pointer.x;
    this.startY = pointer.y;
  });

  this.input.on("pointerup", (pointer) => {
    let deltaX = pointer.x - this.startX;
    let deltaY = pointer.y - this.startY;

    let absDeltaX = Math.abs(deltaX);
    let absDeltaY = Math.abs(deltaY);

    if (absDeltaX > absDeltaY) {
      if (deltaX > 50) {
        player.setVelocityX(960); // Swipe Right
        player.anims.play("right", true);
      } else if (deltaX < -50) {
        player.setVelocityX(-960); // Swipe Left
        player.anims.play("left", true);
      }
    } else {
      if (deltaY > 50) {
        player.setVelocityY(960); // Swipe Down
        player.anims.play("down", true);
      } else if (deltaY < -50) {
        player.setVelocityY(-960); // Swipe Up
        player.anims.play("up", true);
      }
    }

    setTimeout(() => {
      player.setVelocity(0); // Stop movement after some time
      player.anims.stop();
    }, 300);
  });

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
      let zoomChange = (distance - lastDistance) * 0.002; // Adjust sensitivity
      let newZoom = this.cameras.main.zoom + zoomChange;
      this.cameras.main.setZoom(Phaser.Math.Clamp(newZoom, 0.4, 1.2));
    }

    lastDistance = distance;
  }
});

this.input.on("pointerup", () => {
  lastDistance = 0;
});


  cursors = this.input.keyboard.createCursorKeys();

  this.input.on("wheel", (_, __, ___, deltaY) => {
    const zoom = camera.zoom - deltaY * 0.001;
    camera.setZoom(Phaser.Math.Clamp(zoom, 0.4, 1.2));
  });

socket.on("updatePosition", (data) => {
  if (data.id !== socket.id) {
    if (!otherPlayers[data.id]) {
      const otherSprite = this.physics.add
        .sprite(data.x, data.y, "dude")
        .setScale(5.5)
        .setCollideWorldBounds(true);

      createPlayerAnimation.call(this, otherSprite, data.spriteNum);
      otherSprite.setImmovable(true);

      
      // ✅ Create name label for the other player
      let nameBackground = this.add.graphics();
      nameBackground.fillStyle(0x000000, 0.5);
      nameBackground.fillRoundedRect(-50, -20, 100, 30, 10);

      let nameText = this.add
        .text(0, -10, data.playerName, {
          fontSize: "18px",
          fill: "#fff",
          fontFamily: "Arial",
        })
        .setOrigin(0.5);

      let nameLabelContainer = this.add.container(
        otherSprite.x,
        otherSprite.y - 60,
        [nameBackground, nameText]
      );

      // Store the label in the player object
      otherSprite.nameLabel = nameLabelContainer;

      // Add to game scene
      this.add.existing(nameLabelContainer);

      // **Add to otherPlayers object**
      otherPlayers[data.id] = otherSprite;

      Object.values(otherPlayers).forEach((existingPlayer) => {
        this.physics.add.collider(otherSprite, existingPlayer);
      });

      this.physics.add.collider(player, otherSprite);
      otherPlayers[data.id] = otherSprite;

    } else {
      // ✅ Update name label position when player moves
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
  }
});


socket.on("playerDisconnected", (id) => {
  if (otherPlayers[id]) {
    if (otherPlayers[id].nameLabel) {
      otherPlayers[id].nameLabel.destroy(); // Destroy the label
    }
    otherPlayers[id].destroy(); // Destroy player sprite
    delete otherPlayers[id]; // Remove from object
  }
});


  // Animations for the local character
  createPlayerAnimation.call(this, player, spriteNum);
}

function createPlayerAnimation(sprite, spriteNum) {
  function createAnimation(key, baseOffset, adjustedSpriteNum) {
    let f = adjustedSpriteNum * 3 + baseOffset;
    sprite.anims.create({
      key: key,
      frames: sprite.anims.generateFrameNumbers("dude", {
        frames: [f, f + 1, f + 2],
      }),
      frameRate: 10,
      repeat: 0,
    });
  }
  spriteNum -= 1;
  let adjustedSpriteNum = spriteNum % 5;
  let offsetGroup = Math.floor(spriteNum / 5);
  let offsets = {
    down: 0,
    left: 15,
    right: 30,
    up: 45,
  };

  let groupOffset = offsetGroup * 60;

  createAnimation.call(
    sprite,
    "down",
    offsets.down + groupOffset,
    adjustedSpriteNum
  );
  createAnimation.call(
    sprite,
    "left",
    offsets.left + groupOffset,
    adjustedSpriteNum
  );
  createAnimation.call(
    sprite,
    "right",
    offsets.right + groupOffset,
    adjustedSpriteNum
  );
  createAnimation.call(
    sprite,
    "up",
    offsets.up + groupOffset,
    adjustedSpriteNum
  );
}

function updatePlayerAnimation(sprite, newX, newY) {
  const velocityX = newX - sprite.x;
  const velocityY = newY - sprite.y;

  const distanceMoved = Math.sqrt(
    velocityX * velocityX + velocityY * velocityY
  );
  const movementThreshold = 5;

  if (distanceMoved > movementThreshold) {
    const angle = Phaser.Math.Angle.Between(0, 0, velocityX, velocityY);
    const radians = Phaser.Math.DegToRad(angle);

    if (Math.abs(velocityX) > Math.abs(velocityY)) {
      if (velocityX > 0) {
        sprite.anims.play("right", true);
      } else {
        sprite.anims.play("left", true);
      }
    } else {
      if (velocityY > 0) {
        sprite.anims.play("down", true);
      } else {
        sprite.anims.play("up", true);
      }
    }
  } else {
    sprite.anims.stop();
  }
}

let count = 0;
const callCooldown = {};
const activeCalls = {}; // Track active WebRTC calls
const PROXIMITY_THRESHOLD = 200;
const CALL_DELAY = 1500; // Reduced to 1.5s for faster call initiation
const DISCONNECT_DELAY = 1000; // Reduced to 1s for quick disconnection
const UPDATE_INTERVAL = 100;

function update(time) {
  if (count === 0) {
    player.anims.play("down", true);
    count++;
    console.log(count);
  }

  const speed = 960;
  player.setVelocity(0);

  if (joystick.force > 0) {
    const angle = joystick.angle;
    const radians = Phaser.Math.DegToRad(angle);
    player.setVelocityX(Math.cos(radians) * speed);
    player.setVelocityY(Math.sin(radians) * speed);

    if (angle >= -45 && angle <= 45) {
      player.anims.play("right", true);
    } else if (angle > 45 && angle < 135) {
      player.anims.play("down", true);
    } else if (angle >= 135 || angle <= -135) {
      player.anims.play("left", true);
    } else if (angle > -135 && angle < -45) {
      player.anims.play("up", true);
    }
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

  Object.keys(otherPlayers).forEach((id) => {
    let other = otherPlayers[id];
    if (other.nameLabel) {
      other.nameLabel.setPosition(other.x, other.y - 60);
    }
    let distance = Phaser.Math.Distance.Between(
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
          activeCalls[id] = true; // Mark call as active
          delete callCooldown[id];
        }, CALL_DELAY);
      }
    } else if (activeCalls[id]) {
      console.log(`Moving away from player: ${id}`);
      if (distance > PROXIMITY_THRESHOLD + 20) {
        // Extra buffer to avoid frequent disconnects
        endCallWithPlayer(id);
        delete activeCalls[id]; // Remove from active calls
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




function closeGame() {
  socket.emit("playerDisconnected", socket.id);
  socket.disconnect();
  game.destroy(true);
}
