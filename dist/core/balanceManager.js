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
exports.BalanceManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("./utils");
const testApiRoute_1 = require("./testApiRoute");
const config_json_1 = __importDefault(require("./config.json"));
const minerRewardAddress = config_json_1.default.reward.rewardAddress; // 从 config.json 中读取挖矿奖励地址
class BalanceManager {
    constructor() {
        this.balances = {}; // 账户余额的对象结构
        this.accountsFilePath = path.join(__dirname, 'balance/accounts.json'); // 账户余额文件路径
        this.loadBalancesFromFile(); // 在构造函数中加载账户余额
    }
    // 从文件加载余额
    loadBalancesFromFile() {
        try {
            if (fs.existsSync(this.accountsFilePath)) {
                const data = fs.readFileSync(this.accountsFilePath, 'utf8');
                const accountsData = JSON.parse(data);
                // 获取 accounts 对象中的数据
                this.balances = accountsData.accounts || {}; // 确保从 "accounts" 中读取余额
                (0, utils_1.logWithTimestamp)('账户余额已从文件加载完成');
            }
            else {
                (0, utils_1.logWithTimestamp)('未找到账户余额文件，将创建新的文件');
                this.saveBalancesToFile(); // 如果文件不存在，保存初始状态的余额数据
            }
        }
        catch (error) {
            (0, utils_1.logWithTimestamp)('加载账户余额时发生错误:', error);
        }
    }
    // 保存余额到文件
    saveBalancesToFile() {
        try {
            const accountsData = { accounts: this.balances };
            fs.writeFileSync(this.accountsFilePath, JSON.stringify(accountsData, null, 2));
            (0, utils_1.logWithTimestamp)('账户余额已保存到文件:', this.accountsFilePath);
        }
        catch (error) {
            (0, utils_1.logWithTimestamp)('保存账户余额时发生错误:', error);
        }
    }
    // 验证账户是否存在
    verifyAccountExists(address) {
        if (!this.balances[address]) {
            (0, utils_1.logWithTimestamp)(`BalanceManager:账户 ${address} 不存在`);
            return false;
        }
        return true;
    }
    // 验证账户是否有足够的余额进行交易   
    verifySufficientFunds(address, amount) {
        if (!this.verifyAccountExists(address)) {
            (0, utils_1.logWithTimestamp)(`账户 ${address} 不存在，无法验证余额`);
            return false;
        }
        if (this.balances[address].balance < amount) {
            (0, utils_1.logWithTimestamp)(`账户 ${address} 余额不足，当前余额: ${this.balances[address].balance}, 需要: ${amount}`);
            return false;
        }
        return true;
    }
    // 更新余额
    updateBalance(transaction) {
        // 验证发送者账户（非 挖矿奖励   交易）
        // if (transaction.from !== minerRewardAddress) {
        //     if (!this.verifySufficientFunds(transaction.from, transaction.amount)) {
        //         logWithTimestamp(`交易失败：发送方 ${transaction.from} 余额不足`);
        //         return false; // 余额不足时，交易失败
        //     }
        // }
        // // 验证接收者账户   2024.10.09      改为从数据库接口获取，已验证，所以不需要再验证一次；    
        // if (!this.verifyAccountExists(transaction.to)) {
        //     logWithTimestamp(`交易失败：接收方 ${transaction.to} 不存在`);
        //     return false; // 接收方账户不存在时，交易失败
        // }
        // 更新接收者的余额
        if (!this.balances[transaction.to]) {
            this.balances[transaction.to] = { balance: 0 };
        }
        this.balances[transaction.to].balance += transaction.amount;
        // 更新发送者的余额（非 挖矿奖励 交易）
        if (transaction.from !== minerRewardAddress) {
            if (!this.balances[transaction.from]) {
                this.balances[transaction.from] = { balance: 0 };
            }
            this.balances[transaction.from].balance -= transaction.amount;
        }
        // 记录日志并保存最新的余额数据到文件
        (0, utils_1.logWithTimestamp)(`更新了账户余额，发送者: ${transaction.from}, 接收者: ${transaction.to}, 金额: ${transaction.amount}`);
        // this.saveBalancesToFile();  // 每次更新余额后保存
        //转账存入交易相关数据库
        try {
            const transfer = (0, testApiRoute_1.transferByUserAddress)(transaction.from, transaction.to, transaction.amount);
            console.log('保存交易到数据库', transfer);
        }
        catch (error) {
            (0, utils_1.logWithTimestamp)('保存交易到数据库时发生错误:', error);
        }
        return true; // 交易成功
    }
    // 获取某个地址的余额
    // 获取某个地址的余额，并验证账户是否存在
    // 获取某个地址的余额，并验证账户是否存在
    // 获取某个地址的余额，并验证账户是否存在
    // 获取某个地址的余额，并验证账户是否存在
    getBalance(address) {
        if (!this.verifyAccountExists(address)) {
            (0, utils_1.logWithTimestamp)(`无法获取余额：账户 ${address} 不存在`);
            // throw new Error(`账户 ${address} 不存在`); // 抛出异常
            return -1; // 如果账户不存在，返回 -1
        }
        return this.balances[address].balance;
    }
}
exports.BalanceManager = BalanceManager;
