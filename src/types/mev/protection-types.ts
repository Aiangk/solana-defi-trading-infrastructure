// MEV 攻击类型: 抢跑、夹子攻击、套利等
// 保护策略: 时间随机化、隐私保护、滑点增强等
// 威胁检测: 实时监控和预警机制

import { PublicKey, Transaction } from '@solana/web3.js'

// MEV 攻击类型枚举
export enum MEVAttackType {
    FRONTRUNNING = 'frontrunning',  // 抢跑攻击
    SANDWICH = 'sandwich',  // 夹子攻击
    ARBITRAGE = 'arbitrage',  // 套利攻击
    LIQUIDATION = 'liquidation', // 清算抢跑
    UNKNOWN = 'unknown'
}

// MEV 保护策略配置
export interface MEVProtectionConfig {
    // 启用的保护策略
    enabledStrategies: MEVProtectionStrategy[]

    // 时间随机化配置
    timingRandomization: {
        enabled: boolean
        minDelay: number  // 最小延迟 (毫秒)
        maxDelay: number  // 最大延迟 （毫秒）
        jitterFactor: number  // 抖动因子 （0-1）
        //重试（Retry）机制中的 jitterFactor
        // 例如：一个 API 请求失败后，客户端可能会等待一段时间再重试（exponential backoff）。
        // 为了防止多个客户端同时重试（造成“雪崩”），我们可以加点“抖动”。
        // 伪代码：
        // const jitter = baseDelay * jitterFactor;
        // const actualDelay = baseDelay + random(-jitter, +jitter);
    }

    // 隐私保护配置
    privacyProtection: {
        enabled: boolean
        useJitoDontFront: boolean  // 使用 Jito 的 DontFront 服务
        addDummyTransactions: boolean  // 添加虚假交易
        obfuscateAmounts: boolean  // 混淆交易金额，obfuscate混淆
    }

    // 滑点保护增强
    slippageProtection: {
        enabled: boolean
        dynamicAdjustment: boolean  // 动态调整滑点
        maxSlippage: number  // 最大滑点(百分比)
        emergencyStop: boolean  // 紧急停止机制
    }

    // 威胁检测机制
    threatDetection: {
        enabled: boolean
        monitoringWindow: number  // 监控窗口 （毫秒）
        suspiciousPatternThreshold: number  // 可疑模式阈值
        autoResponse: boolean  // 自动响应威胁
    }
}

// MEV 保护策略枚举
export enum MEVProtectionStrategy {
    TIMING_RANDOMIZATION = 'timing_randomization',  // 时间随机化 
    PRIVACY_PROTECTION = 'privacy_protection',      // 隐私保护
    SLIPPAGE_ENHANCEMENT = 'slippage_enhancement',   // 滑点增强
    SANDWICH_DETECTION = 'sandwich_detection',      // 夹子探测
    BUNDLE_ATOMICITY = 'bundle_atomicity'   // 原子性
}

// 威胁检测结果
export interface ThreatDetectionResult {
    isThreatDetected: boolean
    attackType: MEVAttackType
    confidence: number  // 置信度 (0-1)
    riskLevel: 'low' | 'medium' | 'high' | 'critical'

    // 威胁详情
    details: {
        suspiciousTransactions: string[] // 可疑交易签名
        attackerAddress: PublicKey[]  // 疑似攻击者地址
        detectionTime: Date
        evidenceData: any  // 证据数据
    }

    // 建议的相应措施
    recommendAction: MEVResponseAction[]
}

// MEV 相应措施
export enum MEVResponseAction {
    DELAY_EXECUTION = 'delay_execution',  // 延迟执行
    INCREASE_SLIPPAGE = 'increase_slippage', // 增加滑点保护
    CANCEL_TRANSACTION = 'cancel_transaction', // 取消交易
    USE_PRIVATE_POOL = 'use_private_pook',  //  使用私有池  
    SPLIT_TRANSACTION = 'split_transaction' // 拆分交易
}

// 保护策略执行结果
export interface ProtectionExectionResult {
    stratey: MEVProtectionStrategy
    applied: boolean
    executionTime: number   // 执行时间（毫秒）

    // 策略效果
    impact: {
        delayAdded: number  //添加的延迟
        slippageAdjusted: number  // 调整的滑点
        privacyEnhanced: boolean  // 是否增强了隐私
        costIncurred: number   // 产生的额外成本
    }

    error?: string
}

// MEV 保护会话
export interface MEVProtectionSession {
    sessionId: string
    startTime: Date
    endTime?: Date

    // 保护的交易
    protectedTransactions: {
        transaction: Transaction
        protectionApplied: MEVProtectionStrategy[]
        result: ProtectionExectionResult[]
    }[]

    // 会话统计
    statistics: {
        threatsDetected: number
        threatsBlocked: number
        averageProtectionTime: number  // 平均保护时间（毫秒）
        totalCostIncurred: number  // 总共产生的额外成本
    }
}


// MEV 保护引擎状态
export interface MEVProtectionEngineStatus {
    isActive: boolean
    activeStrategies: MEVProtectionStrategy[]

    // 实时统计
    realTimeStats: {
        transactionsProtected: number
        threatsDetected: number
        averageProtectionTime: number
        successRate: number
    }

    // 性能指标
    performance: {
        cpuUsage: number
        memoryUsage: number
        networkLatency: number
        lastHealthCheck: Date
    }
}