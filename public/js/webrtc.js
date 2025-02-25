const localVideo = document.getElementById("my-video");
let localStream = null;

const startLocalStream = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideo.srcObject = localStream;
    localVideo.muted = true;

    console.log("local stream started");
  } catch (err) {
    console.log(err);
  }
};

startLocalStream();

const peerConnections = {};

const startCallWithPlayer = async (targetSocketId) => {
  console.log(`Starting call with player ${targetSocketId}`);

  const peerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  });

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    const remoteVideo = document.getElementById("other-video");
    remoteVideo.srcObject = event.streams[0];
    console.log("Remote stream received.");
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("icecandidate", {
        to: targetSocketId,
        candidate: event.candidate,
      });
    }
  };

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("offer", {
      to: targetSocketId,
      offer: peerConnection.localDescription,
    });

    peerConnections[targetSocketId] = peerConnection;
  } catch (error) {
    console.error("Error creating WebRTC offer:", error);
  }
};

socket.on("offer", async ({ from, offer }) => {
  console.log(`Received offer from player ${from}`);

  const peerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  });

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    const remoteVideo = document.getElementById("other-video");
    remoteVideo.srcObject = event.streams[0];
    console.log("Remote stream received.");
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("icecandidate", {
        to: from,
        candidate: event.candidate,
      });
    }
  };

  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("answer", {
      to: from,
      answer: peerConnection.localDescription,
    });

    peerConnections[from] = peerConnection;
  } catch (error) {
    console.error("Error handling WebRTC offer:", error);
  }
});

socket.on("answer", async ({ from, answer }) => {
  console.log(`Received answer from player ${from}`);

  const peerConnection = peerConnections[from];

  if (peerConnection) {
    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    } catch (error) {
      console.error("Error setting remote description:", error);
    }
  }
});

socket.on("icecandidate", async ({ from, candidate }) => {
  const peerConnection = peerConnections[from];

  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`Added ICE candidate from player ${from}`);
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  }
});

socket.on("playerDisconnected", (id) => {
  console.log(`Player ${id} disconnected`);

  // Close the connection for the disconnected player
  if (peerConnections[id]) {
    const peerConnection = peerConnections[id];

    // Close the peer connection
    peerConnection.close();

    // Remove the remote video element (if desired)
    const remoteVideo = document.getElementById("other-video");
    if (remoteVideo) {
      remoteVideo.srcObject = null;
    }

    // Remove the player from the peerConnections object
    delete peerConnections[id];
  }

  // You can also handle the visual side here: e.g., hiding or removing the video feed UI
});


const endCallWithPlayer = (targetSocketId) => {
  console.log(`Ending call with player ${targetSocketId}`);

  if (peerConnections[targetSocketId]) {
    peerConnections[targetSocketId].close();
    delete peerConnections[targetSocketId];
  }

  const remoteVideo = document.getElementById("other-video");
  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }

  // Notify the other player to end the call
  socket.emit("endCall", { to: targetSocketId });
};


socket.on("endCall", ({ from }) => {
  console.log(`Call ended by player ${from}`);

  if (peerConnections[from]) {
    peerConnections[from].close();
    delete peerConnections[from];
  }

  const remoteVideo = document.getElementById("other-video");
  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }
});
