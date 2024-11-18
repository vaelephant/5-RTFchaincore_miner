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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// Import necessary libraries
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
// Load environment variables from .env file
dotenv.config();
class DatabaseClient {
    constructor() {
        this.client = new pg_1.Client({
            user: process.env.DB_USER || '',
            host: process.env.DB_HOST || '',
            database: process.env.DB_NAME || '',
            password: process.env.DB_PASSWORD || '',
            port: parseInt(process.env.DB_PORT || '5432'),
        });
    }
    // Connect to the database
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.connect();
                console.log('Connected to PostgreSQL database successfully');
            }
            catch (error) {
                console.error('Database connection error:', error.message);
                throw error;
            }
        });
    }
    // Disconnect from the database
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.end();
                console.log('Disconnected from PostgreSQL database');
            }
            catch (error) {
                console.error('Database disconnection error:', error.message);
            }
        });
    }
    // Execute a query
    query(queryText, values) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield this.client.query(queryText, values);
                return res;
            }
            catch (error) {
                console.error('Database query error:', error.message);
                throw error;
            }
        });
    }
}
exports.default = DatabaseClient;
// Example usage (other programs can import DatabaseClient to perform database operations)
(() => __awaiter(void 0, void 0, void 0, function* () {
    const dbClient = new DatabaseClient();
    yield dbClient.connect();
    try {
        const result = yield dbClient.query('SELECT NOW()');
        console.log('Current Time from Database:', result.rows[0]);
    }
    catch (error) {
        console.error('Error executing query:', error.message);
    }
    finally {
        yield dbClient.disconnect();
    }
}))();
