document.addEventListener("DOMContentLoaded", () => {
  
  const conferenceWindow = document.getElementById("conferenceWindow");
  const remoteVideosContainer = document.getElementById("remote-videos");
  const localVideoElem = document.getElementById("local-video");
  const exitConferenceBtn = document.getElementById("exitConferenceBtn");
  const micButton = document.querySelector(".microphone");
  const videoButton = document.querySelector(".videobtn");

  
  let peerConnections = {};
  let localStream = null;
  let conferenceParticipants = [];
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  const avatarColors = ["#FFB399", "#FF33FF", "#00B3E6", "#E6B333", "#3366E6"];
  let videoMuted = false;

  
  const gamedata = document.getElementById("gamedata");
  const userId = gamedata.dataset.userId;
  const roomId = gamedata.dataset.roomId;

  
  function getAvatarConfig(userName) {
    const initial = userName.charAt(0).toUpperCase();
    const color = avatarColors[userName.charCodeAt(0) % avatarColors.length];
    return { initial, color };
  }

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
    }
    return container;
  }

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

  function cleanupConnection(remoteSocketId) {
    const pc = peerConnections[remoteSocketId];
    if (pc) pc.close();
    delete peerConnections[remoteSocketId];
    const element = document.getElementById(`remote-${remoteSocketId}`);
    if (element) element.remove();
    updateVideoElements();
  }

  function updateVideoElements() {
    document.querySelectorAll(".video-container").forEach((container) => {
      const video = container.querySelector("video");
      const avatar = container.querySelector(".video-avatar");
      const isVideoActive =
        video.srcObject?.getVideoTracks()?.some((track) => track.enabled) ??
        false;

      video.classList.toggle("show", isVideoActive);
      video.classList.toggle("dontshow", !isVideoActive);
      avatar.classList.toggle("show", !isVideoActive);
      avatar.classList.toggle("dontshow", isVideoActive);
    });
  }

  async function initMediaStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !videoMuted ? { width: 640, height: 360 } : false,
        audio: true,
      });
      return stream;
    } catch (err) {
      console.error("Error getting media devices:", err);
      return null;
    }
  }

  async function toggleAudio() {
    if (!localStream) {
      localStream = await initMediaStream();
      if (!localStream) return;
    }

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const newState = !audioTracks[0].enabled;
      audioTracks[0].enabled = newState;
      micButton.classList.toggle("muted", !newState);
      socket.emit("audioStateChange", { userId, audioEnabled: newState });
    }
  }

  async function toggleVideo() {
    if (!localStream) {
      localStream = await initMediaStream();
      if (!localStream) return;
    }

    const videoTracks = localStream.getVideoTracks();
    const isVideoCurrentlyOn = videoTracks.length > 0 && videoTracks[0].enabled;

    if (isVideoCurrentlyOn) {
      
      videoTracks.forEach((track) => {
        track.enabled = false;
        track.stop();
        localStream.removeTrack(track);
      });

      videoMuted = true;
      videoButton.classList.add("video-off");
      if (localVideoElem) {
        localVideoElem.style.display = "none";
      }
      const localAvatar = document.getElementById("local-avatar");
      if (localAvatar) {
        localAvatar.style.display = "flex";
      }

      
      Object.values(peerConnections).forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(null);
      });
    } else {
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 360 },
        });
        const newVideoTrack = stream.getVideoTracks()[0];

        if (!localStream) {
          localStream = new MediaStream();
        }
        localStream.addTrack(newVideoTrack);

        if (localVideoElem) {
          localVideoElem.srcObject = localStream;
          localVideoElem.style.display = "block";
          localVideoElem.muted = true;
        }

        const localAvatar = document.getElementById("local-avatar");
        if (localAvatar) {
          localAvatar.style.display = "none";
        }

        
        Object.values(peerConnections).forEach((pc) => {
          const sender = pc
            .getSenders()
            .find((s) => !s.track || s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(newVideoTrack);
          } else {
            pc.addTrack(newVideoTrack, localStream);
          }
        });

        videoMuted = false;
        videoButton.classList.remove("video-off");
      } catch (err) {
        console.error("Error restarting video:", err);
        return;
      }
    }

    socket.emit("videoStateChange", {
      userId,
      socketId: socket.id,
      videoEnabled: !isVideoCurrentlyOn,
    });
  }

  function processIceQueue(pc) {
    while (pc.iceQueue.length > 0) {
      const candidate = pc.iceQueue.shift();
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    }
  }

  function initLocalAvatar() {
    const { initial, color } = getAvatarConfig(userId);
    const localAvatar = document.getElementById("local-avatar");
    if (localAvatar) {
      localAvatar.textContent = initial;
      localAvatar.style.backgroundColor = color;
    }
  }

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

  
  if (micButton) {
    micButton.addEventListener("click", toggleAudio);
  }
  if (videoButton) {
    videoButton.addEventListener("click", toggleVideo);
  }

  
  window.conference = {
    async enter() {
      conferenceWindow.style.display = "block";
      remoteVideosContainer.innerHTML = "";
      Object.values(peerConnections).forEach((pc) => pc.close());
      peerConnections = {};
      initLocalAvatar();

      try {
        localStream = await initMediaStream();
        if (localStream && localVideoElem) {
          localVideoElem.srcObject = localStream;
          localVideoElem.muted = true;

          if (videoMuted) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach((track) => {
              track.enabled = false;
              track.stop();
              localStream.removeTrack(track);
            });
            localVideoElem.style.display = "none";
            const localAvatar = document.getElementById("local-avatar");
            if (localAvatar) {
              localAvatar.style.display = "flex";
            }
          }
        }
      } catch (err) {
        console.error("Error getting local stream:", err);
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

  if (exitConferenceBtn) {
    exitConferenceBtn.addEventListener("click", () => {
      conference.exit();
      socket.emit("exitConference", { roomId, id: socket.id, userId });
    });
  }

  
  socket.on("offer", async ({ offer, sender }) => {
    if (sender === socket.id) return;
    setTimeout(async () => {
      const response = await fetch(`/api/get-players?roomId=${roomId}`);
      conferenceParticipants = await response.json();
      const participant = conferenceParticipants.find(
        (p) => p.socketId === sender
      );
      const participantName = participant?.userName || "Participant";

      if (!peerConnections[sender]) {
        const pc = createPeerConnection(sender, participantName);
        peerConnections[sender] = pc;

        if (!localStream) {
          localStream = await initMediaStream();
          if (localVideoElem) {
            localVideoElem.srcObject = localStream;
            localVideoElem.muted = true;
          }
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

  socket.on(
    "videoChange",
    ({ userId: remoteUserId, socketId: remoteSocketId, videoEnabled }) => {
      if (remoteSocketId === socket.id) return;
      const container = document.getElementById(`remote-${remoteSocketId}`);
      if (container) {
        const video = container.querySelector("video");
        const avatar = container.querySelector(".video-avatar");

        video.classList.toggle("show", videoEnabled);
        video.classList.toggle("dontshow", !videoEnabled);
        avatar.classList.toggle("show", !videoEnabled);
        avatar.classList.toggle("dontshow", videoEnabled);
      }
    }
  );

  console.log("✅ Conference module ready → use conference.enter() to join.");
});


