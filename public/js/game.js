const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: { preload, create, update },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
const game = new Phaser.Game(config);

// Global Variables
let player;
const otherPlayers = {};
let lastUpdateTime = 0;
let lastPlayerPosition = { x: 1500, y: 900 };
let joystick,
  joystickToggle = false;
const showButton = document.getElementById("showButton");

// Chair-sitting variables
let sitting = false;
let sitText; // "Press X to Sit/Leave" prompt
let chairLayer; // The tile layer for chairs (for collision)

// New global arrays for object layers from Tiled:
let chairObjects = [];
let textObjects = [];

// New global variables for Lobby (from Tiled) and its state:
let lobbyRegion = null;
let inLobby = false;

// WebRTC placeholders (if used)
const callCooldown = {};
const activeCalls = {};
const PROXIMITY_THRESHOLD = 100;
const CALL_DELAY = 1500;
const DISCONNECT_DELAY = 1000;

// Movement config
const UPDATE_INTERVAL = 100;
const speed = 960;
let count = 0;

// Conference Hall Region (from Tiled)
let conferenceHallRegion = null;
let inConferenceHall = false;

// WASD keys and sit toggle key
let wKey, aKey, sKey, dKey, sitKey;
let cursors;

function preload() {
  // Load assets
  this.load.image("finalTiles", "/assets/main_assets/final.png");
  // Load the map as JSON (exported from Tiled with embedded tilesets and object layers)
  this.load.tilemapTiledJSON("map", "/assets/final_csv/final.json");
  this.load.spritesheet("dude", "/assets/sprite_character/Character1.png", {
    frameWidth: 16,
    frameHeight: 16,
  });
  this.load.spritesheet("dude_sit", "/assets/sprite_character/Character2.png", {
    frameWidth: 16,
    frameHeight: 16,
  });
  this.load.plugin(
    "rexvirtualjoystickplugin",
    "https://cdn.jsdelivr.net/npm/phaser3-rex-plugins/dist/rexvirtualjoystickplugin.min.js",
    true
  );
}

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

function create() {
  // Create the tilemap from the JSON file
  const map = this.make.tilemap({ key: "map" });
  const tileset = map.addTilesetImage("final", "finalTiles");

  // Create layers (using the names defined in Tiled)
  const floorLayer = map.createLayer("floor", tileset, 0, 0);
  const wallLayer = map.createLayer("wall", tileset, 0, 0);
  chairLayer = map.createLayer("chair", tileset, 0, 0);
  const other1Layer = map.createLayer("other1", tileset, 0, 0);
  const other2Layer = map.createLayer("other2", tileset, 0, 0);
  const other0Layer = map.createLayer("other0", tileset, 0, 0);
  const activeLayer = map.createLayer("active", tileset, 0, 0);

  // Set collisions (using properties defined in Tiled)
  wallLayer.setCollisionByProperty({ collides: true });
  other0Layer.setCollisionByProperty({ collides: true });
  other1Layer.setCollisionByProperty({ collides: true });
  other2Layer.setCollisionByProperty({ collides: true });
  activeLayer.setCollisionByProperty({ collides: true });

  // Parse conference hall region from Tiled objects
  const confLayer = map.getObjectLayer("conference hall");
  if (confLayer && confLayer.objects.length > 0) {
    confLayer.objects.forEach((obj) => {
      if (obj.properties) {
        obj.properties.forEach((prop) => {
          if (prop.name === "isConference" && prop.value === true) {
            conferenceHallRegion = new Phaser.Geom.Rectangle(
              obj.x,
              obj.y,
              obj.width,
              obj.height
            );
            console.log("Conference Hall Region:", conferenceHallRegion);
          }
        });
      }
    });
  }

  // NEW: Parse Lobby region from Tiled objects (assumes object layer name "lobby")
  const lobbyLayer = map.getObjectLayer("lobby");
  if (lobbyLayer && lobbyLayer.objects.length > 0) {
    // Assuming one lobby region is defined
    const lobbyObj = lobbyLayer.objects[0];
    lobbyRegion = new Phaser.Geom.Rectangle(
      lobbyObj.x,
      lobbyObj.y,
      lobbyObj.width,
      lobbyObj.height
    );
    console.log("Lobby Region:", lobbyRegion);
  }

  // Parse new object layers for chairs and text
  const chairObjLayer = map.getObjectLayer("chairObj");
  if (chairObjLayer) {
    chairObjects = chairObjLayer.objects;
  }
  const textObjLayer = map.getObjectLayer("textObj");
  if (textObjLayer) {
    textObjects = textObjLayer.objects;
  }

  // Create the local player sprite
  player = this.physics.add
    .sprite(3000, 1650, "dude")
    .setScale(2.5)
    .setCollideWorldBounds(true);
  player.lastDirection = "down";

  // Set up collisions
  this.physics.add.collider(player, wallLayer);
  this.physics.add.collider(player, other0Layer);
  this.physics.add.collider(player, other1Layer);
  this.physics.add.collider(player, other2Layer);
  this.physics.add.collider(player, activeLayer);
  this.physics.add.collider(player, chairLayer);
  this.physics.add.overlap(player, activeLayer, () => {});

  // Configure camera
  const camera = this.cameras.main;
  camera.startFollow(player).setZoom(0.9);
  camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

  // Joystick setup
  joystick = this.plugins.get("rexvirtualjoystickplugin").add(this, {
    x: 1350,
    y: camera.height - 140,
    radius: 40,
    base: this.add.circle(0, 0, 50, 0x888888),
    thumb: this.add.circle(0, 0, 30, 0xcccccc),
  });
  joystick.base.setVisible(joystickToggle);
  joystick.thumb.setVisible(joystickToggle);
  showButton.addEventListener("click", () => {
    joystickToggle = !joystickToggle;
    joystick.base.setVisible(joystickToggle);
    joystick.thumb.setVisible(joystickToggle);
  });

  sitKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);

  cursors = this.input.keyboard.createCursorKeys();

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

  // Wheel zoom
  this.input.on("wheel", (_, __, ___, deltaY) => {
    camera.setZoom(Phaser.Math.Clamp(camera.zoom - deltaY * 0.001, 0.4, 1.2));
  });

  // Socket events for remote players
  socket.on("updatePosition", (data) => {
    if (data.id === socket.id) return;
    if (!otherPlayers[data.id]) {
      const otherSprite = this.physics.add
        .sprite(data.x, data.y, "dude")
        .setScale(2.5)
        .setCollideWorldBounds(true);
      createPlayerAnimation.call(this, otherSprite, data.spriteNum);
      otherSprite.setImmovable(true);
      const nameLabel = createNameLabel(
        this,
        data.playerName,
        otherSprite.x,
        otherSprite.y
      );
      otherSprite.nameLabel = nameLabel;
      this.add.existing(nameLabel);
      otherSprite.targetX = data.x;
      otherSprite.targetY = data.y;
      otherSprite.prevX = data.x;
      otherSprite.prevY = data.y;
      otherPlayers[data.id] = otherSprite;
      this.physics.add.collider(player, otherSprite);
      Object.values(otherPlayers).forEach((existingPlayer) => {
        this.physics.add.collider(otherSprite, existingPlayer);
      });
    } else {
      otherPlayers[data.id].targetX = data.x;
      otherPlayers[data.id].targetY = data.y;
    }
  });

  socket.on("playerDisconnected", (id) => {
    if (otherPlayers[id]) {
      if (otherPlayers[id].nameLabel) otherPlayers[id].nameLabel.destroy();
      otherPlayers[id].destroy();
      delete otherPlayers[id];
    }
  });

  createPlayerAnimation.call(this, player, spriteNum);
}

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
      player.lastDirection = "right";
    } else if (deltaX < -30) {
      player.setVelocityX(-1200 * speedFactor);
      player.anims.play("left", true);
      player.lastDirection = "left";
    }
  } else {
    if (deltaY > 30) {
      player.setVelocityY(1200 * speedFactor);
      player.anims.play("down", true);
      player.lastDirection = "down";
    } else if (deltaY < -30) {
      player.setVelocityY(-1200 * speedFactor);
      player.anims.play("up", true);
      player.lastDirection = "up";
    }
  }
  setTimeout(() => {
    player.setVelocity(0);
    player.anims.stop();
  }, 10000);
}

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

function sitOnChair() {
  // Find the nearest chair object from the chairObjects array
  let nearestChairObj = null;
  let minDist = Infinity;
  chairObjects.forEach((obj) => {
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const dist = Phaser.Math.Distance.Between(
      player.x,
      player.y,
      centerX,
      centerY
    );
    if (dist < minDist) {
      minDist = dist;
      nearestChairObj = { centerX, centerY, properties: obj.properties };
    }
  });

  // If no chair object found, fallback to nearest tile from chairLayer
  let finalX, finalY;
  if (nearestChairObj) {
    finalX = nearestChairObj.centerX;
    finalY = nearestChairObj.centerY;
  } else if (chairLayer) {
    let closestTile = null;
    let minTileDist = Infinity;
    chairLayer.layer.data.forEach((row) => {
      row.forEach((tile) => {
        if (tile.index !== -1) {
          const tileCenterX = tile.pixelX + tile.width / 2;
          const tileCenterY = tile.pixelY + tile.height / 2;
          const tileDist = Phaser.Math.Distance.Between(
            player.x,
            player.y,
            tileCenterX,
            tileCenterY
          );
          if (tileDist < minTileDist) {
            minTileDist = tileDist;
            closestTile = tile;
          }
        }
      });
    });
    if (closestTile) {
      finalX = closestTile.pixelX + closestTile.width / 2;
      finalY = closestTile.pixelY + closestTile.height / 2;
    }
  }

  // Determine the chair direction from properties or fallback to lastDirection
  let chairDirection = "down";
  if (nearestChairObj && nearestChairObj.properties) {
    nearestChairObj.properties.forEach((prop) => {
      if (prop.name === "chairDirection") {
        chairDirection = prop.value;
      }
    });
  } else {
    chairDirection = player.lastDirection;
  }

  // Calculate the sitting frame based on chair direction
  const baseOffset = (spriteNum - 1) * 3;
  let sitFrame;
  switch (chairDirection) {
    case "down":
      sitFrame = baseOffset + 0;
      break;
    case "left":
      sitFrame = baseOffset + 15;
      break;
    case "right":
      sitFrame = baseOffset + 30;
      break;
    case "up":
      sitFrame = baseOffset + 45;
      break;
    default:
      sitFrame = baseOffset + 0;
      break;
  }
  player.setTexture("dude_sit");
  player.setFrame(sitFrame);
  player.setOrigin(0.5, 1);
  player.setPosition(finalX, finalY);
  player.y -= 16;
  sitting = true;

  // Display a nearby text object's message (if any)
  textObjects.forEach((obj) => {
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const dist = Phaser.Math.Distance.Between(finalX, finalY, centerX, centerY);
    if (dist < 50) {
      let textMsg = "Chair";
      if (obj.properties) {
        obj.properties.forEach((prop) => {
          if (prop.name === "message") {
            textMsg = prop.value;
          }
        });
      }
      const chairLabel = this.add
        .text(finalX, finalY - 40, textMsg, { fontSize: "16px", fill: "#fff" })
        .setOrigin(0.5);
      this.time.addEvent({ delay: 3000, callback: () => chairLabel.destroy() });
    }
  });
}

function update(time) {
  // Update remote players smoothly
  Object.keys(otherPlayers).forEach((id) => {
    let remote = otherPlayers[id];
    if (
      typeof remote.targetX === "number" &&
      typeof remote.targetY === "number"
    ) {
      remote.x = Phaser.Math.Linear(remote.x, remote.targetX, 0.2);
      remote.y = Phaser.Math.Linear(remote.y, remote.targetY, 0.2);
      if (remote.nameLabel)
        remote.nameLabel.setPosition(remote.x, remote.y - 60);
      if (typeof remote.prevX !== "number") remote.prevX = remote.x;
      if (typeof remote.prevY !== "number") remote.prevY = remote.y;
      let deltaX = remote.x - remote.prevX;
      let deltaY = remote.y - remote.prevY;
      let distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance > 1) {
        if (Math.abs(deltaX) > Math.abs(deltaY))
          remote.anims.play(deltaX > 0 ? "right" : "left", true);
        else remote.anims.play(deltaY > 0 ? "down" : "up", true);
      } else {
        remote.anims.stop();
      }
      remote.prevX = remote.x;
      remote.prevY = remote.y;
    }
  });

  // Conference Hall Detection
  if (conferenceHallRegion) {
    if (
      Phaser.Geom.Rectangle.Contains(conferenceHallRegion, player.x, player.y)
    ) {
      if (!inConferenceHall) {
        inConferenceHall = true;
        console.log("Entered Conference Hall");
        conference.enter(); // Defined in conference.js
        socket.emit("enterConference", { roomId, id: socket.id, userId });
      }
    } else {
      if (inConferenceHall) {
        inConferenceHall = false;
        document;

        console.log("Exited Conference Hall");
        conference.exit(); // Defined in conference.js
        socket.emit("exitConference", { roomId, id: socket.id, userId });
      }
    }
  }

  // NEW: Lobby Region Detection
  if (lobbyRegion) {
    if (Phaser.Geom.Rectangle.Contains(lobbyRegion, player.x, player.y)) {
      if (!inLobby) {
        inLobby = true;
        console.log("Entered Lobby");
        // (Optional) Trigger lobby-specific behavior/UI here
        socket.emit("enterLobby", { roomId, id: socket.id, userId });
      }
    } else {
      if (inLobby) {
        inLobby = false;
        console.log("Exited Lobby");
        // (Optional) Hide lobby UI or trigger an exit event
        socket.emit("exitLobby", { roomId, id: socket.id, userId });
      }
    }
  }

  // Chair-sitting handling
  let closestChairTile = null;
  let minDistance = Infinity;
  if (chairLayer) {
    chairLayer.layer.data.forEach((row) => {
      row.forEach((tile) => {
        if (tile.index !== -1) {
          const tileCenterX = tile.pixelX + tile.width / 2;
          const tileCenterY = tile.pixelY + tile.height / 2;
          const distance = Phaser.Math.Distance.Between(
            player.x,
            player.y,
            tileCenterX,
            tileCenterY
          );
          if (distance < 50 && distance < minDistance) {
            minDistance = distance;
            closestChairTile = tile;
          }
        }
      });
    });
  }
  let nearChair = closestChairTile !== null;
  if (nearChair) {
    if (!sitting) {
      if (!sitText) {
        sitText = this.add
          .text(player.x, player.y - 40, "Press X to Sit", {
            fontSize: "20px",
            fill: "#fff",
            fontFamily: "Arial",
          })
          .setOrigin(0.5);
      }
      sitText.setText("Press X to Sit");
      sitText.setPosition(player.x, player.y - 40);
    } else {
      if (!sitText) {
        sitText = this.add
          .text(player.x, player.y - 40, "Press X to Leave", {
            fontSize: "20px",
            fill: "#fff",
            fontFamily: "Arial",
          })
          .setOrigin(0.5);
      }
      sitText.setText("Press X to Leave");
      sitText.setPosition(player.x, player.y - 40);
    }
  } else {
    if (sitText) {
      sitText.destroy();
      sitText = null;
    }
  }
  if (Phaser.Input.Keyboard.JustDown(sitKey)) {
    if (nearChair && !sitting) {
      sitOnChair.call(this, closestChairTile);
    } else if (sitting) {
      player.setTexture("dude");
      player.setOrigin(0.5, 0.5);
      player.anims.play(player.lastDirection, true);
      sitting = false;
    }
  }

  // Local Player Movement using WASD/Joystick
  if (!sitting) {
    if (count === 0) {
      player.anims.play("down", true);
      player.lastDirection = "down";
      count++;
    }
    player.setVelocity(0);
    if (joystick.force > 0) {
      const angle = joystick.angle;
      const radians = Phaser.Math.DegToRad(angle);
      player.setVelocityX(Math.cos(radians) * speed);
      player.setVelocityY(Math.sin(radians) * speed);
      if (angle >= -45 && angle <= 45) {
        player.anims.play("right", true);
        player.lastDirection = "right";
      } else if (angle > 45 && angle < 135) {
        player.anims.play("down", true);
        player.lastDirection = "down";
      } else if (angle >= 135 || angle <= -135) {
        player.anims.play("left", true);
        player.lastDirection = "left";
      } else if (angle > -135 && angle < -45) {
        player.anims.play("up", true);
        player.lastDirection = "up";
      }
    } else if (cursors.left.isDown) {
      player.setVelocityX(-speed);
      player.anims.play("left", true);
      player.lastDirection = "left";
    } else if (cursors.right.isDown) {
      player.setVelocityX(speed);
      player.anims.play("right", true);
      player.lastDirection = "right";
    } else if (cursors.up.isDown) {
      player.setVelocityY(-speed);
      player.anims.play("up", true);
      player.lastDirection = "up";
    } else if (cursors.down.isDown) {
      player.setVelocityY(speed);
      player.anims.play("down", true);
      player.lastDirection = "down";
    } else {
      player.anims.stop();
    }
  }

  // WebRTC Call Handling Based on Proximity
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
          // startCallWithPlayer(id);
          activeCalls[id] = true;
          delete callCooldown[id];
        }, CALL_DELAY);
      }
    } else if (activeCalls[id]) {
      console.log(`Moving away from player: ${id}`);
      if (distance > PROXIMITY_THRESHOLD + 20) {
        // endCallWithPlayer(id);
        delete activeCalls[id];
      } else {
        setTimeout(() => {
          if (
            Phaser.Math.Distance.Between(player.x, player.y, other.x, other.y) >
            PROXIMITY_THRESHOLD
          ) {
            // endCallWithPlayer(id);
            delete activeCalls[id];
          }
        }, DISCONNECT_DELAY);
      }
    }
  });

  // Emit Local Player Position Updates
  if (player.x !== lastPlayerPosition.x || player.y !== lastPlayerPosition.y) {
    if (time - lastUpdateTime > UPDATE_INTERVAL) {
      socket.emit("updatePosition", {
        id: socket.id,
        x: player.x,
        y: player.y,
        spriteNum: spriteNum, // defined in your project
        playerName: userId, // defined in your project
      });
      lastPlayerPosition = { x: player.x, y: player.y };
      lastUpdateTime = time;
    }
  }
}

function closeGame() {
  socket.emit("main-disconnect");
  socket.emit("exitConference", { roomId, id: socket.id, userId });
  socket.disconnect();
  game.destroy(true);
}
