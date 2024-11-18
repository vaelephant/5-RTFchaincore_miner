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
exports.getUserBalance = getUserBalance;
exports.transferByUserId = transferByUserId;
exports.transferByUserAddress = transferByUserAddress;
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
dotenv_1.default.config();
const FASTAPI_URL = process.env.FASTAPI_URL;
// 获取用户余额
function getUserBalance(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.get(`${FASTAPI_URL}/api/balance/${userId}`);
            const balanceData = response.data; // 直接使用响应数据
            console.log('balanceData:', balanceData);
            return balanceData; // 返回用户余额数据数组
        }
        catch (error) {
            console.error('Error fetching user balance:', error);
            return undefined; // 返回undefined以指示错误
        }
    });
}
// 转账 
function transferByUserId(senderId, receiverId, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.post(`${FASTAPI_URL}/api/transactionbyuserid`, {
                sender_id: senderId,
                receiver_id: receiverId,
                amount: amount,
            });
            const transferData = response.data; // 直接使用响应数据       
            console.log(transferData.message); // 打印消息
            return transferData; // 返回转账操作结果
        }
        catch (error) {
            console.error('TransferByUserId Error:', error);
            return undefined; // 返回undefined以指示错误
        }
    });
}
// 根据用户地址进行转账
function transferByUserAddress(senderAddress, receiverAddress, amount) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.post(`${FASTAPI_URL}/api/transactionbyaddress`, {
                sender_address: senderAddress,
                receiver_address: receiverAddress,
                amount: amount,
            });
            const transferData = response.data; // 直接使用响应数据       
            console.log(transferData.message); // 打印消息
            return transferData; // 返回转账操作结果
        }
        catch (error) {
            console.error('TransferByUserAddress Error:', error);
            return undefined; // 返回undefined以指示错误
        }
    });
}
// 示例调用
// getUserBalance('16').then(data => console.log(data));
// transferByUserId('12345', '67890', 100).then(data => console.log(data));
