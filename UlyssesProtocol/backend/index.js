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

// --- 核心配置：ERC20 ABI ---
const MIN_ERC20_ABI = [
    "function balanceOf(address account) external view returns (uint256)"
];

// --- 全局初始化 ---
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const pk = process.env.WATCHER_PRIVATE_KEY?.trim();

if (!pk) {
    console.error("❌ 错误: .env 中未检测到 WATCHER_PRIVATE_KEY");
    process.exit(1);
}

const watcherWallet = new ethers.Wallet(pk, provider);
let lastScannedBlock = 0;
let STAKING_TOKEN_ADDRESS = ""; // 动态获取质押币地址

// --- 核心模块 I：执行链上罚没 ---
async function executeSlash(stakeRecord) {
    try {
        const abi = JSON.parse(fs.readFileSync("./abi.json", "utf8"));
        const contractAddress = getAddress(process.env.CONTRACT_ADDRESS.trim());
        const contract = new ethers.Contract(contractAddress, abi, watcherWallet);

        console.log(`🔨 [准备出警] 目标用户: ${stakeRecord.userAddress} | 违禁币: ${stakeRecord.targetAddress}`);
        
        const tx = await contract.slash(stakeRecord.userAddress, stakeRecord.targetAddress);
        console.log(`⏳ 罚没指令已提交，哈希: ${tx.hash}`);
        
        await tx.wait();
        await stakeRecord.update({ status: 2 }); // 状态 2: 已处理（罚没或到期）
        console.log(`✅ [出警成功] 用户质押金已被合约处理。`);
        
    } catch (error) {
        console.error(`❌ [出警失败]:`, error.reason || error.message);
        if (error.message.toLowerCase().includes("already slashed")) {
            await stakeRecord.update({ status: 2 });
        }
    }
}

// --- 核心模块 II：事件监听 ---
async function pollChainEvents() {
    try {
        const abi = JSON.parse(fs.readFileSync("./abi.json", "utf8"));
        const contractAddress = getAddress(process.env.CONTRACT_ADDRESS.trim());
        const contract = new ethers.Contract(contractAddress, abi, provider);

        // 动态同步合约的质押币地址
        if (!STAKING_TOKEN_ADDRESS) {
            STAKING_TOKEN_ADDRESS = (await contract.stakingToken()).toLowerCase();
            console.log(`ℹ️ 系统识别：本合约质押币为 ${STAKING_TOKEN_ADDRESS}`);
        }

        const currentBlock = await provider.getBlockNumber();
        if (lastScannedBlock === 0) lastScannedBlock = currentBlock - 50;
        if (currentBlock <= lastScannedBlock) return;

        console.log(`🔍 巡逻区块: ${lastScannedBlock + 1} -> ${currentBlock}`);

        const events = await contract.queryFilter("Staked", lastScannedBlock + 1, currentBlock);
        
        for (let event of events) {
            const [user, target, amount, weight, startTime, unlockTime] = event.args;
            console.log(`\n🔔 发现新质押！`);
            console.log(`👤 用户: ${user}`);
            console.log(`🚫 禁止持有: ${target}`);

            await Stake.findOrCreate({
                where: { userAddress: user.toLowerCase(), unlockTime: Number(unlockTime) },
                defaults: {
                    userAddress: user.toLowerCase(),
                    targetAddress: target.toLowerCase(),
                    amount: ethers.formatEther(amount),
                    unlockTime: Number(unlockTime),
                    status: 0
                }
            });
        }
        lastScannedBlock = currentBlock;
    } catch (error) {
        console.error("⚠️ 扫描异常:", error.message);
    }
}

// --- 核心模块 III：自动化监控 (20秒/次) ---
async function startTimers() {
    setInterval(pollChainEvents, 10000);

    setInterval(async () => {
        const now = Math.floor(Date.now() / 1000);
        try {
            const activeStakes = await Stake.findAll({ where: { status: 0 } });

            for (let stake of activeStakes) {
                const forbiddenToken = stake.targetAddress.toLowerCase();
                const userAddress = stake.userAddress.toLowerCase();

                // 【逻辑修正：核心防御】
                // 如果禁止持有的币就是质押币，说明是误填或特殊逻辑，警察保持沉默
                if (forbiddenToken === STAKING_TOKEN_ADDRESS) {
                    // console.log(`🛡️ 监测中：用户 ${userAddress} 质押中 (已跳过质押币余额检查)`);
                } else {
                    // 【执法检查：查的是禁忌土狗币】
                    const tokenContract = new ethers.Contract(forbiddenToken, MIN_ERC20_ABI, provider);
                    try {
                        const balance = await tokenContract.balanceOf(userAddress);
                        if (balance > 0n) {
                            console.log(`🚨 破戒！检测到用户 ${userAddress} 偷买土狗币 ${forbiddenToken}`);
                            await executeSlash(stake);
                            continue; 
                        }
                    } catch (e) {
                        // 如果余额查询失败（比如地址填错了），不轻易罚没，仅警告
                        console.warn(`⚠️ 无法读取地址 ${forbiddenToken} 的余额，请确认它是有效的 ERC20 代币。`);
                    }
                }

                // 【时间检查】：到期后自动执行（在合约里到期 slash 也是正常结算逻辑）
                if (stake.unlockTime < now) {
                    console.log(`⏰ 时间到！用户 ${userAddress} 成功完成挑战。`);
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
        const filter = address ? { userAddress: address.toLowerCase() } : {};
        const data = await Stake.findAll({ where: filter, order: [['createdAt', 'DESC']] });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "获取失败" });
    }
});

// --- 入口 ---
async function main() {
    try {
        await sequelize.sync({ force: true }); 
        console.log("✅ 数据库已就绪（已强制重置）");
        await startTimers();
        app.listen(PORT, () => {
            console.log("-----------------------------------------");
            console.log("🚨 Ulysses 动态警察后端已上线！");
            console.log(`🌐 接口: http://localhost:${PORT}/history`);
            console.log("-----------------------------------------");
        });
    } catch (err) {
        console.error("❌ 启动失败:", err);
    }
}

main();