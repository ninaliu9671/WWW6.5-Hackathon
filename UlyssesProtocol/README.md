# README

---

# ⚓ Ulysses Protocol (尤利西斯协议)

> **“在代码即法律的世界里，我们让理智重回王座。”**
> 

Ulysses Protocol 是一款基于行为金融学设计的 **Web3 交易干预工具**。通过智能合约构建“尤利西斯契约”（Ulysses Pact），它允许用户在理智时刻为自己未来的冲动行为预设“物理枷锁”，将无形的交易意志力转化为有形的经济博弈。

---

## 🌟 项目愿景 (Vision)

在 Web3 的黑暗森林中，投资者常面临**跨时决策不一致性**：理智时刻的长期目标（保护本金）极易被冲动时刻的欲望（FOMO 追高）击溃。

Ulysses Protocol 并不是在禁止交易，而是在交易自由与自律之间构建一扇缓冲门。我们为每一位交易者提供那根最坚固的**“数字桅杆”**，帮助他们对抗海妖塞壬（Siren）般的链上诱惑。

---

## 🛠️ 核心机制 (Core Mechanisms)

### 1. 尤利西斯契约 (The Ulysses Pact)

- **预先承诺：** 用户质押 USDC 并设定禁买名单（Target Token）与禁买时长。
- **实时审计：** 协议后台监听钱包行为。一旦违约（买入禁买币种），质押金立即被 **Slash（没收）**。
- **正向激励：** 成功完成挑战的用户将赎回本金，并瓜分池中由违约者贡献的“情绪税”。

### 2. 意志力权重模型 (Mathematical Model)

为了确保公平，防止巨鲸垄断收益，我们引入亚线性激励公式：

$$W = \sqrt{P \times \text{PRECISION}} \times \min(T, 3d)$$

- **本金开方 ($\sqrt{P}$)：** 资金增加 100 倍，权重仅增加 10 倍，强调自律时长而非纯资金量。
- **时间上限 ($3d$)：** 基于心理学冲动半衰期，鼓励高频、短周期的理智续约。

### 3. 高效收益分配 (AccRewardPerWeight)

采用类 Uniswap V3 的“雨水收集”算法。无论用户规模多大，结算复杂度均为 $O(1)$，极大降低了链上 Gas 消耗。

---

## 🗺️ 未来愿景 (Future Roadmap)

- **身份绑定 (DID)：** 接入 WorldID，确保契约绑定的是“人”而非钱包，防止换号交易。
- **物理拦截 (AA)：** 通过 ERC-4337 账户抽象钱包，在禁买期内直接从底层拒绝违规交易签名。
- **情绪熔断器：** 扩展至“止损冷却期”、“杠杆熔断器”等更多自律场景。
- **B2B 插件：** 作为安全组件嵌入 DEX 或钱包前端，提示高风险交易并提供挑战选项。

---

## 💻 技术栈 (Tech Stack)

- **Smart Contracts:** Solidity (OpenZeppelin, Foundry)
- **Frontend:** Next.js, Tailwind CSS, Wagmi/RainbowKit
- **Oracle/Monitoring:** Node.js Watcher Service
- **Mathematical Logic:** Sub-linear Weighting & Global Accumulator Index

---

## 📝 快速开始 (Quick Start)

### 合约部署

Bash

# 

`# 安装依赖
forge install

# 编译合约
forge build

# 部署至测试链
forge create --rpc-url <YOUR_RPC_URL> --private-key <YOUR_PRIVATE_KEY> src/UlyssesProtocol.sol:UlyssesProtocol --constructor-args <USDC_ADDRESS> <WATCHER_ADDRESS>`

---

## ⚖️ 许可证 (License)

本项目采用 **MIT License**。

---

> **“在 Web3，最贵的税叫‘情绪税’。Ulysses Protocol 的使命，就是把这笔税收回来，发给那些保持理智的人。”**
> 

---

# ⚓ Ulysses Protocol (尤利西斯协议)

> **“让理智时刻的你，为冲动时刻的你带上镣铐。”**
> 

Ulysses Protocol 是一款针对 **Web3 全场景非理性投资行为**设计的行为干预协议。它将行为金融学中的“尤利西斯契约”（Ulysses Pact）代码化，通过智能合约预设“违约成本”，强制拉长决策路径。协议的核心逻辑具备高度的可扩展性：当前版本聚焦于“禁买行为约束”，但其底层的“质押-监听-惩罚-分红”框架可横向平移至任何需要自律约束的交易场景。

---

## 🌟 核心理念：从宏观克制到微观执行

### 1. 宏观叙事：对抗跨时决策不一致性

Web3 交易的高频与高波特性，常使投资者陷入“短视冲动”。Ulysses Protocol 提供了一套**预先承诺机制**，让用户在理智期制定规则，并在冲动期由系统强制执行。

### 2. 逻辑收敛：从所有冲动到“禁买”场景

虽然协议旨在解决所有非理性冲动（如过度杠杆、频繁操作、恐慌抛售等），但本项目首阶段选取了**“非理性买入”**这一最具破坏性的场景进行合约落地。通过锁定特定代币地址，为用户在诱惑面前构筑一道物理防线。

---

## 💡 应用场景 (Application Scenarios)

基于当前的禁买合约，我们针对非理性买入提炼了三类核心场景：

- **新币上线冷静期 (The Post-Listing Cooling-off)：** 针对热门币种上线前 15 分钟的极端泡沫。用户预先质押，强制跳过波动最剧烈、接盘风险最高的阶段。
- **高风险标的隔离 (High-Risk Asset Shield)：** 针对社交媒体（Twitter/Telegram）诱导下的冲动投机。用户在理智时将高风险、低流动性资产（如 Meme、投机标的）列入禁买名单。
- **报复性交易阻断 (Revenge Trading Guard)：** 针对单笔大额亏损后的情绪失控。用户设定 72 小时的特定币种“禁入期”，强制阻断试图通过重仓对冲来“回本”的非理性自救行为。

---

## 📈 数学模型：意志力加权与公平分红

协议通过数学手段确保“自律时间”的价值，并实现高效的财富再分配。

- **意志力权重公式：** $W = \sqrt{P \times \text{PRECISION}} \times \min(T, 3d)$
    - **亚线性激励：** 对本金 $P$ 开方，防止巨鲸垄断，提升普通散户“自律时长”的收益权重。
    - **周期上限：** 将时间 $T$ 设为 3 天上限，符合心理学冲动半衰期规律，鼓励高频自律续约。
- **分红累加器 (AccRewardPerWeight)：** 采用 $O(1)$ 复杂度的水位计算法。确保无论参与人数多少，每笔 Slash 的罚金都能精准、低成本地分配给所有在保的“理智者”。

---

## 🛠️ 技术栈 (Tech Stack)

- **Smart Contracts:** Solidity (OpenZeppelin) —— 核心逻辑实现与资产托管。
- **Development:** Remix —— 合约开发与部署。
- **Monitoring:** Node.js Watcher Service —— 基于实时索引的违约裁决引擎。
- **Frontend:** Next.js + Tailwind CSS —— 提供直观的“意志力进度条”交互体验。
- **Web3 Interaction:** Wagmi / Viem —— 标准化 Web3 钱包连接与链上交互。

---

## 🚀 横向扩展愿景 (Future Scaling)

当前的“禁买”逻辑只是 Ulysses 框架的起点。未来我们将利用相同的底层协议逻辑，扩展至更多元化的非理性干预领域：

- **资产配置锁定器 (Portfolio Rebalance Lock)：** 用户设定资产配比目标（如稳定币占 50%），一旦冲动调仓导致偏离目标，触发质押金 Slash，强制回归稳健策略。
- **交易频率熔断机制 (Activity Circuit Breaker)：** 针对交易成瘾（Over-trading）。用户设定每日操作次数上限，超额交易将产生高昂的惩罚成本，从而过滤无效操作。
- **跨协议生态接入：** 以 API 形式接入 DEX 前端，作为“交易冷静期”中间件，为所有 Web3 交易者提供可选的自律约束服务。

---

## 📜 结语

**“在代码即法律的世界，我们为意志力提供执行力。在web3世界里，不交’情绪税’，将你的自律与理智转化为链上收益。”**

---

### 快速开始 (Quick Start)

`# 克隆仓库
git clone https://github.com/ninaliu9671/WWW6.5-Hackathon/UlyssesProtocol.git
# 安装环境
forge install
# 运行测试
forge test`
