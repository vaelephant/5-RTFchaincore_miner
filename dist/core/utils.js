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
exports.logWithTimestamp = logWithTimestamp;
exports.saveToFile = saveToFile;
exports.loadFromFile = loadFromFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path")); // 引入路径模块
// 创建日志文件夹（如果不存在）
const logDir = path.join(__dirname, 'log');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir); // 创建日志文件夹
}
// 日志文件路径，使用当前日期命名
const logFilePath = path.join(logDir, `logs_${new Date().toISOString().split('T')[0]}.log`);
// 带时间戳的日志记录函数，接受任意数量的参数
function logWithTimestamp(...messages) {
    const timestamp = new Date().toISOString(); // 获取当前时间戳
    const logMessage = `[${timestamp}] ${messages.join(' ')}\n`; // 格式化日志信息
    console.log(logMessage); // 输出到控制台
    // 将日志信息追加到日志文件
    fs.appendFileSync(logFilePath, logMessage, 'utf8'); // 追加写入日志文件
}
// 保存数据到文件
function saveToFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); // 将数据写入文件
}
// 从文件加载数据
function loadFromFile(filePath) {
    if (fs.existsSync(filePath)) { // 检查文件是否存在
        const data = fs.readFileSync(filePath, 'utf8'); // 读取文件内容
        return JSON.parse(data); // 解析并返回数据
    }
    return null; // 如果文件不存在，返回 null
}
