import { WebSocket, WebSocketServer } from 'ws';
import { Game, Move } from 'hika';

const gameString = '8,8,2,1 RNBQKBNR,PPPPPPPP,,,,,pppppppp,rnbqkbnr';
const game = new Game(gameString);
const gameState: {[key: string]: any, moves: string[]} = {
    id: 'ae',
    status: 0,
    initialState: gameString,
    moves: []
}


const server = new WebSocketServer({ port: 9024 });

type Payload = {
    o: string,
    d?: any,
    s?: number
}

type SocketData = {
    id: number,
    payloadCount: number
}

// let socketList = [];

let socketData = new Map<WebSocket, SocketData>();

function sendPayload(socket: WebSocket, payload: Payload) {
    let data = socketData.get(socket);
    if (!data) throw Error;
    payload.s = data.payloadCount++;
    socket.send(JSON.stringify(payload));
}

let idCounter = 0;

server.on('connection', (socket) => {

    console.log(`Socket ${idCounter} connecting`);

    socketData.set(socket, {
        id: idCounter,
        payloadCount: 0
    });
    idCounter++;

    socket.on('message', (message, isBinary) => {
        console.log(`${socketData.get(socket)?.id}: ${message.toString()}`);

        let payload: Payload = JSON.parse(message.toString());
        switch (payload.o) {
            case '0.a': // heartbeat
                sendPayload(socket, {
                    o: '0.b'
                });
                break;
            case '1.a': // handshake
                if (payload.d && payload.d.version == '0.0.1') {
                    sendPayload(socket, {
                        o: '1.b',
                        d: {
                            success: true,
                            data: gameState
                        }
                    });
                } else {
                    sendPayload(socket, {
                        o: '1.b',
                        d: {
                            success: false
                        }
                    });
                }
                break;
            case '2.a': // ping
                sendPayload(socket, {
                    o: '2.b'
                });
                break;
            case '3.a': // move
                let move = Move.deserialize(payload.d);
                if (game.isValidMove(move)) {
                    game.move(move);
                    gameState.moves.push(Move.serialize(move))
                    sendPayload(socket, {
                        o: '3.b',
                        d: {
                            success: true
                        }
                    });
                    socketData.forEach((data, sock) => {
                        if (data.id != socketData.get(socket)?.id) {
                            sendPayload(sock, {
                                o: '3.c',
                                d: {
                                    move: Move.serialize(move),
                                    team: 0
                                }
                            });
                        }
                    });
                } else {
                    sendPayload(socket, {
                        o: '3.b',
                        d: {
                            success: false
                        }
                    });
                }
                break;
            case '4.a': // state
                break;
            case '5.a': // draw
                break;
            case '5.d': // undraw
                break;
            case '6.a': // resign
                break;
            case '7.a': // chat
                break;
        }
    });

});

console.log("lets gooo");