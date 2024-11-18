"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testApiRoute_1 = require("./testApiRoute");
const userId = 16;
const userBalance = (0, testApiRoute_1.getUserBalance)(userId); // 获取用户余额
console.log(userBalance);
// 转账
const transfer = (0, testApiRoute_1.transferByUserId)(59, 84, 10);
console.log(transfer);
