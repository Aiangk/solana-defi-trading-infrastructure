import { TokenAmount, Token } from "@raydium-io/raydium-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import BN = require('bn.js');

// 常量定义
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
const INPUT_AMOUNT = 0.1; // 0.1 SOL
const SLIPPAGE = 1; // 1%

// API 响应类型定义
interface RaydiumPoolInfo {
    success: boolean;
    data: Array<{
        mintAmountA: string;
        mintAmountB: string;
        [key: string]: any;
    }>;
}

/**
 * 使用 Raydium 官方算法进行价格计算
 * 优先使用 V3 API，失败时使用本地计算
 */
export async function calculateWithRaydiumOfficial(): Promise<{
    amountOut: TokenAmount;
    minAmountOut: TokenAmount;
}> {
    try {
        console.log("📡 尝试调用 Raydium V3 API 获取真实价格...");

        // 1. 使用 Raydium V3 API 获取池子信息（免费！）
        const poolId = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";
        const poolData = await fetch(`https://api-v3.raydium.io/pools/info/ids?ids=${poolId}`);
        const poolInfo = await poolData.json() as RaydiumPoolInfo;

        if (poolInfo.success && poolInfo.data.length > 0) {
            const pool = poolInfo.data[0];

            console.log("✅ API 调用成功，使用真实池子数据计算");

            // 2. 手动实现 Raydium 的恒定乘积计算
            const baseReserve = new BN(pool.mintAmountA);
            const quoteReserve = new BN(pool.mintAmountB);
            const amountIn = new BN(INPUT_AMOUNT * 10 ** 9);

            // 3. Raydium 官方算法实现
            const { amountOut, minAmountOut } = computeAmountOutOfficial(
                baseReserve,
                quoteReserve,
                amountIn,
                SLIPPAGE / 100
            );

            console.log("✅ 使用 Raydium 官方算法计算完成");

            // 创建输出代币对象
            const outputToken = new Token(TOKEN_PROGRAM_ID, USDC_MINT, 6, "USDC", "USD Coin");

            return {
                amountOut: new TokenAmount(outputToken, amountOut),
                minAmountOut: new TokenAmount(outputToken, minAmountOut)
            };
        }
    } catch (error) {
        console.log("⚠️ API 调用失败，使用本地计算:", error);
    }

    // 备用方案：本地计算
    console.log("🔄 使用本地恒定乘积算法计算...");
    return calculateLocalPrice();
}

/**
 * Raydium 官方恒定乘积算法实现
 * 基于 x * y = k 公式，考虑手续费和滑点
 */
export function computeAmountOutOfficial(
    baseReserve: BN,
    quoteReserve: BN,
    amountIn: BN,
    slippage: number
): { amountOut: BN; minAmountOut: BN } {
    console.log("🧮 执行恒定乘积公式计算...");
    console.log(`   输入储备: ${baseReserve.toString()} (base), ${quoteReserve.toString()} (quote)`);
    console.log(`   输入金额: ${amountIn.toString()}`);
    console.log(`   滑点容忍: ${(slippage * 100).toFixed(2)}%`);

    // Raydium 手续费：0.25%
    const feeRate = 0.0025;

    // 步骤1：扣除手续费
    // amountInWithFee = amountIn * (1 - feeRate)
    // 使用整数运算避免浮点数精度问题
    const feeRateInt = Math.floor(feeRate * 10000); // 0.0025 * 10000 = 25
    const amountInWithFee = amountIn.mul(new BN(10000 - feeRateInt)).div(new BN(10000));

    console.log(`   扣除手续费后: ${amountInWithFee.toString()}`);

    // 步骤2：恒定乘积计算
    // 公式：(x + Δx) * (y - Δy) = x * y = k
    // 推导：Δy = y - (x * y) / (x + Δx) = (y * Δx) / (x + Δx)
    const numerator = amountInWithFee.mul(quoteReserve);     // Δx * y
    const denominator = baseReserve.add(amountInWithFee);    // x + Δx
    const amountOut = numerator.div(denominator);            // Δy = (Δx * y) / (x + Δx)

    console.log(`   计算结果: ${amountOut.toString()}`);

    // 步骤3：滑点保护
    // minAmountOut = amountOut * (1 - slippage)
    const slippageInt = Math.floor(slippage * 10000); // 转换为整数
    const minAmountOut = amountOut.mul(new BN(10000 - slippageInt)).div(new BN(10000));

    console.log(`   滑点保护后: ${minAmountOut.toString()}`);
    console.log("✅ 恒定乘积计算完成");

    return { amountOut, minAmountOut };
}

/**
 * 本地价格计算（备用方案）
 * 当 API 不可用时使用的简化计算
 */
function calculateLocalPrice(): {
    amountOut: TokenAmount;
    minAmountOut: TokenAmount;
} {
    console.log("🔧 使用本地简化价格计算...");

    // 使用模拟的池子储备进行计算
    const mockBaseReserve = new BN(1000 * 10 ** 9);  // 1000 SOL
    const mockQuoteReserve = new BN(100000 * 10 ** 6); // 100,000 USDC
    const amountIn = new BN(INPUT_AMOUNT * 10 ** 9);

    console.log("📊 使用模拟池子数据:");
    console.log(`   SOL 储备: ${mockBaseReserve.toNumber() / 10 ** 9} SOL`);
    console.log(`   USDC 储备: ${mockQuoteReserve.toNumber() / 10 ** 6} USDC`);

    // 使用相同的官方算法
    const { amountOut, minAmountOut } = computeAmountOutOfficial(
        mockBaseReserve,
        mockQuoteReserve,
        amountIn,
        SLIPPAGE / 100
    );

    // 创建输出代币对象
    const outputToken = new Token(TOKEN_PROGRAM_ID, USDC_MINT, 6, "USDC", "USD Coin");

    console.log("✅ 本地计算完成");

    return {
        amountOut: new TokenAmount(outputToken, amountOut),
        minAmountOut: new TokenAmount(outputToken, minAmountOut)
    };
}

/**
 * 计算价格影响
 * 显示这次交易对池子价格的影响程度
 */
export function calculatePriceImpact(
    baseReserve: BN,
    quoteReserve: BN,
    amountIn: BN,
    amountOut: BN
): number {
    // 计算交易前的价格
    const priceBefore = quoteReserve.mul(new BN(10 ** 18)).div(baseReserve);

    // 计算交易后的储备
    const newBaseReserve = baseReserve.add(amountIn);
    const newQuoteReserve = quoteReserve.sub(amountOut);

    // 计算交易后的价格
    const priceAfter = newQuoteReserve.mul(new BN(10 ** 18)).div(newBaseReserve);

    // 计算价格影响百分比
    const priceImpact = priceBefore.sub(priceAfter).mul(new BN(10000)).div(priceBefore);

    return priceImpact.toNumber() / 100; // 转换为百分比
}

/**
 * 验证滑点设置是否合理
 * 帮助用户理解滑点的含义和影响
 */
export function validateSlippageSettings(slippage: number): {
    isValid: boolean;
    warning?: string;
    recommendation?: string;
} {
    console.log(`🔍 验证滑点设置: ${slippage}%`);

    if (slippage < 0.1) {
        return {
            isValid: false,
            warning: "滑点设置过低，交易可能频繁失败",
            recommendation: "建议设置至少 0.1%"
        };
    }

    if (slippage > 5) {
        return {
            isValid: true,
            warning: "滑点设置较高，可能遭受 MEV 攻击",
            recommendation: "建议降低到 1-3% 范围内"
        };
    }

    if (slippage >= 0.1 && slippage <= 1) {
        return {
            isValid: true,
            recommendation: "滑点设置合理，适合大多数交易"
        };
    }

    return {
        isValid: true,
        recommendation: "滑点设置可接受"
    };
}

/**
 * 格式化金额显示
 * 将 BN 格式的金额转换为人类可读的格式
 */
export function formatAmount(amount: BN, decimals: number, symbol: string): string {
    const divisor = new BN(10).pow(new BN(decimals));
    const wholePart = amount.div(divisor);
    const fractionalPart = amount.mod(divisor);

    // 计算小数部分
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');

    if (trimmedFractional === '') {
        return `${wholePart.toString()} ${symbol}`;
    } else {
        return `${wholePart.toString()}.${trimmedFractional} ${symbol}`;
    }
}

/**
 * 显示详细的价格计算信息
 * 用于教育目的，帮助理解计算过程
 */
export function displayCalculationDetails(
    baseReserve: BN,
    quoteReserve: BN,
    amountIn: BN,
    amountOut: BN,
    minAmountOut: BN
): void {
    console.log("\n📊 详细计算信息:");
    console.log("=".repeat(50));

    console.log("🏊 池子状态:");
    console.log(`   SOL 储备: ${formatAmount(baseReserve, 9, "SOL")}`);
    console.log(`   USDC 储备: ${formatAmount(quoteReserve, 6, "USDC")}`);

    const currentPrice = quoteReserve.mul(new BN(10 ** 9)).div(baseReserve).toNumber() / 10 ** 6;
    console.log(`   当前价格: 1 SOL = ${currentPrice.toFixed(6)} USDC`);

    console.log("\n💱 交易详情:");
    console.log(`   输入金额: ${formatAmount(amountIn, 9, "SOL")}`);
    console.log(`   预期输出: ${formatAmount(amountOut, 6, "USDC")}`);
    console.log(`   最小输出: ${formatAmount(minAmountOut, 6, "USDC")}`);

    const effectivePrice = amountOut.mul(new BN(10 ** 9)).div(amountIn).toNumber() / 10 ** 6;
    console.log(`   实际价格: 1 SOL = ${effectivePrice.toFixed(6)} USDC`);

    const priceImpact = calculatePriceImpact(baseReserve, quoteReserve, amountIn, amountOut);
    console.log(`   价格影响: ${priceImpact.toFixed(4)}%`);

    console.log("=".repeat(50));
}
