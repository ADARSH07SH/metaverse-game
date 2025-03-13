const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://adarsh07sh:adarsh07sh@project-1.nqm85.mongodb.net/t";
const dbName="metaverse"
const client = new MongoClient(uri);




const getUserDetailsCollection = async () => {
  try {
    await client.connect();
    console.log(`connected to the ${dbName} database`);
      const userDetails = await client.db("metaverse").collection("userId");
      return userDetails;
  } catch (err) {
    console.error(`error connecting to database :${err}`);
  }
};
const getRoomDetailsCollection = async () => {
  try {
    await client.connect();
    console.log(`connected to the ${dbName} database`);
      const roomDetails = await client.db("metaverse").collection("roomId");
      return roomDetails;
  } catch (err) {
    console.error(`error connecting to database :${err}`);
  }
};
const playerChat = async () => {
  try {
    await client.connect();
    console.log(`connected to the ${dbName} database`);
      const roomDetails = await client.db("metaverse").collection("chat");
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
      // Map each participant to a simplified object with userName and socketId.
      return room.conferenceHall.map((participant) => ({
        number: participant.number, // if you need the number
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