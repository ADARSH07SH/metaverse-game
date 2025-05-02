

function createRoom() {
  const roomInput = document.querySelector(".create-room input");
  const roomId = roomInput.value.trim();
  const userName = document.querySelector("input[name='userName']").value;

  if (!roomId) {
    alert("Please enter a Room ID!");
    return;
  }

  try {
    socket.emit("createRoom", roomId); 
    console.log(`Room ${roomId} created by ${userName} from here`);
  } catch (err) {
    console.error("Error creating room:", err);
  }
}

socket.on("message", (data) => {
  console.log("Message from server:", data);
});

function joinRoom() {
  const roomInput = document.querySelector(".join-room input");
  const roomId = roomInput.value.trim();

  if (!roomId) {
    alert("Please enter a Room ID!");
    return;
  }
  
  try {
    socket.emit("joinroom", roomId);
    console.log(`Joined ${roomId} `);
  } catch (err) {
    console.log(err);
  }
}
