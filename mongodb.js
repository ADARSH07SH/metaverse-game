require("dotenv").config();

const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_URI;
const dbName = "metaverse";
const client = new MongoClient(uri);

const getUserDetailsCollection = async () => {
  try {
    await client.connect();
    const userDetails = await client.db(dbName).collection("userId");
    return userDetails;
  } catch (err) {
    console.error(`error connecting to database :${err}`);
  }
};

const getRoomDetailsCollection = async () => {
  try {
    await client.connect();
    const roomDetails = await client.db(dbName).collection("roomId");
    return roomDetails;
  } catch (err) {
    console.error(`error connecting to database :${err}`);
  }
};

const playerChat = async () => {
  try {
    await client.connect();
    const roomDetails = await client.db(dbName).collection("chat");
    return roomDetails;
  } catch (err) {
    console.error(`error connecting to database :${err}`);
  }
};

const getConferenceParticipants = async (roomId) => {
  try {
    const roomCollection = await getRoomDetailsCollection();
    const room = await roomCollection.findOne({ roomId });
    if (room && room.conferenceHall) {
      return room.conferenceHall.map((participant) => ({
        number: participant.number,
        userName: participant.userName,
        socketId: participant.socketId,
      }));
    }
    return [];
  } catch (err) {
    console.error("Error retrieving conference participants:", err);
    return [];
  }
};

module.exports = {
  getUserDetailsCollection,
  getRoomDetailsCollection,
  playerChat,
  getConferenceParticipants,
};
