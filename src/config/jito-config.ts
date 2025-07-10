// 环境配置: 不同网络环境的端点和参数
// 默认策略: 生产环境推荐的配置
// 性能调优: 基于官方建议的优化参数

import { PublicKey } from '@solana/web3.js'
import { JitoConfig, NetworkEndpoints } from '../types/jito/jito-types'
import { BundleOptions, TipStrategy } from '../types/jito/bundle-types'

// 官方 Jito Block Engine 端点
export const JITO_ENDPOINTS: NetworkEndpoints = {
    mainnet: 'https://mainnet.block-engine.jito.wtf/api/v1',
    devnet: 'https://testnet.block-engine.jito.wtf/api/v1',
    testnet: 'https://testnet.block-engine.jito.wtf/api/v1'
}
// 多区域端点配置 -- 基于官方文档
export const JITO_REGIONAL_ENDPOINTS = {
    mainnet: {
        // 全球负载均衡端点
        global: 'https://mainnet.block-engine.jito.wtf/api/v1',

        // 区域特定端点
        amsterdam: 'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1',
        frankfurt: 'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1',
        london: 'https://london.mainnet.block-engine.jito.wtf/api/v1',
        newyork: 'https://ny.mainnet.block-engine.jito.wtf/api/v1',
        saltlakecity: 'https://slc.mainnet.block-engine.jito.wtf/api/v1',
        singapore: 'https://singapore.mainnet.block-engine.jito.wtf/api/v1',
        tokyo: 'https://tokyo.mainnet.block-engine.jito.wtf/api/v1'
    },
    testnet: {
        global: 'https://testnet.block-engine.jito.wtf/api/v1',
        dallas: 'https://dallas.testnet.block-engine.jito.wtf/api/v1',
        newyork: 'https://ny.testnet.block-engine.jito.wtf/api/v1'
    },
    devnet: {
        global: 'https://testnet.block-engine.jito.wtf/api/v1',
        dallas: 'https://dallas.testnet.block-engine.jito.wtf/api/v1',
        newyork: 'https://ny.testnet.block-engine.jito.wtf/api/v1'
    }
} as const

// 区域优先级配置 -- 基于地理位置和延迟
export const REGION_PRIORITY_CONFIG = {
    // 亚洲用户优先级
    asia: ['singapore', 'tokyo', 'frankfurt', 'amsterdam', 'london', 'newyork', 'saltlakecity'],

    // 欧洲用户优先级  
    europe: ['frankfurt', 'amsterdam', 'london', 'singapore', 'tokyo', 'newyork', 'saltlakecity'],

    // 北美用户优先级
    america: ['newyork', 'saltlakecity', 'frankfurt', 'amsterdam', 'london', 'singapore', 'tokyo'],

    // 默认全球优先级
    global: ['singapore', 'frankfurt', 'newyork', 'amsterdam', 'london', 'tokyo', 'saltlakecity']
} as const

// 区域健康状态跟踪
export interface RegionHealthStatus {
    region: string
    endpoint: string
    isHealthy: boolean
    lastChecked: Date
    responseTime: number
    errorCount: number
    successCount: number
    rateLimitHit: boolean
    lastRateLimitTime?: Date
}

// 区域切换配置
export interface RegionSwitchConfig {
    // 启动自动区域切换
    enableAutoSwitch: boolean

    // 健康检查间隔（毫秒）
    healthCheckInterval: number

    // 区域切换阈值
    switchThresholds: {
        maxErrorRate: number      // 最大错误率（0-1）
        maxResponseTime: number   // 最大响应时间（毫秒）
        rateLimitCooldown: number // 速率限制后切换的冷却时间（毫秒）
    }

    // 用户地理位置偏好
    userRegion: 'asia' | 'europe' | 'america' | 'global'

    // 并发健康检查
    enableConcurrentHealthCheck: boolean
}

// 默认区域切换配置
export const DEFAULT_REGION_SWITCH_CONFIG: RegionSwitchConfig = {
    enableAutoSwitch: true,
    healthCheckInterval: 30000, // 30秒检查一次
    switchThresholds: {
        maxErrorRate: 0.3,        // 30% 错误率触发切换
        maxResponseTime: 5000,    // 5秒响应时间触发切换
        rateLimitCooldown: 60000  // 1分钟限流冷却
    },
    userRegion: 'global',
    enableConcurrentHealthCheck: true
}

// 官方小费账户(主网)
export const MAINNET_TIP_ACCOUNTS = [
    new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
    new PublicKey('HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe'),
    new PublicKey('Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY'),
    new PublicKey('ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49'),
    new PublicKey('DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh'),
    new PublicKey('ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt'),
    new PublicKey('DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL'),
    new PublicKey('3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT')
]

// 官方小费账户（测试网）
export const TESTNET_TIP_ACCOUNTS = [
    new PublicKey('B1mrQSpdeMU9gCvkJ6VsXVVoYjRGkNA7TtjMyqxrhecH'),
    new PublicKey('aTtUk2DHgLhKZRDjePq6eiHRKC1XXFMBiSUfQ2JNDbN'),
    new PublicKey('E2eSqe33tuhAHKTrwky5uEjaVqnb2T9ns6nHHUrN8588'),
    new PublicKey('4xgEmT58RwTNsF5xm2RMYCnR1EVukdK8a1i2qFjnJFu3'),
    new PublicKey('EoW3SUQap7ZeynXQ2QJ847aerhxbPVr843uMeTfc9dxM'),
    new PublicKey('ARTtviJkLLt6cHGQDydfo1Wyk6M4VGZdKZ2ZhdnJL336'),
    new PublicKey('9n3d1K5YD2vECAbRFhFFGYNNjiXtHXJWn9F31t89vsAV'),
    new PublicKey('9ttgPBBhRYFuQccdR1DSnb7hydsWANoDsV3P9kaGMCEh')
]

// 默认小费策略
export const DEFAULT_TIP_STRATEGY: TipStrategy = {
    mode: 'auto',
    percentile: 50, //使用中位数小费
    maxTip: 100000  // 最大 0.1 SOL
}

// 生产环境推荐配置
export const PRODUCTION_JITO_CONFIG: JitoConfig = {
    network: 'mainnet',

    defaultBundleOptions: {
        encoding: 'base64',
        priority: 'medium',
        maxRetries: 3,
        timeoutMs: 60000,  // 60秒超时
        enableMevProtection: true,
        tipStrategy: DEFAULT_TIP_STRATEGY
    },

    tipConfig: {
        defaultStrategy: DEFAULT_TIP_STRATEGY,
        minTip: 1000,  // 官方最小要求：1000 lamports  0.001 SOL
        maxTip: 1000000,  // 最大 1 SOL
        tipAccounts: MAINNET_TIP_ACCOUNTS
    },

    performance: {
        enableMetrics: true,
        logLevel: 'info',
        maxConcurrentBundles: 5, //限制并发数
        statusCheckInterval: 2000, // 2秒检查一次状态
    },

    retry: {
        maxAttempts: 3,
        baseDelay: 1000,  // 1秒基础延迟
        maxDelay: 10000,   // 最大10秒延迟
        backoffMultiplier: 2  // 退避倍数
    }
}


// 开发环境配置 - 使用 mainnet 以获得更好的稳定性
export const DEVELOPMENT_JITO_CONFIG: JitoConfig = {
    ...PRODUCTION_JITO_CONFIG,
    network: 'mainnet',  // 改为 mainnet，因为 testnet 不稳定

    tipConfig: {
        ...PRODUCTION_JITO_CONFIG.tipConfig,
        minTip: 1000,
        maxTip: 10000,    // 开发环境限制更低
        tipAccounts: MAINNET_TIP_ACCOUNTS  // 使用 mainnet 账户
    },

    performance: {
        ...PRODUCTION_JITO_CONFIG.performance,
        logLevel: 'debug',       // 开发环境启用详细日志
        maxConcurrentBundles: 2, // 开发环境降低并发
    }
}


// 根据环境获取配置
export function getJitoConfig(environment: 'production' |
    'development' = 'production'): JitoConfig {
    switch (environment) {
        case 'production':
            return PRODUCTION_JITO_CONFIG;
        case 'development':
            return DEVELOPMENT_JITO_CONFIG;
        default:
            return PRODUCTION_JITO_CONFIG;
    }
}

// 小费策略预设
export const TIP_STRATEGY = {
    // 低优先级：适用于非紧急交易
    LOW_PRIORITY: {
        mode: 'auto' as const,
        percentile: 25,
        maxTip: 10000
    },

    // 中等优先级：日常交易推荐
    MEDIUM_PRIORITY: {
        mode: 'auto' as const,
        percentile: 50,
        maxTip: 50000
    },

    // 高优先级：重要交易
    HIGH_PRIORITY: {
        mode: 'auto' as const,
        percentile: 75,
        maxTip: 100000
    },

    // 紧急优先级：关键交易
    URGENT_PRIORITY: {
        mode: 'auto' as const,
        percentile: 95,
        maxTip: 1000000
    }
} as const

// Bundle 配置预设
export const BUNDLE_PRESETS = {
    // 快速交易：低延迟，中等保护
    FAST_TRADE: {
        encoding: 'base64' as const,
        priority: 'high' as const,
        maxRetries: 2,
        timeoutMs: 30000,
        enableMevProtection: true,
        tipStrategy: TIP_STRATEGY.HIGH_PRIORITY
    },

    // 安全交易：高保护，可接受延迟
    SECURE_TRADE: {
        encoding: 'base64' as const,
        priority: 'medium' as const,
        maxRetries: 5,
        timeoutMs: 120000,
        enableMevProtection: true,
        tipStrategy: TIP_STRATEGY.MEDIUM_PRIORITY
    },

    // 经济型交易：低成本，基础保护
    ECONOMY_TRADE: {
        encoding: 'base64' as const,
        priority: 'low' as const,
        maxRetries: 3,
        timeoutMs: 60000,
        enableMevProtection: false,
        tipStrategy: TIP_STRATEGY.LOW_PRIORITY
    }
} as const