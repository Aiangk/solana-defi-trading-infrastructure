import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * 交换方向枚举
 */
export enum SwapDirection {
    /** SOL转换为USDC */
    SOL_TO_USDC = 'SOL_TO_USDC',
    /** USDC转换为SOL */
    USDC_TO_SOL = 'USDC_TO_SOL'
}

/**
 * 交换参数
 */
export interface SwapParams {
    /** 交换方向 */
    direction: SwapDirection;
    
    /** 输入金额 */
    inputAmount: BN;
    
    /** 最小输出金额 */
    minimumOutputAmount: BN;
    
    /** 滑点容忍度 (0.01 = 1%) */
    slippageTolerance: number;
}

/**
 * 交换账户信息
 */
export interface SwapAccounts {
    /** 用户钱包地址 */
    wallet: PublicKey;
    
    /** 代币A账户地址 */
    tokenAccountA: PublicKey;
    
    /** 代币B账户地址 */
    tokenAccountB: PublicKey;
}

/**
 * 交换结果
 */
export interface SwapResult {
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

/**
 * 代币信息
 */
export interface TokenInfo {
    /** 代币mint地址 */
    mint: PublicKey;
    
    /** 代币符号 */
    symbol: string;
    
    /** 小数位数 */
    decimals: number;
    
    /** 代币名称 */
    name?: string;
    
    /** 代币图标URL */
    logoURI?: string;
}

/**
 * 池子信息
 */
export interface PoolInfo {
    /** 池子地址 */
    address: PublicKey;
    
    /** 代币A信息 */
    tokenA: TokenInfo;
    
    /** 代币B信息 */
    tokenB: TokenInfo;
    
    /** 流动性 */
    liquidity: BN;
    
    /** 24小时交易量 */
    volume24h?: BN;
    
    /** 手续费率 */
    feeRate: number;
    
    /** 协议名称 */
    protocol: string;
}

/**
 * 交换配置
 */
export interface SwapConfig {
    /** 默认滑点容忍度 */
    defaultSlippage: number;
    
    /** 最大滑点容忍度 */
    maxSlippage: number;
    
    /** 最小SOL交易量 */
    minSolAmount: number;
    
    /** 最小USDC交易量 */
    minUsdcAmount: number;
    
    /** 交易超时时间 (秒) */
    timeoutSeconds: number;
    
    /** 是否启用MEV保护 */
    mevProtection: boolean;
}
