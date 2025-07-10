import { BundleInstance } from '../../types/jito/bundle-manager-types'
import { BundleStatus } from '../../types/jito/bundle-types'
import { JitoError } from '../../types/jito/jito-types'

/**
 * 重试策略类型
 */
export enum RetryStrategy {
    IMMEDIATE = 'immediate', //立即重试
    LINEAR_BACKOFF = 'liner_backoff', // 线性退避
    EXPONENTIAL_BACKOFF = 'exponential_backoff', // 指数退避
    ADAPTIVE = 'adaptive'   // 自适应策略
}

/**
 * 错误分类
 */
export enum ErrorCategory {
    NETWORK_ERROR = 'network_error', // 网络错误
    VALIDATION_ERROR = 'validation_error', // 验证错误
    TIMEOUT_ERROR = 'timeout_error', // 超时错误
    RATE_LIMIT_ERROR = 'rate_limit_error', // 限流错误
    SYSTEM_ERROR = 'system_error', // 系统错误
    UNKNOWN_ERROR = 'unknown_error' // 未知错误
}

/**\
 * 重试配置
 */
export interface RetryConfig {
    // 重试策略
    strategy: RetryStrategy
    // 最大重试次数
    maxAttempts: number
    // 基础延迟时间（毫秒）
    baseDelay: number
    // 最大延迟时间（毫秒）
    maxDelay: number
    // 退避倍数
    backoffMultiplier: number
    // 抖动因子（0-1）
    jitterFactor: number
    // 可重试的错误类型
    retryableErrors: ErrorCategory[]
}

/**
 * 重试决策结果
 */
export interface RetryDecision {
    // 是否应该重试
    shouldRetry: boolean
    // 延迟时间（毫秒）
    delayMs: number
    // 决策原因
    reason: string
    // 建议的策略调整
    strategyAdjustment?: Partial<RetryConfig>
}

/**
 * 错误分析结果
 */
export interface ErrorAnalysis {
    // 错误分类
    category: ErrorCategory
    // 是否可重试
    isRetryable: boolean
    // 建议的处理方式(重试，中止，升级)
    recommendedAction: 'retry' | 'abort' | 'escalate'
    // 错误严重程度
    severity: 'low' | 'medium' | 'high' | 'critical'
    // 分析详情
    details: string
}

/**
 *  Bundle 重试管理器
 * 实现智能重试机制和错误分类
 */
export class BundleRetryManager {
    private config: RetryConfig
    private errorHistory: Map<string, JitoError[]>
    private retryHistory: Map<string, number[]>
    private networkConditions: {
        latency: number
        errorRate: number
        lastUpdated: Date
    }

    constructor(config?: Partial<RetryConfig>) {
        this.config = this.mergeConfig(config)
        this.errorHistory = new Map()
        this.retryHistory = new Map()
        this.networkConditions = {
            latency: 0,
            errorRate: 0,
            lastUpdated: new Date()
        }
    }

    // ==================== 公共方法 ====================

    /**
     * 分析错误并做出重试决策
     * 这是重试管理器的核心方法
     */
    makeRetryDecision(bundle: BundleInstance, error: JitoError): RetryDecision {
        // 1. 分析错误类型
        const errorAnalysis = this.analyzeError(error)

        // 2. 检查重试次数限制
        if (bundle.retryCount >= this.config.maxAttempts) {
            return {
                shouldRetry: false,
                delayMs: 0,
                reason: `Maximum retry attempts (${this.config.maxAttempts}) exceeded`,
                strategyAdjustment: undefined
            }
        }

        // 3. 检查错误是否可重试
        if (!errorAnalysis.isRetryable) {
            return {
                shouldRetry: false,
                delayMs: 0,
                reason: `Error category '${errorAnalysis.category}' is not retryable`,
                strategyAdjustment: undefined
            }
        }

        // 4. 计算延迟时间
        const delayMs = this.calculateRetryDelay(bundle, errorAnalysis)

        // 5. 检查网络状况
        const networkAdjustment = this.analyzeNetworkConditions(bundle, errorAnalysis)

        // 6. 记录错误历史
        this.recordError(bundle.id, error)

        return {
            shouldRetry: true,
            delayMs,
            reason: `Retrying due to ${errorAnalysis.category} (attempt ${bundle.retryCount + 1}/${this.config.maxAttempts})`,
            strategyAdjustment: networkAdjustment
        }
    }

    /**
     * 分析错误类型和严重程度
     */
    analyzeError(error: JitoError): ErrorAnalysis {
        const errorMessage = error.message.toLowerCase()
        const errorCode = error.code.toLowerCase()

        // 网络相关错误
        if (this.isNetworkError(errorMessage, errorCode)) {
            return {
                category: ErrorCategory.NETWORK_ERROR,
                isRetryable: true,
                recommendedAction: 'retry',
                severity: 'medium',
                details: 'Network connectivity issue, likely temporary'
            }
        }

        // 超时错误
        if (this.isTimeoutError(errorMessage, errorCode)) {
            return {
                category: ErrorCategory.TIMEOUT_ERROR,
                isRetryable: true,
                recommendedAction: 'retry',
                severity: 'medium',
                details: 'Request timed out, may succeed on retry'
            }
        }

        // 限流错误
        if (this.isRateLimitError(errorMessage, errorCode)) {
            return {
                category: ErrorCategory.RATE_LIMIT_ERROR,
                isRetryable: true,
                recommendedAction: 'retry',
                severity: 'low',
                details: 'Rate limit exceeded, should retry with backoff'
            }
        }

        // 验证错误
        if (this.isValidationError(errorMessage, errorCode)) {
            return {
                category: ErrorCategory.VALIDATION_ERROR,
                isRetryable: false,
                recommendedAction: 'abort',
                severity: 'high',
                details: 'Transaction validation failed, retry unlikely to succeed'
            }
        }

        // 系统错误
        if (this.isSystemError(errorMessage, errorCode)) {
            return {
                category: ErrorCategory.SYSTEM_ERROR,
                isRetryable: true,
                recommendedAction: 'escalate',
                severity: 'high',
                details: 'System-level error, may require manual intervention'
            }
        }

        // 未知错误
        return {
            category: ErrorCategory.UNKNOWN_ERROR,
            isRetryable: true,
            recommendedAction: 'retry',
            severity: 'medium',
            details: 'Unknown error type, attempting retry with caution'
        }
    }

    /**
   * 更新网络状况
   * 基于最近的错误和延迟情况更新网络状况评估
   */
    updateNetworkConditions(latency: number, errorOccurred: boolean): void {
        this.networkConditions.latency = latency

        // 计算最近的错误率
        const recentErrors = Array.from(this.errorHistory.values())
            .flat()
            .filter(error => {
                const errorAge = Date.now() - error.timestamp.getTime()
                return errorAge < 5 * 60 * 1000 // 最近5分钟
            })

        const totalRecentBundles = Math.max(recentErrors.length * 2, 10) // 估算总Bundle数
        this.networkConditions.errorRate = recentErrors.length / totalRecentBundles
        this.networkConditions.lastUpdated = new Date()

        this.log('debug', `Network conditions updated: latency=${latency}ms, errorRate=${(this.networkConditions.errorRate * 100).toFixed(1)}%`)
    }

    /**
   * 获取重试统计信息
   */
    getRetryStatistics(): {
        totalRetries: number
        successfulRetries: number
        failedRetries: number
        averageRetryDelay: number
        commonErrorCategories: Array<{ category: ErrorCategory; count: number }>
    } {
        const allErrors = Array.from(this.errorHistory.values()).flat()
        const allRetryDelays = Array.from(this.retryHistory.values()).flat()

        // 统计错误类别
        const errorCategoryCounts = new Map<ErrorCategory, number>()
        allErrors.forEach(error => {
            const analysis = this.analyzeError(error)
            const count = errorCategoryCounts.get(analysis.category) || 0
            errorCategoryCounts.set(analysis.category, count + 1)
        })

        const commonErrorCategories = Array.from(errorCategoryCounts.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)

        return {
            totalRetries: allRetryDelays.length,
            successfulRetries: 0, // 需要从外部传入成功信息
            failedRetries: allErrors.length,
            averageRetryDelay: allRetryDelays.length > 0
                ? allRetryDelays.reduce((sum, delay) => sum + delay, 0) / allRetryDelays.length
                : 0,
            commonErrorCategories
        }
    }

    // ==================== 私有方法 ====================

    /**
     * 合并配置
     */
    private mergeConfig(userConfig?: Partial<RetryConfig>): RetryConfig {
        const defaultConfig: RetryConfig = {
            strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
            maxAttempts: 3,
            baseDelay: 1000, // 1秒
            maxDelay: 30000, // 30秒
            backoffMultiplier: 2,
            jitterFactor: 0.1,
            retryableErrors: [
                ErrorCategory.NETWORK_ERROR,
                ErrorCategory.TIMEOUT_ERROR,
                ErrorCategory.RATE_LIMIT_ERROR,
                ErrorCategory.SYSTEM_ERROR,
                ErrorCategory.UNKNOWN_ERROR
            ]
        }

        return { ...defaultConfig, ...userConfig }
    }

    /**
     * 计算重试延迟
     */
    private calculateRetryDelay(bundle: BundleInstance, errorAnalysis: ErrorAnalysis): number {
        const attempt = bundle.retryCount + 1
        let delay: number

        switch (this.config.strategy) {
            case RetryStrategy.IMMEDIATE:
                delay = 0
                break

            case RetryStrategy.LINEAR_BACKOFF:
                delay = this.config.baseDelay * attempt
                break

            case RetryStrategy.EXPONENTIAL_BACKOFF:
                delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)
                break

            case RetryStrategy.ADAPTIVE:
                delay = this.calculateAdaptiveDelay(bundle, errorAnalysis)
                break

            default:
                delay = this.config.baseDelay
        }

        // 应用最大延迟限制
        delay = Math.min(delay, this.config.maxDelay)

        // 添加抖动以避免惊群效应
        if (this.config.jitterFactor > 0) {
            const jitter = delay * this.config.jitterFactor * (Math.random() - 0.5)
            delay += jitter
        }

        // 根据错误类型调整延迟
        delay = this.adjustDelayForErrorType(delay, errorAnalysis)

        return Math.max(0, Math.round(delay))
    }

    /**
   * 计算自适应延迟
   * 根据网络状况和错误历史动态调整延迟
   */
    private calculateAdaptiveDelay(bundle: BundleInstance, errorAnalysis: ErrorAnalysis): number {
        let baseDelay = this.config.baseDelay

        // 根据网络延迟调整
        if (this.networkConditions.latency > 1000) {
            baseDelay *= 2 // 网络慢时增加延迟
        } else if (this.networkConditions.latency < 200) {
            baseDelay *= 0.5 // 网络快时减少延迟
        }

        // 根据错误率调整
        if (this.networkConditions.errorRate > 0.2) {
            baseDelay *= 3 // 错误率高时大幅增加延迟
        } else if (this.networkConditions.errorRate < 0.05) {
            baseDelay *= 0.8 // 错误率低时稍微减少延迟
        }

        // 指数退避
        const attempt = bundle.retryCount + 1
        return baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)
    }

    /**
     * 根据错误类型调整延迟
     */
    private adjustDelayForErrorType(delay: number, errorAnalysis: ErrorAnalysis): number {
        switch (errorAnalysis.category) {
            case ErrorCategory.RATE_LIMIT_ERROR:
                return delay * 2 // 限流错误需要更长延迟
            case ErrorCategory.NETWORK_ERROR:
                return delay * 1.5 // 网络错误稍微增加延迟
            case ErrorCategory.TIMEOUT_ERROR:
                return delay * 1.2 // 超时错误略微增加延迟
            case ErrorCategory.SYSTEM_ERROR:
                return delay * 3 // 系统错误需要更长等待
            default:
                return delay
        }
    }

    /**
   * 分析网络状况并建议策略调整
   */
    private analyzeNetworkConditions(bundle: BundleInstance, errorAnalysis: ErrorAnalysis): Partial<RetryConfig> | undefined {
        const conditions = this.networkConditions

        // 网络状况良好，可以更激进
        if (conditions.latency < 200 && conditions.errorRate < 0.05) {
            return {
                strategy: RetryStrategy.LINEAR_BACKOFF,
                baseDelay: 500,
                maxAttempts: 5
            }
        }

        // 网络状况较差，需要保守策略
        if (conditions.latency > 1000 || conditions.errorRate > 0.2) {
            return {
                strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
                baseDelay: 2000,
                maxAttempts: 2,
                backoffMultiplier: 3
            }
        }

        // 特定错误类型的调整
        if (errorAnalysis.category === ErrorCategory.RATE_LIMIT_ERROR) {
            return {
                strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
                baseDelay: 5000,
                backoffMultiplier: 2
            }
        }

        return undefined // 无需调整
    }

    /**
     * 记录错误历史
     */
    private recordError(bundleId: string, error: JitoError): void {
        if (!this.errorHistory.has(bundleId)) {
            this.errorHistory.set(bundleId, [])
        }

        const errors = this.errorHistory.get(bundleId)!
        errors.push(error)

        // 限制每个Bundle的错误记录数量
        if (errors.length > 10) {
            errors.shift() // 移除最老的错误记录
        }
    }

    /**
     * 记录重试延迟
     */
    private recordRetryDelay(bundleId: string, delay: number): void {
        if (!this.retryHistory.has(bundleId)) {
            this.retryHistory.set(bundleId, [])
        }

        const delays = this.retryHistory.get(bundleId)!
        delays.push(delay)

        // 限制记录数量
        if (delays.length > 10) {
            delays.shift()
        }
    }

    /**
     * 检查是否为网络错误
     */
    private isNetworkError(message: string, code: string): boolean {
        const networkKeywords = [
            'network', 'connection', 'timeout', 'unreachable',
            'dns', 'socket', 'econnreset', 'enotfound'
        ]
        return networkKeywords.some(keyword =>
            message.includes(keyword) || code.includes(keyword)
        )
    }

    /**
     * 检查是否为超时错误
     */
    private isTimeoutError(message: string, code: string): boolean {
        const timeoutKeywords = ['timeout', 'timed out', 'deadline', 'expired']
        return timeoutKeywords.some(keyword =>
            message.includes(keyword) || code.includes(keyword)
        )
    }

    /**
     * 检查是否为限流错误
     */
    private isRateLimitError(message: string, code: string): boolean {
        const rateLimitKeywords = [
            'rate limit', 'too many requests', 'quota', 'throttle',
            '429', 'rate_limit', 'limit_exceeded'
        ]
        return rateLimitKeywords.some(keyword =>
            message.includes(keyword) || code.includes(keyword)
        )
    }

    /**
     * 检查是否为验证错误
     */
    private isValidationError(message: string, code: string): boolean {
        const validationKeywords = [
            'invalid', 'validation', 'signature', 'unauthorized',
            'forbidden', 'bad request', '400', '401', '403'
        ]
        return validationKeywords.some(keyword =>
            message.includes(keyword) || code.includes(keyword)
        )
    }

    /**
     * 检查是否为系统错误
     */
    private isSystemError(message: string, code: string): boolean {
        const systemKeywords = [
            'internal server error', '500', '502', '503', '504',
            'service unavailable', 'maintenance', 'system'
        ]
        return systemKeywords.some(keyword =>
            message.includes(keyword) || code.includes(keyword)
        )
    }

    /**
     * 日志记录
     */
    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] [${level.toUpperCase()}] [RetryManager] ${message}`)
    }
}

// 导出别名以保持向后兼容
export { BundleRetryManager as RetryManager }