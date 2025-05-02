
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
const axios = require("axios");

const cors = require("cors");


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));
inject();
app.use("/assets", express.static(path.join(__dirname, "public/assets")));


const players = {};




io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  
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
    socket.roomId = roomId;
    console.log(`Room ${roomId} created successfully!`);
    socket.emit("message", `Room ${roomId} created successfully!`);
  });

  socket.on("joinRoom", async (roomId, userId) => {
    socket.join(roomId);
    socket.myRoomId = roomId;
    console.log(`Socket ${socket.id} joined room ${roomId} as ${userId}`);

    try {
      const roomCollection = await getRoomDetailsCollection();
      const roomDoc = await roomCollection.findOne({ roomId });

      if (roomDoc) {
        const existingPlayer = roomDoc.players.find(
          (p) => p.userName === userId
        );

        if (existingPlayer) {
          
          await roomCollection.updateOne(
            { roomId, "players.userName": userId },
            { $set: { "players.$.socketId": socket.id, "players.$.active": 1 } }
          );
          console.log(`Updated ${userId} in room ${roomId} with new socketId`);
        } else {
          
          await roomCollection.updateOne(
            { roomId },
            {
              $push: {
                players: { userName: userId, socketId: socket.id, active: 1 },
              },
            }
          );
          console.log(
            `Added ${userId} to room ${roomId} with socketId ${socket.id}`
          );
        }
      }
    } catch (err) {
      console.error("Error in joinRoom:", err);
    }

    socket.emit("message", `Joined room ${roomId}`);
  });

  socket.on("updatePosition", (data) => {
    
    players[socket.id] = {
      x: data.x,
      y: data.y,
      spriteNum: data.spriteNum,
      playerName: data.playerName,
      roomId:data.roomId
    };
    socket.broadcast.emit("updatePosition", {
      id: socket.id,
      x: data.x,
      y: data.y,
      spriteNum: data.spriteNum,
      playerName: data.playerName,
      roomId:data.roomId,
    });
  });

  
  socket.on("player-chat", async (data) => {
    console.log(`Chat from ${data.userId}: ${data.message}`);
    io.to(data.roomId).emit("player-chat", data);
    socket.emit("player-chat", data);
    socket.broadcast.emit("player-chat", data);
    await saveChatMessage(data.roomId, socket.id, data.message, data.userId);
  });

  
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

        if (existing) {
          
          await roomCollection.updateOne(
            { roomId: data.roomId, "players.userName": data.userId },
            { $set: { "players.$.socketId": socket.id, "players.$.active": 1 } }
          );
          console.log(
            `Updated ${data.userId} in room ${data.roomId} (via lobby).`
          );
        } else {
          
          await roomCollection.updateOne(
            { roomId: data.roomId },
            {
              $push: {
                players: {
                  userName: data.userId,
                  socketId: socket.id,
                  active: 1,
                },
              },
            }
          );
          console.log(
            `Added ${data.userId} to room ${data.roomId} (via lobby).`
          );
        }
      }
    } catch (err) {
      console.error("Error processing enterLobby event:", err);
    }
  });

  socket.on("videoStateChange", async (data) => {
    console.log(data);
    socket.broadcast.emit("videoChange", data);
  });

  socket.on("exitLobby", async (data) => {
    console.log(
      `Player ${data.userId} exited the lobby for room ${data.roomId}`
    );
  });

  socket.on("entercafe", (data) => {
    const targetSocketId = data.id;
    io.to(targetSocketId).emit("entercafe1", {
      userId: data.userId,
      roomId: data.roomId,
    });
  });

  socket.on("exitcafe", (data) => {
    const targetSocketId = data.id;
    io.to(targetSocketId).emit("exitcafe1", {
      userId: data.userId,
      roomId: data.roomId,
    });
  });

  socket.on("entercode", (data) => {
    const targetSocketId = data.id;
    console.log(targetSocketId);
    io.to(targetSocketId).emit("entercode1", {
      userId: data.userId,
      roomId: data.roomId,
    });
  });

  socket.on("exitcode", (data) => {
    
    const targetSocketId = data.id;
   
    io.to(targetSocketId).emit("exitcode1", {
      userId: data.userId,
    });
  });

  socket.on("editor-change", ({ roomId, code }) => {
    console.log(code);
    console.log(roomId);
    
    let res = socket.broadcast.emit("editor-update", { roomId, code });
    
 });

 socket.on("join-editor-room", (roomId) => {
   socket.join(roomId);
   console.log(`${socket.id} joined editor room: ${roomId}`);
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


  socket.on("initiate-private-call", ({ to, from, callerName }) => {
    console.log(`${callerName} is calling ${to}`);
    io.to(to).emit("incoming-private-call", {
      from,
      callerName,
    });
  });

  socket.on("accept-private-call", ({ from, to }) => {
    io.to(from).emit("call-accepted", { from: to });
  });

  socket.on("reject-private-call", ({ from, reason }) => {
    io.to(from).emit("call-rejected", { from: socket.id, reason });
  });
  
  
  socket.on("enterConference", async (data) => {
    console.log(
      `Player ${data.userId} with socket id ${data.id} entered the conference hall`
    );
    socket.join("conferenceHall");
    try {
      const roomCollection = await getRoomDetailsCollection();
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
    
    res.redirect(`/joinroom?userName=${userName}`);
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

    const players = room.players.map((player) => ({
      socketId: player.socketId,
      userName: player.userName,
      active: player.active,
    }));

    res.json(players);
  } catch (err) {
    console.error("Error fetching players:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


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

app.post("/ask", async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 10,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.2,
        },
      },
      {
        headers: {
          Authorization: `Bearer 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`,
        },
      }
    );
    const botReply =
      response.data[0]?.generated_text || "Bot had nothing to say 😅";
    res.json({ reply: botReply });
  } catch (err) {
    console.error("BOT ERR:", err.message);
    res.status(500).json({ reply: "Bot is sleeping rn 🥱" });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}/`);
});