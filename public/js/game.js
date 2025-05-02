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

// New global variables for Lobby (from Tiled) and its state:
let lobbyRegion = null;
let inLobby = false;
let incafe = false;
let incode = false;
let inmycom = false;
let mycomRegions = [];
let fridgeRegions = [];
let inFridge = false;
let fridgeSound;

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
  this.load.audio("fridgeBuzz", "/assets/audio/can.mp3");
  const progressBar = this.add.graphics();
  const progressText = this.add
    .text(
      this.sys.game.config.width / 2,
      this.sys.game.config.height / 2,
      "0%",
      {
        fontSize: "24px",
        fill: "#ffffff",
      }
    )
    .setOrigin(0.5);

  this.load.on("progress", (value) => {
    progressBar.clear();
    progressBar.fillStyle(0x00ff00, 0.7);

    // 💡 Reduced width (70% of game width)
    const barWidth = this.sys.game.config.width * 0.5;
    const barX = (this.sys.game.config.width - barWidth) / 2;

    progressBar.fillRect(
      barX,
      this.sys.game.config.height / 2 - 15,
      barWidth * value,
      30
    );

    progressText.setText(`${Math.round(value * 100)}%`);
  });

  // Load assets
  this.load.image("finalTiles", "/assets/main_assets/final.png");
  // Load the map as JSON (exported from Tiled with embedded tilesets and object layers)
  this.load.tilemapTiledJSON("map", "/assets/final_csv/final.json");
  this.load.spritesheet("dude", "/assets/sprite_character/Character1.png", {
    frameWidth: 16,
    frameHeight: 16,
  });
  this.load.spritesheet("bot", "/assets/sprite_character/bot.png", {
    frameWidth: 24,
    frameHeight: 33,
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
  const chatInput = document.getElementById("player-chat");

  const codeEditor = document.getElementById("virtualEditorScreen");

  codeEditor.addEventListener("keydown", function (event) {
    event.stopPropagation();
  });

  chatInput.addEventListener("keydown", function (event) {
    event.stopPropagation();
  });

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
  chairLayer.setCollisionByProperty({ collides: true });

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
            // console.log("Conference Hall Region:", conferenceHallRegion);
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
    // console.log("Lobby Region:", lobbyRegion);
  }

  const cafeLayer = map.getObjectLayer("cafeteria");
  if (cafeLayer && cafeLayer.objects.length > 0) {
    // Assuming one lobby region is defined
    const cafeObj = cafeLayer.objects[0];
    cafeRegion = new Phaser.Geom.Rectangle(
      cafeObj.x,
      cafeObj.y,
      cafeObj.width,
      cafeObj.height
    );
    // console.log("cafe Region:", cafeRegion);
  }
  const codeLayer = map.getObjectLayer("futuristic");
  if (codeLayer && codeLayer.objects.length > 0) {
    // Assuming one lobby region is defined
    const codeObj = codeLayer.objects[0];
    codeRegion = new Phaser.Geom.Rectangle(
      codeObj.x,
      codeObj.y,
      codeObj.width,
      codeObj.height
    );
    // console.log("code Region:", codeRegion);
  }
  const myComLayer = map.getObjectLayer("myCom");

  if (myComLayer && myComLayer.objects.length > 0) {
    myComLayer.objects.forEach((obj) => {
      const region = new Phaser.Geom.Rectangle(
        obj.x,
        obj.y,
        obj.width,
        obj.height
      );
      mycomRegions.push(region);
    });
  }

  const fridgeLayer = map.getObjectLayer("fridge");
  if (fridgeLayer && fridgeLayer.objects.length > 0) {
    fridgeLayer.objects.forEach(obj => {
      const rect = new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height);
      fridgeRegions.push(rect);
    });
  }

  // Create the sound instance
  fridgeSound = this.sound.add('fridgeBuzz');


  // Create the local player sprite
  player = this.physics.add
    .sprite(3000, 1650, "dude")
    .setScale(3)
    .setCollideWorldBounds(true);
  bot = this.physics.add
    .sprite(2600, 1480, "bot")
    .setScale(2.7)
    .setCollideWorldBounds(true);

  player.lastDirection = "down";

  this.anims.create({
    key: "bot_walk",
    frames: this.anims.generateFrameNumbers("bot", { start: 0, end: 7 }),
    frameRate: 10,
    repeat: -1,
  });
  bot.anims.play("bot_walk", true);

  this.physics.add.collider(bot, wallLayer);
  this.physics.add.collider(bot, player);

  bot.setImmovable(true);

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
    x: this.cameras.main.width - 100,
    y: this.cameras.main.height - 100,
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

  botKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);

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
    if (data.roomId == roomId) {
      if (!otherPlayers[data.id]) {
        const otherSprite = this.physics.add
          .sprite(data.x, data.y, "dude")
          .setScale(3)
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
  // Find the nearest chair tile
  let closestTile = null;
  let minDist = Infinity;
  let chairDirection = "down"; // Default direction

  chairLayer.layer.data.forEach((row) => {
    row.forEach((tile) => {
      if (tile.index !== -1) {
        // Get tile center coordinates
        const tileCenterX = tile.pixelX + tile.width / 2;
        const tileCenterY = tile.pixelY + tile.height / 2;

        // Calculate distance to player
        const dist = Phaser.Math.Distance.Between(
          player.x,
          player.y,
          tileCenterX,
          tileCenterY
        );

        if (dist < minDist) {
          minDist = dist;
          closestTile = tile;

          // Get chair direction from tile properties
          if (tile.properties) {
            if (tile.properties.down) chairDirection = "down";
            else if (tile.properties.left) chairDirection = "left";
            else if (tile.properties.right) chairDirection = "right";
            else if (tile.properties.up) chairDirection = "up";
          }
        }
      }
    });
  });

  if (closestTile) {
    const chairCenterX = closestTile.pixelX + closestTile.width / 2;
    const chairCenterY = closestTile.pixelY + closestTile.height / 2;

    // Calculate sitting frame based on spriteNum and direction
    const sitFrame = calculateSitFrame(spriteNum, chairDirection);

    player.setTexture("dude_sit");
    player.setFrame(sitFrame);
    player.setOrigin(0.5, 0.8);
    player.setPosition(chairCenterX, chairCenterY - 8);
    // Optional: Add debug visualization

    sitting = true;
    player.lastDirection = chairDirection;
  }
}

function calculateSitFrame(spriteNum, direction) {
  // Base offsets for each direction
  const directionOffsets = {
    down: 0,
    left: 15,
    right: 30,
    up: 45,
  };

  // Determine which sprite group we're in (groups of 5)
  const group = Math.floor((spriteNum - 1) / 5);
  const spriteInGroup = (spriteNum - 1) % 5;

  // Calculate frame number
  let frame;

  if (group === 0) {
    // First group (sprites 1-5)
    frame = directionOffsets[direction] + spriteInGroup * 3;
  } else {
    // Subsequent groups (sprites 6-10, 11-15, etc.)
    frame = 60 * group + directionOffsets[direction] + spriteInGroup * 3;
  }

  return frame;
}

function update(time) {
  const chatInput = document.getElementById("player-chat");

  // Check if chat input is not focused

  const dist = Phaser.Math.Distance.Between(bot.x, bot.y, player.x, player.y);
  if (this.botComing && dist < 100) {
    // Stop bot
    bot.body.setVelocity(0);
    bot.anims.stop();
    this.botComing = false;

    // Bot “speaks”
    const talk = this.add
      .text(bot.x, bot.y - 40, "Hey! Whatcha need?", {
        font: "16px Arial",
        fill: "#fff",
        backgroundColor: "rgba(0,0,0,0.5)",
      })
      .setOrigin(0.5);

    // Remove text after 3s
    this.time.delayedCall(2000, () => talk.destroy());
  }

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
  if (cafeRegion) {
    if (Phaser.Geom.Rectangle.Contains(cafeRegion, player.x, player.y)) {
      if (!incafe) {
        incafe = true;

        // (Optional) Trigger lobby-specific behavior/UI here
        socket.emit("entercafe", { roomId, id: socket.id, userId });
      }
    } else {
      if (incafe) {
        incafe = false;

        // (Optional) Hide lobby UI or trigger an exit event
        socket.emit("exitcafe", { roomId, id: socket.id, userId });
      }
    }
  }
  if (codeRegion) {
    if (Phaser.Geom.Rectangle.Contains(codeRegion, player.x, player.y)) {
      if (!incode) {
        incode = true;

        // (Optional) Trigger lobby-specific behavior/UI here
        socket.emit("entercode", { roomId, id: socket.id, userId });
      }
    } else {
      if (incode) {
        incode = false;

        // (Optional) Hide lobby UI or trigger an exit event
        socket.emit("exitcode", { roomId, id: socket.id, userId });
      }
    }
  }
  if (mycomRegions.length > 0) {
    let isInRegion = false;
    for (const region of mycomRegions) {
      if (Phaser.Geom.Rectangle.Contains(region, player.x, player.y)) {
        isInRegion = true;
        break;
      }
    }

    if (isInRegion) {
      if (!inmycom) {
        inmycom = true;
        socket.emit("entercode", { roomId, id: socket.id, userId });
      }
    } else {
      if (inmycom) {
        inmycom = false;
        socket.emit("exitcode", { roomId, id: socket.id, userId });
      }
    }
  }

   let currentlyInFridge = fridgeRegions.some(region =>
    Phaser.Geom.Rectangle.Contains(region, player.x, player.y)
  );

  if (currentlyInFridge && !inFridge) {
    inFridge = true;
    console.log("Entered a fridge area");
    fridgeSound.play();        // play the sound
    handleFridgeInteraction(); // call your fridge function
  } else if (!currentlyInFridge && inFridge) {
    inFridge = false;
    console.log("Exited fridge area");
    // optionally stop sound or do exit logic
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

  const codeEditor = document.getElementById("virtualEditorScreen");
  const editorVisible = codeEditor && !codeEditor.classList.contains("hidden");

  // Completely disable Phaser input when editor is visible
  if (editorVisible) {
    // Freeze player and clear inputs

    // Disable Phaser keyboard system
    this.input.keyboard.enabled = false;

    // Clear any active key states
    this.input.keyboard.resetKeys();

    // Prevent canvas from capturing focus
    this.game.canvas.tabIndex = -1;
    this.game.canvas.style.pointerEvents = "none";

    return;
  } else {
    // Re-enable Phaser input when editor is hidden
    this.input.keyboard.enabled = true;
    this.game.canvas.style.pointerEvents = "auto";
  }

  if (document.activeElement !== chatInput) {
    if (Phaser.Input.Keyboard.JustDown(botKey)) {
      callBotToYou.call(this);
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
        playerName: userId,
        roomId: roomId, // defined in your project
      });
      lastPlayerPosition = { x: player.x, y: player.y };
      lastUpdateTime = time;
    }
  }
}
function callBotToYou() {
  // Flag so update knows it’s coming
  this.botComing = true;

  // Start walk anim
  bot.anims.play("bot_walk", true);

  // Move bot toward player at 200px/sec
  this.physics.moveToObject(bot, player, 400);
}

function closeGame() {
  socket.emit("main-disconnect");
  socket.emit("exitConference", { roomId, id: socket.id, userId });
  socket.disconnect();
  game.destroy(true);
}

function handleFridgeInteraction() {
  // e.g. show a UI prompt, open fridge inventory, etc.
  console.log("Fridge function called!");
  // … your custom logic here …
}
