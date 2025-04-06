document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing WebRTC conference module...");

  // DOM Elements
  const conferenceWindow = document.getElementById("conferenceWindow");
  const remoteVideosContainer = document.getElementById("remote-videos");
  const localVideoElem = document.getElementById("local-video");
  const exitConferenceBtn = document.getElementById("exitConferenceBtn");
  const micButton = document.querySelector(".microphone");
  const videoButton = document.querySelector(".videobtn");

  // Global Variables
  let peerConnections = {}; // Keyed by socketId
  let localStream = null; // Local media stream
  let conferenceParticipants = []; // List of participants
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  const avatarColors = ["#FFB399", "#FF33FF", "#00B3E6", "#E6B333", "#3366E6"];
  let videoMuted = false; // false means video is on

  // Extract user and room info from DOM
  const gamedata = document.getElementById("gamedata");
  const userId = gamedata.dataset.userId;
  const roomId = gamedata.dataset.roomId;

  // Helper: Get avatar config for a user
  function getAvatarConfig(userName) {
    const initial = userName.charAt(0).toUpperCase();
    const color = avatarColors[userName.charCodeAt(0) % avatarColors.length];
    return { initial, color };
  }

  // Create or update a remote participant's video element
  function createVideoElement(remoteSocketId, participantName) {
    let container = document.getElementById(`remote-${remoteSocketId}`);
    if (!container) {
      const { initial, color } = getAvatarConfig(participantName);
      container = document.createElement("div");
      container.className = "video-card";
      container.id = `remote-${remoteSocketId}`;
      container.dataset.userId = participantName;
      container.innerHTML = `
        <div class="video-container">
          <div class="video-avatar show" style="background-color: ${color};">${initial}</div>
          <video class="remote-video show" data-socket-id="${remoteSocketId}" autoplay playsinline></video>
          <div class="participant-name">${participantName}</div>
        </div>
      `;
      remoteVideosContainer.appendChild(container);
    } else {
      const nameElem = container.querySelector(".participant-name");
      const participant = conferenceParticipants.find(
        (p) => p.socketId === remoteSocketId
      );
      if (nameElem && participant) {
        nameElem.innerText = participant.userName;
        container.dataset.userId = participant.userName;
      }
    }
    return container;
  }

  // Create an RTCPeerConnection for a remote participant
  function createPeerConnection(remoteSocketId, participantName) {
    const pc = new RTCPeerConnection({ iceServers });
    pc.iceQueue = [];
    pc.userName = participantName;
    pc.socketId = remoteSocketId;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("iceCandidate", {
          candidate,
          target: remoteSocketId,
          sender: socket.id,
        });
      }
    };

    pc.ontrack = ({ streams: [stream] }) => {
      const videoContainer = createVideoElement(
        remoteSocketId,
        participantName
      );
      const videoElement = videoContainer.querySelector("video");
      videoElement.srcObject = stream;
      updateVideoElements();
    };

    pc.onconnectionstatechange = () => {
      console.log(
        `Connection state for ${participantName} (${remoteSocketId}): ${pc.connectionState}`
      );
      if (["disconnected", "failed"].includes(pc.connectionState)) {
        cleanupConnection(remoteSocketId);
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

  // Clean up a peer connection and remove its video element
  function cleanupConnection(remoteSocketId) {
    const pc = peerConnections[remoteSocketId];
    if (pc) {
      pc.close();
      delete peerConnections[remoteSocketId];
    }
    const element = document.getElementById(`remote-${remoteSocketId}`);
    if (element) element.remove();
    updateVideoElements();
  }

  // Update video elements for each container: if video track is enabled, show video and hide avatar; otherwise, show avatar.
  function updateVideoElements() {
    document.querySelectorAll(".video-container").forEach((container) => {
      const video = container.querySelector("video");
      const avatar = container.querySelector(".video-avatar");
      const isVideoActive = video.srcObject
        ? video.srcObject.getVideoTracks().some((track) => track.enabled)
        : false;
      if (isVideoActive) {
        video.classList.add("show");
        video.classList.remove("dontshow");
        avatar.classList.add("dontshow");
        avatar.classList.remove("show");
      } else {
        video.classList.add("dontshow");
        video.classList.remove("show");
        avatar.classList.add("show");
        avatar.classList.remove("dontshow");
      }
    });
  }

  // Toggle local audio state
  function toggleAudio() {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const newState = !audioTracks[0].enabled;
        audioTracks[0].enabled = newState;
        micButton.classList.toggle("muted", !newState);
        socket.emit("audioStateChange", { userId, audioEnabled: newState });
        console.log(`Local audio ${newState ? "enabled" : "disabled"}`);
      }
    }
  }

  // Toggle local video state.
  // When turning off, stop and remove the video track so that webcam is not active.
  // When turning on, obtain a new video track and add it to the stream and update all peer connections.
  async function toggleVideo() {
    if (!localStream) return;
    let videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0 && videoTracks[0].enabled) {
      // Turn video off
      videoTracks.forEach((track) => {
        track.stop();
        localStream.removeTrack(track);
      });
      videoMuted = true;
      videoButton.classList.add("video-off");
      localVideoElem.style.setProperty("display", "none", "important");
      const localAvatar = document.getElementById("local-avatar");
      if (localAvatar) {
        localAvatar.style.setProperty("display", "flex", "important");
      }
      socket.emit("videoStateChange", {
        userId,
        socketId: socket.id,
        videoEnabled: false,
      });
      console.log("Local video disabled");
    } else {
      // Turn video on: get a new video track
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 360 },
        });
        const newTrack = stream.getVideoTracks()[0];
        localStream.addTrack(newTrack);
        // Replace track in all peer connections
        Object.values(peerConnections).forEach((pc) => {
          const sender = pc
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(newTrack);
        });
        videoMuted = false;
        videoButton.classList.remove("video-off");
        localVideoElem.style.setProperty("display", "block", "important");
        const localAvatar = document.getElementById("local-avatar");
        if (localAvatar) {
          localAvatar.style.setProperty("display", "none", "important");
        }
        socket.emit("videoStateChange", {
          userId,
          socketId: socket.id,
          videoEnabled: true,
        });
        console.log("Local video enabled");
      } catch (err) {
        console.error("Error restarting video:", err);
      }
    }
  }

  // Process queued ICE candidates for a given peer connection.
  function processIceQueue(pc) {
    while (pc.iceQueue.length > 0) {
      const candidate = pc.iceQueue.shift();
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) =>
        console.error("ICE candidate error:", err)
      );
    }
  }

  // Initialize the local avatar (for your own video container)
  function initLocalAvatar() {
    const { initial, color } = getAvatarConfig(userId);
    const localAvatar = document.getElementById("local-avatar");
    if (localAvatar) {
      localAvatar.textContent = initial;
      localAvatar.style.backgroundColor = color;
    }
  }

  // Connect to all current participants in the conference.
  async function initiateConnections() {
    for (const participant of conferenceParticipants) {
      if (participant.socketId === socket.id) continue;
      if (!peerConnections[participant.socketId]) {
        const pc = createPeerConnection(
          participant.socketId,
          participant.userName
        );
        peerConnections[participant.socketId] = pc;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("offer", {
            offer: pc.localDescription,
            target: participant.socketId,
            sender: socket.id,
          });
        } catch (err) {
          console.error("Offer error:", err);
          cleanupConnection(participant.socketId);
        }
      }
    }
  }

  // Conference Controls: Enter and Exit.
  window.conference = {
    async enter() {
      conferenceWindow.style.display = "block";
      remoteVideosContainer.innerHTML = "";
      Object.values(peerConnections).forEach((pc) => pc.close());
      peerConnections = {};
      initLocalAvatar();

      if (!localStream) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 360 },
            audio: true,
          });
          localVideoElem.srcObject = localStream;
          localVideoElem.muted = true;
        } catch (err) {
          console.error("Error getting local stream:", err);
        }
      }

      try {
        const res = await fetch(
          `/api/conference-participants?roomId=${roomId}`
        );
        conferenceParticipants = await res.json();
      } catch (err) {
        console.error("Fetching participants failed:", err);
      }

      socket.emit("enterConference", { roomId, id: socket.id, userId });
      await initiateConnections();
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
      socket.emit("exitConference", { roomId, id: socket.id });
    },
  };

  micButton.addEventListener("click", toggleAudio);
  videoButton.addEventListener("click", toggleVideo);
  exitConferenceBtn.addEventListener("click", () => {
    conference.exit();
    socket.emit("exitConference", { roomId, id: socket.id, userId });
  });

  // Socket Handlers
  socket.on("offer", async ({ offer, sender }) => {
    if (sender === socket.id) return;
    setTimeout(async () => {
      const response = await fetch(`/api/get-players?roomId=${roomId}`);
      conferenceParticipants = await response.json();
      const participant = conferenceParticipants.find(
        (p) => p.socketId === sender
      );
      const participantName = participant
        ? participant.userName
        : "Participant";
      if (!peerConnections[sender]) {
        const pc = createPeerConnection(sender, participantName);
        peerConnections[sender] = pc;
        if (!localStream) {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          localVideoElem.srcObject = localStream;
          localVideoElem.muted = true;
        }
        if (pc.getSenders().length === 0) {
          localStream
            .getTracks()
            .forEach((track) => pc.addTrack(track, localStream));
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { answer, target: sender, sender: socket.id });
        processIceQueue(pc);
      }
    }, 100);
  });

  socket.on("answer", async ({ answer, sender }) => {
    const pc = peerConnections[sender];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      processIceQueue(pc);
    }
  });

  socket.on("iceCandidate", async ({ candidate, sender }) => {
    const pc = peerConnections[sender];
    if (pc) {
      const iceCandidate = new RTCIceCandidate(candidate);
      if (pc.remoteDescription) {
        await pc.addIceCandidate(iceCandidate);
      } else {
        pc.iceQueue.push(iceCandidate);
      }
    }
  });

  socket.on("participantExited", ({ socketId: exitedSocketId }) => {
    cleanupConnection(exitedSocketId);
  });

  socket.on("videoChange", async (data) => {
    console.log(data);
    const {
      userId: remoteUserId,
      socketId: remoteSocketId,
      videoEnabled,
    } = data;
    if (remoteSocketId === socket.id) return;
    const container = document.getElementById(`remote-${remoteSocketId}`);
    if (container) {
      const avatar = container.querySelector(".video-avatar");
      const video = container.querySelector(".remote-video");
      if (videoEnabled) {
        video.classList.add("show");
        video.classList.remove("dontshow");
        avatar.classList.add("dontshow");
        avatar.classList.remove("show");
      } else {
        video.classList.add("dontshow");
        video.classList.remove("show");
        avatar.classList.add("show");
        avatar.classList.remove("dontshow");
      }
    }
  });

  console.log("✅ Conference module ready → use conference.enter() to join.");
});
