document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing WebRTC conference module...");

  const conferenceWindow = document.getElementById("conferenceWindow");
  const participantsList = document.getElementById("participantsList");
  const remoteVideosContainer = document.getElementById("remote-videos"); // Dedicated container for remote videos
  const localVideoElem = document.getElementById("local-video");

  // Map for storing RTCPeerConnections keyed by remote socket IDs.
  let peerConnections = {};

  // Global local media stream
  let localStream = null;

  // Array for conference participants (for UI display only)
  let conferenceParticipants = [];

  // Polling: Fetch and update the conference participant list (for UI)
  async function fetchParticipants() {
    const roomId = document
      .getElementById("gamedata")
      .getAttribute("data-room-id");
    try {
      const response = await fetch(
        `/api/conference-participants?roomId=${roomId}`
      );
      if (!response.ok) throw new Error("Network response was not ok");
      const participants = await response.json();
      conferenceParticipants = participants;
      console.log("Fetched participants:", participants);
      participantsList.innerHTML = "";
      participants.forEach((participant) => {
        if (participant.socketId === socket.id) return; // Exclude self from UI
        const li = document.createElement("li");
        li.textContent = `${participant.userName} (Socket: ${participant.socketId})`;
        participantsList.appendChild(li);
      });
      // After updating the participant list, try to initiate connections for any new participants.
      await initiateConnections();
    } catch (error) {
      console.error("Error fetching conference participants:", error);
    }
  }

  // WebRTC configuration
  const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  // Utility: Create a new RTCPeerConnection and build/update the UI container for a remote participant.
  async function createPeerConnection(remoteSocketId, participantName) {
    const pc = new RTCPeerConnection(rtcConfig);
    console.log(
      `Created RTCPeerConnection for remote socket ${remoteSocketId}`
    );

    // Add local tracks if available and not already added.
    if (localStream) {
      // Avoid duplicate tracks by checking if any sender exists.
      if (pc.getSenders().length === 0) {
        localStream.getTracks().forEach((track) => {
          console.log(
            `Adding local ${track.kind} track to connection for ${remoteSocketId}`
          );
          pc.addTrack(track, localStream);
        });
      }
    }

    // Handle ICE candidates.
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(
          `Sending ICE candidate to ${remoteSocketId}:`,
          event.candidate
        );
        socket.emit("iceCandidate", {
          candidate: event.candidate,
          sender: socket.id,
          target: remoteSocketId,
        });
      }
    };

    // Handle remote tracks and build/update the remote video UI.
    pc.ontrack = (event) => {
      console.log(`Received remote track from ${remoteSocketId}:`, event);
      let container = document.getElementById(`remote-${remoteSocketId}`);
      if (!container) {
        container = document.createElement("div");
        container.id = `remote-${remoteSocketId}`;
        container.classList.add("video-container");

        // Create a placeholder showing the participant's first letter.
        const placeholder = document.createElement("div");
        placeholder.classList.add("video-placeholder");
        placeholder.textContent = participantName.charAt(0).toUpperCase();
        container.appendChild(placeholder);

        // Create the video element.
        const videoElem = document.createElement("video");
        videoElem.classList.add("remote-video");
        videoElem.autoplay = true;
        videoElem.playsInline = true;
        videoElem.style.display = "none"; // Hidden until stream arrives
        container.appendChild(videoElem);

        // Create a name overlay at bottom left (5% height)
        const overlay = document.createElement("div");
        overlay.classList.add("video-overlay");
        overlay.textContent = participantName;
        overlay.style.position = "absolute";
        overlay.style.bottom = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "5%";
        overlay.style.backgroundColor = "blue";
        overlay.style.color = "white";
        overlay.style.fontSize = "10px";
        overlay.style.padding = "2px";
        overlay.style.opacity = "0.8";
        container.appendChild(overlay);

        remoteVideosContainer.appendChild(container);
      }
      const videoElem = container.querySelector(".remote-video");
      videoElem.srcObject = event.streams[0];
      videoElem.style.display = "block";
      // Hide the placeholder.
      const placeholder = container.querySelector(".video-placeholder");
      if (placeholder) placeholder.style.display = "none";
      console.log(`Remote stream from ${remoteSocketId} set for display.`);
    };

    return pc;
  }

  // Initiate connections to all remote participants (excluding self).
  async function initiateConnections() {
    for (const participant of conferenceParticipants) {
      if (participant.socketId === socket.id) continue;
      if (!peerConnections[participant.socketId]) {
        console.log(
          `Initiating connection to ${participant.socketId} (${participant.userName})`
        );
        const pc = await createPeerConnection(
          participant.socketId,
          participant.userName
        );
        peerConnections[participant.socketId] = pc;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log(`Sending offer to ${participant.socketId}:`, offer);
        socket.emit("offer", {
          offer: offer,
          sender: socket.id,
          target: participant.socketId,
        });
      }
    }
  }

  // Signaling: Handle incoming offers, answers, and ICE candidates.
  socket.on("offer", async (data) => {
    if (data.target !== socket.id) {
      console.log(`Ignoring offer from ${data.sender} not targeting me.`);
      return;
    }
    console.log(`Received offer from ${data.sender}:`, data.offer);
    // Look up participant name.
    let participantName = "Unknown";
    for (const p of conferenceParticipants) {
      if (p.socketId === data.sender) {
        participantName = p.userName;
        break;
      }
    }
    if (!peerConnections[data.sender]) {
      const pc = await createPeerConnection(data.sender, participantName);
      peerConnections[data.sender] = pc;
      // Ensure local media is captured.
      if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localVideoElem.srcObject = localStream;
        console.log("Local media captured for incoming offer.");
      }
      // Do not re-add tracks if already added.
      if (pc.getSenders().length === 0) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }
    }
    const pc = peerConnections[data.sender];
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log(`Sending answer to ${data.sender}:`, answer);
    socket.emit("answer", {
      answer: answer,
      sender: socket.id,
      target: data.sender,
    });
  });

  socket.on("answer", async (data) => {
    if (data.target !== socket.id) {
      console.log(`Ignoring answer from ${data.sender} not targeting me.`);
      return;
    }
    console.log(`Received answer from ${data.sender}:`, data.answer);
    const pc = peerConnections[data.sender];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log(`Remote description set for connection with ${data.sender}`);
    }
  });

  socket.on("iceCandidate", async (data) => {
    if (data.target !== socket.id) {
      console.log(
        `Ignoring ICE candidate from ${data.sender} not targeting me.`
      );
      return;
    }
    console.log(`Received ICE candidate from ${data.sender}:`, data.candidate);
    const pc = peerConnections[data.sender];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log(`Added ICE candidate from ${data.sender}`);
      } catch (error) {
        console.error(`Error adding ICE candidate from ${data.sender}:`, error);
      }
    }
  });

  // Cleanup: Close all peer connections and clear remote video elements.
  function cleanupConnections() {
    console.log("Cleaning up all peer connections.");
    Object.keys(peerConnections).forEach((key) => {
      const pc = peerConnections[key];
      if (pc) {
        pc.close();
        console.log(`Closed connection with ${key}`);
      }
    });
    peerConnections = {};
    remoteVideosContainer.innerHTML = "";
  }

  // Expose conference.enter() and conference.exit() globally.
  window.conference = {
    enter: async function () {
      console.log("Conference.enter() called.");
      cleanupConnections();
      conferenceWindow.style.display = "block";
      console.log("Conference window displayed.");

      await fetchParticipants();
      window._conferenceInterval = setInterval(fetchParticipants, 3000);
      console.log(
        "Polling for participants started. Current participants:",
        conferenceParticipants
      );

      const roomId = document
        .getElementById("gamedata")
        .getAttribute("data-room-id");
      const userId = document
        .getElementById("gamedata")
        .getAttribute("data-user-id");
      socket.emit("enterConference", { roomId, id: socket.id, userId });

      if (!localStream) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          localVideoElem.srcObject = localStream;
          console.log("Local media captured on enter.");
        } catch (error) {
          console.error("Error capturing local media on enter:", error);
        }
      }
      await initiateConnections();
    },
    exit: function () {
      console.log("Conference.exit() called.");
      const roomId = document
        .getElementById("gamedata")
        .getAttribute("data-room-id");
      const userId = document
        .getElementById("gamedata")
        .getAttribute("data-user-id");
      socket.emit("exitConference", { roomId, id: socket.id, userId });
      conferenceWindow.style.display = "none";
      console.log("Conference window hidden.");

      if (window._conferenceInterval) {
        clearInterval(window._conferenceInterval);
        window._conferenceInterval = null;
        console.log("Polling interval cleared.");
      }

      cleanupConnections();
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop();
          console.log(`Stopped local track: ${track.kind}`);
        });
        localStream = null;
      }
      participantsList.innerHTML = "";
      console.log("Conference exited, UI cleared, and all connections closed.");
    },
  };

  console.log(
    "Conference module initialized and available as window.conference"
  );
});
