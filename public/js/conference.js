document.addEventListener("DOMContentLoaded", () => {
  const conferenceWindow = document.getElementById("conferenceWindow");
  const remoteVideosContainer = document.getElementById("remote-videos");
  const localVideoElem = document.getElementById("local-video");
  const exitConferenceBtn = document.getElementById("exitConferenceBtn");

  let peerConnections = {};
  let localStream = null;
  let conferenceParticipants = [];
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

  // Avatar configuration
  const avatarColors = ["#FFB399", "#FF33FF", "#00B3E6", "#E6B333", "#3366E6"];

  // Get avatar properties from username
  function getAvatarConfig(userName) {
    const initial = userName.charAt(0).toUpperCase();
    const color = avatarColors[userName.charCodeAt(0) % avatarColors.length];
    return { initial, color };
  }

  // Update video elements with avatar visibility
  function updateVideoElements() {
    document.querySelectorAll(".video-container").forEach((container) => {
      const video = container.querySelector("video");
      const avatar = container.querySelector(".video-avatar");
      const isVideoActive = video.srcObject
        ?.getVideoTracks()
        .some((track) => track.enabled);

      avatar.style.display = isVideoActive ? "none" : "flex";
      video.style.display = isVideoActive ? "block" : "none";
    });

    // Update local video element
    const localVideo = document.getElementById("local-video");
    const localAvatar = document.getElementById("local-avatar");
    const isLocalVideoActive = localVideo.srcObject
      ?.getVideoTracks()
      .some((track) => track.enabled);
    localAvatar.style.display = isLocalVideoActive ? "none" : "flex";
    localVideo.style.display = isLocalVideoActive ? "block" : "none";
  }

  // Toggle audio mute state
  function toggleAudio() {
    const micButton = document.querySelector(".microphone");
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !audioTracks[0].enabled;
        audioTracks[0].enabled = newState;
        micButton.classList.toggle( !newState);
      }
    }
  }

  // Toggle video state
  function toggleVideo() {
    const videoButton = document.querySelector(".videobtn");
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const newState = !videoTracks[0].enabled;
        videoTracks[0].enabled = newState;
        videoButton.classList.toggle( !newState);
        updateVideoElements();

        // Notify other participants
        socket.emit("videoStateChange", {
          userId: document.getElementById("gamedata").dataset.userId,
          videoEnabled: newState,
        });
      }
    }
  }

  // Initialize local avatar
  function initLocalAvatar() {
    const userId = document.getElementById("gamedata").dataset.userId;
    const { initial, color } = getAvatarConfig(userId);
    const localAvatar = document.getElementById("local-avatar");
    localAvatar.textContent = initial;
    localAvatar.style.backgroundColor = color;
  }

  // ICE Candidate Queue Handling
  function processIceQueue(pc) {
    while (pc.iceQueue.length > 0) {
      const candidate = pc.iceQueue.shift();
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) =>
        console.error("ICE candidate error:", err)
      );
    }
  }

  // Peer Connection Management
  function createPeerConnection(socketId, userName) {
    const pc = new RTCPeerConnection({ iceServers });
    pc.iceQueue = [];
    pc.userName = userName;
    pc.socketId = socketId;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("iceCandidate", {
          candidate,
          target: socketId,
          sender: socket.id,
        });
      }
    };

    pc.ontrack = ({ streams: [stream] }) => {
      if (!stream) return;
      const videoContainer = createVideoElement(socketId, userName);
      const videoElement = videoContainer.querySelector("video");
      videoElement.srcObject = stream;
      updateVideoElements();
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state (${userName}): ${pc.connectionState}`);
      if (["disconnected", "failed"].includes(pc.connectionState)) {
        cleanupConnection(socketId);
      }
    };

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        if (!pc.getSenders().some((s) => s.track === track)) {
          pc.addTrack(track, localStream);
        }
      });
    }

    return pc;
  }

  // Video Element with Name and Avatar
  function createVideoElement(socketId, userName) {
    let container = document.getElementById(`remote-${socketId}`);
    if (!container) {
      const { initial, color } = getAvatarConfig(userName);

      container = document.createElement("div");
      container.className = "video-card";
      container.id = `remote-${socketId}`;
      container.dataset.userId = userName;

      container.innerHTML = `
        <div class="video-container">
          <video class="remote-video" autoplay playsinline></video>
          <div class="participant-name">${userName}</div>
          <div class="video-avatar" style="background-color: ${color}">${initial}</div>
        </div>
      `;
      remoteVideosContainer.appendChild(container);
    }
    return container;
  }

  // Connection Cleanup
  function cleanupConnection(socketId) {
    const pc = peerConnections[socketId];
    if (pc) {
      pc.close();
      delete peerConnections[socketId];
    }
    const element = document.getElementById(`remote-${socketId}`);
    element?.remove();
    updateVideoElements();
  }

  // Initialize Connections
  async function initiateConnections() {
    conferenceParticipants
      .filter((p) => p.socketId !== socket.id)
      .forEach(async ({ socketId, userName }) => {
        if (!peerConnections[socketId]) {
          const pc = createPeerConnection(socketId, userName);
          peerConnections[socketId] = pc;

          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", {
              offer: pc.localDescription,
              target: socketId,
              sender: socket.id,
            });
          } catch (err) {
            console.error("Offer error:", err);
            cleanupConnection(socketId);
          }
        }
      });
  }

  // Event Listeners
  document.querySelector(".microphone").addEventListener("click", toggleAudio);
  document.querySelector(".videobtn").addEventListener("click", toggleVideo);
  exitConferenceBtn.addEventListener("click", () => conference.exit());

  // Signaling Handlers
  socket.on("offer", async ({ offer, sender }) => {
    if (!peerConnections[sender]) {
      const pc = createPeerConnection(sender, "Participant");
      peerConnections[sender] = pc;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", {
          answer: pc.localDescription,
          target: sender,
          sender: socket.id,
        });
        processIceQueue(pc);
      } catch (err) {
        console.error("Offer handling error:", err);
        cleanupConnection(sender);
      }
    }
  });

  socket.on("answer", async ({ answer, sender }) => {
    const pc = peerConnections[sender];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        processIceQueue(pc);
      } catch (err) {
        console.error("Answer error:", err);
        cleanupConnection(sender);
      }
    }
  });

  socket.on("iceCandidate", async ({ candidate, sender }) => {
    const pc = peerConnections[sender];
    if (pc) {
      try {
        const iceCandidate = new RTCIceCandidate(candidate);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(iceCandidate);
        } else {
          pc.iceQueue.push(iceCandidate);
        }
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    }
  });

  socket.on("participantExited", ({ socketId }) => {
    cleanupConnection(socketId);
  });

  socket.on("videoStateChange", ({ userId, videoEnabled }) => {
    const containers = document.querySelectorAll(`[data-user-id="${userId}"]`);
    containers.forEach((container) => {
      const avatar = container.querySelector(".video-avatar");
      const video = container.querySelector("video");
      avatar.style.display = videoEnabled ? "none" : "flex";
      video.style.display = videoEnabled ? "block" : "none";
    });
  });

  // Conference Controls
  window.conference = {
    async enter() {
      conferenceWindow.style.display = "block";
      try {
        Object.values(peerConnections).forEach((pc) => pc.close());
        peerConnections = {};
        remoteVideosContainer.innerHTML = "";
        initLocalAvatar();

        if (!localStream) {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 360 },
            audio: true,
          });
          localVideoElem.srcObject = localStream;
          localVideoElem.muted = true;
          updateVideoElements();
        }

        const roomId = document.getElementById("gamedata").dataset.roomId;
        const response = await fetch(
          `/api/conference-participants?roomId=${roomId}`
        );
        conferenceParticipants = await response.json();

        await initiateConnections();
      } catch (err) {
        console.error("Conference error:", err);
      }
    },

    exit() {
      conferenceWindow.style.display = "none";
      Object.values(peerConnections).forEach((pc) => pc.close());
      peerConnections = {};
      remoteVideosContainer.innerHTML = "";

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
      }

      socket.emit("exitConference", {
        roomId: document.getElementById("gamedata").dataset.roomId,
        id: socket.id,
      });
    },
  };
});
