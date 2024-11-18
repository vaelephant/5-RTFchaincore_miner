"use strict";
// npm install express body-parser pg
// npm install --save-dev @types/express @types/body-parser @types/pg
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
// CREATE TABLE schemablockchain.hashrate_records (
//     id SERIAL PRIMARY KEY,               -- 自增的主键
//     miner_address VARCHAR(64) NOT NULL,  -- 矿工地址，用于标识每个矿工
//     hash_rate DECIMAL(20, 2) NOT NULL,   -- 矿工算力，单位为 H/s
//     recorded_at TIMESTAMP DEFAULT NOW()  -- 记录时间，默认为当前时间
// );
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
const config_json_1 = __importDefault(require("./config.json"));
// Load environment variables from .env file
dotenv.config();
// 创建数据库连接池
const pool = new pg_1.Pool({
    user: process.env.DB_USER || '',
    host: process.env.DB_HOST || '',
    database: process.env.DB_NAME || '',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '5433'),
});
const app = (0, express_1.default)();
const PORT = config_json_1.default.network.hashServerPort; // 从 config.json 中读取算力服务器端口
// 中间件
app.use(body_parser_1.default.json());
// 定义算力记录表的插入函数
function insertHashRateRecord(minerAddress, hashRate) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `
        INSERT INTO schemablockchain.hashrate_records (miner_address, hash_rate)
        VALUES ($1, $2) RETURNING *;
    `;
        const values = [minerAddress, hashRate];
        const result = yield pool.query(query, values);
        return result.rows[0];
    });
}
// 接收算力数据的端点
app.post('/submit-hashrate', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { minerAddress, hashRate } = req.body;
    // 日志打印接收到的请求数据
    console.log(`接收到算力提交请求 - 矿工地址: ${minerAddress}, 算力: ${hashRate} H/s`);
    if (!minerAddress || !hashRate) {
        console.error('错误：矿工地址和算力是必填字段');
        return res.status(400).json({ error: '矿工地址和算力是必填字段' });
    }
    try {
        const record = yield insertHashRateRecord(minerAddress, hashRate);
        console.log('算力记录成功:', record); // 日志打印成功插入的记录
        res.status(200).json({ message: '算力记录成功', record });
    }
    catch (error) {
        console.error('数据库插入错误:', error);
        res.status(500).json({ error: '无法记录算力' });
    }
}));
// 启动服务器
app.listen(PORT, () => {
    console.log(`算力记录服务器已启动，监听端口 ${PORT}`);
});
