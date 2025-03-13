// mediasoupServer.js
const mediasoup = require("mediasoup");

let worker;
let router;

const startMediasoupWorker = async () => {
  worker = await mediasoup.createWorker({
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp"],
  });
  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {},
      },
    ],
  });
};

module.exports = { startMediasoupWorker, router, worker };
