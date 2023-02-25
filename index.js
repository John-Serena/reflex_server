require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const state = {};
const playerGameMap = {};
const words = ['poodles', 'giraffe', 'turtles', 'trex'];

// Helper functions
function printInfo(...args) {
	let infoString = '';
	for (const word of args) {
		infoString += '[' + word + '] ';
	}
	console.log(infoString);
}

function GeneratePartyCode() {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let letters = '';
	while (letters.length < 3) {
		letters += alphabet[Math.floor(Math.random() * alphabet.length)];
	}

	let numbers = '';
	while (numbers.length < 3) {
		numbers += Math.floor(Math.random() * 10);
	}

	return letters + numbers;
}

function GenerateUniquePartyCode() {
	code = GeneratePartyCode();

	while (Object.keys(state).includes(code)) {
		code = GeneratePartyCode();
	}

	return code;
}

function GetWord(previousWords) {
	word = words[Math.floor(Math.random() * words.length)].toUpperCase();

	while (previousWords.includes(word)) {
		word = words[Math.floor(Math.random() * words.length)].toUpperCase();
	}

	return word;
}

function TransferHost(code, oldHostId, newHostId, sock) {
	code = code.toUpperCase();

	if (!Object.keys(state).includes(code)) {
		printInfo(
			code,
			oldHostId,
			'ERROR: Trying to transfer hosts in a non-existent party'
		);
		return;
	}

	if (!Object.keys(state[code]['players']).includes(oldHostId)) {
		printInfo(
			code,
			oldHostId,
			'ERROR: Trying to transfer host when host not in party'
		);
		return;
	}

	if (!Object.keys(state[code]['players']).includes(newHostId)) {
		printInfo(
			code,
			oldHostId,
			'ERROR: Trying to transfer host when new host not in party'
		);
		return;
	}

	state[code]['players'][oldHostId].isHost = false;
	state[code]['players'][newHostId].isHost = true;

	sock.broadcast.to(code).emit('transfered host', state[code]);
}

function LeaveGame(code, id, sock) {
	code = code.toUpperCase();

	if (!Object.keys(state).includes(code)) {
		printInfo(code, id, 'ERROR: Trying to leave a non-existent party');
		return;
	}

	if (!Object.keys(state[code]['players']).includes(id)) {
		printInfo(code, id, 'ERROR: Trying to leave game when not in party');
		return;
	}

	if (state[code]['players'][id].isHost) {
		//transfer host randomly
		for (playerId of Object.keys(state[code]['players'])) {
			if (!state[code]['players'][playerId].isHost) {
				TransferHost(code, id, playerId, sock);
				break;
			}
		}
	}

	//remove player
	delete state[code]['players'][id];
	printInfo(code, id, `REMOVING PLAYER FROM GAME`);

	//conditionally delete game
	if (Object.keys(state[code]['players']).length == 0) {
		//delete game
		delete state[code];
		printInfo(code, 'DELETING GAME DUE TO NO PLAYERS');
	} else {
		//update state
		sock.broadcast.to(code).emit('player left', state[code]);
	}
}

const { Server } = require('socket.io');
const io = new Server(server, {
	cors: {
		origin: process.env.FRONTEND_HOST,
	},
});

// Establish headers
app.use((_, res, next) => {
	res.append('Access-Control-Allow-Origin', process.env.FRONTEND_HOST);
	res.append('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
	res.append('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

// Establish requests
app.get('/', (_, res) => {
	res.send(
		"<h4>Hi!</h4><p>You've reached the socket server for Reflex. To access the summary navigate to <b>/summary/{secret}</b> where {secret} is the unique token for the page.</p>"
	);
});

app.get('/summary/' + process.env.SECRET, (_, res) => {
	res.send(state);
});

// Configure socket
io.on('connection', (socket) => {
	socket.on('disconnect', (_) => {
		printInfo('USER DISCONNECT', socket.id);

		if (!Object.keys(playerGameMap).includes(socket.id)) {
			printInfo(socket.id, 'INFO: You have no friends');
			return;
		}

		LeaveGame(playerGameMap[socket.id], socket.id, socket);
	});

	socket.on('create party', (data, cb) => {
		code = GenerateUniquePartyCode();
		printInfo(code, socket.id, 'GENERATE PARTY CODE');
		prevWords = [];
		word = GetWord(prevWords);
		printInfo(code, socket.id, 'CREATE PARTY AS HOST');
		printInfo(code, socket.id, `ASSIGNING WORD: ${word}`);

		let host = {
			socketId: socket.id,
			name: null,
			answer: null,
			isHost: true,
			points: 0,
		};

		party = {
			code: code,
			currentWord: word,
			currentRound: -1,
			dateCreated: Date().toString(),
			previousWords: prevWords,
			players: {},
			settings: {
				numRounds: data.numRounds,
				timer: data.timer,
			},
		};

		party['players'][socket.id] = host;
		state[code] = party;
		socket.join(code);
		playerGameMap[socket.id] = code;
		cb(party);
	});

	socket.on('validate party', (data, cb) => {
		var code = data.code.toUpperCase();
		var isValid = Object.keys(state).includes(code);
		printInfo(code, socket.id, `VALIDATE PARTY: ${isValid ? 'TRUE' : 'FALSE'}`);
		cb(isValid);
	});

	socket.on('change name', (data, cb) => {
		var code = data.code.toUpperCase();

		if (!Object.keys(state).includes(code)) {
			printInfo(
				code,
				socket.id,
				'ERROR: Trying to alter name in a non-existent party'
			);
			return;
		}

		if (!Object.keys(state[code]['players']).includes(socket.id)) {
			printInfo(
				code,
				socket.id,
				'ERROR: Trying to alter name when not in party'
			);
			return;
		}

		printInfo(code, socket.id, `CHANGE NAME TO ${data.name}`);

		state[code]['players'][socket.id]['name'] = data.name;
		cb(state[code]);
		socket.broadcast.to(code).emit('changed name', state[code]);
	});

	socket.on('join party', (data, cb) => {
		var code = data.code.toUpperCase();
		printInfo(
			code,
			socket.id,
			`JOIN PARTY AS PARTICIPANT WITH NAME ${data.name}`
		);

		if (!Object.keys(state).includes(code)) {
			printInfo(code, socket.id, 'ERROR: Trying to join a non-existent party');
			return;
		}

		if (!Object.keys(state[code]['players']).includes(socket.id)) {
			player = {
				socketId: socket.id,
				name: data.name,
				answer: null,
				isHost: false,
				points: 0,
			};

			state[code]['players'][socket.id] = player;
		} else {
			printInfo(code, socket.id, 'ERROR: Socket ID already exists in party');
			return;
		}

		cb(party);
		socket.join(code);
		playerGameMap[socket.id] = code;
		socket.broadcast.to(code).emit('joined party', state[code]);
	});

	socket.on('change party state', (data, cb) => {
		//moving the game forward as host
		var code = data.code.toUpperCase();

		if (!Object.keys(state).includes(code)) {
			printInfo(
				code,
				socket.id,
				'ERROR: Trying to alter state of a non-existent party'
			);
			return;
		}

		if (!Object.keys(state[code]['players']).includes(socket.id)) {
			printInfo(
				code,
				socket.id,
				'ERROR: Non-player cannot progress party state'
			);
			return;
		}

		if (!state[code]['players'][socket.id].isHost) {
			printInfo(code, socket.id, 'ERROR: Non host cannot progress party state');
			return;
		}

		console.log('[' + code + '] [' + socket.id + '] [CHANGE PARTY STATE]');
		socket.broadcast.to(code).emit('game update', state[code]);
		cb(state[code]);
	});

	socket.on('submit word', (data, cb) => {
		var code = data.code;
		var submittedWord = data.word.toUpperCase();
		printInfo(code, socket.id, `SUBMIT WORD ${submittedWord}`);

		if (!Object.keys(state).includes(code)) {
			printInfo(
				code,
				socket.id,
				'ERROR: Trying to submit word to non-existent party'
			);
			return;
		}

		if (Object.keys(state[code]['players']).includes(socket.id)) {
			state[code]['players'][socket.id]['answer'] = submittedWord;
		} else {
			printInfo(
				code,
				socket.id,
				'ERROR: Socket ID does not exist in party for submission'
			);
			return;
		}

		var allAnswered = true;
		Object.keys(state[code]['players']).forEach((id) => {
			if (state[code]['players'][id]['answer'] == null) {
				allAnswered = false;
			}
		});

		if (allAnswered) {
			state[code]['currentRound'] =
				state[code]['currentRound'] >= state[code]['settings']['numRounds']
					? -1
					: state[code]['currentRound'] + 1;

			var answerMap = {};

			Object.keys(state[code]['players']).forEach((id) => {
				if (
					Object.keys(answerMap).includes(state[code]['players'][id]['answer'])
				) {
					answerMap[state[code]['players'][id]['answer']].push(id);
				} else {
					answerMap[state[code]['players'][id]['answer']] = [id];
				}

				state[code]['players'][id]['answer'] = null;
			});

			Object.keys(answerMap).forEach((answer) => {
				if (answerMap[answer].length >= 2) {
					answerMap[answer].forEach((id) => {
						state[code]['players'][id]['points'] += 10;
						//TODO: sort out points logic
					});
				}
			});

			if (state[code]['currentRound'] != -1) {
				state[code]['previousWords'].push(state[code]['currentWord']);
				var word = GetWord(state[code]['previousWords']);
				printInfo(code, socket.id, `ASSIGNING WORD: ${word}`);
				state[code]['currentWord'] = word;
			}

			//signal to change to next screen automatically
			socket.broadcast.to(code).emit('change screen', true);
			cb({
				change: true,
				state: null,
			});
		}

		socket.broadcast.to(code).emit('word submitted', state[code]);
		cb({
			change: false,
			state: state[code],
		});
	});

	socket.on('transfer host', (data, cb) => {
		var code = data.code.toUpperCase();
		var newHostId = data.newHostId;

		TransferHost(code, socket.id, newHostId, socket);
		cb(state[code]);
	});

	socket.on('leave game', (data) => {
		console.log('[LEAVE GAME] [' + socket.id + ']');

		if (!Object.keys(playerGameMap).includes(socket.id)) {
			printInfo(socket.id, 'INFO: You have no friends');

			console.log('[' + socket.id + '] [INFO] YOU HAVE NO FRIENDS]');
			return;
		}

		LeaveGame(playerGameMap[socket.id], socket.id, socket);
	});
});

// Initialize server
server.listen(3001, () => {
	console.log('Listening on port 3001.');
});

// Export the Express server
module.exports = server;
