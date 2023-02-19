require('dotenv').config()

const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const state = {}
const playerGameMap = {}
const words = ['poodles', 'giraffe', 'turtles', 'trex']

// Helper functions
function GeneratePartyCode() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let letters = ''
  while (letters.length < 3) {
    letters += alphabet[Math.floor(Math.random() * alphabet.length)]
  }

  let numbers = ''
  while (numbers.length < 3) {
    numbers += Math.floor(Math.random() * 10)
  }

  return letters + numbers
}

function GenerateUniquePartyCode() {
  code = GeneratePartyCode()

  while (Object.keys(state).includes(code)) {
    code = GeneratePartyCode()
  }

  return code
}

function GetWord(previousWords) {
  word = words[Math.floor(Math.random() * words.length)].toUpperCase()

  while (previousWords.includes(word)) {
    word = words[Math.floor(Math.random() * words.length)].toUpperCase()
  }

  return word
}

function TransferHost(code, oldHostId, newHostId, sock) {
  code = code.toUpperCase();

  if (!Object.keys(state).includes(code)) {
    console.log(
      '[' +
        code +
        '] [' +
        oldHostId +
        '] [ERROR] TRYING TO TRANSFER HOSTS IN A NON-EXISTENT PARTY]',
    )
    return
  }

  if (!Object.keys(state[code]['players']).includes(oldHostId)) {
    console.log(
      '[' +
        code +
        '] [' +
        oldHostId +
        '] [ERROR] TRYING TO TRANSFER HOST WHEN HOST NOT IN PARTY]',
    )
    return
  }

  if (!Object.keys(state[code]['players']).includes(newHostId)) {
    console.log(
      '[' +
        code +
        '] [' +
        oldHostId +
        '] [ERROR] TRYING TO TRANSFER HOST WHEN NEW HOST NOT IN PARTY]',
    )
    return
  }

  state[code]['players'][oldHostId].isHost = false;
  state[code]['players'][newHostId].isHost = true;

  sock.broadcast.to(code).emit('transfered host', state[code]);
}

function LeaveGame(code, id, sock) {
  code = code.toUpperCase();

  if (!Object.keys(state).includes(code)) {
    console.log(
      '[' +
        code +
        '] [' +
        id +
        '] [ERROR] TRYING TO LEAVE A NON-EXISTENT PARTY]',
    )
    return
  }

  if (!Object.keys(state[code]['players']).includes(id)) {
    console.log(
      '[' +
        code +
        '] [' +
        id +
        '] [ERROR] TRYING TO LEAVE GAME WHEN NOT IN PARTY]',
    )
    return
  }

  if (state[code]['players'][id].isHost){
    //transfer host randomly
    for (playerId of Object.keys(state[code]['players'])){
      if (!state[code]['players'][playerId].isHost) {
        TransferHost(code, id, playerId, sock);
        break;
      }
    }
  }

  //remove player
  state[code]['players'].delete(id);

  //conditionally delete game
  if (Object.keys(state[code]['players']).length == 0){
    //delete game
    state.delete(code);
  } else {
    //update state
    sock.broadcast.to(code).emit('player left', state[code])
  }
}

const { Server } = require('socket.io')
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_HOST,
  },
})

// Establish headers
app.use((_, res, next) => {
  res.append('Access-Control-Allow-Origin', process.env.FRONTEND_HOST)
  res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.append('Access-Control-Allow-Headers', 'Content-Type')
  next()
})

// Establish requests
app.get('/', (_, res) => {
  res.send(
    "<h4>Hi!</h4><p>You've reached the socket server for Reflex. To access the summary navigate to <b>/summary/{secret}</b> where {secret} is the unique token for the page.</p>",
  )
})

app.get('/summary/' + process.env.SECRET, (_, res) => {
  res.send(state)
})

// Configure socket
io.on('connection', (socket) => {
  socket.on('disconnect', (_) => {
    console.log('[USER DISCONNECT] [' + socket.id + ']')

    if (!Object.keys(playerGameMap).includes(socket.id)){
      console.log('[' +
          socket.id +
          '] [INFO] YOU HAVE NO FRIENDS]',
      )
      return;
    }

    LeaveGame(playerGameMap[socket.id], socket.id, socket)
  })

  socket.on('create party', (data, cb) => {
    code = GenerateUniquePartyCode()
    console.log('[' + code + '] [' + socket.id + '] [GENERATE PARTY CODE]')
    prevWords = []
    word = GetWord(prevWords)
    console.log('[' + code + '] [' + socket.id + '] [CREATE PARTY AS HOST]')
    console.log(
      '[' + code + '] [' + socket.id + '] [ASSIGNING WORD: ' + word + ']',
    )

    let host = {
      socketId: socket.id,
      name: null,
      answer: null,
      isHost: true,
      points: 0,
    }

    party = {
      code: code,
      currentWord: word,
      currentRound: 1,
      dateCreated: Date().toString(),
      previousWords: prevWords,
      players: {},
      settings: {
        numRounds: 3,
        timer: -1,
      },
    }

    party['players'][socket.id] = host
    state[code] = party
    socket.join(code)
    playerGameMap[socket.id] = code
    cb(party)
  })

  socket.on('validate party', (data, cb) => {
    var code = data.code.toUpperCase()
    var isValid = Object.keys(state).includes(code)
    console.log(
      '[' +
        code +
        '] [' +
        socket.id +
        '] [VALIDATE PARTY: ' +
        (isValid ? 'TRUE' : 'FALSE') +
        ']',
    )

    cb(isValid)
  })

  socket.on('change name', (data, cb) => {
    var code = data.code.toUpperCase()

    if (!Object.keys(state).includes(code)) {
      console.log(
        '[' +
          code +
          '] [' +
          socket.id +
          '] [ERROR] TRYING TO ALTER NAME IN A NON-EXISTENT PARTY]',
      )
      return
    }

    if (!Object.keys(state[code]['players']).includes(socket.id)) {
      console.log(
        '[' +
          code +
          '] [' +
          socket.id +
          '] [ERROR] TRYING TO ALTER NAME WHEN NOT IN PARTY]',
      )
      return
    }

    console.log(
      '[' + code + '] [' + socket.id + "] [CHANGE NAME TO '" + data.name + "']",
    )

    state[code]['players'][socket.id]['name'] = data.name
    cb(state[code])
    socket.broadcast.to(code).emit('changed name', state[code])
  })

  socket.on('join party', (data, cb) => {
    var code = data.code.toUpperCase()
    console.log(
      '[' +
        code +
        '] [' +
        socket.id +
        "] [JOIN PARTY AS PARTICIPANT WITH NAME '" +
        data.name +
        "']",
    )

    if (!Object.keys(state).includes(code)) {
      console.log(
        '[' +
          code +
          '] [' +
          socket.id +
          '] [ERROR] TRYING TO JOIN A NON-EXISTENT PARTY]',
      )
      return
    }

    if (!Object.keys(state[code]['players']).includes(socket.id)) {
      player = {
        socketId: socket.id,
        name: data.name,
        answer: null,
        isHost: false,
        points: 0,
      }

      state[code]['players'][socket.id] = player
    } else {
      console.log(
        '[' +
          code +
          '] [' +
          socket.id +
          '] [ERROR] SOCKET ID ALREADY EXISTS IN PARTY]',
      )
      return
    }

    cb(party)
    socket.join(code)
    playerGameMap[socket.id] = code
    socket.broadcast.to(code).emit('joined party', state[code])
  })

  socket.on('change party state', (data, cb) => {
    //moving the game forward as host
    var code = data.code.toUpperCase()

    if (!Object.keys(state).includes(code)) {
      console.log(
        '[' +
          code +
          '] [' +
          socket.id +
          '] [ERROR] TRYING TO ALTER STATE OF A NON-EXISTENT PARTY]',
      )
      return
    }

    if (!Object.keys(state[code]['players']).includes(socket.id)) {
      console.log(
        '[' +
          code +
          '] [' +
          socket.id +
          '] [ERROR] NON PLAYER CANNOT PROGRESS PARTY STATE]',
      )
      return
    }

    if (!state[code]['players'][socket.id].isHost) {
      console.log(
        '[' +
          code +
          '] [' +
          socket.id +
          '] [ERROR] NON HOST CANNOT PROGRESS PARTY STATE]',
      )
      return
    }

    console.log('[' + code + '] [' + socket.id + '] [CHANGE PARTY STATE]')
    socket.broadcast.to(code).emit('game update', state[code])
    cb(state[code])
  })

  socket.on('submit word', (data, cb) => {
    var code = data.code
    var submittedWord = data.word.toUpperCase()
    console.log(
      '[' +
        code +
        '] [' +
        socket.id +
        "] [SUBMIT WORD '" +
        submittedWord +
        "']",
    )

    if (!Object.keys(state).includes(code)) {
      console.log(
        '[' +
          code +
          '] [' +
          socket.id +
          '] [ERROR] TRYING TO SUBMIT WORD TO NON-EXISTENT PARTY]',
      )
      return
    }

    if (Object.keys(state[code]['players']).includes(socket.id)) {
      state[code]['players'][socket.id]['answer'] = submittedWord
    } else {
      console.log(
        '[' +
          code +
          '] [' +
          socket.id +
          '] [ERROR] SOCKET ID DOES NOT EXIST IN PARTY FOR SUBMISSION]',
      )
      return
    }

    var allAnswered = true
    Object.keys(state[code]['players']).forEach((id) => {
      if (state[code]['players'][id]['answer'] == null) {
        allAnswered = false
      }
    })

    if (allAnswered) {
      state[code]['currentRound'] =
        state[code]['currentRound'] >= state[code]['settings']['numRounds']
          ? -1
          : state[code]['currentRound'] + 1

      var answerMap = {}

      Object.keys(state[code]['players']).forEach((id) => {
        if (
          Object.keys(answerMap).includes(state[code]['players'][id]['answer'])
        ) {
          answerMap[state[code]['players'][id]['answer']].push(id)
        } else {
          answerMap[state[code]['players'][id]['answer']] = [id]
        }

        state[code]['players'][id]['answer'] = null
      })

      Object.keys(answerMap).forEach((answer) => {
        if (answerMap[answer].length >= 2) {
          answerMap[answer].forEach((id) => {
            state[code]['players'][id]['points'] += 10
            //TODO: sort out points logic
          })
        }
      })

      if (state[code]['currentRound'] != -1) {
        state[code]['previousWords'].push(state[code]['currentWord'])
        var word = GetWord(state[code]['previousWords'])
        console.log(
          '[' + code + '] [' + socket.id + '] [ASSIGNING WORD: ' + word + ']',
        )
        state[code]['currentWord'] = word
      }

      //signal to change to next screen automatically
      socket.broadcast.to(code).emit('change screen', true)
      cb({
        "change": true,
        "state": null
      })
    }

    socket.broadcast.to(code).emit('word submitted', state[code])
    cb({
      "change": false,
      "state": state[code]
    })
  })

  socket.on('transfer host', (data, cb) => {
    var code = data.code.toUpperCase();
    var newHostId = data.newHostId;

    TransferHost(code, socket.id, newHostId, socket);
    cb(state[code]);
  })

  socket.on('leave game', data => {
    console.log('[LEAVE GAME] [' + socket.id + ']')

    if (!Object.keys(playerGameMap).includes(socket.id)){
      console.log('[' +
          socket.id +
          '] [INFO] YOU HAVE NO FRIENDS]',
      )
      return;
    }

    LeaveGame(playerGameMap[socket.id], socket.id, socket);
  })
})

// Initialize server
server.listen(5000, () => {
  console.log('Listening on port 5000.')
})

// Export the Express server
module.exports = server
