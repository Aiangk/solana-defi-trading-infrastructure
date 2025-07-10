import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

/**
 * 统一交易请求接口
 * 整合所有DEX协议的交易参数
 */
export interface SwapRequest {
    /** 输入代币地址 */
    inputToken: PublicKey;

    /** 输出代币地址 */
    outputToken: PublicKey;

    /** 输入金额 */
    inputAmount: BN;

    /** 滑点容忍度 (0.01 = 1%) */
    slippage: number;

    /** 用户钱包地址 */
    userWallet: PublicKey;

    /** 交易优先级 */
    priority?: SwapPriority;

    /** 是否启用MEV保护 */
    enableMevProtection?: boolean;

    /** 指定使用的DEX (可选，不指定则自动选择最优) */
    preferredDex?: string;

    /** 最大可接受的价格影响 */
    maxPriceImpact?: number;

    /** 交易截止时间（Unix 时间戳） */
    deadline?: number;
}

/**
 * 交易优先级枚举
 */
export enum SwapPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    URGENT = 'urgent'
}

/**
 * 报价请求接口
 */
export interface QuoteRequest {
    /** 输入代币地址 */
    inputToken: PublicKey;

    /** 输出代币地址 */
    outputToken: PublicKey;

    /** 输入金额 */
    inputAmount: BN;

    /** 滑点容忍度 (0.01 = 1%) */
    slippage: number;

    /** 是否包含所有 DEX 的报价 */
    includeAllQuotes?: boolean;

    /** 排除的 DEX 列表 */
    excludeDexes?: string[];
}

/**
 * MEV 保护交易请求
 */
export interface ProtectedSwapRequest extends SwapRequest {
    /** Bundle 优先级 */
    bundlePriority: 'low' | 'medium' | 'high' | 'urgent';

    /** 自定义小费金额（lamports） */
    customTip?: number;

    /** 是否启用前置运行保护 */
    enableFrontrunProtection: boolean;

    /** 最大等待时间（毫秒） */
    maxWaitTime?: number;
}

/**
 * 批量交易请求
 */
export interface BatchSwapRequest {
    /** 交易列表 */
    swaps: SwapRequest[];

    /** 是否作为原子操作执行 */
    atomic: boolean;

    /** 批量执行策略 */
    strategy: BatchStrategy;

    /** 是否启用 MEV 保护 */
    enableMevProtection?: boolean;
}


/**
 * 批量执行策略
 */
export enum BatchStrategy {
    /** 并行执行 */
    PARALLEL = 'parallel',

    /** 顺序执行 */
    SEQUENTIAL = 'sequential',

    /** 智能执行 （根据依赖关系自动选择） */
    SMART = 'smart'
}