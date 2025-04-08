
document.addEventListener("DOMContentLoaded", () => {
  const mobileMain = document.querySelector(".mobileMain");
  let audio = new Audio(); // basic audio obj
  let isPlaying = false;

  if (mobileMain) {
    const phoneFrame = document.createElement("div");
    phoneFrame.className = "phone-frame";
    phoneFrame.innerHTML = `
      <div class="phone-screen">
        <div class="status-bar">
          <span id="current-time">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div class="app-container">
          <div class="app-icon" id="spotify-app">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png" alt="Spotify">
          </div>
        </div>
      </div>
    `;
    mobileMain.appendChild(phoneFrame);

    const spotifyOverlay = document.createElement("div");
    spotifyOverlay.className = "spotify-overlay";
    spotifyOverlay.style.display = "none";
    spotifyOverlay.innerHTML = `
      <div class="spotify-player">
        <div class="song-info">
          <div class="album-art"></div>
          <div class="song-details">
            <div class="song-title">Song Title</div>
            <div class="artist">Artist</div>
          </div>
        </div>
        <div class="progress-container">
          <div class="progress-bar" id="progressBar"></div>
        </div>
        <div class="player-controls">
          <button class="control-button prev">⏮</button>
          <button class="control-button play-button">▶</button>
          <button class="control-button next">⏭</button>
        </div>
        <div class="song-list">
          <button class="song-btn" data-song="1.mp3">Song 1</button>
          <button class="song-btn" data-song="2.mp3">Song 2</button>
          <button class="song-btn" data-song="3.mp3">Song 3</button>
        </div>
      </div>
    `;
    mobileMain.appendChild(spotifyOverlay);

    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      phoneFrame.querySelector("#current-time").textContent = timeString;
    };
    updateTime();
    setInterval(updateTime, 60000);

    const spotifyApp = phoneFrame.querySelector("#spotify-app");
    spotifyApp.addEventListener("click", () => {
      const isHidden = spotifyOverlay.style.display === "none";
      spotifyOverlay.style.display = isHidden ? "block" : "none";
      if (isHidden) playAudio("1.mp3");
      else stopAudio();
    });

    const playBtn = spotifyOverlay.querySelector(".play-button");
    playBtn.addEventListener("click", () => {
      if (isPlaying) {
        audio.pause();
        playBtn.innerHTML = "▶";
      } else {
        audio.play();
        playBtn.innerHTML = "❚❚";
      }
      isPlaying = !isPlaying;
    });

    document.querySelectorAll(".song-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const songFile = btn.getAttribute("data-song");
        playAudio(songFile);
      });
    });

    function playAudio(file) {
      audio.src = "/assets/audio/1.mp3";

      audio.play();
      playBtn.innerHTML = "❚❚";
      isPlaying = true;
    }

    function stopAudio() {
      audio.pause();
      audio.currentTime = 0;
      playBtn.innerHTML = "▶";
      isPlaying = false;
    }
  }
});

// socket events
const mobileMain = document.querySelector(".mobileMain");
mobileMain.style.display = "none";

socket.on("entercafe1", () => {
  console.log("enter");
  mobileMain.classList.add("active");
});

socket.on("exitcafe1", () => {
  console.log("exit");
  mobileMain.classList.remove("active");
});
