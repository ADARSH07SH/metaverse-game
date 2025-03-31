const gameContainer = document.getElementById("gamedata");
roomId = gameContainer.getAttribute("data-room-id");
userId = gameContainer.getAttribute("data-user-id");
const chatButton = document.querySelector(".player-chat-submit");
const playerChatInput = document.getElementById("player-chat");
const chatMessages = document.getElementById("chat-messages");

// Function to scroll to bottom of chat
function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

socket.on("player-chat", (data) => {
  // Display the received message
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("chat-message");
  messageDiv.innerHTML = `<strong>${data.userId}</strong>: ${data.message}`;
  chatMessages.appendChild(messageDiv);

  // Scroll to the new message
  scrollChatToBottom();
});

chatButton.addEventListener("click", () => {
  const playerChat = playerChatInput.value;

  if (playerChat.trim() !== "") {
    // Emit the chat message to the server
    socket.emit("player-chat", {
      roomId,
      socketId: socket.id,
      message: playerChat,
      userId: userId,
    });

    // Clear the input field
    playerChatInput.value = "";

    // Focus remains on input for next message
    playerChatInput.focus();
  }
});

// Also scroll to bottom when chat is opened
document.querySelector(".chat i").addEventListener("click", scrollChatToBottom);

// Allow sending with Enter key
playerChatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    chatButton.click();
  }
});
