import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { NATIVE_MINT } from "@solana/spl-token";

/**
 * 代币工具函数集合
 * 提供代币相关的常用工具函数
 */

/**
 * 格式化代币金额
 * 将最小单位的代币金额转换为可读格式
 * @param amount 原始金额 (最小单位)
 * @param decimals 小数位数
 * @param precision 显示精度 (默认: 6位小数)
 * @returns 格式化后的金额字符串
 */
export function formatTokenAmount(
    amount: BN | string | number,
    decimals: number,
    precision: number = 6
): string {
    const amountBN = typeof amount === 'string' || typeof amount === 'number' 
        ? new BN(amount) 
        : amount;
    
    const divisor = new BN(10).pow(new BN(decimals));
    const quotient = amountBN.div(divisor);
    const remainder = amountBN.mod(divisor);
    
    // 计算小数部分
    const decimalPart = remainder.toNumber() / Math.pow(10, decimals);
    const formattedDecimal = decimalPart.toFixed(precision).substring(2);
    
    return `${quotient.toString()}.${formattedDecimal}`;
}

/**
 * 解析代币金额
 * 将可读格式的代币金额转换为最小单位
 * @param amount 格式化的金额字符串
 * @param decimals 小数位数
 * @returns 最小单位的金额
 */
export function parseTokenAmount(amount: string, decimals: number): BN {
    const [integerPart, decimalPart = ''] = amount.split('.');
    
    // 补齐或截断小数部分到指定位数
    const paddedDecimal = decimalPart.padEnd(decimals, '0').substring(0, decimals);
    
    // 组合整数和小数部分
    const fullAmount = integerPart + paddedDecimal;
    
    return new BN(fullAmount);
}

/**
 * 检查是否为原生SOL
 * @param mint 代币mint地址
 * @returns 是否为原生SOL
 */
export function isNativeSOL(mint: PublicKey): boolean {
    return mint.equals(NATIVE_MINT);
}

/**
 * 检查是否为Wrapped SOL
 * @param mint 代币mint地址
 * @returns 是否为WSOL
 */
export function isWrappedSOL(mint: PublicKey): boolean {
    return mint.equals(NATIVE_MINT);
}

/**
 * 获取代币符号的显示名称
 * @param mint 代币mint地址
 * @returns 代币符号
 */
export function getTokenSymbol(mint: PublicKey): string {
    // 已知代币地址映射
    const knownTokens: Record<string, string> = {
        'So11111111111111111111111111111111111111112': 'SOL',
        'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k': 'devUSDC',
        '7UTBhm5Q88UqEUNkp1hvDCEV4VpWwfvDME1jUeEe3nE2': 'devUSDC',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT'
    };
    
    return knownTokens[mint.toBase58()] || mint.toBase58().substring(0, 8) + '...';
}

/**
 * 计算价格影响
 * @param inputAmount 输入金额
 * @param outputAmount 输出金额
 * @param marketPrice 市场价格
 * @returns 价格影响百分比
 */
export function calculatePriceImpact(
    inputAmount: BN,
    outputAmount: BN,
    marketPrice: number
): number {
    const expectedOutput = inputAmount.toNumber() * marketPrice;
    const actualOutput = outputAmount.toNumber();
    
    if (expectedOutput === 0) return 0;
    
    return Math.abs((expectedOutput - actualOutput) / expectedOutput);
}

/**
 * 计算滑点保护的最小输出金额
 * @param expectedOutput 预期输出金额
 * @param slippageTolerance 滑点容忍度 (0.01 = 1%)
 * @returns 最小输出金额
 */
export function calculateMinimumOutputAmount(
    expectedOutput: BN,
    slippageTolerance: number
): BN {
    const slippageMultiplier = Math.floor((1 - slippageTolerance) * 10000);
    return expectedOutput.muln(slippageMultiplier).divn(10000);
}

/**
 * 验证代币mint地址格式
 * @param mint 代币mint地址字符串
 * @returns 是否为有效格式
 */
export function isValidMintAddress(mint: string): boolean {
    try {
        new PublicKey(mint);
        return true;
    } catch {
        return false;
    }
}

/**
 * 比较两个代币金额
 * @param amountA 金额A
 * @param amountB 金额B
 * @returns 比较结果 (-1: A<B, 0: A=B, 1: A>B)
 */
export function compareTokenAmounts(amountA: BN, amountB: BN): number {
    return amountA.cmp(amountB);
}

/**
 * 计算代币金额的百分比
 * @param amount 总金额
 * @param percentage 百分比 (0.1 = 10%)
 * @returns 计算后的金额
 */
export function calculatePercentageAmount(amount: BN, percentage: number): BN {
    const multiplier = Math.floor(percentage * 10000);
    return amount.muln(multiplier).divn(10000);
}

/**
 * 格式化价格影响显示
 * @param priceImpact 价格影响 (0.01 = 1%)
 * @returns 格式化的价格影响字符串
 */
export function formatPriceImpact(priceImpact: number): string {
    const percentage = priceImpact * 100;
    
    if (percentage < 0.01) {
        return '<0.01%';
    } else if (percentage < 1) {
        return `${percentage.toFixed(2)}%`;
    } else {
        return `${percentage.toFixed(1)}%`;
    }
}

/**
 * 获取代币精度建议
 * @param decimals 代币小数位数
 * @returns 建议的显示精度
 */
export function getRecommendedPrecision(decimals: number): number {
    if (decimals <= 2) return decimals;
    if (decimals <= 6) return 4;
    return 6;
}

/**
 * 验证交易金额是否合理
 * @param amount 交易金额
 * @param decimals 代币小数位数
 * @param minAmount 最小金额限制
 * @param maxAmount 最大金额限制
 * @returns 验证结果
 */
export function validateTransactionAmount(
    amount: BN,
    decimals: number,
    minAmount?: number,
    maxAmount?: number
): { isValid: boolean; error?: string } {
    if (amount.lte(new BN(0))) {
        return { isValid: false, error: "交易金额必须大于0" };
    }
    
    const formattedAmount = parseFloat(formatTokenAmount(amount, decimals));
    
    if (minAmount && formattedAmount < minAmount) {
        return { 
            isValid: false, 
            error: `交易金额不能小于 ${minAmount}` 
        };
    }
    
    if (maxAmount && formattedAmount > maxAmount) {
        return { 
            isValid: false, 
            error: `交易金额不能大于 ${maxAmount}` 
        };
    }
    
    return { isValid: true };
}

/**
 * 代币金额常量
 */
export const TOKEN_AMOUNT_CONSTANTS = {
    /** 零金额 */
    ZERO: new BN(0),
    
    /** 1 SOL (lamports) */
    ONE_SOL: new BN(1_000_000_000),
    
    /** 1 USDC (micro USDC) */
    ONE_USDC: new BN(1_000_000),
    
    /** 最小SOL交易金额 (0.001 SOL) */
    MIN_SOL_AMOUNT: new BN(1_000_000),
    
    /** 最小USDC交易金额 (0.01 USDC) */
    MIN_USDC_AMOUNT: new BN(10_000)
};
