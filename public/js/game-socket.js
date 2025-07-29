const gameContainer = document.getElementById("gamedata");
const roomId = gameContainer.getAttribute("data-room-id");
const userId = gameContainer.getAttribute("data-user-id");
const chatButton = document.querySelector(".player-chat-submit");
const playerChatInput = document.getElementById("player-chat");
const chatMessages = document.getElementById("chat-messages");
let botActive = 0;

function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

socket.on("player-chat", (data) => {
  if (data.roomId === roomId) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("chat-message");
    messageDiv.innerHTML = `<strong>${data.userId}</strong>: ${data.message}`;
    chatMessages.appendChild(messageDiv);
    scrollChatToBottom();
  }
});

chatButton.addEventListener("click", () => {
  const playerChat = playerChatInput.value;
  if (playerChat.trim() === "") return;

  if (botActive !== 1) {
    socket.emit("player-chat", {
      roomId,
      socketId: socket.id,
      message: playerChat,
      userId: userId,
    });
  } else {
    const tempBotMessage = document.createElement("div");
    tempBotMessage.classList.add("chat-message");
    tempBotMessage.innerHTML = `<strong>Bot</strong>: is typing...`;
    chatMessages.appendChild(tempBotMessage);
    scrollChatToBottom();

    fetch("https://metaverse-game.onrender.com/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: playerChat }),
    })
      .then((res) => res.json())
      .then((data) => {
        tempBotMessage.innerHTML = `<strong>Bot</strong>: ${data.reply}`;
        scrollChatToBottom();
        textToSpeech(data.reply);
      })
      .catch((err) => {
        tempBotMessage.innerHTML = `<strong>Bot</strong>: Error, please try again.`;
        console.error("Bot Error:", err);
      });
  }

  playerChatInput.value = "";
  playerChatInput.focus();
});

document.querySelector(".chat i").addEventListener("click", scrollChatToBottom);

playerChatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    chatButton.click();
  }
});

const aiBtn = document.getElementById("AI");
aiBtn.addEventListener("click", () => {
  botActive = botActive === 0 ? 1 : 0;
  aiBtn.classList.toggle("active");
});
