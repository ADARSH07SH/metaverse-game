// conference.js

// Conference module to control the conference overlay UI
const conference = {
  // Called when the local player enters the conference hall:
  enter: function () {
    const overlay = document.querySelector(".overlay-container");
    // Hide video overlay completely
    const videoOverlay = document.querySelector(".video-overlay");
    if (overlay) overlay.style.display = "block";
    if (videoOverlay) videoOverlay.style.display = "none";
  },
  // Called when the local player exits the conference hall:
  exit: function () {
    const overlay = document.querySelector(".overlay-container");
    const videoOverlay = document.querySelector(".video-overlay");
    if (overlay) overlay.style.display = "none";
    if (videoOverlay) videoOverlay.style.display = "block";
  },
  // Build the grid using conference hall participant data,
  // showing only the fallback text initial (no video elements).
  createVideoGrid: function (participants) {
    const videoGrid = document.getElementById("videoGrid");
    if (!videoGrid) return;
    videoGrid.innerHTML = ""; // Clear any existing grid content

    // Optionally set a responsive class based on the number of participants
    videoGrid.className = "video-grid participants-" + participants.length;

    participants.forEach((participant, i) => {
      const name = participant.userName || "Guest";
      const initial = name.charAt(0).toUpperCase();
      const socketId = participant.socketId;
      // Preset colors for initials
      const colors = [
        "#F44336",
        "#E91E63",
        "#9C27B0",
        "#673AB7",
        "#3F51B5",
        "#2196F3",
        "#03A9F4",
        "#00BCD4",
        "#009688",
        "#4CAF50",
        "#8BC34A",
        "#CDDC39",
        "#FFEB3B",
        "#FFC107",
        "#FF9800",
      ];
      const colorIndex = i % colors.length;

      const videoContainer = document.createElement("div");
      videoContainer.className = "video-container";
      videoContainer.id = `video-container-${socketId}`;

      // Create a fallback element that shows the user's initial at the center.
      const userInitial = document.createElement("div");
      userInitial.className = "user-initial";
      userInitial.style.backgroundColor = colors[colorIndex];
      userInitial.textContent = initial;
      // Center the initial with flex layout
      userInitial.style.display = "flex";
      userInitial.style.alignItems = "center";
      userInitial.style.justifyContent = "center";

      // Element for the user name (displayed over the container)
      const userNameDiv = document.createElement("div");
      userNameDiv.className = "user-name";
      userNameDiv.textContent = name;

      videoContainer.appendChild(userInitial);
      videoContainer.appendChild(userNameDiv);
      videoGrid.appendChild(videoContainer);
    });
  },
  // Fetch conference hall participants from the API and update the grid.
  // This function only runs if the local player is still in the conference hall.
  updateConferenceHall: function (roomId) {
    if (!inConferenceHall) return;
    fetch(`/api/conference-participants?roomId=${roomId}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Current conference hall participants:", data);
        this.createVideoGrid(data);
      })
      .catch((err) =>
        console.error("Error fetching conference hall data:", err)
      );
  },
};

// (Optional) Remove unused WebRTC event listeners if video is not used:
// socket.on("stream", ({ socketId, stream }) => { /* ... */ });
// socket.on("videoToggle", ({ socketId, isVideoEnabled }) => { /* ... */ });

// Socket listeners for conference hall updates:
socket.on("participantEntered", (data) => {
  console.log("Participant entered:", data);
  conference.updateConferenceHall(roomId);
});

socket.on("participantExited", (data) => {
  console.log("Participant exited:", data);
  conference.updateConferenceHall(roomId);
});

// Optionally poll for updates every 5 seconds
setInterval(() => {
  conference.updateConferenceHall(roomId);
}, 5000);

// Expose the conference module globally if needed:
window.conference = conference;
