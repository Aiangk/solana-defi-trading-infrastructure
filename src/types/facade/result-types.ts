import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { DEXQuote } from "../dex/protocol";
import { BundleInstance } from "../jito/bundle-manager-types";

/**
 * 统一交易结果接口
 */
export interface SwapResult {
    /** 交易是否成功 */
    success: boolean;

    /** 交易签名 */
    signature?: string;

    /** 使用的 DEX */
    executedDex: string;

    /** 实际输入金额 */
    actualInputAmount: BN;

    /** 实际输出金额 */
    actualOutputAmount: BN;

    /** 实际价格影响 */
    actualPriceImpact: number;

    /** 交易费用 */
    transactionFee: BN;

    /** 执行时间（毫秒） */
    executionTime: number;

    /** 错误信息 (如果失败) */
    error?: SwapError;

    /** 交易详情 */
    details: SwapDetails;
}

/**
 * 最优报价结果
 */
export interface OptimalQuote {
    /** 推荐的最佳报价 */
    bestQuote: DEXQuote;

    /** 所有可用报价 */
    allQuotes: DEXQuote[];

    /** 推荐原因  */
    recommendation: QuoteRecommendation;

    /** 相比其他选项的优势 */
    advantages: string[];

    /** 风险评估 */
    riskAssessment: RiskLevel;

    /** 预估执行成功率 */
    successProbability: number;

}

/**
 * Bundle 执行结果
 */
export interface BundleResult extends SwapResult {
    /** Bundle ID */
    bundleId: string;

    /** Bundle 状态 */
    bundleStatus: 'pending' | 'processing' | 'confirmed' | 'failed';

    /** MEV 保护详情 */
    mevProtection: MevProtectionDetails;

    /** Bundle 实例引用 */
    bundleInstance?: BundleInstance;
}

/**
 * 批量交易结果
 */
export interface BatchResult {
    /** 整体执行状态 */
    overallSuccess: boolean;
    /** 成功的交易数量 */
    successCount: number;
    /** 失败的交易数量 */
    failureCount: number;
    /** 各个交易的结果 */
    results: SwapResult[];
    /** 总执行时间 */
    totalExecutionTime: number;
    /** 批量执行统计 */
    statistics: BatchStatistics;
}

/**
 * 交易错误信息
 */
export interface SwapError {
    /** 错误代码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 错误类型 */
    type: ErrorType;
    /** 是否可重试 */
    retryable: boolean;
    /** 建议的解决方案 */
    suggestion?: string;
}

/**
 * 交易详情
 */
export interface SwapDetails {
    /** 使用的路由路径 */
    route: PublicKey[];
    /** 中间代币（如果有） */
    intermediateTokens?: PublicKey[];
    /** 交易指令数量 */
    instructionCount: number;
    /** 计算单元消耗 */
    computeUnitsUsed: number;
    /** 网络拥堵级别 */
    networkCongestion: 'low' | 'medium' | 'high';
    /** 执行策略 */
    executionStrategy: string;
}

/**
 * 报价推荐信息
 */
export interface QuoteRecommendation {
    /** 推荐原因 */
    reason: 'best_price' | 'lowest_impact' | 'highest_liquidity' | 'fastest_execution';
    /** 详细说明 */
    explanation: string;
    /** 置信度（0-1） */
    confidence: number;
}

/**
 * MEV 保护详情
 */
export interface MevProtectionDetails {
    /** 保护级别 */
    protectionLevel: 'basic' | 'standard' | 'premium';
    /** 检测到的 MEV 威胁 */
    detectedThreats: string[];
    /** 应用的保护措施 */
    appliedProtections: string[];
    /** 小费金额 */
    tipAmount: number;
    /** 保护成本 */
    protectionCost: BN;
}

/**
 * 风险级别枚举
 */
export enum RiskLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
    NETWORK_ERROR = 'network_error',
    INSUFFICIENT_BALANCE = 'insufficient_balance',
    SLIPPAGE_EXCEEDED = 'slippage_exceeded',
    DEADLINE_EXCEEDED = 'deadline_exceeded',
    POOL_NOT_FOUND = 'pool_not_found',
    MEV_PROTECTION_FAILED = 'mev_protection_failed',
    BUNDLE_FAILED = 'bundle_failed',
    UNKNOWN_ERROR = 'unknown_error'
}

/**
 * 批量执行统计
 */
export interface BatchStatistics {
    /** 平均执行时间 */
    averageExecutionTime: number;

    /** 总节省金额 */
    totalSavings: BN;

    /** 成功率 */
    successRate: number;

    /** 使用的 DEX 分布 */
    dexDistribution: Record<string, number>;

    /** MEV 保护统计 */
    mevProtectionStats?: {
        protectedTransactions: number;
        totalProtectionCost: BN;
        threatsBlocked: number;
    };
}
