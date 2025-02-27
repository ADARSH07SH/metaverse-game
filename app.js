// app.js
const express = require("express");
const ejsMate = require("ejs-mate");
const path = require("path");
const { inject } = require("@vercel/analytics");
const { createServer } = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const {
  getUserDetailsCollection,
  getRoomDetailsCollection,
  playerChat,
} = require("./public/js/mongodb");

const app = express();
const PORT = 8080;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
io.setMaxListeners(20);

// Middleware & view setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));
inject();

// In-memory object to track player positions and info
const players = {};

// -------------------
// SOCKET.IO EVENTS
// -------------------
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Create Room
  socket.on("createRoom", async (roomId) => {
    const roomCollection = await getRoomDetailsCollection();
    const existingRoom = await roomCollection.findOne({ roomId });
    if (existingRoom) {
      console.log(`Room ${roomId} already exists.`);
      socket.emit("errorMessage", `Room ${roomId} already exists.`);
      return;
    }
    await roomCollection.insertOne({ roomId, players: [] });
    socket.join(roomId);
    console.log(`Room ${roomId} created successfully!`);
    socket.emit("message", `Room ${roomId} created successfully!`);
  });

  // Join Room
  socket.on("joinRoom", async (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    socket.emit("message", `Joined room ${roomId}`);
  });

  // Update player position
  socket.on("updatePosition", (data) => {
    players[socket.id] = {
      x: data.x,
      y: data.y,
      spriteNum: data.spriteNum,
      playerName: data.playerName,
    };
    // Broadcast updated position to all other sockets
    socket.broadcast.emit("updatePosition", {
      id: socket.id,
      x: data.x,
      y: data.y,
      spriteNum: data.spriteNum,
      playerName: data.playerName,
    });
  });

  // --- WebRTC Signaling ---
  socket.on("offer", (data) => {
    console.log(`Offer from ${socket.id} to ${data.to}`);
    socket.to(data.to).emit("offer", { from: socket.id, offer: data.offer });
  });
  socket.on("answer", (data) => {
    console.log(`Answer from ${socket.id} to ${data.to}`);
    socket.to(data.to).emit("answer", { from: socket.id, answer: data.answer });
  });
  socket.on("icecandidate", (data) => {
    console.log(`ICE candidate from ${socket.id} to ${data.to}`);
    socket
      .to(data.to)
      .emit("icecandidate", { from: socket.id, candidate: data.candidate });
  });

  // Chat event
  socket.on("player-chat", async (data) => {
    console.log(`Chat from ${data.userId}: ${data.message}`);
    io.to(data.roomId).emit("player-chat", data);
    await saveChatMessage(data.roomId, socket.id, data.message, data.userId);
  });

  // Helper function to mark a player as inactive on disconnect
  const handleDisconnect = async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const player = players[socket.id];
    if (player && player.playerName) {
      try {
        const roomCollection = await getRoomDetailsCollection();
        await roomCollection.updateOne(
          { "players.userName": player.playerName },
          { $set: { "players.$.active": 0 } }
        );
        console.log(`Marked ${player.playerName} as inactive.`);
      } catch (err) {
        console.error("Error updating player status on disconnect:", err);
      }
    }
    delete players[socket.id];
    socket.broadcast.emit("playerDisconnected", socket.id);
  };

  socket.on("disconnect", handleDisconnect);
  socket.on("main-disconnect", handleDisconnect);
});

// -------------------
// EXPRESS ROUTES
// -------------------
app.get("/", (req, res) => res.redirect("/login"));
app.get("/login", (req, res) => res.render("signin.ejs"));

app.post("/login", async (req, res) => {
  const { userName, password } = req.body;
  if (!userName || !password)
    return res.status(400).send("All fields are required.");
  try {
    const userDetails = await getUserDetailsCollection();
    const user = await userDetails.findOne({ userName });
    if (!user) return res.status(400).send("User not found.");
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) res.redirect(`/joinroom?userName=${userName}`);
    else res.status(400).send("Invalid credentials.");
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).send("Internal server error.");
  }
});

app.post("/register", async (req, res) => {
  const { userName, email, password } = req.body;
  if (!userName || !email || !password)
    return res.status(400).send("All fields are required.");
  try {
    const userDetails = await getUserDetailsCollection();
    const existingUser = await userDetails.findOne({ userName });
    if (existingUser) return res.status(400).send("Username already exists.");
    const hashedPassword = await bcrypt.hash(password, 10);
    await userDetails.insertOne({ userName, email, password: hashedPassword });
    res.redirect("/login");
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).send("Internal server error.");
  }
});

app.get("/joinroom", (req, res) => {
  const { userName } = req.query;
  res.render("home.ejs", { userName });
});

app.post("/create-room", async (req, res) => {
  const { roomId, userName, sprite } = req.body;
  try {
    const roomCollection = await getRoomDetailsCollection();
    const existingRoom = await roomCollection.findOne({ roomId });
    if (existingRoom) return res.status(400).send("Room ID already exists.");
    await roomCollection.insertOne({
      roomId,
      createdby: userName,
      players: [{ userName, active: 1 }],
    });
    res.redirect(
      `/v1/game_office1?roomId=${roomId}&userId=${userName}&sprite=${sprite}`
    );
  } catch (err) {
    console.error("Error creating room:", err);
    res.status(500).send("Internal server error.");
  }
});

app.post("/join-room", async (req, res) => {
  const { roomId, userName, sprite: currentImage } = req.body;
  try {
    const roomCollection = await getRoomDetailsCollection();
    const existingRoom = await roomCollection.findOne({ roomId });
    if (!existingRoom) return res.status(400).send("Room ID does not exist.");
    const playerExists = existingRoom.players.find(
      (p) => p.userName === userName
    );
    if (playerExists) {
      await roomCollection.updateOne(
        { roomId, "players.userName": userName },
        { $set: { "players.$.active": 1 } }
      );
      console.log(`${userName} is now active in room ${roomId}`);
    } else {
      await roomCollection.updateOne(
        { roomId },
        { $push: { players: { userName, active: 1 } } }
      );
    }
    res.redirect(
      `/v1/game_office1?roomId=${roomId}&userId=${userName}&sprite=${currentImage}`
    );
  } catch (err) {
    console.error("Error joining room:", err);
    res.status(500).send("Internal server error.");
  }
});

app.get("/v1/game_office1", (req, res) => {
  const { roomId, userId, sprite } = req.query;
  res.render("game", { roomId, userId, sprite });
});

// Save chat message helper
async function saveChatMessage(roomId, socketId, message, userId) {
  const chatCollection = await playerChat();
  try {
    const room = await chatCollection.findOne({ roomId });
    if (room) {
      await chatCollection.updateOne(
        { roomId },
        { $push: { chat: { socketId, userId, message } } }
      );
    } else {
      await chatCollection.insertOne({
        roomId,
        chat: [{ socketId, userId, message }],
      });
    }
  } catch (err) {
    console.error("Error saving chat message:", err);
  }
}

app.get("/api/get-players", async (req, res) => {
  const { roomId } = req.query;
  try {
    const roomCollection = await getRoomDetailsCollection();
    const room = await roomCollection.findOne({ roomId });
    if (!room) return res.status(404).json({ error: "Room not found" });
    res.json(room.players);
  } catch (err) {
    console.error("Error fetching players:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}/`);
});
