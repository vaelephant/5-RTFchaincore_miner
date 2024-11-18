"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Blockchain = void 0;
const block_1 = require("./block"); // 引入 Block 类
const transaction_1 = require("./transaction"); // 引入 Transaction 接口和 TransactionManager 类
const fs = __importStar(require("fs")); // 引入文件系统模块
const path = __importStar(require("path")); // 引入路径模块
const utils_1 = require("./utils"); // 引入日志输出函数
const balanceManager_1 = require("./balanceManager");
const config_json_1 = __importDefault(require("./config.json"));
const mineDifficulty = config_json_1.default.blockchain.difficulty; // 从 config.json 中读取挖矿难度
const mineInterval = config_json_1.default.blockchain.miningInterval; // 从 config.json 中读取挖矿间隔时间
const minereward = config_json_1.default.reward.minerReward; // 从 config.json 中读取挖矿奖励
const minerRewardAddress = config_json_1.default.reward.rewardAddress; // 从 config.json 中读取挖矿奖励地址
class Blockchain {
    constructor() {
        this.chainFilePath = path.join(__dirname, 'chaindata/blockchain.json'); // 区块链文件存储路径
        this.chain = []; // 存储区块链的数组
        this.pendingTransactions = []; // 存储待处理交易的数组
        this.difficulty = mineDifficulty; // 挖矿难度
        this.reward = minereward; // 挖矿奖励
        this.balanceManager = new balanceManager_1.BalanceManager(); // 初始化 BalanceManager
        this.transactionManager = new transaction_1.TransactionManager(this, this.balanceManager); // 初始化 TransactionManager
        this.loadBlockchainFromFile(); // 在构造函数中加载区块链数
        (0, utils_1.logWithTimestamp)('blocakchain----区块链初始化完成，当前区块链长度:', this.chain.length); // 输出当前区块链长度
    }
    // 创建创世区块
    createGenesisBlock() {
        const genesisBlock = new block_1.Block(0, new Date().toISOString(), [], '0'); // 创建创世区块
        this.chain.push(genesisBlock); // 将创世区块添加到链中
        this.saveBlockchainToFile(); // 保存创世区块
        (0, utils_1.logWithTimestamp)('创世区块已创建'); // 输出创世区块创建信息
    }
    // 添加区块到区块链
    addBlock(newBlock) {
        var _a;
        newBlock.previousHash = ((_a = this.getLatestBlock()) === null || _a === void 0 ? void 0 : _a.hash) || '0'; // 使用最新区块的哈希
        newBlock.mineBlock(this.difficulty); // 挖矿新块
        this.chain.push(newBlock); // 将新块添加到链中
        //更新交易文件，
        for (const transaction of newBlock.transactions) {
            this.balanceManager.updateBalance(transaction); // 更新余额
            (0, utils_1.logWithTimestamp)(`区块 ${newBlock.index} 已添加，当前区块链长度: ${this.chain.length}`); // 输出添加的区块信息
        }
        //更新链文件
        this.saveBlockchainToFile(); // 保存区块链到文件
    }
    // 获取最新的区块
    getLatestBlock() {
        if (this.chain.length === 0) {
            (0, utils_1.logWithTimestamp)('getLatestBlock---区块链为空，无法获取最新区块。');
            // return null; // 如果链为空，返回 null
        }
        const latestBlock = this.chain[this.chain.length - 1]; // 获取最后一个区块
        (0, utils_1.logWithTimestamp)(`最新区块信息: ${JSON.stringify(latestBlock, null, 2)}`); // 打印最新区块信息
        return latestBlock; // 返回链上的最后一个区块
    }
    replaceChain(newChain) {
        console.log('新链长度是****************：\n\n', newChain.length);
        console.log('当前链长度是&&&&&&&&&&&&&&：\n\n', this.chain.length);
        if (newChain.length >= this.chain.length) {
            this.chain = newChain;
            (0, utils_1.logWithTimestamp)('区块链已被替换为接收到的链');
            return true;
        }
        else {
            (0, utils_1.logWithTimestamp)('接收到的链比当前链短，拒绝替换');
            return false;
        }
    }
    // 从文件加载区块链
    loadBlockchainFromFile() {
        (0, utils_1.logWithTimestamp)('正在加载本地区块链数据...');
        try {
            if (fs.existsSync(this.chainFilePath)) { // 检查文件是否存在
                const data = fs.readFileSync(this.chainFilePath, 'utf8'); // 读取文件内容
                const parsedChain = JSON.parse(data);
                (0, utils_1.logWithTimestamp)(`\n\n 查看本地区块链数据元文件: ${JSON.stringify(parsedChain, null, 2)}\n`);
                // 确保 parsedChain 是一个数组
                if (Array.isArray(parsedChain)) {
                    // 将普通对象转换为 Block 实例，保留文件中的哈希
                    this.chain = parsedChain.map((blockData) => new block_1.Block(blockData.index, blockData.timestamp, blockData.transactions, blockData.previousHash, blockData.nonce, blockData.hash // 直接使用文件中的哈希值，而不是重新计算
                    ));
                    (0, utils_1.logWithTimestamp)(`区块链数据已从文件加载完成，当前区块链长度: ${this.chain.length}`); // 输出加载后的区块链长度
                }
                else {
                    (0, utils_1.logWithTimestamp)('加载的数据不是有效的区块链数组，创建创世区块。');
                    this.createGenesisBlock(); // 如果数据格式不正确，创建创世区块
                }
            }
            else {
                (0, utils_1.logWithTimestamp)('未找到区块链文件，创建创世区块。');
                this.createGenesisBlock(); // 如果文件不存在，创建创世区块
            }
        }
        catch (error) {
            (0, utils_1.logWithTimestamp)('加载区块链数据时发生错误:', error);
            this.createGenesisBlock(); // 在加载失败时重新创建区块链
        }
    }
    // 保存区块链到文件
    saveBlockchainToFile() {
        fs.writeFileSync(this.chainFilePath, JSON.stringify(this.chain, null, 2)); // 将区块链数据写入文件
        (0, utils_1.logWithTimestamp)('区块链数据已保存到文件:', this.chainFilePath); // 输出保存信息
    }
    // 使用 TransactionManager 来创建交易并添加到待处理交易列表
    createBCTransaction(from, to, amount) {
        // 使用 TransactionManager 创建交易
        const transaction = this.transactionManager.createTransaction(from, to, amount);
        // 将交易添加到待处理交易列表
        this.pendingTransactions.push(transaction);
        // 使用日志工具记录交易信息
        (0, utils_1.logWithTimestamp)(`交易已添加到待处理交易列表: ${JSON.stringify(transaction, null, 2)}`);
        // 返回创建的交易对象
        return transaction;
    }
    // 获取指定地址的余额
    getBalance(address) {
        let balance = 0;
        for (const block of this.chain) {
            for (const tx of block.transactions) {
                if (tx.from === address) {
                    balance -= tx.amount;
                }
                if (tx.to === address) {
                    balance += tx.amount;
                }
            }
        }
        (0, utils_1.logWithTimestamp)(`地址 ${address} 的当前余额: ${balance}`);
        return balance;
    }
    startMining(minerAddress) {
        (0, utils_1.logWithTimestamp)('blockchain.ts ---- 开始挖矿...');
        setInterval(() => {
            let transactionsToInclude = this.pendingTransactions;
            // 如果没有待处理交易，生成空块
            if (this.pendingTransactions.length === 0) {
                (0, utils_1.logWithTimestamp)('没有待处理交易，生成空块...');
                transactionsToInclude = []; // 空交易列表
            }
            // 获取最新区块
            const latestBlock = this.getLatestBlock();
            if (!latestBlock) {
                (0, utils_1.logWithTimestamp)('无法获取最新区块，挖矿失败。');
                return; // 如果无法获取最新区块，停止挖矿
            }
            // 创建新区块
            const minertransaction = this.transactionManager.createTransaction(minerRewardAddress, minerAddress, this.reward);
            transactionsToInclude.push(minertransaction);
            const newBlock = new block_1.Block(this.chain.length, new Date().toISOString(), transactionsToInclude, latestBlock.hash);
            (0, utils_1.logWithTimestamp)(`开始挖新区块，当前区块 index: ${newBlock.index}`);
            // 调用挖矿函数来进行哈希计算
            newBlock.mineBlock(this.difficulty);
            // 挖矿成功后添加到区块链
            this.addBlock(newBlock);
            (0, utils_1.logWithTimestamp)('新区块已挖出并添加到区块链:', newBlock);
            // 清空待处理交易
            this.pendingTransactions = [];
        }, mineInterval); // 每N秒尝试挖矿一次
    }
    // 启动挖矿停止
    // 获取待处理交易列表中所有交易的函数
    getPendingTransactions() {
        const pendingTransactions = []; // 创建一个数组来存储待处理交易
        // 假设有一个属性 this.pendingTransactions 存储待处理交易
        pendingTransactions.push(...this.pendingTransactions); // 将待处理交易添加到数组中
        (0, utils_1.logWithTimestamp)(`当前待处理交易数量: ${pendingTransactions.length}`); // 输出待处理交易数量
        return pendingTransactions; // 返回待处理交易
    }
    // 验证区块是否有效（根据难度）
    isValidBlock(block) {
        const hashCheck = block.hash.substring(0, this.difficulty) === '0'.repeat(this.difficulty);
        return hashCheck;
    }
}
exports.Blockchain = Blockchain;
const blockchain = new Blockchain();
blockchain.loadBlockchainFromFile();
// logWithTimestamp(`111111111111', ${JSON.stringify(blockchain.getLatestBlock())}`)
