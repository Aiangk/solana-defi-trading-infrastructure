import { BundleInstance, BundleManagerStats, BundleEventType, BundleEvent } from "../../types/jito/bundle-manager-types";
import { BundleStatus } from '../../types/jito/bundle-types'

/**
 * Bundle 性能监控器配置
 */
export interface PerformanceMonitorConfig {
    // 是否启用详细监控
    enableDetailedMonitoring: boolean
    // 性能数据保留时间（毫秒）
    dataRetentionTime: number
    // 性能报告生成间隔（毫秒）
    reportInterval: number
    // 是否启用实时警报
    enableAlerts: boolean
    // 性能阈值配置
    thresholds: PerformanceThresholds
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
    // 最大确认时间（毫秒）
    maxConfirmationTime: number
    // 最小成功率（百分比）
    minSuccessRate: number
    // 最大平均小费（lamports）
    maxAverageTip: number
    // 最大重试率（百分比）
    maxRetryRate: number
}

/**
 * 详细性能指标
 */
export interface DetailedPerformanceMetrics {
    // 时间段
    timeWindow: {
        start: Date
        end: Date
    }
    // Bundle 统计
    bundleStats: {
        total: number
        successful: number
        failed: number
        timeout: number
        retried: number
    }
    // 时间统计
    timeStats: {
        averageSubmissionTime: number
        averageConfirmationTime: number
        averageTotalTime: number
        p50ConfirmationTime: number
        p95ConfirmationTime: number
        p99ConfirmationTime: number
    }
    // 成本统计
    costStats: {
        averageTip: number
        totalTips: number
        tipEfficiency: number // 成功率/平均小费
    }
    // 错误统计
    errorStats: {
        errorRate: number
        timeoutRate: number
        retryRate: number
        commonErrors: Array<{
            code: string
            count: number
            percentage: number
        }>
    }
}

/**
 * 性能警报
 */
export interface PerformanceAlert {
    // 警报类型
    type: 'HIGH_CONFIRMATION_TIME' | 'LOW_SUCCESS_RATE' | 'HIGH_TIP_COST' | 'HIGH_ERROR_RATE'
    // 警报级别
    level: 'WARNING' | 'CRITICAL'
    // 警报消息
    message: string
    // 当前值
    currentValue: number
    // 阈值
    threshold: number
    // 触发时间
    timestamp: Date
    // 相关数据
    data?: any
}

/**
 * Bundle 性能监控器
 * 专门负责收集，分析和报告 Bundle 的执行性能
 */
export class BundlePerformanceMonitor {
    private config: PerformanceMonitorConfig
    private performanceHistory: BundleInstance[]
    private alerts: PerformanceAlert[]
    private reportTimer?: NodeJS.Timeout

    constructor(config?: Partial<PerformanceMonitorConfig>) {
        this.config = this.mergeConfig(config)
        this.performanceHistory = []
        this.alerts = []
    }

    // ==================== 公共方法 ====================

    /**
     * 记录 Bundle 性能数据
     * 当 Bundle 状态发生变化时调用
     */
    recordBundlePerformance(bundle: BundleInstance): void {
        if (!this.config.enableDetailedMonitoring) return

        // 添加到历史记录
        this.performanceHistory.push({ ...bundle })

        // 清理过期数据
        this.cleanupExpiredData()

        // 检查性能阈值
        if (this.config.enableAlerts) {
            this.checkPerformanceThresholds(bundle)
        }
    }

    /**
     * 处理 Bundle 事件
     * 从 Bundle 管理器接收事件并更新性能数据
     */
    handleBundleEvent(event: BundleEvent): void {
        switch (event.type) {
            case BundleEventType.SUBMITTED:
                this.recordSubmissionEvent(event.bundle)
                break
            case BundleEventType.CONFIRMED:
                this.recordConfirmationEvent(event.bundle)
                break
            case BundleEventType.FAILED:
                this.recordFailureEvent(event.bundle)
                break
            case BundleEventType.TIMEOUT:
                this.recordTimeoutEvent(event.bundle)
                break
            case BundleEventType.RETRY:
                this.recordRetryEvent(event.bundle)
                break
        }

        // 更新性能数据
        this.recordBundlePerformance(event.bundle)
    }

    /**
     * 生成详细性能报告
     * 分析指定时间窗口内的性能数据
     */
    generateDetailedReport(timeWindow?: { start: Date, end: Date }): DetailedPerformanceMetrics {
        const window = timeWindow || this.getDefaultTimeWindow()
        const bundles = this.getBundlesInTimeWindow(window)

        return {
            timeWindow: window,
            bundleStats: this.calculateBundleStats(bundles),
            timeStats: this.calculateTimeStats(bundles),
            costStats: this.calculateCostStats(bundles),
            errorStats: this.calculateErrorStats(bundles)
        }
    }

    /**
     * 获取当前警报列表
     */
    getActiveAlerts(): PerformanceAlert[] {
        // 返回最近的警报 （过去1小时内）
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        return this.alerts.filter(alert => alert.timestamp > oneHourAgo)
    }

    /**
     * 清除警报
     */
    clearAlerts(): void {
        this.alerts = []
    }

    /**
     * 启动性能监控
     */
    start(): void {
        if (this.config.reportInterval > 0) {
            this.reportTimer = setInterval(
                () => this.generatePeriodicReport(),
                this.config.reportInterval
                // periodic 定期的
            )
        }
    }

    /**
     * 停止性能监控
     */
    stop(): void {
        if (this.reportTimer) {
            clearInterval(this.reportTimer)
            this.reportTimer = undefined
        }
    }

    // ==================== 私有辅助方法 ====================
    /**
     * 合并配置
     */
    private mergeConfig(userConfig?: Partial<PerformanceMonitorConfig>): PerformanceMonitorConfig {
        const defaultConfig: PerformanceMonitorConfig = {
            enableDetailedMonitoring: true,
            dataRetentionTime: 24 * 60 * 60 * 1000, // 24小时
            reportInterval: 5 * 60 * 1000, // 5分钟
            enableAlerts: true,
            thresholds: {
                maxConfirmationTime: 60000, // 60秒
                minSuccessRate: 90, // 90%
                maxAverageTip: 100000, // 0.1 SOL
                maxRetryRate: 10 // 10%
            }
        }
        return {
            ...defaultConfig,
            ...userConfig,
            thresholds: { ...defaultConfig.thresholds, ...userConfig?.thresholds }
        }
    }

    /**
     * 清理过期数据
     */
    private cleanupExpiredData(): void {
        const cutoffTime = new Date(Date.now() - this.config.dataRetentionTime)
        this.performanceHistory = this.performanceHistory.filter(
            bundle => bundle.createdAt > cutoffTime
        )
    }

    /**
   * 记录提交事件
   */
    private recordSubmissionEvent(bundle: BundleInstance): void {
        // 可以在这里记录提交相关的特定指标
        this.log('debug', `Bundle submitted: ${bundle.id}`)
    }

    /**
     * 记录确认事件
     */
    private recordConfirmationEvent(bundle: BundleInstance): void {
        // 记录成功确认的指标
        this.log('debug', `Bundle confirmed: ${bundle.id} in ${bundle.metrics.totalTime}ms`)
    }

    /**
     * 记录失败事件
     */
    private recordFailureEvent(bundle: BundleInstance): void {
        // 记录失败相关的指标
        this.log('debug', `Bundle failed: ${bundle.id} - ${bundle.error?.message}`)
    }

    /**
     * 记录超时事件
     */
    private recordTimeoutEvent(bundle: BundleInstance): void {
        // 记录超时相关的指标
        this.log('warn', `Bundle timeout: ${bundle.id}`)
    }

    /**
     * 记录重试事件
     */
    private recordRetryEvent(bundle: BundleInstance): void {
        // 记录重试相关的指标
        this.log('info', `Bundle retry: ${bundle.id} (attempt ${bundle.retryCount})`)
    }

    /**
     * 检查性能阈值
     */
    private checkPerformanceThresholds(bundle: BundleInstance): void {
        const thresholds = this.config.thresholds

        // 检查确认时间
        if (bundle.metrics.confirmationTime && bundle.metrics.confirmationTime > thresholds.maxConfirmationTime) {
            this.createAlert('HIGH_CONFIRMATION_TIME', 'WARNING',
                `Bundle confirmation time (${bundle.metrics.confirmationTime}ms) exceeds threshold`,
                bundle.metrics.confirmationTime, thresholds.maxConfirmationTime, { bundleId: bundle.id })
        }

        // 检查小费金额
        if (bundle.metrics.tipAmount > thresholds.maxAverageTip) {
            this.createAlert('HIGH_TIP_COST', 'WARNING',
                `Bundle tip amount (${bundle.metrics.tipAmount} lamports) exceeds threshold`,
                bundle.metrics.tipAmount, thresholds.maxAverageTip, { bundleId: bundle.id })
        }

        // 定期检查整体成功率和重试率
        if (this.performanceHistory.length >= 10) {
            this.checkOverallMetrics()
        }
    }

    /**
   * 检查整体指标
   */
    private checkOverallMetrics(): void {
        const recentBundles = this.performanceHistory.slice(-50) // 最近50个Bundle
        const thresholds = this.config.thresholds

        // 计算成功率
        const successfulBundles = recentBundles.filter(b => b.status === BundleStatus.LANDED).length
        const successRate = (successfulBundles / recentBundles.length) * 100

        if (successRate < thresholds.minSuccessRate) {
            this.createAlert('LOW_SUCCESS_RATE', 'CRITICAL',
                `Success rate (${successRate.toFixed(1)}%) below threshold`,
                successRate, thresholds.minSuccessRate)
        }

        // 计算重试率
        const retriedBundles = recentBundles.filter(b => b.retryCount > 0).length
        const retryRate = (retriedBundles / recentBundles.length) * 100

        if (retryRate > thresholds.maxRetryRate) {
            this.createAlert('HIGH_ERROR_RATE', 'WARNING',
                `Retry rate (${retryRate.toFixed(1)}%) exceeds threshold`,
                retryRate, thresholds.maxRetryRate)
        }
    }


    /**
     * 创建警报
     */
    private createAlert(
        type: PerformanceAlert['type'],
        level: PerformanceAlert['level'],
        message: string,
        currentValue: number,
        threshold: number,
        data?: any
    ): void {
        const alert: PerformanceAlert = {
            type,
            level,
            message,
            currentValue,
            threshold,
            timestamp: new Date(),
            data
        }

        this.alerts.push(alert)
        this.log(level === 'CRITICAL' ? 'error' : 'warn', `Performance Alert: ${message}`)
    }

    /**
   * 获取默认时间窗口（最近1小时）
   */
    private getDefaultTimeWindow(): { start: Date; end: Date } {
        const end = new Date()
        const start = new Date(end.getTime() - 60 * 60 * 1000) // 1小时前
        return { start, end }
    }

    /**
   * 获取时间窗口内的 Bundle
   */
    private getBundlesInTimeWindow(window: { start: Date; end: Date }): BundleInstance[] {
        return this.performanceHistory.filter(bundle =>
            bundle.createdAt >= window.start && bundle.createdAt <= window.end
        )
    }

    /**
   * 计算 Bundle 统计
   */
    private calculateBundleStats(bundles: BundleInstance[]): DetailedPerformanceMetrics['bundleStats'] {
        return {
            total: bundles.length,
            successful: bundles.filter(b => b.status === BundleStatus.LANDED).length,
            failed: bundles.filter(b => b.status === BundleStatus.FAILED).length,
            timeout: bundles.filter(b => b.status === BundleStatus.TIMEOUT).length,
            retried: bundles.filter(b => b.retryCount > 0).length
        }
    }

    /**
   * 计算时间统计
   */
    private calculateTimeStats(bundles: BundleInstance[]): DetailedPerformanceMetrics['timeStats'] {
        const completedBundles = bundles.filter(b => b.metrics.totalTime !== undefined)

        if (completedBundles.length === 0) {
            return {
                averageSubmissionTime: 0,
                averageConfirmationTime: 0,
                averageTotalTime: 0,
                p50ConfirmationTime: 0,
                p95ConfirmationTime: 0,
                p99ConfirmationTime: 0
            }
        }

        // 计算平均值
        const avgSubmission = this.calculateAverage(completedBundles, b => b.metrics.submissionTime || 0)
        const avgConfirmation = this.calculateAverage(completedBundles, b => b.metrics.confirmationTime || 0)
        const avgTotal = this.calculateAverage(completedBundles, b => b.metrics.totalTime || 0)

        // 计算百分位数
        const confirmationTimes = completedBundles
            .map(b => b.metrics.confirmationTime || 0)
            .filter(time => time > 0)
            .sort((a, b) => a - b)

        return {
            averageSubmissionTime: avgSubmission,
            averageConfirmationTime: avgConfirmation,
            averageTotalTime: avgTotal,
            p50ConfirmationTime: this.calculatePercentile(confirmationTimes, 50),
            p95ConfirmationTime: this.calculatePercentile(confirmationTimes, 95),
            p99ConfirmationTime: this.calculatePercentile(confirmationTimes, 99)
        }
    }

    /**
   * 计算成本统计
   */
    private calculateCostStats(bundles: BundleInstance[]): DetailedPerformanceMetrics['costStats'] {
        const bundlesWithTips = bundles.filter(b => b.metrics.tipAmount > 0)

        if (bundlesWithTips.length === 0) {
            return {
                averageTip: 0,
                totalTips: 0,
                tipEfficiency: 0
            }
        }

        const totalTips = bundlesWithTips.reduce((sum, b) => sum + b.metrics.tipAmount, 0)
        const averageTip = totalTips / bundlesWithTips.length

        // 计算小费效率：成功率 / 平均小费
        const successfulBundles = bundles.filter(b => b.status === BundleStatus.LANDED).length
        const successRate = bundles.length > 0 ? successfulBundles / bundles.length : 0
        const tipEfficiency = averageTip > 0 ? successRate / (averageTip / 1000000) : 0 // 转换为SOL单位

        return {
            averageTip,
            totalTips,
            tipEfficiency
        }
    }

    /**
   * 计算错误统计
   */
    private calculateErrorStats(bundles: BundleInstance[]): DetailedPerformanceMetrics['errorStats'] {
        const totalBundles = bundles.length

        if (totalBundles === 0) {
            return {
                errorRate: 0,
                timeoutRate: 0,
                retryRate: 0,
                commonErrors: []
            }
        }

        const failedBundles = bundles.filter(b => b.status === BundleStatus.FAILED).length
        const timeoutBundles = bundles.filter(b => b.status === BundleStatus.TIMEOUT).length
        const retriedBundles = bundles.filter(b => b.retryCount > 0).length

        // 统计常见错误
        const errorCounts = new Map<string, number>()
        bundles.forEach(bundle => {
            if (bundle.error?.code) {
                const count = errorCounts.get(bundle.error.code) || 0
                errorCounts.set(bundle.error.code, count + 1)
            }
        })

        const commonErrors = Array.from(errorCounts.entries())
            .map(([code, count]) => ({
                code,
                count,
                percentage: (count / totalBundles) * 100
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5) // 取前5个最常见的错误

        return {
            errorRate: (failedBundles / totalBundles) * 100,
            timeoutRate: (timeoutBundles / totalBundles) * 100,
            retryRate: (retriedBundles / totalBundles) * 100,
            commonErrors
        }
    }

    /**
   * 计算平均值
   */
    private calculateAverage(items: BundleInstance[], getValue: (item: BundleInstance) => number): number {
        if (items.length === 0) return 0
        const sum = items.reduce((total, item) => total + getValue(item), 0)
        return sum / items.length
    }

    /**
     * 计算百分位数
     */
    private calculatePercentile(sortedArray: number[], percentile: number): number {
        if (sortedArray.length === 0) return 0

        const index = (percentile / 100) * (sortedArray.length - 1)
        //计算百分位对应的“位置索引”
        const lower = Math.floor(index)
        const upper = Math.ceil(index)
        //找到左右两个索引

        if (lower === upper) {
            return sortedArray[lower]
        }

        const weight = index - lower
        //计算权重
        //根据权重进行线性插值
        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
    }

    /**
     * 生成定期报告
     */
    private generatePeriodicReport(): void {
        const report = this.generateDetailedReport()
        this.log('info', `Performance Report - Success Rate: ${report.bundleStats.successful}/${report.bundleStats.total} (${((report.bundleStats.successful / report.bundleStats.total) * 100).toFixed(1)}%)`)
    }

    /**
     * 日志记录
     */
    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] [${level.toUpperCase()}] [PerformanceMonitor] ${message}`)
    }

}

// 导出别名以保持向后兼容
export { BundlePerformanceMonitor as PerformanceMonitor }
