import { getJitoConfig, BUNDLE_PRESETS } from '../../config/jito-config'
import { BundleManagerConfig } from '../../types/jito/bundle-manager-types'
import { PerformanceMonitorConfig } from '../../core/jito/bundle-performance-monitor'
import { RetryConfig, RetryStrategy, ErrorCategory } from '../../core/jito/bundle-retry-manager'

/**
 * 演示专用配置
 * 针对 Hello Bundle 演示优化的配置参数
 */
export interface DemoConfig {
    // 基础 Jito 配置
    jito: ReturnType<typeof getJitoConfig>

    // Bundle 管理器配置
    bundleManager: BundleManagerConfig

    // 性能监控配置
    performanceMonitor: PerformanceMonitorConfig

    // 重试管理配置
    retryManager: RetryConfig

    // 演示特定配置
    demo: {
        // 演示交易数量
        transactionCount: number
        // 演示 Bundle 数量
        bundleCount: number
        // 是否启用详细日志
        enableVerboseLogging: boolean
        // 演示超时时间
        demoTimeoutMs: number
    }
}

/**
 * 获取演示配置
 * 为不同演示场景提供预设配置
 * scenario: 设想
 */
export function getDemoConfig(scenario: 'basic' | 'stress' | 'production' | 'local'): DemoConfig {
    const baseJitoConfig = getJitoConfig('development')

    const baseConfig: DemoConfig = {
        jito: baseJitoConfig,

        bundleManager: {
            maxConcurrentBundles: 3,
            statusCheckInterval: 3000, //3秒检查间隔
            bundleTimeout: 45000, // 45秒超时
            enableAutoRetry: true,
            enablePerformanceMonitoring: true,
            enableEventNotifications: true
        },

        performanceMonitor: {
            enableDetailedMonitoring: true,
            dataRetentionTime: 5 * 60 * 1000, // 5分钟
            reportInterval: 10000, // 10秒报告间隔
            enableAlerts: true,
            thresholds: {
                maxConfirmationTime: 30000, // 30秒最大确认时间
                minSuccessRate: 80, // 80% 最小成功率
                maxAverageTip: 50000, // 0.05 SOL 最大平均小费
                maxRetryRate: 20 // 20% 最大重试率
            }
        },
        retryManager: {
            strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
            maxAttempts: 3,
            baseDelay: 2000, // 2秒基础延迟
            maxDelay: 15000, // 15秒最大延迟
            backoffMultiplier: 2,
            jitterFactor: 0.1, // 添加10%抖动因子
            retryableErrors: [  // 添加可重试错误类型
                ErrorCategory.NETWORK_ERROR,
                ErrorCategory.TIMEOUT_ERROR,
                ErrorCategory.RATE_LIMIT_ERROR,
                ErrorCategory.SYSTEM_ERROR,
                ErrorCategory.UNKNOWN_ERROR
            ]
        },

        demo: {
            transactionCount: 2,
            bundleCount: 1,
            enableVerboseLogging: true,
            demoTimeoutMs: 60000
        }
    }

    // 根据场景调整配置
    switch (scenario) {
        case 'basic':
            return baseConfig

        case 'stress':
            return {
                ...baseConfig,
                bundleManager: {
                    ...baseConfig.bundleManager,
                    maxConcurrentBundles: 5
                },
                demo: {
                    ...baseConfig.demo,
                    transactionCount: 10,
                    bundleCount: 3,
                    demoTimeoutMs: 120000
                }
            }
        case 'production':
            return {
                ...baseConfig,
                jito: getJitoConfig('production'),
                performanceMonitor: {
                    ...baseConfig.performanceMonitor,
                    reportInterval: 60000,            // ✅ 生产环境降低报告频率到1分钟
                    thresholds: {
                        ...baseConfig.performanceMonitor.thresholds,
                        maxConfirmationTime: 45000,     // ✅ 生产环境更严格的阈值
                        minSuccessRate: 95,             // ✅ 生产环境要求更高成功率
                    }
                },
                demo: {
                    ...baseConfig.demo,
                    enableVerboseLogging: false,      // ✅ 生产环境减少日志噪音
                    demoTimeoutMs: 30000              // ✅ 生产环境更短的演示超时
                }
            }

        case 'local':
            // 本地测试环境：模拟 Bundle 行为，避开网络拥堵
            return {
                ...baseConfig,
                bundleManager: {
                    ...baseConfig.bundleManager,
                    maxConcurrentBundles: 1,
                    statusCheckInterval: 1000, // 1秒检查间隔
                    bundleTimeout: 10000, // 10秒超时
                },
                demo: {
                    ...baseConfig.demo,
                    transactionCount: 2,
                    bundleCount: 1,
                    enableVerboseLogging: true,
                    demoTimeoutMs: 15000 // 15秒演示超时
                }
            }

        default:
            return baseConfig
    }
}