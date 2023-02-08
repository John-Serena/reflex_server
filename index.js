require("dotenv").config();

const express = require("express");
const app = express();
const http = require('http');
const server = http.createServer(app);
const state = {};
const words = ["poodles", "giraffe", "turtles", "trex"];

// Helper functions
function GeneratePartyCode(){
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const c1 = alphabet[Math.floor(Math.random() * alphabet.length)];
  const c2 = alphabet[Math.floor(Math.random() * alphabet.length)];
  const c3 = alphabet[Math.floor(Math.random() * alphabet.length)];

  const n1 = Math.floor(Math.random() * 10);
  const n2 = Math.floor(Math.random() * 10);
  const n3 = Math.floor(Math.random() * 10);
  return "" + c1 + c2 + c3 + n1 + n2 + n3;
}

function GenerateUniquePartyCode(){
  code = GeneratePartyCode();

  while (Object.keys(state).includes(code)){
    code = GeneratePartyCode();
  }

  return code;
}

function GetWord(previousWords){
  word = words[Math.floor(Math.random() * words.length)];

  while (previousWords.includes(word)){
    word = words[Math.floor(Math.random() * words.length)];
  }

  return word.toUpperCase();
}

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
    console.log('[USER DISCONNECT]');
    //purge map of IDs
  });

  socket.on('create party', _ => {
    code = GenerateUniquePartyCode();
    console.log('[CREATE PARTY ' + code + ']');
    prevWords = [];
    word = GetWord(prevWords);
    console.log('[ASSIGNING WORD: ' + word + ']');
    
    party = {
      "code": code,
      "currentWord": word,
      "currentRound": 1,
      "dateCreated": Date().toString(),
      "previousWords": prevWords,
      "players": {},
      "settings": {
          "numRounds": 3,
          "timer": -1
      }
    };

    state[code] = party;
    socket.emit("party state", party);
  });

  socket.on('validate party', data => {
    var isValid = Object.keys(state).includes(data.code);
    console.log('[VALIDATE PARTY ' + data.code + ': ' + (isValid ? "TRUE" : "FALSE") +']');
    
    socket.emit("party valid", isValid);
  });

  socket.on('join party', data => {
    console.log('[JOIN PARTY ' + data.code + ' AS ' + (data.isHost ? 'HOST' : 'PARTICIPANT') + ' WITH NAME ' + data.name + ']');
    var code = data.code;

    if (!Object.keys(state[code]["players"]).includes(socket.id)){
      player = {
        "socketId": socket.id,
        "name": data.name,
        "answer": null,
        "isHost": data.isHost,
        "points": 0,
      };

      state[code]["players"][socket.id] = player;
    }
    
    socket.join(code);
    socket.emit("party state", state[code]);
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