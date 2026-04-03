const { ethers, getAddress } = require("ethers");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();
const { sequelize, Stake } = require("./db");
const { Op } = require("sequelize");

const app = express();
app.use(cors());
const PORT = 3001;

// --- 全局变量：记录上次扫描到的区块高度 ---
let lastScannedBlock = 0;

// --- 核心模块 I：自动化执行罚没 (Slash) ---
async function executeSlash(stakeRecord) {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL, 43113);
        const watcherWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const abi = JSON.parse(fs.readFileSync("./abi.json", "utf8"));
        const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, watcherWallet);

        console.log(`🔨 [执法中] 正在对违约用户 ${stakeRecord.userAddress} 发起罚没...`);
        
        // 调用合约的 slash 方法
        const tx = await contract.slash(stakeRecord.userAddress, stakeRecord.targetAddress);
        console.log(`⏳ 交易已提交，哈希: ${tx.hash}`);
        
        await tx.wait(); // 等待链上确认
        
        // 更新数据库状态：2 代表已处理/已罚没
        await stakeRecord.update({ status: 2 });
        console.log(`✅ [执法成功] 用户 ${stakeRecord.userAddress} 的质押已被罚没。`);
        
    } catch (error) {
        console.error(`❌ [执法失败] 用户 ${stakeRecord.userAddress}:`, error.reason || error.message);
        // 如果合约提示已经罚过了，也更新数据库状态避免死循环
        if (error.message.toLowerCase().includes("already slashed")) {
            await stakeRecord.update({ status: 2 });
        }
    }
}

// --- 核心模块 II：区块链轮询警察 (代替 contract.on) ---
async function pollChainEvents() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL, 43113);
        const abi = JSON.parse(fs.readFileSync("./abi.json", "utf8"));
        const contractAddress = getAddress(process.env.CONTRACT_ADDRESS.split('=').pop().trim());
        const contract = new ethers.Contract(contractAddress, abi, provider);

        // 初始化起始区块
        if (lastScannedBlock === 0) {
            lastScannedBlock = await provider.getBlockNumber();
        }

        const currentBlock = await provider.getBlockNumber();
        if (currentBlock <= lastScannedBlock) return;

        console.log(`🔍 正在扫描区块: ${lastScannedBlock + 1} -> ${currentBlock}`);

        // 抓取 Staked 事件日志
        const events = await contract.queryFilter("Staked", lastScannedBlock + 1, currentBlock);
        
        for (let event of events) {
            const [user, target, amount, weight, startTime, unlockTime] = event.args;
            console.log(`\n🔔 发现新质押！用户: ${user}`);

            // 写入数据库 (防重复)
            await Stake.findOrCreate({
                where: { 
                    userAddress: user.toLowerCase(), 
                    unlockTime: Number(unlockTime) 
                },
                defaults: {
                    userAddress: user.toLowerCase(),
                    targetAddress: target.toLowerCase(),
                    amount: ethers.formatEther(amount),
                    unlockTime: Number(unlockTime),
                    status: 0
                }
            });
            console.log("💾 记录已同步至数据库。");
        }

        lastScannedBlock = currentBlock;

    } catch (error) {
        console.error("⚠️ 链上扫描出错 (节点繁忙):", error.message);
    }
}

// --- 核心模块 III：提供给前端的 API ---
app.get("/history", async (req, res) => {
    try {
        const { address } = req.query;
        let filter = {};
        if (address) {
            filter = { userAddress: address.toLowerCase() };
        }
        const data = await Stake.findAll({ 
            where: filter,
            order: [['createdAt', 'DESC']] 
        });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "获取历史记录失败" });
    }
});

// --- 周期性任务管理器 ---
async function startTimers() {
    // 1. 每 8 秒拉取一次新事件 (避开公共节点限制)
    setInterval(pollChainEvents, 8000);

    // 2. 每 30 秒检查一次数据库，处理违约
    setInterval(async () => {
        const now = Math.floor(Date.now() / 1000);
        try {
            const expiredStakes = await Stake.findAll({
                where: {
                    status: 0,
                    unlockTime: { [Op.lt]: now }
                }
            });

            for (let stake of expiredStakes) {
                console.log(`🚨 发现过期记录！用户: ${stake.userAddress}，开始罚没...`);
                await executeSlash(stake);
            }
        } catch (err) {
            console.error("❌ 定时执法任务出错:", err);
        }
    }, 30000);
}

// --- 程序主入口 ---
async function main() {
    try {
        // 【关键改动】使用 { force: true } 强制清空并重建所有表结构
        // 运行成功一次后，建议把 { force: true } 删掉，否则每次启动都会丢数据
        await sequelize.sync({ force: true }); 
        console.log("✅ 数据库结构已【强制刷新】就绪");

        await startTimers();

        app.listen(PORT, () => {
            console.log("-----------------------------------------");
            console.log("🚨 Ulysses 后端警察已上线！");
            console.log(`🌐 API 地址: http://localhost:${PORT}/history`);
            console.log("-----------------------------------------");
        });
    } catch (err) {
        console.error("❌ 程序启动失败:", err);
    }
}

main();