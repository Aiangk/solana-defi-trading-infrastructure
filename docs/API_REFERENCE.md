# API参考文档

## 📚 核心API

### SwapEngine

主要的交换引擎类，提供完整的DeFi交换功能。

#### 构造函数

```typescript
constructor(
    connection: Connection,
    wallet: Wallet,
    networkType: NetworkType = NetworkType.DEVNET
)
```

**参数:**
- `connection`: Solana网络连接实例
- `wallet`: 用户钱包实例
- `networkType`: 网络类型 (DEVNET | MAINNET)

**示例:**
```typescript
import { Connection } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { SwapEngine, NetworkType } from "./src";

const connection = new Connection("https://api.devnet.solana.com");
const wallet = new Wallet(keypair);
const swapEngine = new SwapEngine(connection, wallet, NetworkType.DEVNET);
```

#### executeSwap()

执行代币交换操作。

```typescript
async executeSwap(params: SwapParams): Promise<SwapResult>
```

**参数:**
- `params`: 交换参数对象

**返回值:**
- `SwapResult`: 交换结果对象

**示例:**
```typescript
const result = await swapEngine.executeSwap({
    direction: SwapDirection.SOL_TO_USDC,
    inputAmount: new BN(0.001 * 1e9), // 0.001 SOL
    minimumOutputAmount: new BN(0),
    slippageTolerance: 0.01 // 1%
});

if (result.success) {
    console.log("交换成功:", result.signature);
} else {
    console.log("交换失败:", result.error);
}
```

#### getSwapQuote()

获取交换报价（不执行交换）。

```typescript
async getSwapQuote(params: SwapParams): Promise<AggregatedRoute>
```

**参数:**
- `params`: 交换参数对象

**返回值:**
- `AggregatedRoute`: 聚合路由结果

**示例:**
```typescript
const quote = await swapEngine.getSwapQuote({
    direction: SwapDirection.SOL_TO_USDC,
    inputAmount: new BN(0.001 * 1e9),
    minimumOutputAmount: new BN(0),
    slippageTolerance: 0.01
});

console.log("最佳DEX:", quote.recommendedDEX);
console.log("预期输出:", quote.bestQuote.outputAmount.toString());
```

#### getUserBalances()

获取用户代币余额。

```typescript
async getUserBalances(userWallet?: PublicKey): Promise<TokenBalance[]>
```

**参数:**
- `userWallet`: 用户钱包地址（可选，默认使用当前钱包）

**返回值:**
- `TokenBalance[]`: 代币余额数组

**示例:**
```typescript
const balances = await swapEngine.getUserBalances();
balances.forEach(balance => {
    console.log(`${balance.symbol}: ${balance.formattedBalance}`);
});
```

### DEXAggregator

DEX聚合器，负责聚合多个DEX的报价。

#### 构造函数

```typescript
constructor(connection: Connection, protocols: DEXProtocol[])
```

#### getAggregatedQuote()

获取聚合报价。

```typescript
async getAggregatedQuote(
    tokenA: PublicKey,
    tokenB: PublicKey,
    amount: BN,
    slippage: number
): Promise<AggregatedRoute>
```

#### buildCompleteSwapTransaction()

构建完整的交换交易。

```typescript
async buildCompleteSwapTransaction(
    route: AggregatedRoute,
    userWallet: PublicKey,
    tokenMintA: PublicKey,
    tokenMintB: PublicKey
): Promise<TransactionInstruction[]>
```

### TokenAccountManager

代币账户管理器。

#### getAssociatedTokenAccountAddress()

获取关联代币账户地址。

```typescript
async getAssociatedTokenAccountAddress(
    mint: PublicKey,
    owner: PublicKey
): Promise<PublicKey>
```

#### checkTokenAccountStatus()

检查代币账户状态。

```typescript
async checkTokenAccountStatus(tokenAccount: PublicKey): Promise<TokenAccountStatus>
```

#### getTokenBalance()

获取代币余额。

```typescript
async getTokenBalance(
    tokenAccount: PublicKey,
    mint: PublicKey,
    symbol: string,
    decimals: number
): Promise<TokenBalance | null>
```

## 🔧 类型定义

### SwapParams

交换参数接口。

```typescript
interface SwapParams {
    /** 交换方向 */
    direction: SwapDirection;
    
    /** 输入金额 */
    inputAmount: BN;
    
    /** 最小输出金额 */
    minimumOutputAmount: BN;
    
    /** 滑点容忍度 (0.01 = 1%) */
    slippageTolerance: number;
}
```

### SwapResult

交换结果接口。

```typescript
interface SwapResult {
    /** 交易签名 */
    signature: string;
    
    /** 实际输入金额 */
    inputAmount: BN;
    
    /** 实际输出金额 */
    outputAmount: BN;
    
    /** 实际价格影响 */
    priceImpact: number;
    
    /** 交换是否成功 */
    success: boolean;
    
    /** 错误信息 (如果失败) */
    error?: string;
}
```

### DEXQuote

DEX报价接口。

```typescript
interface DEXQuote {
    /** DEX名称 */
    dexName: string;
    
    /** 输入金额 */
    inputAmount: BN;
    
    /** 预期输出金额 */
    outputAmount: BN;
    
    /** 价格影响 (0.01 = 1%) */
    priceImpact: number;
    
    /** 交易手续费 */
    fee: BN;
    
    /** 交易路径 */
    route: PublicKey[];
    
    /** 预估gas费用 */
    estimatedGas: number;
    
    /** 报价可信度 (0-1) */
    confidence: number;
}
```

### AggregatedRoute

聚合路由结果接口。

```typescript
interface AggregatedRoute {
    /** 最佳报价 */
    bestQuote: DEXQuote;
    
    /** 所有报价列表 */
    allQuotes: DEXQuote[];
    
    /** 推荐的DEX */
    recommendedDEX: string;
    
    /** 相比其他选项的节省金额 */
    totalSavings: BN;
    
    /** 执行策略 */
    executionStrategy: 'SINGLE' | 'SPLIT' | 'ROUTE';
}
```

### TokenBalance

代币余额接口。

```typescript
interface TokenBalance {
    /** 代币mint地址 */
    mint: PublicKey;
    
    /** 原始余额 (最小单位) */
    rawBalance: string;
    
    /** 格式化余额 */
    formattedBalance: number;
    
    /** 代币符号 */
    symbol: string;
    
    /** 小数位数 */
    decimals: number;
    
    /** USD价值 (如果可用) */
    usdValue?: number;
}
```

## 🛠️ 工具函数

### formatTokenAmount()

格式化代币金额。

```typescript
function formatTokenAmount(
    amount: BN | string | number,
    decimals: number,
    precision: number = 6
): string
```

**示例:**
```typescript
const formatted = formatTokenAmount(new BN("1000000"), 6, 2);
console.log(formatted); // "1.00"
```

### parseTokenAmount()

解析代币金额。

```typescript
function parseTokenAmount(amount: string, decimals: number): BN
```

**示例:**
```typescript
const parsed = parseTokenAmount("1.5", 6);
console.log(parsed.toString()); // "1500000"
```

### calculateMinimumOutputAmount()

计算最小输出金额。

```typescript
function calculateMinimumOutputAmount(
    expectedOutput: BN,
    slippageTolerance: number
): BN
```

### validateSwapParams()

验证交换参数。

```typescript
function validateSwapParams(params: SwapParams): ValidationResult
```

## 🔧 配置函数

### getNetworkConfig()

获取网络配置。

```typescript
function getNetworkConfig(networkType: NetworkType): NetworkConfig
```

### getTokenMint()

获取代币mint地址。

```typescript
function getTokenMint(
    symbol: 'SOL' | 'USDC',
    protocol?: 'ORCA' | 'JUPITER' | 'OFFICIAL',
    networkType: NetworkType = NetworkType.DEVNET
): PublicKey
```

### getDEXConfig()

获取DEX配置。

```typescript
function getDEXConfig(dexName: SupportedDEX): DEXConfig
```

## 📝 使用示例

### 完整的交换流程

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import { 
    SwapEngine, 
    SwapDirection, 
    NetworkType,
    validateSwapParams 
} from "./src";
import BN from "bn.js";

async function performSwap() {
    // 1. 初始化
    const connection = new Connection("https://api.devnet.solana.com");
    const wallet = new Wallet(Keypair.generate());
    const swapEngine = new SwapEngine(connection, wallet, NetworkType.DEVNET);
    
    // 2. 准备参数
    const swapParams = {
        direction: SwapDirection.SOL_TO_USDC,
        inputAmount: new BN(0.001 * 1e9), // 0.001 SOL
        minimumOutputAmount: new BN(0),
        slippageTolerance: 0.01 // 1%
    };
    
    // 3. 验证参数
    const validation = validateSwapParams(swapParams);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }
    
    // 4. 获取报价
    const quote = await swapEngine.getSwapQuote(swapParams);
    console.log("最佳报价:", quote.bestQuote);
    
    // 5. 执行交换
    const result = await swapEngine.executeSwap(swapParams);
    
    if (result.success) {
        console.log("交换成功!");
        console.log("交易签名:", result.signature);
        console.log("输出金额:", result.outputAmount.toString());
    } else {
        console.log("交换失败:", result.error);
    }
}
```

### 批量查询余额

```typescript
async function checkBalances() {
    const swapEngine = new SwapEngine(connection, wallet);
    
    // 获取当前余额
    const balances = await swapEngine.getUserBalances();
    
    console.log("当前余额:");
    balances.forEach(balance => {
        console.log(`${balance.symbol}: ${balance.formattedBalance}`);
        if (balance.usdValue) {
            console.log(`  USD价值: $${balance.usdValue.toFixed(2)}`);
        }
    });
}
```

### 比较多个DEX报价

```typescript
async function compareQuotes() {
    const aggregator = new DEXAggregator(connection, protocols);
    
    const route = await aggregator.getAggregatedQuote(
        tokenA,
        tokenB,
        amount,
        slippage
    );
    
    console.log("所有报价:");
    route.allQuotes.forEach((quote, index) => {
        console.log(`${index + 1}. ${quote.dexName}:`);
        console.log(`   输出: ${quote.outputAmount.toString()}`);
        console.log(`   价格影响: ${(quote.priceImpact * 100).toFixed(4)}%`);
        console.log(`   可信度: ${(quote.confidence * 100).toFixed(1)}%`);
    });
    
    console.log(`\n推荐: ${route.recommendedDEX}`);
    console.log(`节省: ${route.totalSavings.toString()}`);
}
```

## ⚠️ 错误处理

### 常见错误类型

1. **网络错误**: RPC连接失败
2. **余额不足**: 用户余额不够支付交易
3. **滑点过大**: 价格变动超出容忍范围
4. **账户未初始化**: 代币账户不存在
5. **参数无效**: 输入参数格式错误

### 错误处理示例

```typescript
try {
    const result = await swapEngine.executeSwap(params);
} catch (error) {
    if (error.message.includes("insufficient funds")) {
        console.log("余额不足，请充值后重试");
    } else if (error.message.includes("slippage")) {
        console.log("滑点过大，请调整滑点设置");
    } else if (error.message.includes("AccountNotInitialized")) {
        console.log("代币账户未初始化，系统将自动创建");
    } else {
        console.log("未知错误:", error.message);
    }
}
```

---

更多详细信息请参考源代码和技术文档。
