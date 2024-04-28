import WebSocket from 'ws';

export default (auth) => new Promise((resolve) => {
    let matchmaker = new WebSocket('wss://math.international/matchmaker/', {
        headers: {
            'user-agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'accept-language': 'en-US,en;q=0.9'
        }
    });

    matchmaker.onopen = () => matchmaker.send(JSON.stringify({ command: 'regionList' }));

    let mode = Math.floor(Math.random() * 4);

    matchmaker.onmessage = (msg) => {
        msg = JSON.parse(msg.data);

        if (msg.command === 'regionList') matchmaker.send(JSON.stringify({
            command: 'findGame',
            region: 'useast',
            playType: 0,
            gameType: mode,
            sessionId: auth.session
        }));

        if (msg.command === 'gameFound') resolve({
            ...msg,
            mode
        });
    };

    matchmaker.onclose = () => console.log('Matchmaker closed.');
});