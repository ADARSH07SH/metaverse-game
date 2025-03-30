// const localVideo = document.getElementById("my-video");
// const remoteVideo = document.getElementById("other-video");
// let localStream = null;
// const peerConnections = {};
// let isInConference = false; // Track conference state

// const startLocalStream = async () => {
//   try {
//     localStream = await navigator.mediaDevices.getUserMedia({
//       video: true,
//       // audio: true,
//     });
//     localVideo.srcObject = localStream;
//     localVideo.muted = false;
//     setupControls();
//   } catch (err) {
//     console.error(err);
//   }
// };

// const setupControls = () => {
//   const micButton = document.querySelector(".microphone");
//   const videoButton = document.querySelector(".videobtn");
//   micButton.addEventListener("click", function () {
//     if (!localStream) return;
//     const audioTracks = localStream.getAudioTracks();
//     if (audioTracks.length > 0) {
//       audioTracks[0].enabled = !audioTracks[0].enabled;
//     }
//   });
//   videoButton.addEventListener("click", function () {
//     if (!localStream) return;
//     const videoTracks = localStream.getVideoTracks();
//     if (videoTracks.length > 0) {
//       videoTracks[0].enabled = !videoTracks[0].enabled;
//     }
//   });
// };

// startLocalStream();

// const startCallWithPlayer = async (targetSocketId) => {
//   if (isInConference) return; // Prevent proximity calls inside the conference

//   const peerConnection = new RTCPeerConnection({
//     iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//   });

//   localStream.getTracks().forEach((track) => {
//     peerConnection.addTrack(track, localStream);
//   });

//   peerConnection.ontrack = (event) => {
//     remoteVideo.srcObject = event.streams[0];
//   };

//   peerConnection.onicecandidate = (event) => {
//     if (event.candidate) {
//       socket.emit("icecandidate", {
//         to: targetSocketId,
//         candidate: event.candidate,
//       });
//     }
//   };

//   try {
//     const offer = await peerConnection.createOffer();
//     await peerConnection.setLocalDescription(offer);
//     socket.emit("offer", {
//       to: targetSocketId,
//       offer: peerConnection.localDescription,
//     });
//     peerConnections[targetSocketId] = peerConnection;
//   } catch (error) {
//     console.error(error);
//   }
// };

// // Handle incoming WebRTC calls
// socket.on("offer", async ({ from, offer }) => {
//   if (isInConference) return; // Ignore WebRTC offers while in conference

//   const peerConnection = new RTCPeerConnection({
//     iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//   });

//   localStream.getTracks().forEach((track) => {
//     peerConnection.addTrack(track, localStream);
//   });

//   peerConnection.ontrack = (event) => {
//     remoteVideo.srcObject = event.streams[0];
//   };

//   peerConnection.onicecandidate = (event) => {
//     if (event.candidate) {
//       socket.emit("icecandidate", { to: from, candidate: event.candidate });
//     }
//   };

//   try {
//     await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
//     const answer = await peerConnection.createAnswer();
//     await peerConnection.setLocalDescription(answer);
//     socket.emit("answer", {
//       to: from,
//       answer: peerConnection.localDescription,
//     });
//     peerConnections[from] = peerConnection;
//   } catch (error) {
//     console.error(error);
//   }
// });

// const stopProximityCalls = () => {
//   Object.keys(peerConnections).forEach((socketId) => {
//     if (peerConnections[socketId]) {
//       peerConnections[socketId].close();
//       delete peerConnections[socketId];
//     }
//   });
//   remoteVideo.srcObject = null;
//   console.log("Proximity calls stopped due to conference mode.");
// };

// const resumeProximityCalls = () => {
//   console.log("Resuming proximity calls...");
//   // Automatically start a call with nearby players
//   // You might need logic to detect nearby players and start calls again
// };

// window.endCallWithPlayer = endCallWithPlayer;
