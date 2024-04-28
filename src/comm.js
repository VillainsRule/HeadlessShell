export class Pool {
    constructor(constructorFn, size) {
        this.size = 0;
        this.originalSize = size;
        this.constructorFn = constructorFn;
        this.objects = [];
        this.idx = 0;
        this.numActive = 0;
        this.expand(size);
    };

    expand(num) {
        for (var i2 = 0; i2 < num; i2++) {
            var obj = this.constructorFn();
            obj.id = i2 + this.size;
            obj.active = false;
            this.objects.push(obj);
        };
        this.size += num;
    };

    retrieve(id) {
        if (id != void 0) {
            while (id >= this.size) this.expand(this.originalSize);
            this.numActive++;
            this.objects[id].active = true;
            return this.objects[id];
        };

        var i2 = this.idx;
        do {
            i2 = (i2 + 1) % this.size;
            var obj = this.objects[i2];
            if (!obj.active) {
                this.idx = i2;
                this.numActive++;
                obj.active = true;
                return obj;
            };
        } while (i2 != this.idx);

        this.expand(this.originalSize);
        console.log('Expanding pool for: ' + this.objects[0].constructor.name + ' to: ' + this.size);
        return this.retrieve();
    };

    recycle(obj) {
        obj.active = false;
        this.numActive--;
    };

    forEachActive(fn) {
        for (var i2 = 0; i2 < this.size; i2++) {
            var obj = this.objects[i2];
            if (obj.active === true) fn(obj, i2);
        };
    };
};

export class OutBuffer {
    constructor(size) {
        this.idx = 0;
        this.arrayBuffer = new ArrayBuffer(size);
        this.buffer = new Uint8Array(this.arrayBuffer, 0, size);
    };

    send(ws2) {
        var b2 = new Uint8Array(this.arrayBuffer, 0, this.idx);
        ws2.send(b2);
        CommOut.bufferPool.recycle(this);
    };

    packInt8(val) {
        this.buffer[this.idx] = val & 255;
        this.idx++;
    };

    packInt16(val) {
        this.buffer[this.idx] = val & 255;
        this.buffer[this.idx + 1] = val >> 8 & 255;
        this.idx += 2;
    };

    packInt24(val) {
        this.buffer[this.idx] = val & 255;
        this.buffer[this.idx + 1] = val >> 8 & 255;
        this.buffer[this.idx + 2] = val >> 16 & 255;
        this.idx += 3;
    };

    packInt32(val) {
        this.buffer[this.idx] = val & 255;
        this.buffer[this.idx + 1] = val >> 8 & 255;
        this.buffer[this.idx + 2] = val >> 16 & 255;
        this.buffer[this.idx + 3] = val >> 24 & 255;
        this.idx += 4;
    };

    packRadU = (val) => this.packInt24(val * 2097152);
    packRad = (val) => this.packInt16((val + Math.PI) * 8192);
    packFloat = (val) => this.packInt16(val * 256);
    packDouble = (val) => this.packInt32(val * 1048576);

    packString(str) {
        if (typeof str !== 'string') str = '';
        this.packInt8(str.length);
        for (var i2 = 0; i2 < str.length; i2++) this.packInt16(str.charCodeAt(i2));
    };

    packLongString(str) {
        if (typeof str !== 'string') str = '';
        this.packInt16(str.length);
        for (var i2 = 0; i2 < str.length; i2++) this.packInt16(str.charCodeAt(i2));
    };
};

export class CommOut {
    static buffer = null;
    static bufferPool = new Pool(() => new OutBuffer(16384), 2);

    static getBuffer() {
        var b2 = this.bufferPool.retrieve();
        b2.idx = 0;
        return b2;
    };
};

export class CommIn {
    static buffer;
    static idx;
    static init(buf) {
        this.buffer = new Uint8Array(buf);
        this.idx = 0;
    };

    static isMoreDataAvailable = () => Math.max(0, this.buffer.length - this.idx);
    static peekInt8U = () => this.buffer[this.idx];

    static unPackInt8U() {
        var i2 = this.idx;
        this.idx++;
        return this.buffer[i2];
    };

    static unPackInt8() {
        var v = this.unPackInt8U();
        return (v + 128) % 256 - 128;
    };

    static unPackInt16U() {
        var i2 = this.idx;
        this.idx += 2;
        return this.buffer[i2] + this.buffer[i2 + 1] * 256;
    };

    static unPackInt24U() {
        var i2 = this.idx;
        this.idx += 3;
        return this.buffer[i2] + this.buffer[i2 + 1] * 256 + this.buffer[i2 + 2] * 65536;
    };

    static unPackInt32U() {
        var i2 = this.idx;
        this.idx += 4;
        return this.buffer[i2] + this.buffer[i2 + 1] * 256 + this.buffer[i2 + 2] * 65536 + this.buffer[i2 + 3] * 16777216;
    };

    static unPackInt16() {
        var v = this.unPackInt16U();
        return (v + 32768) % 65536 - 32768;
    };

    static unPackInt32() {
        var v = this.unPackInt32U();
        return (v + 2147483648) % 4294967296 - 2147483648;
    };

    // Unsigned radians (0 to 6.2831)
    static unPackRadU = () => this.unPackInt24U() / 2097152;

    // Signed radians (-3.1416 to 3.1416)
    static unPackRad() {
        var v = this.unPackInt16U() / 8192;
        return v - Math.PI;
    };

    // Float value packing (-327.68 to 327.67)
    static unPackFloat = () => this.unPackInt16() / 256;
    static unPackDouble = () => this.unPackInt32() / 1048576;

    static unPackString(maxLen) {
        maxLen = maxLen || 255;
        var len = Math.min(this.unPackInt8U(), maxLen);
        return this.unPackStringHelper(len);
    };

    static unPackLongString(maxLen) {
        maxLen = maxLen || 16383;
        var len = Math.min(this.unPackInt16U(), maxLen);
        return this.unPackStringHelper(len);
    };

    static unPackStringHelper(len) {
        let remainder = this.isMoreDataAvailable();
        if (remainder < len) return 0;
        var str = new String();
        for (var i2 = 0; i2 < len; i2++) {
            var c = this.unPackInt16U();
            if (c > 0) str += String.fromCodePoint(c);
        };
        return str;
    };
};

export const CommCode = {
    'announcement': 10,
    'updateBalance': 11,
    'reload': 12,
    'respawn': 13,
    'respawnDenied': 14,
    'swapWeapon': 15,
    'joinGame': 16,
    'refreshGameState': 17,
    'spawnItem': 18,
    'observeGame': 19,
    'ping': 20,
    'pong': 21,
    'clientReady': 22,
    'requestRespawn': 23,
    'joinPublicGame': 24,
    'joinPrivateGame': 25,
    'switchTeamFail': 26,
    'expireUpgrade': 27,
    'bootPlayer': 28,
    'banPlayer': 29,
    'loginRequired': 30,
    'gameLocked': 31,
    'reportPlayer': 32,
    'banned': 33,
    'createPrivateGame': 34,
    'switchTeam': 35,
    'changeCharacter': 36,
    'pause': 37,
    'metaGameState': 38,
    'syncMe': 39,
    'explode': 40,
    'keepAlive': 41,
    'musicInfo': 42,
    'hitMeHardBoiled': 43,
    'playerInfo': 44,
    'gameOptions': 45,
    'gameAction': 46,
    'requestGameOptions': 47,
    'gameJoined': 48,
    'socketReady': 49,
    'addPlayer': 50,
    'removePlayer': 51,
    'chat': 52,
    'syncThem': 53,
    'syncAmmo': 54,
    'die': 55,
    'beginShellStreak': 56,
    'endShellStreak': 57,
    'startReload': 58,
    'fire': 59,
    'melee': 60,
    'throwGrenade': 61,
    'info': 62,
    'eventModifier': 63,
    'hitThem': 64,
    'hitMe': 65,
    'collectItem': 66
};