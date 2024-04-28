import authorize from './authorize.js';
import getPrivateGame from './getPrivateGame.js';
import findGame from './findGame.js';
import join from './join.js';

import config from '#config';

const run = async () => {
    let authData = await authorize();
    let gameData = !!config.privateCode ? await getPrivateGame(authData) : await findGame(authData);
    join(authData, gameData);
};

new Array(config.botCount || 1).fill(true).forEach(async () => {
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * (config.botCount * 2000 - 1000 + 1) + 1000)));
    run();
});