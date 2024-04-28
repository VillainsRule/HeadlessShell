import WebSocket from 'ws';
import { CommIn, CommOut, CommCode } from '../util/comm.js';
import config from '../config.js';

export default (auth, game) => {
    let gameSocket = new WebSocket(`wss://${game.subdomain}.math.international/game/${game.id}`, {
        headers: {
            'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'accept-language': 'en-US,en;q=0.9'
        }
    });

    gameSocket.binaryType = 'arraybuffer';

    gameSocket.onopen = () => (!!config.logHook) ? fetch(config.logHook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `**Joined!** Code: ${game.id} | Gamemode: ${game.mode}` })
    }) : console.log('Game Joined!');

    gameSocket.onmessage = (e2) => {
        CommIn.init(e2.data);
        let cmd = CommIn.unPackInt8U();

        switch (cmd) {
            case CommCode.socketReady:
                console.log('Got socketReady, sending data.');
                var out = CommOut.getBuffer();
                out.packInt8(CommCode.joinGame);
                out.packString(config.names[config.names.length * Math.random() | 0]);
                out.packString(game.uuid);
                out.packInt8(0); // hideBadge
                out.packInt8(Math.floor(Math.random() * 5)); // Weapon? Named classIdx
                out.packInt32(auth.sessionInt); // playerAccount.session
                out.packString(auth.firebase); // playerAccount.firebaseId
                out.packString(auth.session); // playerAccount.sessionId
                out.send(gameSocket);
                break;

            case CommCode.gameJoined:
                setTimeout(() => {
                    var out = CommOut.getBuffer();
                    out.packInt8(CommCode.clientReady);
                    out.send(gameSocket);

                    var out = CommOut.getBuffer();
                    out.packInt8(CommCode.ping);
                    out.send(gameSocket);

                    setInterval(() => {
                        var out = CommOut.getBuffer();
                        out.packInt8(CommCode.chat);
                        out.packString(config.messages[config.messages.length * Math.random() | 0]);
                        out.send(gameSocket);
                        console.log('Sent chat!');
                    }, 5000);

                    setInterval(() => {
                        var out = CommOut.getBuffer();
                        out.packInt8(CommCode.ping);
                        out.send(gameSocket);
                    }, 1e3);
                }, 4000);
                break;
        };
    };

    gameSocket.onclose = () => console.log('Game Socket closed.');
};