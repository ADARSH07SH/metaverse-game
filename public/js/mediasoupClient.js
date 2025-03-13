// Assume mediasoupClient is available (import it or include via CDN)
let device;
let producerTransport;
let consumerTransport;
let producer;
const socket = io();

// First, load the mediasoup-client Device with the router's RTP capabilities from the server.
socket.emit("getRouterRtpCapabilities", null, async (routerRtpCapabilities) => {
  device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities });

  // Now create a producer transport:
  socket.emit("createProducerTransport", {}, (transportInfo) => {
    producerTransport = device.createSendTransport(transportInfo);

    producerTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      socket.emit(
        "connectProducerTransport",
        { dtlsParameters },
        (response) => {
          if (response.error) errback(response.error);
          else callback();
        }
      );
    });

    producerTransport.on(
      "produce",
      ({ kind, rtpParameters }, callback, errback) => {
        socket.emit("produce", { kind, rtpParameters }, (response) => {
          if (response.error) errback(response.error);
          else callback({ id: response.id });
        });
      }
    );

    // Start sending your video stream (for example, from a local video element)
    producer = producerTransport.produce({
      track: localStream.getVideoTracks()[0],
    });
  });
});
// Listen for new producers from other participants.
socket.on("newProducer", async (data) => {
  console.log("New producer available:", data);
  await consumeRemoteStream(data.producerId);
});

const createConsumerTransport = () => {
  return new Promise((resolve, reject) => {
    socket.emit("createConsumerTransport", {}, (transportInfo) => {
      if (transportInfo.error) {
        return reject(transportInfo.error);
      }
      consumerTransport = device.createRecvTransport(transportInfo);
      consumerTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
        socket.emit("connectConsumerTransport", { dtlsParameters }, (response) => {
          if (response.error) errback(response.error);
          else callback();
        });
      });
      resolve(consumerTransport);
    });
  });
};

const consumeRemoteStream = async (producerId) => {
  try {
    if (!consumerTransport) {
      await createConsumerTransport();
    }

    socket.emit("consume", { producerId, rtpCapabilities: device.rtpCapabilities }, (consumerInfo) => {
      if (consumerInfo.error) {
        console.error("Error consuming remote stream:", consumerInfo.error);
        return;
      }
      const consumer = consumerTransport.consume({
        id: consumerInfo.id,
        producerId: consumerInfo.producerId,
        kind: consumerInfo.kind,
        rtpParameters: consumerInfo.rtpParameters,
      });
      const remoteStream = new MediaStream();
      remoteStream.addTrack(consumer.track);
      const remoteVideoElement = document.createElement("video");
      remoteVideoElement.srcObject = remoteStream;
      remoteVideoElement.autoplay = true;
      remoteVideoElement.playsInline = true;
      document.getElementById("remoteVideos").appendChild(remoteVideoElement);
    });
  } catch (error) {
    console.error("Error in consumeRemoteStream:", error);
  }
};
