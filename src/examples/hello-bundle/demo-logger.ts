/**
 * 演示日志工具
 * 提供结构化的日志输出和性能追踪
 */
export class DemoLogger {
    private startTime: number
    private stepTimes: Map<string, number>
    private enableVerbose: boolean
    private context: string

    constructor(context?: string | boolean, enableVerbose: boolean = true) {
        this.startTime = Date.now()
        this.stepTimes = new Map()

        // 处理重载：支持旧的 boolean 参数和新的 context 参数
        if (typeof context === 'boolean') {
            this.enableVerbose = context
            this.context = 'Demo'
        } else {
            this.context = context || 'Demo'
            this.enableVerbose = enableVerbose
        }
    }

    /**
     * 记录步骤开始时间
     */
    startStep(stepName: string): void {
        this.stepTimes.set(stepName, Date.now())
        if (this.enableVerbose) {
            console.log(`🚀 [${this.getTimestamp()}] 开始: ${stepName}`)
        }
    }

    /**
     * 记录步骤完成时间
     */
    endStep(stepName: string): void {
        const startTime = this.stepTimes.get(stepName)
        if (startTime) {
            const duration = Date.now() - startTime
            console.log(`✅ [${this.getTimestamp()}] 完成: ${stepName} (耗时: ${duration}ms)`)
        }
    }

    /**
     * 简化的步骤记录方法（兼容性）
     */
    step(stepName: string): void {
        this.startStep(stepName)
    }

    /**
     * 记录错误
     */
    error(message: string, error?: any): void {
        console.error(`❌ [${this.getTimestamp()}] 错误: ${message}`)
        if (error && this.enableVerbose) {
            console.error('详细错误信息:', error)
        }
    }

    /**
     * 记录警告
     */
    warn(message: string): void {
        console.warn(`⚠️  [${this.getTimestamp()}] 警告: ${message}`)
    }

    /**
     * 记录信息
     */
    info(message: string): void {
        console.log(`ℹ️  [${this.getTimestamp()}] 信息: ${message}`)
    }

    /**
     * 记录成功
     */
    success(message: string): void {
        console.log(`🎉 [${this.getTimestamp()}] 成功: ${message}`)
    }

    /**
     * 记录性能统计
     */
    logPerformanceStats(stats: any): void {
        console.log('\n📊 性能统计:')
        console.log('=====================================')
        Object.entries(stats).forEach(([key, value]) => {
            console.log(`${key}: ${value}`)
        })
        console.log('=====================================\n')
    }

    /**
     * 记录 Bundle 状态变化
     */
    logBundleStatus(bundleId: string, status: string, details?: any): void {
        const statusEmoji = this.getStatusEmoji(status)
        console.log(`${statusEmoji} [${this.getTimestamp()}] Bundle ${bundleId}: ${status}`)

        if (details && this.enableVerbose) {
            console.log('详细信息:', JSON.stringify(details, null, 2))
        }
    }

    /**
     * 获取总执行时间
     */
    getTotalTime(): number {
        return Date.now() - this.startTime
    }

    /**
     * 私有方法：获取时间戳
     */
    private getTimestamp(): string {
        return new Date().toISOString().substring(11, 23)
    }

    /**
     * 私有方法：获取状态对应的表情符号
     */
    private getStatusEmoji(status: string): string {
        const emojiMap: Record<string, string> = {
            'PENDING': '⏳',
            'PROCESSING': '🔄',
            'LANDED': '✅',
            'FAILED': '❌',
            'TIMEOUT': '⏰',
            'CANCELLED': '🚫',
            'CREATED': '📝',
            'SUBMITTED': '📤',
            'CONFIRMED': '✅',
            'RETRY': '🔄'
        }
        return emojiMap[status] || '📋'
    }
}

/**
 * 创建格式化的分隔线
 */
export function createSeparator(title: string, width: number = 50): string {
    const padding = Math.max(0, width - title.length - 2)
    const leftPad = Math.floor(padding / 2)
    const rightPad = padding - leftPad
    return '='.repeat(leftPad) + ` ${title} ` + '='.repeat(rightPad)
}

/**
 * 格式化 Bundle 信息显示
 */
export function formatBundleInfo(bundle: any): string {
    return `
Bundle ID: ${bundle.id}
Jito Bundle ID: ${bundle.bundleId || '未分配'}
状态: ${bundle.status}
交易数量: ${bundle.transactions.length}
创建时间: ${bundle.createdAt.toISOString()}
重试次数: ${bundle.retryCount}
${bundle.error ? `错误: ${bundle.error.message}` : ''}
  `.trim()
}