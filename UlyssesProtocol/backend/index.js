const { ethers, getAddress } = require("ethers");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { sequelize, Stake } = require("./db");
const { Op } = require("sequelize");

const app = express();
app.use(cors());
const PORT = 3001;

// --- 核心配置：ERC20 余额查询 ABI ---
const MIN_ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)"
];

// --- 全局初始化 (修复重复声明报错) ---
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const pk = process.env.WATCHER_PRIVATE_KEY?.trim();

if (!pk) {
    console.error("❌ 错误: .env 中未检测到 WATCHER_PRIVATE_KEY，请检查路径和文件内容");
    process.exit(1);
}

const watcherWallet = new ethers.Wallet(pk, provider);
let lastScannedBlock = 0;

// --- 核心模块 I：执行链上罚没 ---
async function executeSlash(stakeRecord) {
    try {
        const abi = JSON.parse(fs.readFileSync("./abi.json", "utf8"));
        const contractAddress = getAddress(process.env.CONTRACT_ADDRESS.trim());
        const contract = new ethers.Contract(contractAddress, abi, watcherWallet);

        console.log(`🔨 [执法中] 正在对违约用户 ${stakeRecord.userAddress} 发起罚没...`);
        
        // 调用合约 slash 方法 (确保合约里有这个函数)
        const tx = await contract.slash(stakeRecord.userAddress, stakeRecord.targetAddress);
        console.log(`⏳ 交易已提交，哈希: ${tx.hash}`);
        
        await tx.wait(); // 等待区块确认
        
        // 更新数据库状态：2 代表已罚没/已处理
        await stakeRecord.update({ status: 2 });
        console.log(`✅ [执法成功] 用户 ${stakeRecord.userAddress} 的质押已被扣除。`);
        
    } catch (error) {
        console.error(`❌ [执法失败] 用户 ${stakeRecord.userAddress}:`, error.reason || error.message);
        // 如果链上已经罚过了，同步数据库状态
        if (error.message.toLowerCase().includes("already slashed")) {
            await stakeRecord.update({ status: 2 });
        }
    }
}

// --- 核心模块 II：区块链事件监听 (同步新质押) ---
async function pollChainEvents() {
    try {
        const abi = JSON.parse(fs.readFileSync("./abi.json", "utf8"));
        const contractAddress = getAddress(process.env.CONTRACT_ADDRESS.trim());
        const contract = new ethers.Contract(contractAddress, abi, provider);

        const currentBlock = await provider.getBlockNumber();
        if (lastScannedBlock === 0) {
            lastScannedBlock = currentBlock - 100; // 首次启动向前扫描100个区块
        }

        if (currentBlock <= lastScannedBlock) return;

        console.log(`🔍 扫描区块: ${lastScannedBlock + 1} -> ${currentBlock}`);

        const events = await contract.queryFilter("Staked", lastScannedBlock + 1, currentBlock);
        
        for (let event of events) {
            const [user, target, amount, weight, startTime, unlockTime] = event.args;
            console.log(`\n🔔 监测到新质押！用户: ${user} | 目标币种: ${target}`);

            await Stake.findOrCreate({
                where: { 
                    userAddress: user.toLowerCase(), 
                    unlockTime: Number(unlockTime) 
                },
                defaults: {
                    userAddress: user.toLowerCase(),
                    targetAddress: target.toLowerCase(), // 这里存入的就是用户承诺不买的币
                    amount: ethers.formatEther(amount),
                    unlockTime: Number(unlockTime),
                    status: 0
                }
            });
        }
        lastScannedBlock = currentBlock;
    } catch (error) {
        console.error("⚠️ 链上扫描异常:", error.message);
    }
}

// --- 核心模块 III：自动化监控 (检查时间+余额) ---
async function startTimers() {
    // 每 10 秒扫一次新事件
    setInterval(pollChainEvents, 10000);

    // 每 20 秒检查一次违规
    setInterval(async () => {
        const now = Math.floor(Date.now() / 1000);
        
        try {
            const activeStakes = await Stake.findAll({ where: { status: 0 } });

            for (let stake of activeStakes) {
                // 【判定 1】：检查用户是否购买了禁忌币
                const forbiddenToken = stake.targetAddress;
                
                if (ethers.isAddress(forbiddenToken)) {
                    const tokenContract = new ethers.Contract(forbiddenToken, MIN_ERC20_ABI, provider);
                    try {
                        const balance = await tokenContract.balanceOf(stake.userAddress);
                        if (balance > 0n) {
                            console.log(`🚨 破戒！检测到用户 ${stake.userAddress} 持有了禁忌币 ${forbiddenToken}`);
                            await executeSlash(stake);
                            continue; 
                        }
                    } catch (e) {
                        console.warn(`无法读取地址 ${forbiddenToken} 的余额，请检查该地址是否为合法的ERC20代币。`);
                    }
                }

                // 【判定 2】：检查质押是否到期
                if (stake.unlockTime < now) {
                    console.log(`⏰ 时间到！用户 ${stake.userAddress} 锁定结束，执行后续逻辑。`);
                    await executeSlash(stake);
                }
            }
        } catch (err) {
            console.error("❌ 巡逻任务出错:", err);
        }
    }, 20000);
}

// --- API 路由 ---
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

// --- 主程序入口 ---
async function main() {
    try {
        // 同步数据库表结构 (首次运行建议保留 force: true)
        await sequelize.sync({ force: true }); 
        console.log("✅ 数据库已就绪并强制刷新");

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