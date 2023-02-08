require("dotenv").config();

const express = require("express");
const app = express();
const http = require('http');
const server = http.createServer(app);
const state = {};

// Helper functions

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_HOST
  }
});

// Establish headers
app.use((req, res, next) => {
  res.append('Access-Control-Allow-Origin', process.env.FRONTEND_HOST);
  res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.append('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Establish requests
app.get("/", (_, res) => {
  res.send('<h4>Hi!</h4><p>You\'ve reached the socket server for Reflex. To access the summary navigate to <b>/summary/{secret}</b> where {secret} is the unique token for the page.</p>');
});


app.get("/summary/" + process.env.SECRET, (_, res) => {
  res.send(state);
});

// Configure socket
io.on('connection', socket => {
  console.log('[NEW CONNECTION]');
  
  socket.on('disconnect', _ => {
    console.log('user disconnected');
    //purge map of IDs
  });

  socket.on('create party', _ => {
    console.log('[CREATE PARTY]');
    code = "PARTYA";
    word = "poodles";

    party = {
      "code": code,
      "currentWord": word,
      "currentRound": 1,
      "dateCreated": Date().toString(),
      "players": {},
      "settings": {
          "numRounds": 3,
          "timer": -1
      }
    };

    state[code] = party;
    socket.emit("room state", party);
  });

  socket.on('join room', data => {
    //name, room
    console.log('room join');
    console.log(data);
    socket.join(data.room);

    //emit room state map to occupants
  });

  socket.on('leave room', data => {
    console.log('leaving room');
    console.log(data);
    socket.leave(data.room)

    //emit room state
  });

  socket.on('submit', data => {
    //submitted

    console.log(data.room);
    socket.broadcast
    .to(data.room)
    .emit('receive message', data)
  });
});

// Initialize server
server.listen(5000, () => {
  console.log("Listening on port 5000.");
});

// Export the Express server
module.exports = server;