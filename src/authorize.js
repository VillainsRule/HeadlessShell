import axios from 'axios';
import ws from 'ws';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

import config from '#config';

export default () => new Promise(async (resolve) => {
    let appConfig = {
        apiKey: 'AIzaSyDP4SIjKaw6A4c-zvfYxICpbEjn1rRnN50',
        authDomain: 'shellshockio-181719.firebaseapp.com',
        databaseURL: 'https://shellshockio-181719.firebaseio.com',
        projectId: 'shellshockio-181719',
        storageBucket: 'shellshockio-181719.appspot.com',
        messagingSenderId: '68327206324'
    };

    let liveApp = initializeApp(appConfig);
    let app = getAuth(liveApp);

    onAuthStateChanged(app, async (user) => {
        if (!user) return;

        const sessionID = new ws('wss://math.international/services/');

        sessionID.onmessage = (msg) => {
            let data = JSON.parse(msg.data);
            if (data.sessionId) resolve({
                session: data.sessionId,
                firebase: data.firebaseId,
                sessionInt: data.session
            });
            else console.log('Auth Error', data);
        };

        sessionID.onopen = async () => {
            await new Promise(r => setTimeout(r, Math.floor(Math.random() * (5000 + 1) + 1000)));

            sessionID.send(JSON.stringify({
                cmd: 'auth',
                firebaseToken: user.accessToken
            }));
        };
    });

    let account;

    try {
        account = await axios.post('https://shellprint.villainsrule.xyz/v3/account?key=' + config.shellprintKey + Math.random().toString(32).slice(2));
    } catch (err) {
        console.log(err);
        console.log('ShellPrint is down. The bots cannot run.');
        process.exit(0);
    };

    if (account.data.error) {
        console.log(account.data);
        console.log('ShellPrint threw an error. The bots cannot run.');
        process.exit(0);
    };

    await signInWithEmailAndPassword(app, account.data.email, account.data.password);
});