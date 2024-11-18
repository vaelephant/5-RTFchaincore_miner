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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Block = void 0;
const crypto = __importStar(require("crypto"));
class Block {
    constructor(index, timestamp, transactions, previousHash = '', nonce = 0, hash // 可选的哈希参数，用于载入现有区块时使用
    ) {
        this.index = index;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.nonce = nonce;
        if (hash) {
            this.hash = hash; // 如果传入了哈希值，则使用它
        }
        else {
            this.hash = this.calculateHash(); // 否则重新计算哈希
        }
    }
    // 计算区块哈希 16位
    calculateHash() {
        const data = this.index +
            this.timestamp +
            this.previousHash +
            this.nonce +
            JSON.stringify(this.transactions);
        const fullHash = crypto
            .createHash('sha256')
            .update(data)
            .digest('hex');
        // 只返回前16位哈希值
        return fullHash.substring(0, 16);
    }
    // 挖矿函数，根据难度进行哈希运算
    mineBlock(difficulty) {
        const target = '0'.repeat(difficulty); // 根据难度生成目标前缀
        let attempt = 0;
        let lastLogTime = Date.now(); // 上次日志输出时间
        // 循环计算哈希，直到满足难度条件
        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++; // 不断尝试改变 nonce
            this.hash = this.calculateHash(); // 重新计算哈希
            attempt++;
            // 控制日志输出间隔，每隔 5 秒输出一次日志
            const currentTime = Date.now();
            if (currentTime - lastLogTime > 5000) {
                console.log(`正在尝试挖矿... 尝试次数: ${attempt}, 当前 nonce: ${this.nonce}, 当前 hash: ${this.hash}`);
                lastLogTime = currentTime; // 更新上次日志输出时间
            }
        }
        // 当找到符合条件的哈希后输出结果
        console.log(`🎉 区块已成功挖出! nonce: ${this.nonce}, hash: ${this.hash}, 挖矿尝试次数: ${attempt}`);
    }
}
exports.Block = Block;
