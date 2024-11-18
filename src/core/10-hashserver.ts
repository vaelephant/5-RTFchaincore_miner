// npm install express body-parser pg
// npm install --save-dev @types/express @types/body-parser @types/pg


// CREATE TABLE schemablockchain.hashrate_records (
//     id SERIAL PRIMARY KEY,               -- 自增的主键
//     miner_address VARCHAR(64) NOT NULL,  -- 矿工地址，用于标识每个矿工
//     hash_rate DECIMAL(20, 2) NOT NULL,   -- 矿工算力，单位为 H/s
//     recorded_at TIMESTAMP DEFAULT NOW()  -- 记录时间，默认为当前时间
// );




import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
// Import necessary libraries
import { Client } from 'pg';
import config from './config.json';
// Load environment variables from .env file
dotenv.config();

// 创建数据库连接池
const pool = new Pool({
    user: process.env.DB_USER || '',
    host: process.env.DB_HOST || '',
    database: process.env.DB_NAME || '',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '5433'),
});

const app = express();
const PORT =  config.network.hashServerPort;     // 从 config.json 中读取算力服务器端口

// 中间件
app.use(bodyParser.json());

// 定义算力记录表的插入函数
async function insertHashRateRecord(minerAddress: string, hashRate: number) {
    const query = `
        INSERT INTO schemablockchain.hashrate_records (miner_address, hash_rate)
        VALUES ($1, $2) RETURNING *;
    `;
    const values = [minerAddress, hashRate];
    const result = await pool.query(query, values);
    return result.rows[0];
}

// 接收算力数据的端点
app.post('/submit-hashrate', async (req: Request, res: Response) => {
    const { minerAddress, hashRate } = req.body;

    // 日志打印接收到的请求数据
    console.log(`接收到算力提交请求 - 矿工地址: ${minerAddress}, 算力: ${hashRate} H/s`);

    if (!minerAddress || !hashRate) {
        console.error('错误：矿工地址和算力是必填字段');
        return res.status(400).json({ error: '矿工地址和算力是必填字段' });
    }

    try {
        const record = await insertHashRateRecord(minerAddress, hashRate);
        console.log('算力记录成功:', record); // 日志打印成功插入的记录
        res.status(200).json({ message: '算力记录成功', record });
    } catch (error) {
        console.error('数据库插入错误:', error);
        res.status(500).json({ error: '无法记录算力' });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`算力记录服务器已启动，监听端口 ${PORT}`);
});