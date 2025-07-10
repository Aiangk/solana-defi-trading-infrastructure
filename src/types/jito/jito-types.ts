// JitoConfig: Jito 客户端的完整配置
// NetworkEndpoints: 不同网络环境的端点配置
// TipAccountInfo: 小费账户的详细信息
// BundlePerformanceMetrics: Bundle 性能监控指标

import { PublicKey } from '@solana/web3.js'
import { BundleOptions, TipStrategy } from './bundle-types'

// Jito 网络端点配置
export interface NetworkEndpoints {
    mainnet: string
    devnet: string
    testnet: string
}

// Jito 客户端配置
export interface JitoConfig {
    // 网络配置
    network: 'mainnet' | 'devnet' | 'testnet'
    endpoint?: string // 自定义端点，覆盖默认配置
    uuid?: string  // API 密钥 （可选）

    // 默认 Bundle 配置
    defaultBundleOptions: Partial<BundleOptions> //它的类型是 BundleOptions 的一个可选子集。

    // 小费配置
    tipConfig: {
        defaultStrategy: TipStrategy
        minTip: number // 最小小费 (lamports)
        maxTip: number // 最大小费 (lamports)
        tipAccounts?: PublicKey[] // 缓存的小费账户
    }

    // 性能配置
    performance: {
        enableMetrics: boolean  // 启用指标
        logLevel: 'debug' | 'info' | 'warn' | 'error'
        maxConcurrentBundles: number  // 最大并发捆绑包数
        statusCheckInterval: number // 状态检查间隔（毫秒）
    }

    // 重试配置
    retry: {
        maxAttempts: number
        baseDelay: number // 基础延迟 （毫秒）
        maxDelay: number // 最大延迟 （毫秒）
        backoffMultiplier: number // 退避倍数
        // //什么是指数退避（Exponential Backoff）？
        // 当请求发生失败（如网络错误、超时或被限流）时，不是立即重试，而是等待一段时间后再尝试。
        // 每次重试等待时间会按固定比例 指数 增加，以避免短时间内频繁打满服务器，提供系统恢复时间
    }
}

// 小费账户信息
export interface TipAccountInfo {
    publicKey: PublicKey
    balance: number
    isActive: boolean
    lastUsed?: Date
    // Date 在 TypeScript 中确实代表 JavaScript 的内置日期类型。
    // lastUsed? 表示这是一个 可选属性。
    // 如果赋值了，值必须是 Date 类型，否则会在编译时报错。
    // 如果不传（赋 undefined），也是合法的，因为属性本身是可选的。
}

// Bundle 性能指标
export interface BundlePerformanceMetrics {
    totalBundles: number
    successfulBundles: number
    failedBundles: number
    averageConfirmationTime: number // 平均确认时间 (毫秒)
    averageTipAmount: number  // 平均小费金额
    successRate: number  // 成功率 （0-1）


    // 时间统计
    lastHourMetrics: {
        bundleCount: number
        successRate: number
        averageTip: number
    }
}

// 错误类型定义
export interface JitoError {
    code: string
    message: string
    details?: any
    timestamp: Date
    bundleId?: string
    operation?: string
    retryable?: boolean
}

// Bundle 重试信息
export interface RetryInfo {
    attempt: number
    maxAttempts: number
    lastError?: JitoError
    nextRetryAt?: Date
    backoffDelay: number
}

// 网络状态信息
export interface NetworkStatus {
    isHealthy: boolean
    latency: number // 网络延迟(毫秒)
    congestionLevel: 'low' | 'medium' | 'high' //congestionLevel 拥堵程度
    recommendedTipPercentile: number
    lastUpdated: Date
}

// 在现有类型定义后添加

export type JitoRegion = 'amsterdam' | 'frankfurt' | 'london' | 'newyork' | 'saltlakecity' | 'singapore' | 'tokyo' | 'dallas' | 'global'

export interface RegionalEndpoints {
    [region: string]: string
}

export interface NetworkRegionalEndpoints {
    mainnet: RegionalEndpoints
    testnet: RegionalEndpoints
}

export interface RegionHealthMetrics {
    region: JitoRegion
    endpoint: string
    isHealthy: boolean
    responseTime: number
    errorRate: number
    lastRateLimitTime?: Date
    consecutiveErrors: number
    lastSuccessTime: Date
}

export interface RegionSwitchEvent {
    fromRegion: JitoRegion
    toRegion: JitoRegion
    reason: 'rate_limit' | 'timeout' | 'error_rate' | 'manual'
    timestamp: Date
    metrics?: RegionHealthMetrics
}