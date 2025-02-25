const express = require("express");
const ejsMate = require("ejs-mate");
const path = require("path");
const { inject } = require("@vercel/analytics");
const { createServer } = require("http");
const { Server } = require("socket.io");
const {
  getUserDetailsCollection,
  getRoomDetailsCollection,
  playerChat,
} = require("./public/js/mongodb");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 8080;
const httpServer = createServer(app);
const socket = new Server(httpServer, {
  cors: {
    origin: "*", // Replace with your deployed Vercel domain
    methods: ["GET", "POST"],
  },
});
socket.setMaxListeners(20);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));
inject();

const players = {};

socket.on("connection", (socket) => {
  socket.on("createRoom", async (roomId) => {
    socket.join(roomId);
    console.log(`Room ${roomId} created by user ${socket.id}`);
    socket.emit("message", `Room ${roomId} has been created!`);
  });
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    socket.emit("message", `Room ${roomId} has been joined!`);
  });

  console.log(`Player connected: ${socket.id}`);
  players[socket.id] = { x: 2500, y: 1400 };

  socket.on("updatePosition", (data) => {
    const currentPosition = players[socket.id] || {};

    // Check if x, y, or id has changed
    if (
      currentPosition.x !== data.x ||
      currentPosition.y !== data.y ||
      data.id !== socket.id
    ) {
      
      players[socket.id] = { x: data.x, y: data.y, spriteNum: data.spriteNum };

      
      socket.broadcast.emit("updatePosition", {
        id: socket.id,
        x: data.x,
        y: data.y,
        spriteNum: data.spriteNum,
        playerName: data.playerName,
      });
    }
    
  });


  socket.on("offer", (data) => {
    socket.to(data.to).emit("offer", { from: socket.id, offer: data.offer });
  });

 
  socket.on("answer", (data) => {
    socket.to(data.to).emit("answer", { from: socket.id, answer: data.answer });
  });

  
  socket.on("icecandidate", (data) => {
    socket.to(data.to).emit("icecandidate", {
      from: socket.id,
      candidate: data.candidate,
    });

    
    socket.on("sprite", (data) => {
  console.log(data)
})

    
     socket.on("disconnect", () => {
       console.log("Player disconnected: " + socket.id);
       delete players[socket.id]; // Remove player data from server
       socket.broadcast.emit("playerDisconnected", socket.id); // Notify others
     });


     socket.on("main-disconnect", () => {
       console.log(`Player disconnected: ${socket.id}`);
       delete players[socket.id];
       socket.broadcast.emit("playerDisconnected", socket.id);
     });
    
  });


 

socket.on("player-chat", async (data) => {
    const { roomId, socketId, message,userId } = data;

  
  socket.emit("player-chat", data); // Send to the sender
  socket.broadcast.emit("player-chat", data);
  await saveChatMessage(roomId, socketId, message,userId);
});

});

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => res.render("signin.ejs"));

app.post("/login", async (req, res) => {
  const { userName, password } = req.body;

  if (!userName || !password) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const userDetails = await getUserDetailsCollection();
    const user = await userDetails.findOne({ userName });

    if (!user) {
      return res.status(400).send("User not found.");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      res.redirect(`/joinroom?userName=${userName}`);
    } else {
      res.status(400).send("Invalid credentials.");
    }
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).send("Internal server error.");
  }
});

app.post("/register", async (req, res) => {
  const { userName, email, password } = req.body;

  if (!userName || !email || !password) {
    return res.status(400).send("All fields are required.");
  }

  try {
    const userDetails = await getUserDetailsCollection();
    const existingUser = await userDetails.findOne({ userName });

    if (existingUser) {
      return res.status(400).send("Username already exists.");
    }

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
  console.log(userName);
});

app.post("/create-room", async (req, res) => {
  const { roomId, userName,currentImage } = req.body;
  try {
    const roomDetail = await getRoomDetailsCollection();
    const existingRoom = await roomDetail.findOne({ roomId });

    if (existingRoom) {
      return res.status(400).send("Room ID already exists.");
    }
    const roomIdUser = await roomDetail.insertOne({
      roomId: roomId,
      createdby: userName,
      players: [userName],
    });
    res.redirect(
      `/v1/game_office1?roomId=${roomId}&userId=${userName}&sprite=${currentImage}`
    );
  } catch (err) {
    console.log(err);
  }
});
app.post("/join-room", async (req, res) => {
  const { roomId, userName, sprite: currentImage } = req.body;
  try {
    const roomDetail = await getRoomDetailsCollection();
    const existingRoom = await roomDetail.findOne({ roomId });

    if (!existingRoom) {
      return res.status(400).send("Room ID does not exist.");
    }
    const roomIdUser = await roomDetail.updateOne(
      { roomId: roomId },
      { $push: { players: userName } }
    );
    res.redirect(
      `/v1/game_office1?roomId=${roomId}&userId=${userName}&sprite=${currentImage}`
    );
  } catch (err) {
    console.log(err);
  }
});

app.get("/v1/game_office1", (req, res) => {
  const { roomId, userId ,sprite} = req.query;
  res.render("game", { roomId, userId,sprite });
});


async function saveChatMessage(roomId, socketId, message,userId) {
  const chatCollection = await playerChat();

  try {
    // Check if the room exists
    const room = await chatCollection.findOne({ roomId });

    if (room) {
      // If the room exists, update the chat array by adding a new message
      await chatCollection.updateOne(
        { roomId },
        { $push: { chat: { socketId,userId, message } } }
      );
    } else {
      // If the room does not exist, create a new document for the room
      await chatCollection.insertOne({
        roomId,
        chat: [{ socketId,userId, message }],
      });
    }
  } catch (error) {
    console.error("Error saving chat message:", error);
  }
}

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}/`);
});
