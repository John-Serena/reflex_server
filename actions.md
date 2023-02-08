# Schema
```json
[
    {
        "code": "PARTYA",
        "currentWord": "poodles",
        "currentRound": 1, //-1 if about to finish
        "dateCreated": "2023-02-05",
        "players": [
            {
                "socketId": "123231",
                "name": "Jeffrey Anderson",
                "answer": null,
                "isHost": true,
                "points": 0,
            },
            ...
        ],
        "settings": [
            "numRounds": 3,
            "timer": -1
        ]
    },
    ...
]
```
# Actions
**1.0 Create Party**
- Request
- Code is generated, word generated, round is set to 1
- Response (party)

**2.0 Check party**
- Request (code)
- Response (true/false)

**3.0 Join party**
- Request (code, isHost, name)
- Response (party)

**4.0 Submit word**
- Request (code, word)
- Check if all answered, if so incremenet round number (or set to -1), update points, and regenerate word if applicable
- Response (party)

**6.0 Transfer Hosts**
- Request (targetSocketId, code)
- Response (party)

**7.0 Leave Game**
- Request (code)
- Response (party)

**8.0 Delete Game**
- Request (code)
- Response (true/false)