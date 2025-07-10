// 简化集成: 开发者只需要学习一个接口，就能使用所有功能
// 隐藏复杂性: 内部的 Bundle 管理、DEX 选择、MEV 保护等复杂逻辑对用户透明
// 企业级特性: 提供成本估算、性能监控、系统状态等生产环境必需的功能
// 向后兼容: 未来添加新的 DEX 或功能时，接口保持稳定

import { PublicKey } from "@solana/web3.js";
import BN from 'bn.js'

// 导入已经完成的类型定义
import {
    SwapRequest,
    QuoteRequest,
    ProtectedSwapRequest,
    BatchSwapRequest,
    SwapPriority
} from '../../types/facade/swap-types'

import {
    SwapResult,
    OptimalQuote,
    BundleResult,
    BatchResult
} from '../../types/facade/result-types'

// 导入现有的核心组件
import { DEXAggregator } from "../aggregator/dex-aggregator";
import { BundleManager } from '../jito/bundle-manager';
import { DEXProtocol } from '../../types/dex/protocol';

/**
 * 统一 DEX Facade 接口
 * 
 * 这是整个交易系统的统一接口点,提供：
 * 1. 简化的 API 接口
 * 2. 自动的 MEV 保护
 * 3. 智能路由选择
 * 4. 企业级错误处理
 */
export interface IUnifiedDexFacade {
    // ==================== 核心交易方法 ====================

    /**
     * 执行代币交换
     * 自动选择最优 DEX 并执行交易
     * @param request 交换请求参数
     * @returns 交换结果
     */
    executeSwap(request: SwapRequest): Promise<SwapResult>;

    /**
     * 获取最优报价
     * 聚合所有 DEX 的报价并返回最优选择
     * @param request 报价请求参数
     * @returns 最优报价信息
     */
    getOptimalQuote(request: QuoteRequest): Promise<OptimalQuote>;

    /**
     * 执行 MEV 保护交易
     * 使用 Jito Bundle 系统提供 MEV 保护
     * @param request MEV 保护交易请求
     * @returns Bundle 执行结果
     */
    executeProtectedSwap(request: ProtectedSwapRequest): Promise<BundleResult>;

    /**
     * 执行批量交易
     * 支持多种批量执行策略
     * @param request 批量交易请求
     * @returns 批量执行结果
     */
    executeBatchSwaps(request: BatchSwapRequest): Promise<BatchResult>;

    // ==================== 高级功能 ====================

    /**
     * 预估交易成本
     * 包括 gas 费、DEX 手续费、MEV 保护费用等
     * @param request 交易请求
     * @returns 成本估算
     */
    estimateTransactionCost(request: SwapRequest): Promise<TransactionCostEstimate>;

    /**
     * 获取支持的代币对
     * 返回所有支持的交易对信息
     * @returns 支持的代币对列表
     */
    getSupportedPairs(): Promise<TradingPair[]>;

    /**
     * 获取实时市场数据
     * 提供价格、流动性、交易量等信息
     * @param tokenPair 代币对
     * @returns 市场数据
     */
    getMarketData(tokenPair: TradingPair): Promise<MarketData>;

    // ==================== 系统管理 ====================

    /**
     * 获取系统状态
     * 返回各个组件的健康状态
     * @returns 系统状态信息
     */
    getSystemStatus(): Promise<SystemStatus>;

    /**
    * 获取性能统计
    * 返回交易成功率、平均执行时间等指标
    * @returns 性能统计数据
    */
    getPerformanceStats(): Promise<PerformanceStats>;
}


/**
 * 交易成本估算
 */
export interface TransactionCostEstimate {
    /** 网络 Gas 费 (lamports) */
    networkFee: BN;

    /** DEX 手续费 (lamports) */
    dexFee: BN;

    /** MEV 保护费用 (lamports) */
    mevProtectionFee: BN;

    /** 总成本 (lamports) */
    totalCost: BN;

    /** 成本占交易金额的百分比 */
    costPercentage: number;
}

/**
 * 交易对信息
 */
export interface TradingPair {
    /** 基础代币 */
    baseToken: PublicKey;

    /** 报价代币 */
    quoteToken: PublicKey;

    /** 支持的 DEX 列表 */
    supportedDexes: string[];

    /** 最小交易金额 */
    minTradeAmount: BN;

    /** 最大交易金额 */
    maxTradeAmount: BN;
}

/**
 * 市场数据
 */
export interface MarketData {
    /** 当前价格 */
    currentPrice: number;

    /** 24小时价格变化 */
    priceChange24h: number;

    /** 24小时交易量 */
    volume24h: BN;

    /** 流动性 */
    liquidity: BN;

    /** 最后更新时间 */
    lastUpdated: Date;
}

/**
 * 系统状态
 */
export interface SystemStatus {
    /** 整体健康状态 */
    overall: 'healthy' | 'degraded' | 'unhealthy';

    /** 各组件状态 */
    components: {
        dexAggregator: ComponentStatus;
        bundleManager: ComponentStatus;
        jitoClient: ComponentStatus;
        rpcConnections: ComponentStatus;
    };

    /** 最后检查时间 */
    lastChecked: Date;
}

/**
 * 组件状态
 */
export interface ComponentStatus {
    /** 状态 */
    status: 'online' | 'offline' | 'error';

    /** 响应时间 (毫秒) */
    responseTime?: number;

    /** 错误信息 */
    error?: string;

    /** 最后活动时间 */
    lastActivity: Date;
}

/**
 * 性能统计
 */
export interface PerformanceStats {
    /** 总交易数 */
    totalTransactions: number;

    /** 成功交易数 */
    successfulTransactions: number;

    /** 成功率 */
    successRate: number;

    /** 平均执行时间 (毫秒) */
    averageExecutionTime: number;

    /** 平均节省金额 (相比单一 DEX) */
    averageSavings: BN;

    /** MEV 保护统计 */
    mevProtectionStats: {
        protectedTransactions: number;
        threatsBlocked: number;
        averageProtectionCost: BN;
    };

    /** 统计时间范围 */
    timeRange: {
        start: Date;
        end: Date;
    };
}