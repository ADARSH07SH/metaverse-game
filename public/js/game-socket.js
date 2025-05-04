const gameContainer = document.getElementById("gamedata");
roomId = gameContainer.getAttribute("data-room-id");
userId = gameContainer.getAttribute("data-user-id");
const chatButton = document.querySelector(".player-chat-submit");
const playerChatInput = document.getElementById("player-chat");
const chatMessages = document.getElementById("chat-messages");
let botActive = 0;
let playerChat = "";
let botText;

function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

socket.on("player-chat", (data) => {
  if (data.roomId == roomId) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("chat-message");
    messageDiv.innerHTML = `<strong>${data.userId}</strong>: ${data.message}`;
    chatMessages.appendChild(messageDiv);
    scrollChatToBottom();
  }
});

chatButton.addEventListener("click", () => {
  playerChat = playerChatInput.value;
  console.log(" Player Chat Input:", playerChat);

  console.log("player chat input");
  if (playerChat.trim() !== "") {
    if (botActive != 1) {
      console.log(" Sending chat to other players");
      socket.emit("player-chat", {
        roomId,
        socketId: socket.id,
        message: playerChat,
        userId: userId,
      });
    }

    if (botActive == 1) {
      console.log(" Sending chat to bot");
      fetch("http://localhost:8080/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: playerChat }),
      })
        .then((res) => res.json())
        .then((data) => {
          const botReply = data.reply;
          console.log("Bot replied:", botReply);
          const botDiv = document.createElement("div");
          botDiv.classList.add("chat-message");
          botDiv.innerHTML = `<strong>Bot</strong>: ${botReply}`;
          chatMessages.appendChild(botDiv);
          scrollChatToBottom();
          textToSpeech(botReply);
        })
        .catch((err) => {
          console.error(" Bot Error:", err);
        });
    }

    playerChatInput.value = "";
    playerChatInput.focus();
  }
});

document.querySelector(".chat i").addEventListener("click", scrollChatToBottom);

playerChatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    chatButton.click();
  }
});

let aiBtn = document.getElementById("AI");

aiBtn.addEventListener("click", async () => {
  botActive = botActive === 0 ? 1 : 0;
  aiBtn.classList.toggle("active");
  console.log(" Bot mode:", botActive);
});
