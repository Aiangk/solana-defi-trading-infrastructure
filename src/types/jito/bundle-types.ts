// Bundle 配置选项
export interface BundleOptions {
    // 官方 SDK 参数
    encoding?: 'base58' | 'base64'

    // 增强参数
    priority: 'low' | 'medium' | 'high' | 'urgent'
    maxRetries: number
    timeoutMs: number
    enableMevProtection: boolean

    // 小费策略
    tipStrategy: TipStrategy
}

// 小费策略定义
export interface TipStrategy {
    mode: 'auto' | 'manual'
    amount?: number // 手动模式下的固定小费
    percentile?: number // 自动模式下的百分位数 （25，50, 75, 95）
    maxTip?: number // 最大小费限制
}

// Bundle 提交结果
export interface BundleSubmissionResult {
    bundleId: string
    status: 'submitted' | 'failed'
    estimatedConfirmationTime: number
    tipAmount: number
    transactionCount: number
    error?: string
}

// Bundle 状态枚举
export enum BundleStatus {
    PENDING = 'Pending',  // 待办
    PROCESSING = 'Processing',
    LANDED = 'Landed',
    FAILED = 'Failed',
    INVALID = 'Invalid',
    TIMEOUT = 'Timeout'
}

// Bundle 监控结果
export interface BundleStatusResult {
    bundleId: string
    status: BundleStatus
    slot?: number
    confirmationStatus?: 'processed' | 'confirmed' | 'finalized'
    transactions?: string[]
    landedAt?: Date
    error?: any
}