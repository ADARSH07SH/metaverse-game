const gameContainer = document.getElementById("gamedata");
roomId = gameContainer.getAttribute("data-room-id");
userId = gameContainer.getAttribute("data-user-id");
console.log();
const chatButton = document.querySelector(".player-chat-submit");
const playerChatInput = document.getElementById("player-chat");

socket.on("player-chat", (data) => {
  // Display the received message
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("chat-message");
  messageDiv.innerHTML = `<strong>${data.userId}</strong>: ${data.message}`;
  document.getElementById("chat-messages").appendChild(messageDiv);
});

chatButton.addEventListener("click", () => {
  const playerChat = playerChatInput.value;

  if (playerChat.trim() !== "") {
    // Emit the chat message to the server with roomId, socketId, and message
    socket.emit("player-chat", {
      roomId,
      socketId: socket.id,
      message: playerChat,
      userId: userId,
    });

    // Clear the input field after sending the message
    playerChatInput.value = "";
  }
});
