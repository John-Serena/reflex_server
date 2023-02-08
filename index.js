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
  word = words[Math.floor(Math.random() * words.length)].toUpperCase();

  while (previousWords.includes(word)){
    word = words[Math.floor(Math.random() * words.length)].toUpperCase();
  }

  return word;
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
  socket.on('disconnect', _ => {
    console.log('[USER DISCONNECT]');
    //purge map of IDs
  });

  socket.on('create party', _ => {
    code = GenerateUniquePartyCode();
    console.log('[' + code + '] [' + socket.id + '] [CREATE PARTY]');
    prevWords = [];
    word = GetWord(prevWords);
    console.log('[' + code + '] [' + socket.id + '] [ASSIGNING WORD: ' + word + ']');

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
    var isValid = Object.keys(state).includes(data.code.toUpperCase());
    console.log('[' + data.code + '] [' + socket.id + '] [VALIDATE PARTY: ' + (isValid ? "TRUE" : "FALSE") +']');
    
    socket.emit("party valid", isValid);
  });

  socket.on('join party', data => {
    var code = data.code.toUpperCase();
    console.log('[' + code + '] [' + socket.id + '] [JOIN PARTY AS ' + (data.isHost ? 'HOST' : 'PARTICIPANT') + ' WITH NAME \'' + data.name + '\']');

    if (!Object.keys(state[code]["players"]).includes(socket.id)){
      player = {
        "socketId": socket.id,
        "name": data.name,
        "answer": null,
        "isHost": data.isHost,
        "points": 0,
      };

      state[code]["players"][socket.id] = player;
    } else {
      console.log('[' + code + '] [' + socket.id + '] [ERROR] SOCKET ID ALREADY EXISTS IN PARTY]');
      return;
    }
    
    socket.join(code);
    socket.emit("party state", state[code]);
  });

  socket.on('submit word', data => {
    var code = data.code;
    var submittedWord = data.word.toUpperCase();
    console.log('[' + code + '] [' + socket.id + '] [SUBMIT WORD \'' + submittedWord + '\']');
    
    if (Object.keys(state[code]["players"]).includes(socket.id)){
      state[code]["players"][socket.id]["answer"] = submittedWord;
    } else {
      console.log('[' + code + '] [' + socket.id + '] [ERROR] SOCKET ID DOES NOT EXIST IN PARTY FOR SUBMISSION]');
      return;
    }

    var allAnswered = true;
    Object.keys(state[code]["players"]).forEach(id => {
      if (state[code]["players"][id]["answer"] == null){
        allAnswered = false;
      }
    });

    if (allAnswered){
      state[code]["currentRound"] = state[code]["currentRound"] >= state[code]["settings"]["numRounds"] ? -1 : state[code]["currentRound"] + 1;

      var answerMap = {};

      Object.keys(state[code]["players"]).forEach(id => {
        if (Object.keys(answerMap).includes(state[code]["players"][id]["answer"])){
          answerMap[state[code]["players"][id]["answer"]].push(id);
        } else {
          answerMap[state[code]["players"][id]["answer"]] = [id];
        }

        state[code]["players"][id]["answer"] = null;
      });

      Object.keys(answerMap).forEach(answer => {
        if (answerMap[answer].length >= 2){
          answerMap[answer].forEach(id => {
            state[code]["players"][id]["points"] += 10;
            //TODO: sort out points logic
          })
        }
      })

      if (state[code]["currentRound"] != -1){
        state[code]["previousWords"].push(state[code]["currentWord"]);
        var word = GetWord(state[code]["previousWords"]);
        console.log('[' + code + '] [' + socket.id + '] [ASSIGNING WORD: ' + word + ']');
        state[code]["currentWord"] = word;
      }
    }

    socket.broadcast
    .to(code)
    .emit("party state", state[code])
  });
});

// Initialize server
server.listen(5000, () => {
  console.log("Listening on port 5000.");
});

// Export the Express server
module.exports = server;