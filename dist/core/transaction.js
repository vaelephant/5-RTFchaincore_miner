"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionManager = void 0;
const ethers_1 = require("ethers"); // 引入 v6 的 keccak256 和 toUtf8Bytes
const utils_1 = require("./utils"); // 引入日志输出函数
const config_json_1 = __importDefault(require("./config.json"));
const minerRewardAddress = config_json_1.default.reward.rewardAddress; // 从 config.json 中读取挖矿奖励地址
// 交易管理类
class TransactionManager {
    constructor(blockchain, balanceManager) {
        this.blockchain = blockchain;
        this.balanceManager = balanceManager;
    }
    // 创建交易前，验证账号信息和余额是否合理
    validateTransaction(from, to, amount) {
        const fromBalance = this.balanceManager.getBalance(from);
        // 验证发送方是否为 coinbase 或余额是否足够
        if (from !== minerRewardAddress) {
            if (fromBalance < amount) {
                (0, utils_1.logWithTimestamp)(`EEROR:--交易失败，发送方余额不足: ${from} 余额: ${fromBalance}, 交易金额: ${amount}`);
                return false;
            }
            if (fromBalance === -1) {
                (0, utils_1.logWithTimestamp)(`EEROR:--交易失败，发送方账户 ${from} 不存在`);
                return false;
            }
        }
        // 检查接收方地址是否存在（有效地址）
        if (!to || this.balanceManager.getBalance(to) === -1) {
            (0, utils_1.logWithTimestamp)(`EEROR:--交易失败，接收方地址无效或不存在: ${to}`);
            return false;
        }
        return true;
    }
    // 创建交易
    createTransaction(from, to, amount) {
        // 验证交易是否合理
        //2024-10-11 20:11 暂时注释交易验证
        // if (!this.validateTransaction(from, to, amount)) {
        //     logWithTimestamp('交易验证失败，交易未创建');
        //     // throw new Error('交易验证失败：账户余额不足或地址无效');
        // }
        const transaction = {
            from,
            to,
            amount,
            status: 'pending', // 初始状态为待处理
            hash: this.calculateTransactionHash(from, to, amount), // 计算交易哈希
            timestamp: new Date().toISOString() // 记录交易创建时间
        };
        (0, utils_1.logWithTimestamp)(`交易已创建: ${JSON.stringify(transaction)}`); // 输出创建的交易信息
        return transaction; // 返回创建的交易
    }
    // 创建交易结束
    // 计算交易哈希
    calculateTransactionHash(from, to, amount) {
        const hash = (0, ethers_1.keccak256)((0, ethers_1.toUtf8Bytes)(from + to + amount.toString())); // 生成哈希
        (0, utils_1.logWithTimestamp)(`计算的交易哈希: ${hash}`); // 输出计算的哈希
        return hash; // 返回计算的哈希
    }
}
exports.TransactionManager = TransactionManager;
