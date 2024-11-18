import axios, { AxiosError } from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Worker } from 'worker_threads';

import { Blockchain } from './2-blockchain';
import {
  broadcast,
  connectToPeer,
  initP2PServer,
  MessageType,
} from './6-p2p';
import { BalanceManager } from './balanceManager';
import { Block } from './block';
import config from './config.json';
import { TransactionManager } from './transaction';
import { logWithTimestamp } from './utils';

const serverIP = config.network.serverIP;
const serverPort = config.network.rpcPort;
const serverurl = `http://${serverIP}:${serverPort}`;
const peerconnecturl = `ws://${serverIP}:${config.network.p2pServerPort}`;
const p2pminerport = config.miner.p2pMinerPort;
const mineDifficulty = config.blockchain.difficulty;
const mineInterval = config.blockchain.miningInterval;
const minerwalletAddress = config.wallet.minerAddress;
const hashServerurl = `http://${config.network.hashServerIP}:${config.network.hashServerPort}`;
const cpuUtilization = config.mining.cpuUtilization;

// 添加重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

export class Miner {
    minerAddress: string;
    blockchain: Blockchain;
    transactionManager: TransactionManager;
    isMining: boolean = false;
    miningInterval: number = mineInterval;
    newBlock: Block | null = null;
    lastSubmittedBlockHash: string | null = null;
    difficulty: number;

    constructor(minerAddress: string, difficulty: number, blockchain: Blockchain, balanceManager: BalanceManager) {
        this.minerAddress = minerAddress;
        this.difficulty = difficulty;
        this.blockchain = blockchain;
        this.transactionManager = new TransactionManager(blockchain, balanceManager);
    }

    async getLatestBlock() {
        let retries = 0;
        while (retries < MAX_RETRIES) {
            try {
                logWithTimestamp('🔍 Fetching latest block from server...');
                const response = await axios.get(`${serverurl}/latest-block`, {
                    timeout: 10000,  // 10秒超时
                    headers: {
                        'Connection': 'keep-alive'
                    }
                });
                
                logWithTimestamp('📦 Successfully fetched latest block');
                logWithTimestamp(`├── Block Height: #${response.data.index}`);
                logWithTimestamp(`└── Block Hash: ${response.data.hash}`);
                
                return response.data;
            } catch (err: unknown) {
                retries++;
                const isLastRetry = retries === MAX_RETRIES;
                
                if (axios.isAxiosError(err)) {
                    const errorCode = err.code || 'UNKNOWN';
                    const errorMessage = err.message || 'Unknown error';
                    
                    logWithTimestamp(`❌ Network request failed (${retries}/${MAX_RETRIES})`);
                    logWithTimestamp(`├── Error Code: ${errorCode}`);
                    logWithTimestamp(`├── Error Message: ${errorMessage}`);
                    
                    if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
                        logWithTimestamp(`├── Server connection failed`);
                        logWithTimestamp(`├── Target Address: ${serverurl}`);
                    }
                    
                    if (!isLastRetry) {
                        logWithTimestamp(`└── Retrying in ${RETRY_DELAY/1000} seconds...`);
                        await this.pause(RETRY_DELAY);
                        continue;
                    }
                }
                
                if (isLastRetry) {
                    logWithTimestamp(`
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
    }

    async submitBlock(newBlock: Block) {
        logWithTimestamp(`📤 Submitting new block to main node: ${JSON.stringify(newBlock)}`);
        try {
            if (!this.isValidBlock(newBlock)) {
                logWithTimestamp('❌ Found invalid block structure:', newBlock);
                return;
            }
            if (newBlock.hash === this.lastSubmittedBlockHash) {
                logWithTimestamp(`⚠️ Block ${newBlock.hash} has already been submitted, skipping duplicate submission.`);
                return;
            }

            // 1. First, get the latest block height
            const latestBlock = await this.getLatestBlock();
            const expectedIndex = latestBlock.index + 1;

            // 2. Verify block height
            if (newBlock.index !== expectedIndex) {
                logWithTimestamp(`⚠️ Block height mismatch, need to resynchronize`);
                logWithTimestamp(`├── Expected Height: ${expectedIndex}`);
                logWithTimestamp(`├── Current Height: ${newBlock.index}`);
                
                // Resynchronize blockchain
                await this.syncBlockchain();
                return;
            }

            // 3. Submit block, including Miner address
            const response = await axios.post(`${serverurl}/submit-block`, {
                block: newBlock,
                minerAddress: this.minerAddress
            });

            if (response.status === 200) {
                const reward = response.data.reward?.amount || 'pending';
                logWithTimestamp(`
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
                broadcast({ 
                    type: MessageType.NEW_BLOCK, 
                    data: {
                        block: newBlock,
                        minerAddress: this.minerAddress
                    }
                });
            } else {
                logWithTimestamp(`⚠️ Block submission returned non-200 status code: ${response.status}`);
                await this.retrySubmit(newBlock);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    logWithTimestamp(`⚠️ Block submission failed, need to resynchronize`);
                    await this.syncBlockchain();
                    return;
                }
                logWithTimestamp(`❌ Error occurred during block submission: ${error.response?.data?.message || error.message}`);
            } else {
                logWithTimestamp('❌ Unknown error occurred during block submission:', error);
            }
            await this.retrySubmit(newBlock);
        }
    }

    isValidBlock(block: Block): boolean {
        return (
            typeof block.index !== 'undefined' &&
            !!block.timestamp &&
            Array.isArray(block.transactions) &&
            !!block.previousHash &&
            block.nonce >= 0 &&
            !!block.hash
        );
    }

    async retrySubmit(newBlock: Block) {
        const maxRetries = 3;
        const retryDelay = 3000;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            retryCount++;
            logWithTimestamp(`⏸️ Pausing ${retryDelay/1000} seconds before retrying (${retryCount}/${maxRetries})...`);
            await this.pause(retryDelay);

            try {
                // Re-fetch the latest block height
                const latestBlock = await this.getLatestBlock();
                const expectedIndex = latestBlock.index + 1;

                if (newBlock.index < expectedIndex) {
                    logWithTimestamp('⚠️ Block is expired, stopping retry');
                    return;
                }

                await this.submitBlock(newBlock);
                return;
            } catch (error) {
                if (retryCount === maxRetries) {
                    logWithTimestamp('❌ Reached maximum retry attempts, stopping retry');
                    return;
                }
            }
        }
    }

    handleSubmitError(error: unknown, newBlock: Block) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            logWithTimestamp(`❌ Error occurred during submission, server returned status code: ${axiosError.response.status}, response content: ${JSON.stringify(axiosError.response.data)}`);
        } else {
            logWithTimestamp('❌ Unknown error occurred during submission:', (error as Error).message);
        }
        this.retrySubmit(newBlock);
    }

    async startMining() {
        this.isMining = true;
        logWithTimestamp(`🚀 Miner ${this.minerAddress} started mining with difficulty ${this.difficulty}...`);

        const cpuCount = os.cpus().length;
        logWithTimestamp(`🖥️  Detected ${cpuCount} CPU cores, preparing to start ${cpuCount} mining threads...`);

        while (this.isMining) {
            try {
                await this.syncBlockchain();
                let transactions = this.blockchain.getPendingTransactions();
                logWithTimestamp(`🧾 Pending transactions in transaction pool: ${transactions}`);

                const latestBlock = await this.getLatestBlock();
                logWithTimestamp(`📏 Current chain's latest block height: ${latestBlock.index}`);
                this.newBlock = new Block(
                    latestBlock.index + 1,
                    new Date().toISOString(),
                    transactions,
                    latestBlock.hash
                );
                logWithTimestamp('⛏️ Starting to mine new block...');

                const minedBlocks = await this.mineWithWorkers(Math.ceil(cpuCount * cpuUtilization), this.difficulty);
                for (const minedBlock of minedBlocks) {
                    logWithTimestamp(`💎 Block mined! Hash: ${minedBlock.hash}`);
                    await this.submitBlock(minedBlock);
                }

                this.blockchain.pendingTransactions = [];
                await this.pause(this.miningInterval);
            } catch (err: unknown) {
                const error = err as Error;
                
                logWithTimestamp(`
⚠️ Mining Error Occurred
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── ❌ Error Type: ${error instanceof Error ? error.name : 'Unknown'}
├── 📝 Message: ${error instanceof Error ? error.message : 'Unknown error'}
└── 🔄 Retrying in 5 seconds...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
                await this.pause(5000);
                
                // Try reconnecting
                try {
                    await this.getLatestBlock();
                    logWithTimestamp('✅ Reconnected successfully, resuming mining...');
                    continue;
                } catch (reconnectErr) {
                    const reconnectError = reconnectErr as Error;
                    logWithTimestamp(`❌ Reconnection failed: ${reconnectError instanceof Error ? reconnectError.message : 'Unknown error'}`);
                    this.stopMining();
                }
            }
        }
    }

    private async mineWithWorkers(workerCount: number, difficulty: number): Promise<any[]> {
        const promises = [];
        let totalHashRate = 0;
        const startTime = Date.now();

        for (let i = 0; i < workerCount; i++) {
            promises.push(this.mineWithWorker(difficulty));
        }

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;

        results.forEach((result, index) => {
            const { stats } = result;
            logWithTimestamp(`├── Thread ${index + 1} Hashrate: ${stats.hashRate.toFixed(2)} H/s`);
            logWithTimestamp(`│   ├── Attempts: ${stats.attempt}`);
            logWithTimestamp(`│   └── Time: ${stats.elapsedTime.toFixed(2)} seconds`);
            totalHashRate += stats.hashRate;
        });

        logWithTimestamp(`└── Total Hashrate: ${totalHashRate.toFixed(2)} H/s`);
        logWithTimestamp(`    ├── Total Time: ${totalTime.toFixed(2)} seconds`);
        logWithTimestamp(`    └── Average per Thread: ${(totalHashRate / workerCount).toFixed(2)} H/s`);

        await this.submitHashRate(totalHashRate);

        return results.map(result => result.block);
    }

    private mineWithWorker(difficulty: number): Promise<any> {
        return new Promise((resolve, reject) => {
            const worker = new Worker('./minerWorker.ts', {
                workerData: { newBlock: this.newBlock, difficulty }
            });

            worker.on('message', (result: any) => {
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

    private async submitHashRate(hashRate: number) {
        try {
            const hashRateResponse = await axios.post(`${hashServerurl}/submit-hashrate`, {
                minerAddress: this.minerAddress,
                hashRate: hashRate,
                timestamp: new Date().toISOString()
            });

            if (hashRateResponse.status === 200) {
                logWithTimestamp(`✅ Hashrate submitted successfully: ${hashRate.toFixed(2)} H/s`);
                logWithTimestamp(`├── Miner Address: ${this.minerAddress}`);
                logWithTimestamp(`└── Timestamp: ${new Date().toISOString()}`);
            } else {
                logWithTimestamp(`⚠️ Hashrate submission returned abnormal status: ${hashRateResponse.status}`);
            }

        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    logWithTimestamp('⚠️ Hashrate server not responding, will retry in the next round');
                } else {
                    logWithTimestamp(`❌ Hashrate submission failed: ${error.message}`);
                }
            } else {
                logWithTimestamp('❌ Unknown error occurred during hashrate submission:', error);
            }
        }
    }

    async syncBlockchain() {
        logWithTimestamp(`
🔄 Starting Blockchain Synchronization
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        try {
            const localHeight = this.blockchain.chain.length;
            logWithTimestamp(`├── 📊 Local Block Height: #${localHeight}`);

            logWithTimestamp('├── 🌐 Fetching blockchain data from server...');
            const response = await axios.get(`${serverurl}/blockchain`);
            const blockchainData = response.data;
            const remoteHeight = blockchainData.chain.length;

            const heightDiff = remoteHeight - localHeight;
            logWithTimestamp(`├── 📈 Server Block Height: #${remoteHeight}`);
            logWithTimestamp(`├── ${heightDiff > 0 ? '⚠️' : '✅'} Height Difference: ${heightDiff}`);

            const dir = path.join(__dirname, './chaindata/');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logWithTimestamp('├── 📁 Created data directory: chaindata/');
            }

            logWithTimestamp('├── 💾 Saving blockchain data...');
            fs.writeFileSync(
                path.join(dir, 'blockchain.json'), 
                JSON.stringify(blockchainData, null, 2)
            );

            this.blockchain.chain = blockchainData.chain;
            const latestBlock = this.blockchain.getLatestBlock();
            
            logWithTimestamp(`
✅ Blockchain Sync Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── 📊 Current Height: #${remoteHeight}
├── 🔗 Latest Block: ${latestBlock.hash}
├── ⏱️  Block Time: ${new Date(latestBlock.timestamp).toLocaleString()}
├── 📝 Transactions: ${latestBlock.transactions.length}
└── 💾 Data saved to: chaindata/blockchain.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        } catch (err: unknown) {
            const error = err as Error;
            logWithTimestamp(`
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
    }

    stopMining(): void {
        this.isMining = false;
        logWithTimestamp(`
⛔ Mining Stopped
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
├── 📍 Miner Address: ${this.minerAddress}
├── ⏱️  Stop Time: ${new Date().toLocaleString()}
└── 💡 Use startMining() to resume mining
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    }

    pause(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}


// Main program start



const blockchain = new Blockchain();
const balanceManager = new BalanceManager();

initP2PServer(p2pminerport, blockchain);

const miner = new Miner(minerwalletAddress, mineDifficulty, blockchain, balanceManager);
miner.startMining();

connectToPeer(peerconnecturl, blockchain);

// Print startup configuration information
logWithTimestamp(`
🌟 RTF Chain Miner Started 🌟
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Basic Configuration
├── 💻 Miner Address: ${minerwalletAddress}
├── 🔧 Mining Difficulty: ${mineDifficulty}
├── ⏳ Mining Interval: ${mineInterval} ms
├── 🎯 CPU Utilization: ${cpuUtilization * 100}%
└── 💪 CPU Cores: ${os.cpus().length}

🌐 Network Configuration
├── 📡 RPC Server: ${serverurl}
├── 🔗 P2P Server: ${peerconnecturl}
├── 📊 Hashrate Server: ${hashServerurl}
└── 🚪 Local P2P Port: ${p2pminerport}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
