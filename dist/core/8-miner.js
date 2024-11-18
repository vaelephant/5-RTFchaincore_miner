"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Miner = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const worker_threads_1 = require("worker_threads");
const _2_blockchain_1 = require("./2-blockchain");
const _6_p2p_1 = require("./6-p2p");
const balanceManager_1 = require("./balanceManager");
const block_1 = require("./block");
const config_json_1 = __importDefault(require("./config.json"));
const transaction_1 = require("./transaction");
const utils_1 = require("./utils");
const serverIP = config_json_1.default.network.serverIP;
const serverPort = config_json_1.default.network.rpcPort;
const serverurl = `http://${serverIP}:${serverPort}`;
const peerconnecturl = `ws://${serverIP}:${config_json_1.default.network.p2pServerPort}`;
const p2pminerport = config_json_1.default.miner.p2pMinerPort;
const mineDifficulty = config_json_1.default.blockchain.difficulty;
const mineInterval = config_json_1.default.blockchain.miningInterval;
const minerwalletAddress = config_json_1.default.wallet.minerAddress;
const hashServerurl = `http://${config_json_1.default.network.hashServerIP}:${config_json_1.default.network.hashServerPort}`;
const cpuUtilization = config_json_1.default.mining.cpuUtilization;
// 添加重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
class Miner {
    constructor(minerAddress, difficulty, blockchain, balanceManager) {
        this.isMining = false;
        this.miningInterval = mineInterval;
        this.newBlock = null;
        this.lastSubmittedBlockHash = null;
        this.minerAddress = minerAddress;
        this.difficulty = difficulty;
        this.blockchain = blockchain;
        this.transactionManager = new transaction_1.TransactionManager(blockchain, balanceManager);
    }
    getLatestBlock() {
        return __awaiter(this, void 0, void 0, function* () {
            let retries = 0;
            while (retries < MAX_RETRIES) {
                try {
                    (0, utils_1.logWithTimestamp)('🔍 Fetching latest block from server...');
                    const response = yield axios_1.default.get(`${serverurl}/latest-block`, {
                        timeout: 10000, // 10秒超时
                        headers: {
                            'Connection': 'keep-alive'
                        }
                    });
                    (0, utils_1.logWithTimestamp)('📦 Successfully fetched latest block');
                    (0, utils_1.logWithTimestamp)(`├── Block Height: #${response.data.index}`);
                    (0, utils_1.logWithTimestamp)(`└── Block Hash: ${response.data.hash}`);
                    return response.data;
                }
                catch (err) {
                    retries++;
                    const isLastRetry = retries === MAX_RETRIES;
                    if (axios_1.default.isAxiosError(err)) {
                        const errorCode = err.code || 'UNKNOWN';
                        const errorMessage = err.message || 'Unknown error';
                        (0, utils_1.logWithTimestamp)(`❌ Network request failed (${retries}/${MAX_RETRIES})`);
                        (0, utils_1.logWithTimestamp)(`├── Error Code: ${errorCode}`);
                        (0, utils_1.logWithTimestamp)(`├── Error Message: ${errorMessage}`);
                        if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
                            (0, utils_1.logWithTimestamp)(`├── Server connection failed`);
                            (0, utils_1.logWithTimestamp)(`├── Target Address: ${serverurl}`);
                        }
                        if (!isLastRetry) {
                            (0, utils_1.logWithTimestamp)(`└── Retrying in ${RETRY_DELAY / 1000} seconds...`);
                            yield this.pause(RETRY_DELAY);
                            continue;
                        }
                    }
                    if (isLastRetry) {
                        (0, utils_1.logWithTimestamp)(`
❌ Unable to connect to server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Suggestions:
├── 1. Check if the server is online (${serverurl})
├── 2. Check network connection
├── 3. Check firewall settings
└── 4. Check if the server port is open
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
                        this.stopMining();
                        throw new Error('Unable to connect to server, mining stopped');
                    }
                }
            }
            throw new Error('Failed to fetch latest block');
        });
    }
    submitBlock(newBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            (0, utils_1.logWithTimestamp)(`📤 Submitting new block to main node: ${JSON.stringify(newBlock)}`);
            try {
                if (!this.isValidBlock(newBlock)) {
                    (0, utils_1.logWithTimestamp)('❌ Found invalid block structure:', newBlock);
                    return;
                }
                if (newBlock.hash === this.lastSubmittedBlockHash) {
                    (0, utils_1.logWithTimestamp)(`⚠️ Block ${newBlock.hash} has already been submitted, skipping duplicate submission.`);
                    return;
                }
                // 1. First, get the latest block height
                const latestBlock = yield this.getLatestBlock();
                const expectedIndex = latestBlock.index + 1;
                // 2. Verify block height
                if (newBlock.index !== expectedIndex) {
                    (0, utils_1.logWithTimestamp)(`⚠️ Block height mismatch, need to resynchronize`);
                    (0, utils_1.logWithTimestamp)(`├── Expected Height: ${expectedIndex}`);
                    (0, utils_1.logWithTimestamp)(`├── Current Height: ${newBlock.index}`);
                    // Resynchronize blockchain
                    yield this.syncBlockchain();
                    return;
                }
                // 3. Submit block, including Miner address
                const response = yield axios_1.default.post(`${serverurl}/submit-block`, {
                    block: newBlock,
                    minerAddress: this.minerAddress
                });
                if (response.status === 200) {
                    const reward = ((_a = response.data.reward) === null || _a === void 0 ? void 0 : _a.amount) || 'pending';
                    (0, utils_1.logWithTimestamp)(`
✨ Block Submitted Successfully ✨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Block Information
├── 📏 Height: #${newBlock.index}
├── 🔗 Hash: ${newBlock.hash}
├── ⏱️  Time: ${new Date(newBlock.timestamp).toLocaleString()}
└── 📝 Transactions: ${newBlock.transactions.length}

💰 Reward Information
├── 👨‍💼 Miner Address: ${this.minerAddress}
└── 💎 Expected Reward: ${reward} RTF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                `);
                    this.lastSubmittedBlockHash = newBlock.hash;
                    (0, _6_p2p_1.broadcast)({
                        type: "NEW_BLOCK" /* MessageType.NEW_BLOCK */,
                        data: {
                            block: newBlock,
                            minerAddress: this.minerAddress
                        }
                    });
                }
                else {
                    (0, utils_1.logWithTimestamp)(`⚠️ Block submission returned non-200 status code: ${response.status}`);
                    yield this.retrySubmit(newBlock);
                }
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error)) {
                    if (((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) === 404) {
                        (0, utils_1.logWithTimestamp)(`⚠️ Block submission failed, need to resynchronize`);
                        yield this.syncBlockchain();
                        return;
                    }
                    (0, utils_1.logWithTimestamp)(`❌ Error occurred during block submission: ${((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || error.message}`);
                }
                else {
                    (0, utils_1.logWithTimestamp)('❌ Unknown error occurred during block submission:', error);
                }
                yield this.retrySubmit(newBlock);
            }
        });
    }
    isValidBlock(block) {
        return (typeof block.index !== 'undefined' &&
            !!block.timestamp &&
            Array.isArray(block.transactions) &&
            !!block.previousHash &&
            block.nonce >= 0 &&
            !!block.hash);
    }
    retrySubmit(newBlock) {
        return __awaiter(this, void 0, void 0, function* () {
            const maxRetries = 3;
            const retryDelay = 3000;
            let retryCount = 0;
            while (retryCount < maxRetries) {
                retryCount++;
                (0, utils_1.logWithTimestamp)(`⏸️ Pausing ${retryDelay / 1000} seconds before retrying (${retryCount}/${maxRetries})...`);
                yield this.pause(retryDelay);
                try {
                    // Re-fetch the latest block height
                    const latestBlock = yield this.getLatestBlock();
                    const expectedIndex = latestBlock.index + 1;
                    if (newBlock.index < expectedIndex) {
                        (0, utils_1.logWithTimestamp)('⚠️ Block is expired, stopping retry');
                        return;
                    }
                    yield this.submitBlock(newBlock);
                    return;
                }
                catch (error) {
                    if (retryCount === maxRetries) {
                        (0, utils_1.logWithTimestamp)('❌ Reached maximum retry attempts, stopping retry');
                        return;
                    }
                }
            }
        });
    }
    handleSubmitError(error, newBlock) {
        const axiosError = error;
        if (axiosError.response) {
            (0, utils_1.logWithTimestamp)(`❌ Error occurred during submission, server returned status code: ${axiosError.response.status}, response content: ${JSON.stringify(axiosError.response.data)}`);
        }
        else {
            (0, utils_1.logWithTimestamp)('❌ Unknown error occurred during submission:', error.message);
        }
        this.retrySubmit(newBlock);
    }
    startMining() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isMining = true;
            (0, utils_1.logWithTimestamp)(`🚀 Miner ${this.minerAddress} started mining with difficulty ${this.difficulty}...`);
            const cpuCount = os_1.default.cpus().length;
            (0, utils_1.logWithTimestamp)(`🖥️  Detected ${cpuCount} CPU cores, preparing to start ${cpuCount} mining threads...`);
            while (this.isMining) {
                try {
                    yield this.syncBlockchain();
                    let transactions = this.blockchain.getPendingTransactions();
                    (0, utils_1.logWithTimestamp)(`🧾 Pending transactions in transaction pool: ${transactions}`);
                    const latestBlock = yield this.getLatestBlock();
                    (0, utils_1.logWithTimestamp)(`📏 Current chain's latest block height: ${latestBlock.index}`);
                    this.newBlock = new block_1.Block(latestBlock.index + 1, new Date().toISOString(), transactions, latestBlock.hash);
                    (0, utils_1.logWithTimestamp)('⛏️ Starting to mine new block...');
                    const minedBlocks = yield this.mineWithWorkers(Math.ceil(cpuCount * cpuUtilization), this.difficulty);
                    for (const minedBlock of minedBlocks) {
                        (0, utils_1.logWithTimestamp)(`💎 Block mined! Hash: ${minedBlock.hash}`);
                        yield this.submitBlock(minedBlock);
                    }
                    this.blockchain.pendingTransactions = [];
                    yield this.pause(this.miningInterval);
                }
                catch (err) {
                    const error = err;
                    (0, utils_1.logWithTimestamp)(`
⚠️ Mining Error Occurred
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── ❌ Error Type: ${error instanceof Error ? error.name : 'Unknown'}
├── 📝 Message: ${error instanceof Error ? error.message : 'Unknown error'}
└── 🔄 Retrying in 5 seconds...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
                    yield this.pause(5000);
                    // Try reconnecting
                    try {
                        yield this.getLatestBlock();
                        (0, utils_1.logWithTimestamp)('✅ Reconnected successfully, resuming mining...');
                        continue;
                    }
                    catch (reconnectErr) {
                        const reconnectError = reconnectErr;
                        (0, utils_1.logWithTimestamp)(`❌ Reconnection failed: ${reconnectError instanceof Error ? reconnectError.message : 'Unknown error'}`);
                        this.stopMining();
                    }
                }
            }
        });
    }
    mineWithWorkers(workerCount, difficulty) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [];
            let totalHashRate = 0;
            const startTime = Date.now();
            for (let i = 0; i < workerCount; i++) {
                promises.push(this.mineWithWorker(difficulty));
            }
            const results = yield Promise.all(promises);
            const endTime = Date.now();
            const totalTime = (endTime - startTime) / 1000;
            results.forEach((result, index) => {
                const { stats } = result;
                (0, utils_1.logWithTimestamp)(`├── Thread ${index + 1} Hashrate: ${stats.hashRate.toFixed(2)} H/s`);
                (0, utils_1.logWithTimestamp)(`│   ├── Attempts: ${stats.attempt}`);
                (0, utils_1.logWithTimestamp)(`│   └── Time: ${stats.elapsedTime.toFixed(2)} seconds`);
                totalHashRate += stats.hashRate;
            });
            (0, utils_1.logWithTimestamp)(`└── Total Hashrate: ${totalHashRate.toFixed(2)} H/s`);
            (0, utils_1.logWithTimestamp)(`    ├── Total Time: ${totalTime.toFixed(2)} seconds`);
            (0, utils_1.logWithTimestamp)(`    └── Average per Thread: ${(totalHashRate / workerCount).toFixed(2)} H/s`);
            yield this.submitHashRate(totalHashRate);
            return results.map(result => result.block);
        });
    }
    mineWithWorker(difficulty) {
        return new Promise((resolve, reject) => {
            const worker = new worker_threads_1.Worker('./minerWorker.ts', {
                workerData: { newBlock: this.newBlock, difficulty }
            });
            worker.on('message', (result) => {
                const { block, stats } = result;
                resolve({ block, stats });
            });
            worker.on('error', (error) => {
                reject(error);
            });
            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
            });
        });
    }
    submitHashRate(hashRate) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const hashRateResponse = yield axios_1.default.post(`${hashServerurl}/submit-hashrate`, {
                    minerAddress: this.minerAddress,
                    hashRate: hashRate,
                    timestamp: new Date().toISOString()
                });
                if (hashRateResponse.status === 200) {
                    (0, utils_1.logWithTimestamp)(`✅ Hashrate submitted successfully: ${hashRate.toFixed(2)} H/s`);
                    (0, utils_1.logWithTimestamp)(`├── Miner Address: ${this.minerAddress}`);
                    (0, utils_1.logWithTimestamp)(`└── Timestamp: ${new Date().toISOString()}`);
                }
                else {
                    (0, utils_1.logWithTimestamp)(`⚠️ Hashrate submission returned abnormal status: ${hashRateResponse.status}`);
                }
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error)) {
                    if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                        (0, utils_1.logWithTimestamp)('⚠️ Hashrate server not responding, will retry in the next round');
                    }
                    else {
                        (0, utils_1.logWithTimestamp)(`❌ Hashrate submission failed: ${error.message}`);
                    }
                }
                else {
                    (0, utils_1.logWithTimestamp)('❌ Unknown error occurred during hashrate submission:', error);
                }
            }
        });
    }
    syncBlockchain() {
        return __awaiter(this, void 0, void 0, function* () {
            (0, utils_1.logWithTimestamp)(`
🔄 Starting Blockchain Synchronization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            try {
                const localHeight = this.blockchain.chain.length;
                (0, utils_1.logWithTimestamp)(`├── 📊 Local Block Height: #${localHeight}`);
                (0, utils_1.logWithTimestamp)('├── 🌐 Fetching blockchain data from server...');
                const response = yield axios_1.default.get(`${serverurl}/blockchain`);
                const blockchainData = response.data;
                const remoteHeight = blockchainData.chain.length;
                const heightDiff = remoteHeight - localHeight;
                (0, utils_1.logWithTimestamp)(`├── 📈 Server Block Height: #${remoteHeight}`);
                (0, utils_1.logWithTimestamp)(`├── ${heightDiff > 0 ? '⚠️' : '✅'} Height Difference: ${heightDiff}`);
                const dir = path_1.default.join(__dirname, './chaindata/');
                if (!fs_1.default.existsSync(dir)) {
                    fs_1.default.mkdirSync(dir, { recursive: true });
                    (0, utils_1.logWithTimestamp)('├── 📁 Created data directory: chaindata/');
                }
                (0, utils_1.logWithTimestamp)('├── 💾 Saving blockchain data...');
                fs_1.default.writeFileSync(path_1.default.join(dir, 'blockchain.json'), JSON.stringify(blockchainData, null, 2));
                this.blockchain.chain = blockchainData.chain;
                const latestBlock = this.blockchain.getLatestBlock();
                (0, utils_1.logWithTimestamp)(`
✅ Blockchain Sync Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── 📊 Current Height: #${remoteHeight}
├── 🔗 Latest Block: ${latestBlock.hash}
├── ⏱️  Block Time: ${new Date(latestBlock.timestamp).toLocaleString()}
├── 📝 Transactions: ${latestBlock.transactions.length}
└── 💾 Data saved to: chaindata/blockchain.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            }
            catch (err) {
                const error = err;
                (0, utils_1.logWithTimestamp)(`
❌ Blockchain Sync Failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── 📝 Error: ${error instanceof Error ? error.message : 'Unknown error'}
├── 🔧 Possible causes:
│   ├── 1. Network connection unstable
│   ├── 2. Server not responding
│   └── 3. Data format error
└── 💡 Suggestion: Please check network connection and retry
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                throw error;
            }
        });
    }
    stopMining() {
        this.isMining = false;
        (0, utils_1.logWithTimestamp)(`
⛔ Mining Stopped
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── 📍 Miner Address: ${this.minerAddress}
├── ⏱️  Stop Time: ${new Date().toLocaleString()}
└── 💡 Use startMining() to resume mining
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }
    pause(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.Miner = Miner;
// Main program start
const blockchain = new _2_blockchain_1.Blockchain();
const balanceManager = new balanceManager_1.BalanceManager();
(0, _6_p2p_1.initP2PServer)(p2pminerport, blockchain);
const miner = new Miner(minerwalletAddress, mineDifficulty, blockchain, balanceManager);
miner.startMining();
(0, _6_p2p_1.connectToPeer)(peerconnecturl, blockchain);
// Print startup configuration information
(0, utils_1.logWithTimestamp)(`
🌟 RTF Chain Miner Started 🌟
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Basic Configuration
├── 💻 Miner Address: ${minerwalletAddress}
├── 🔧 Mining Difficulty: ${mineDifficulty}
├── ⏳ Mining Interval: ${mineInterval} ms
├── 🎯 CPU Utilization: ${cpuUtilization * 100}%
└── 💪 CPU Cores: ${os_1.default.cpus().length}

🌐 Network Configuration
├── 📡 RPC Server: ${serverurl}
├── 🔗 P2P Server: ${peerconnecturl}
├── 📊 Hashrate Server: ${hashServerurl}
└── 🚪 Local P2P Port: ${p2pminerport}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
