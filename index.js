const express = require("express");
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Use .env [e.g. process.env.NOTION_TOKEN]
require("dotenv").config();

// Establish headers
app.use((req, res, next) => {
  const allowedOrigins = ["http://localhost:3000", "https://cardano-alpha.vercel.app"];
  const origin = req.headers.origin;
  // console.log(origin);
  if (allowedOrigins.includes(origin)) {
       res.append('Access-Control-Allow-Origin', origin);
  }

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
  });

  socket.on('room', data => {
    console.log('room join');
    console.log(data);
    socket.join(data.room);
  });

  socket.on('leave room', data => {
    console.log('leaving room');
    console.log(data);
    socket.leave(data.room)
  });

  socket.on('new message', data => {
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