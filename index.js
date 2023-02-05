require("dotenv").config();

const express = require("express");
const app = express();
const http = require('http');
const server = http.createServer(app);

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
app.get("/", (req, res) => {
  res.send('<h1>Hello world</h1>');
});

// Configure socket
io.on('connection', socket => {
  console.log('a user connected');
  
  socket.on('disconnect', reason => {
    console.log('user disconnected');
    //purge map of IDs
  });

  socket.on('create room', data => {
    //name, code
    //construct map of ID to name
    console.log('room join');
    console.log(data);
    socket.join(data.room);
    
    //emit room state

    //State = [
    //   ABC: {'name':'Person', 'sock': 123, 'answer': 'turnips', 'submitted': False},
    //   ABD:
    //]
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