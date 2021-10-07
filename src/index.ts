import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'https';
import { Game, Move } from 'hika';
import { readFileSync } from 'fs';

let gameString = '4,4,2,2 RNBQ,PPPP/KBNR,PPPP|,,pppp,rnbq/,,pppp,kbnr';
let game = new Game(gameString);
let gameState: {[key: string]: any, moves: string[]} = {
    id: 'ae',
    status: 0,
    initialState: gameString,
    moves: []
}

let ssl_cert;
let ssl_key;
try {
    ssl_cert = readFileSync(process.env.SSL_CERT_PATH as string);
    ssl_key = readFileSync(process.env.SSL_KEY_PATH as string);
} catch {
    throw Error("SSL error");
}

const httpsServer = createServer({
    cert: ssl_cert,
    key: ssl_key
});

const server = new WebSocketServer({ server: httpsServer });

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
                sendPayload(socket, {
                    o: '4.b',
                    d: {
                        data: gameState
                    }
                });
                break;
            case '5.a': // draw
                break;
            case '5.d': // undraw
                break;
            case '6.a': // resign
                break;
            case '7.a': // chat
                break;
            case '#.r': // reset
                gameState.moves = [];
                game = new Game(gameString);
                break;
            case '#.d': // set data
                gameString = payload.d.data;
                gameState.initialState = gameString;
                gameState.moves = [];
                game = new Game(gameString);
                break;
        }
    });

});

httpsServer.listen(process.env.PORT || 9024);
console.log("lets gooo");