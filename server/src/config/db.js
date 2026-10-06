const mongoose = require('mongoose');
const config = require('./index');

mongoose.set('strictQuery', true);

async function connectDB() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log(`[db] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
