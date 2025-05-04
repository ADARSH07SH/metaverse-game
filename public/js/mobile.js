let game101 = 0;
let phaserGame = null;

class Example extends Phaser.Scene {
  constructor() {
    super();
    this.move = 0;
    this.x = 0;
    this.y = 0;
  }

  preload() {
    const progressBar = this.add.graphics();
    const progressText = this.add
      .text(
        this.sys.game.config.width / 2,
        this.sys.game.config.height / 2,
        "0%",
        {
          fontSize: "24px",
          fill: "#ffffff",
        }
      )
      .setOrigin(0.5);

    this.load.on("progress", (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ff00, 0.7);

      const barWidth = this.sys.game.config.width * 0.5;
      const barX = (this.sys.game.config.width - barWidth) / 2;

      progressBar.fillRect(
        barX,
        this.sys.game.config.height / 2 - 15,
        barWidth * value,
        30
      );

      progressText.setText(`${Math.round(value * 100)}%`);
    });

    this.load.image("sky", "/assets/minigame1/deepblue.png");

    this.load.image("ball", "/assets/minigame1/ball.png");
  }

  create() {
    this.add.image(0, 0, "sky").setOrigin(0);
    this.group = this.add.group({ key: "ball", frameQuantity: 128 });

    this.input.on("pointermove", (pointer) => {
      this.x = pointer.x;
      this.y = pointer.y;
    });
  }

  update(time, delta) {
    this.move += delta;
    if (this.move > 6) {
      Phaser.Actions.ShiftPosition(this.group.getChildren(), this.x, this.y);
      this.move = 0;
    }
  }
}

const mobileMain = document.querySelector(".mobileMain");
document.addEventListener("DOMContentLoaded", () => {
  let audio = new Audio();
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
          <span id="current-time">${new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}</span>
        </div>
        <div class="app-container">
          <div class="app-icon" id="spotify-app">
  <img src="/assets/minigame1/R.png" alt="Spotify Icon" />
</div>

          <div class="gamebtn1 app-icon" id="gamebtn1"><i class="fa-solid fa-gamepad fa-3x"></i>      </div>
        </div>
      </div>
    `;
    mobileMain.appendChild(phoneFrame);
    const gameOverlay1 = document.createElement("div");
    gameOverlay1.className = "gameoverlay1";
    gameOverlay1.style.display = "none";
    gameOverlay1.innerHTML = `
    
    <div class="game101">
    </div>`;
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
    mobileMain.appendChild(gameOverlay1);
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

    const gamebtn1 = phoneFrame.querySelector("#gamebtn1");

    gamebtn1.addEventListener("click", () => {
      game101 = game101 === 0 ? 101 : 0;
      const gameHidden = gameOverlay1.style.display === "none";
      gameOverlay1.style.display = gameHidden ? "block" : "none";

      if (gameHidden && !phaserGame) {
        const config = {
          type: Phaser.AUTO,
          width: 280,
          height: 390,
          parent: gameOverlay1,
          scene: Example,
        };
        phaserGame = new Phaser.Game(config);
      } else if (!gameHidden && phaserGame) {
        phaserGame.destroy(true);
        phaserGame = null;
        gameContainer.innerHTML = "";
      }
    });

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

mobileMain.style.display = "none";
const infoIcon = document.querySelector(".info i");

socket.on("entercafe1", () => {
  console.log("enter");
  mobileMain.classList.add("active");
  if (infoIcon) infoIcon.style.color = "red";
});

socket.on("exitcafe1", () => {
  console.log("exit");
  mobileMain.classList.remove("active");
  if (infoIcon) infoIcon.style.color = "";
});
