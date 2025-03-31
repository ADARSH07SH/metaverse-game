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
  getConferenceParticipants,
} = require("./public/js/mongodb");

const app = express();
const PORT = 8080;
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
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

  // Room management
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

  socket.on("joinRoom", async (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    socket.emit("message", `Joined room ${roomId}`);
  });

  socket.on("updatePosition", (data) => {
    players[socket.id] = {
      x: data.x,
      y: data.y,
      spriteNum: data.spriteNum,
      playerName: data.playerName,
    };
    socket.broadcast.emit("updatePosition", {
      id: socket.id,
      x: data.x,
      y: data.y,
      spriteNum: data.spriteNum,
      playerName: data.playerName,
    });
  });

  // Chat event
  socket.on("player-chat", async (data) => {
    console.log(`Chat from ${data.userId}: ${data.message}`);
    io.to(data.roomId).emit("player-chat", data);
    socket.emit("player-chat", data);
    socket.broadcast.emit("player-chat", data);
    await saveChatMessage(data.roomId, socket.id, data.message, data.userId);
  });

  // Lobby events
  socket.on("enterLobby", async (data) => {
    console.log(
      `Player ${data.userId} entered the lobby for room ${data.roomId}`
    );
    try {
      const roomCollection = await getRoomDetailsCollection();
      const roomDoc = await roomCollection.findOne({ roomId: data.roomId });
      if (roomDoc) {
        const existing = roomDoc.players.find(
          (p) => p.userName === data.userId
        );
        if (!existing) {
          await roomCollection.updateOne(
            { roomId: data.roomId },
            { $push: { players: { userName: data.userId, active: 1 } } }
          );
          console.log(
            `Added ${data.userId} to room ${data.roomId} (via lobby).`
          );
        } else {
          await roomCollection.updateOne(
            { roomId: data.roomId, "players.userName": data.userId },
            { $set: { "players.$.active": 1 } }
          );
          console.log(
            `Set ${data.userId} as active in room ${data.roomId} (via lobby).`
          );
        }
      }
    } catch (err) {
      console.error("Error processing enterLobby event:", err);
    }
  });

  socket.on("exitLobby", async (data) => {
    console.log(
      `Player ${data.userId} exited the lobby for room ${data.roomId}`
    );
  });

  socket.on("offer", (data) => {
    if (!data.target) return;
    const targetSocket = io.sockets.sockets.get(data.target);
    if (targetSocket) {
      console.log(`Relaying offer from ${socket.id} to ${data.target}`);
      targetSocket.emit("offer", data);
    }
  });

  socket.on("answer", (data) => {
    if (!data.target) return;
    const targetSocket = io.sockets.sockets.get(data.target);
    if (targetSocket) {
      console.log(`Relaying answer from ${socket.id} to ${data.target}`);
      targetSocket.emit("answer", data);
    }
  });

  socket.on("iceCandidate", (data) => {
    if (!data.target) return;
    const targetSocket = io.sockets.sockets.get(data.target);
    if (targetSocket) {
      console.log(`Relaying ICE candidate from ${socket.id} to ${data.target}`);
      targetSocket.emit("iceCandidate", data);
    }
  });

  // Conference events: When a user enters, add them to "conferenceHall"
  // and update the participant list without creating duplicate entries.
  socket.on("enterConference", async (data) => {
    console.log(
      `Player ${data.userId} with socket id ${data.id} entered the conference hall`
    );
    socket.join("conferenceHall");
    try {
      const roomCollection = await getRoomDetailsCollection();
      // $addToSet ensures that if an entry with the same fields exists, it won't add a duplicate.
      await roomCollection.updateOne(
        { roomId: data.roomId },
        {
          $addToSet: {
            conferenceHall: { userName: data.userId, socketId: data.id },
          },
        }
      );
      console.log(`Conference entry ensured for ${data.userId}`);
    } catch (err) {
      console.error("Error updating conferenceHall for", data.userId, ":", err);
    }
    socket.to("conferenceHall").emit("newParticipant", data);
  });

  socket.on("exitConference", async (data) => {
    try {
      const roomCollection = await getRoomDetailsCollection();
      const result = await roomCollection.updateOne(
        { roomId: data.roomId },
        { $pull: { conferenceHall: { socketId: socket.id } } }
      );
      console.log(`Removed ${socket.id} from conference hall:`, result);
      socket.to("conferenceHall").emit("participantExited", {
        socketId: socket.id,
        userName: data.userId,
      });
    } catch (err) {
      console.error("Error in exitConference:", err);
    }
  });


  // Disconnect handling
  const handleDisconnect = async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const player = players[socket.id];
    if (player && player.playerName) {
      try {
        const roomCollection = await getRoomDetailsCollection();
        await roomCollection.updateOne(
          { "players.userName": player.playerName },
          { $pull: { players: { userName: player.playerName } } }
        );
        await roomCollection.updateOne(
          { "conferenceHall.socketId": socket.id },
          { $pull: { conferenceHall: { socketId: socket.id } } }
        );
        console.log(`Removed ${player.playerName} on disconnect.`);
      } catch (err) {
        console.error("Error removing player on disconnect:", err);
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
    await roomCollection.updateOne(
      { roomId },
      { $pull: { players: { userName } } }
    );
    await roomCollection.updateOne(
      { roomId },
      { $push: { players: { userName, active: 1 } } }
    );
    console.log(`${userName} rejoined room ${roomId} with a fresh record`);
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

app.get("/api/conference-participants", async (req, res) => {
  const { roomId } = req.query;
  try {
    const participants = await getConferenceParticipants(roomId);
    res.json(participants);
  } catch (err) {
    console.error("Error fetching conference participants:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}/`);
});
