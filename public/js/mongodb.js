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







module.exports = {
  getUserDetailsCollection,
  getRoomDetailsCollection,
  playerChat,
};