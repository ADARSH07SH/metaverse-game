
document.addEventListener("DOMContentLoaded", () => {
  const mobileMain = document.querySelector(".mobileMain");
  let audio = new Audio(); // basic audio obj
  let isPlaying = false;
 const songs = {
   "1.mp3": {
     title: "Blinding Lights",
     artist: "The Weeknd",
     albumArt:
       "https://upload.wikimedia.org/wikipedia/en/0/09/The_Weeknd_-_Blinding_Lights.png",
   },
   "2.mp3": {
     title: "Alag Aasman",
     artist: "Anuv Jain",
     albumArt:
       "https://upload.wikimedia.org/wikipedia/en/4/42/Anuv_Jain_-_Alag_Aasman.png",
   },
   "3.mp3": {
     title: "Stay",
     artist: "The Kid LAROI & Justin Bieber",
     albumArt:
       "https://upload.wikimedia.org/wikipedia/en/b/bd/The_Kid_Laroi_and_Justin_Bieber_-_Stay.png",
   },
 };

 function playAudio(file) {
   const { title, artist, albumArt } = songs[file];
   audio.src = `/assets/audio/${file}`;
   audio.play();
   isPlaying = true;
   playBtn.innerHTML = "❚❚";

   // update UI
   spotifyOverlay.querySelector(".song-title").textContent = title;
   spotifyOverlay.querySelector(".artist").textContent = artist;
   spotifyOverlay.querySelector(
     ".album-art"
   ).style.backgroundImage = `url('${albumArt}')`;
 }


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
          
        </div>
      </div>
    `;
    mobileMain.appendChild(spotifyOverlay);
       const songList = spotifyOverlay.querySelector(".song-list");
       Object.entries(songs).forEach(([filename, song]) => {
         const btn = document.createElement("button");
         btn.className = "song-btn";
         btn.dataset.song = filename;
         btn.textContent = song.title;
         songList.appendChild(btn);
       });

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
  const { title, artist, albumArt } = songs[file];
  audio.src = `/assets/audio/${file}`;
  audio.play();
  isPlaying = true;
  playBtn.innerHTML = "❚❚";

  // Update UI
  spotifyOverlay.querySelector(".song-title").textContent = title;
  spotifyOverlay.querySelector(".artist").textContent = artist;
  spotifyOverlay.querySelector(
    ".album-art"
  ).style.backgroundImage = `url('${albumArt}')`;
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
