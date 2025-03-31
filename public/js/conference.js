document.addEventListener("DOMContentLoaded", () => {
  const conferenceWindow = document.getElementById("conferenceWindow");
  const remoteVideosContainer = document.getElementById("remote-videos");
  const localVideoElem = document.getElementById("local-video");
  const exitConferenceBtn = document.getElementById("exitConferenceBtn");

  let peerConnections = {};
  let localStream = null;
  let conferenceParticipants = [];
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

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
      videoContainer.querySelector("video").srcObject = stream;
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state (${userName}): ${pc.connectionState}`);
      if (["disconnected", "failed"].includes(pc.connectionState)) {
        cleanupConnection(socketId);
      }
    };

    // Add local tracks if available
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        if (!pc.getSenders().some((s) => s.track === track)) {
          pc.addTrack(track, localStream);
        }
      });
    }

    return pc;
  }

  // Video Element with Name
  function createVideoElement(socketId, userName) {
    let container = document.getElementById(`remote-${socketId}`);
    if (!container) {
      container = document.createElement("div");
      container.className = "video-card";
      container.id = `remote-${socketId}`;

      container.innerHTML = `
        <div class="video-container">
          <video class="remote-video" autoplay playsinline></video>
          <div class="participant-name">${userName}</div>
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

  // Handle participant exits
  socket.on("participantExited", ({ socketId }) => {
    cleanupConnection(socketId);
  });

  // Conference Controls
  exitConferenceBtn.addEventListener("click", () => conference.exit());

  window.conference = {
    async enter() {
      conferenceWindow.style.display = "block";
      try {
        // Clear previous connections
        Object.values(peerConnections).forEach((pc) => pc.close());
        peerConnections = {};
        remoteVideosContainer.innerHTML = "";

        if (!localStream) {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 360 },
            audio: true,
          });
          localVideoElem.srcObject = localStream;
          localVideoElem.muted = true;
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
