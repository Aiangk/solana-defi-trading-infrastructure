import { Transaction } from '@solana/web3.js'
import { v4 as uuidv4 } from 'uuid'
import { EnhancedJitoClient } from './jito-client'
import {
    BundleManagerConfig,
    BundleInstance,
    BundleEventType,
    BundleEvent,
    BundleEventListener,
    BundleManagerStats,
    BundleQueryOptions,
    BundleBatchResult,
    BundleQueueItem,
    IBundleManager,
    BundleMetrics
} from '../../types/jito/bundle-manager-types'
import {
    BundleOptions,
    BundleSubmissionResult,
    BundleStatusResult,
    BundleStatus,

} from '../../types/jito/bundle-types'
import { JitoError } from '../../types/jito/jito-types'
import { error } from 'console'

/**
 * Bundle 管理器核心类
 * 实现完整的 Bundle 生命周期管理
 */
export class BundleManager implements IBundleManager {
    private jitoClient: EnhancedJitoClient
    private config: BundleManagerConfig
    private bundles: Map<string, BundleInstance>
    private eventListeners: Map<BundleEventType, BundleEventListener[]>
    private statusCheckTimer?: NodeJS.Timeout
    private isRunning: boolean = false
    private stats: BundleManagerStats

    constructor(jitoClient: EnhancedJitoClient, config?: Partial<BundleManagerConfig>) {
        this.jitoClient = jitoClient
        this.config = this.mergeConfig(config)  // mergeConfig 合并配置
        this.bundles = new Map()
        this.eventListeners = new Map()
        this.stats = this.initializeStats()

        this.log('info', 'Bundle Manager initialized')
    }

    // ==================== 私有辅助方法 ====================
    /**
     * 合并配置
     */
    private mergeConfig(userConfig?: Partial<BundleManagerConfig>): BundleManagerConfig {
        const defaultConfig: BundleManagerConfig = {
            maxConcurrentBundles: 10,
            statusCheckInterval: 5000, // 5秒检查一次
            bundleTimeout: 60000, // 60秒超时
            enableAutoRetry: true,
            enablePerformanceMonitoring: true,
            enableEventNotifications: true
        }

        return { ...defaultConfig, ...userConfig }
    }

    /**\
     * 初始化统计信息
     */
    private initializeStats(): BundleManagerStats {
        return {
            totalBundles: 0,
            activeBundles: 0,
            successfulBundles: 0,
            failedBundles: 0,
            averageConfirmationTime: 0,
            averageTipAmount: 0,
            successRate: 0,
            lastUpdated: new Date()
        }
    }

    /**
     * 日志记录
     */
    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] [${level.toUpperCase()}] [BundleManager] ${message}]`)
    }

    /**
     * 生成唯一 Bundle ID
     */
    private generateBundleId(): string {
        return uuidv4()
    }

    /**
     * 创建初始 Bundle 指标
     */
    private createInitialMetrics(transactionCount: number): BundleMetrics {
        return {
            tipAmount: 0,
            transactionCount,
            success: false
        }
    }
    /**
 * 将 Bundle 状态映射为确认状态
 */
    private mapBundleStatusToConfirmation(status: BundleStatus): 'processed' | 'confirmed' | 'finalized' | undefined {
        switch (status) {
            case BundleStatus.PROCESSING:
                return 'processed'
            case BundleStatus.LANDED:
                return 'confirmed'
            default:
                return undefined
        }
    }


    // ==================== 公共接口方法 ====================
    /**
     * 创建 Bundle
     * 创建新的 Bundle 实例但不立即提交
     */
    async createBundle(transactions: Transaction[], options?: Partial<BundleOptions>): Promise<BundleInstance> {
        try {
            // 验证输入
            this.validateCreateBundleInput(transactions, options)

            // 生成唯一 ID
            const bundleId = this.generateBundleId()

            // 创建 Bundle 实例
            const bundle: BundleInstance = {
                id: bundleId,
                bundleId: '', //提交后由 Jito 返回
                transactions: [...transactions], // 复制数组避免外部修改
                options: { ...options } as BundleOptions,
                createdAt: new Date(),
                status: BundleStatus.PENDING,
                retryCount: 0,
                metrics: this.createInitialMetrics(transactions.length)
            }

            // 存储 Bundle
            this.bundles.set(bundleId, bundle)

            // 更新统计信息
            this.updateStats('created')

            // 触发事件
            if (this.config.enableEventNotifications) {
                await this.emitEvent(BundleEventType.CREATED, bundle)
            }

            this.log('info', `Bundle created: ${bundleId} with ${transactions.length} transactions`)

            return bundle
        } catch (error) {
            this.log('error', `Failed to create bundle: ${error}`)
            throw error
        }
    }

    /**
     * 提交 Bundle
     * 将指定的 Bundle 提交到 Jito 网络
     */
    async submitBundle(bundleId: string): Promise<BundleSubmissionResult> {
        try {
            // 获取 Bundle 实例
            const bundle = this.bundles.get(bundleId)
            if (!bundle) {
                throw new Error(`Bundle not found: ${bundleId}`)
            }

            // 检查状态
            if (bundle.status !== BundleStatus.PENDING) {
                throw new Error(`Bundle ${bundleId} is not in pending status: ${bundle.status}`)
            }

            // 检查并发限制
            await this.waitForConcurrencySlot()

            // 更新状态为提交中
            bundle.status = BundleStatus.PROCESSING
            bundle.submittedAt = new Date()

            // 计算提交时间
            if (bundle.metrics.submissionTime === undefined) {
                bundle.metrics.submissionTime = Date.now() - bundle.createdAt.getTime()
            }

            // 使用 Jito 客户端提交
            const result = await this.jitoClient.sendBundle(bundle.transactions, bundle.options)

            // 更新 Bundle 信息
            bundle.bundleId = result.bundleId
            bundle.metrics.tipAmount = result.tipAmount || 0

            // 更新统计信息
            this.updateStats('submitted')

            // 触发事件
            if (this.config.enableEventNotifications) {
                await this.emitEvent(BundleEventType.SUBMITTED, bundle, { result })
            }

            this.log('info', `Bundle submitted: ${bundleId} -> ${result.bundleId}`)

            return result
        } catch (error) {
            // 处理提交失败
            const bundle = this.bundles.get(bundleId)
            if (bundle) {
                bundle.status = BundleStatus.FAILED
                bundle.error = {
                    code: 'SUBMSSION_FAILED',
                    message: error instanceof Error ? error.message : String(error),
                    details: error,
                    timestamp: new Date()
                }
            }

            // 触发失败事件
            if (this.config.enableEventNotifications && bundle) {
                await this.emitEvent(BundleEventType.FAILED, bundle, { error })
            }
        }

        this.log('error', `Failed to submit bundle ${bundleId}: ${error}`)
        throw error
    }

    /**
     * 批量提交 Bundle
     * 同时提交多个 Bundle，提高效率
     */
    async submitBundles(bundleIds: string[]): Promise<BundleBatchResult> {
        const results: BundleBatchResult = {
            successful: [],
            failed: [],
            total: bundleIds.length,
            successCount: 0,
            failureCount: 0
        }

        // 并发提交，但受并发限制控制
        const promises = bundleIds.map(async (bundleId) => {
            try {
                await this.submitBundle(bundleId)
                const bundle = this.bundles.get(bundleId)
                if (bundle) {
                    results.successful.push(bundle)
                    results.successCount++
                }
            } catch (error) {
                const bundle = this.bundles.get(bundleId)
                if (bundle) {
                    results.failed.push({
                        bundle,
                        error: {
                            code: 'BATCH_SUBMISSION_FAILED',
                            message: error instanceof Error ? error.message : String(error),
                            details: error,
                            timestamp: new Date()
                        }
                    })
                    results.failureCount++
                }
            }
        })

        await Promise.allSettled(promises)

        this.log('info', `Batch submission completed: ${results.successCount}/${results.total} successful`)

        return results
    }


    /**
     * 获取 Bundle 状态
     * 查询指定 Bundle 的当前状态
     */
    async getBundleStatus(bundleId: string): Promise<BundleStatusResult> {
        try {
            const bundle = this.bundles.get(bundleId)
            if (!bundle) {
                throw new Error(`Bundle not found: ${bundleId}`)
            }

            // 如果 Bundle 已经提交到 Jito，查询最新状态
            if (bundle.bundleId && bundle.status === BundleStatus.PROCESSING) {
                const jitoStatus = await this.jitoClient.monitorBundleStatus(bundle.bundleId)

                // 更新本地状态
                this.updateBundleFromJitoStatus(bundle, jitoStatus)
            }

            // 返回当前状态
            return {
                bundleId: bundle.bundleId,
                status: bundle.status,
                slot: undefined, // 可以从 Jito 状态中获取
                confirmationStatus: this.mapBundleStatusToConfirmation(bundle.status),
                transactions: bundle.transactions.map(tx =>
                    tx.signature ? (typeof tx.signature === 'string' ? tx.signature : tx.signature.toString('base64')) : ''
                ).filter(sig => sig.length > 0),
                landedAt: bundle.completedAt,
                error: bundle.error?.message
            }
        } catch (error) {
            this.log('error', `Failed to get bundle status ${bundleId}: ${error}`)
            throw error
        }
    }

    /**
     * 取消Bundle
     * 取消未提交获处理中的 Bundle
     */
    async cancelBundle(bundleId: string): Promise<boolean> {
        try {
            const bundle = this.bundles.get(bundleId)
            if (!bundle) {
                throw new Error(`Bundle not found: ${bundleId}`)
            }

            // 只能取消待处理或者处理中的 Bundle
            if (bundle.status !== BundleStatus.PENDING && bundle.status !== BundleStatus.PROCESSING) {
                throw new Error(`Cannot cancel bundle in status: ${bundle.status}`)
            }

            // 更新状态
            bundle.status = BundleStatus.FAILED
            bundle.error = {
                code: 'CANCELLED',
                message: 'Bundle cancelled by user',
                details: null,
                timestamp: new Date()
            }
            bundle.completedAt = new Date()

            // 更新统计信息
            this.updateStats('cancelled')

            // 触发事件
            if (this.config.enableEventNotifications) {
                await this.emitEvent(BundleEventType.FAILED, bundle, { reason: 'cancelled' })
            }

            this.log('info', `Bundle cancelled: ${bundleId}`)

            return true
        } catch (error) {
            this.log('error', `Failed to cancel bundle ${bundleId}: ${error}`)
            return false
        }
    }

    /**
     * 重试 Bundle
     * 重新提交失败的 Bundle
     */
    async retryBundle(bundleId: string): Promise<BundleSubmissionResult> {
        try {
            const bundle = this.bundles.get(bundleId)
            if (!bundle) {
                throw new Error(`Bundle not found: ${bundleId}`)
            }

            // 检查是否可以重试
            if (bundle.status !== BundleStatus.FAILED) {
                throw new Error(`Bundle ${bundleId} is not in failed status: ${bundle.status}`)
            }

            // 检查重试次数限制
            const maxRetries = bundle.options.maxRetries || 3
            if (bundle.retryCount >= maxRetries) {
                throw new Error(`Bundle ${bundleId} has exceeded max retry attempts: ${bundle.retryCount}/${maxRetries}`)
            }

            // 更新重试次数
            bundle.retryCount++

            // 重置状态
            bundle.status = BundleStatus.PENDING
            bundle.error = undefined
            bundle.submittedAt = undefined
            bundle.completedAt = undefined

            // 触发重试事件
            if (this.config.enableEventNotifications) {
                await this.emitEvent(BundleEventType.RETRY, bundle, { retryCount: bundle.retryCount, maxRetries })
            }

            this.log('info', `Retrying bundle: ${bundleId} (attempt ${bundle.retryCount}/${maxRetries})`)

            // 重新提交
            return await this.submitBundle(bundleId)

        } catch (error) {
            this.log('error', `Failed to retry bundle ${bundleId}: ${error}`)
            throw error
        }
    }

    /**
     * 查询 Bundle
     * 根据条件查询 Bundle 列表
     */
    async queryBundles(options?: BundleQueryOptions): Promise<BundleInstance[]> {
        try {
            let bundles = Array.from(this.bundles.values())

            // 状态过滤
            if (options?.status && options.status.length > 0) {
                bundles = bundles.filter(bundle => options.status!.includes(bundle.status))
            }

            // 时间范围过滤
            if (options?.timeRange) {
                const { start, end } = options.timeRange
                bundles = bundles.filter(bundle => bundle.createdAt >= start && bundle.createdAt <= end)
            }

            // 排序
            if (options?.sort) {
                const { field, order } = options.sort
                bundles.sort((a, b) => {
                    const aValue = a[field]
                    const bValue = b[field]

                    // 处理 undefined 值
                    if (aValue === undefined && bValue === undefined) return 0
                    if (aValue === undefined) return order === 'asc' ? 1 : -1
                    if (bValue === undefined) return order === 'asc' ? -1 : 1

                    // 处理 Date 类型
                    if (aValue instanceof Date && bValue instanceof Date) {
                        const diff = aValue.getTime() - bValue.getTime()
                        return order === 'asc' ? diff : -diff
                    }

                    // 处理数字类型
                    if (typeof aValue === 'number' && typeof bValue === 'number') {
                        const diff = aValue - bValue
                        return order === 'asc' ? diff : -diff
                    }

                    // 处理字符串类型（转换为字符串进行比较）
                    const aStr = String(aValue)
                    const bStr = String(bValue)

                    if (aStr < bStr) return order === 'asc' ? -1 : 1
                    if (aStr > bStr) return order === 'asc' ? 1 : -1
                    return 0
                })
            }

            // 分页
            if (options?.pagination) {
                const { offset, limit } = options.pagination
                bundles = bundles.slice(offset, offset + limit)
            }

            return bundles
        } catch (error) {
            this.log('error', `Failed to query bundles: ${error}`)
            throw error
        }
    }

    /**
     * 获取统计信息
     * 返回管理器的性能和状态统计信息
     */
    getStats(): BundleManagerStats {
        // 更新实时统计
        this.updateRealTimeStats()

        return { ...this.stats }
    }

    /**
     * 添加事件监听器
     * 监听 Bundle 生命周期事件
     */
    addEventListener(type: BundleEventType, listener: BundleEventListener): void {
        if (!this.eventListeners.has(type)) {
            this.eventListeners.set(type, [])
        }

        const listeners = this.eventListeners.get(type)!

        listeners.push(listener)

        this.log('debug', `Event listener added for ${type}, total listeners: ${listeners.length}`)
    }

    /**
     * 移除事件监听器
     * 移除指定的事件监听器
     */
    removeEventListener(type: BundleEventType, listener: BundleEventListener): void {
        const listeners = this.eventListeners.get(type)
        if (!listeners) return
        //这里的 return 什么都不返回，等于结束函数执行。
        // 在 void 返回类型的函数里，加 return 相当于“跳出函数”，不会报错。

        const index = listeners.indexOf(listener)
        //找到时返回对应索引（>= 0）；
        // 找不到时返回 -1（表示“不存在”）
        // index > -1 表示找到了该监听器

        if (index > -1) {
            listeners.splice(index, 1)
            // listeners.splice(index, 1) 的意思是在数组中从 index 位置删除 1 个元素（也就是那个 listener 本身）。
            // splice 是会修改原数组的方法，删除后数组长度减少，元素自动前移，不留空洞。
            this.log('debug', `Event listener removed for ${type}, remaining listeners: ${listeners.length}`)
        }
    }

    /**
     * 启动管理器
     * 启动后台监控和处理服务
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            this.log('warn', 'Bundle manager is already running')
            return
        }

        this.isRunning = true

        // 启动状态检查定时器
        if (this.config.statusCheckInterval > 0) {
            this.statusCheckTimer = setInterval(() => {
                this.performStatusCheck()
            }, this.config.statusCheckInterval)
        }
        this.log('info', 'Bundle manager started')
    }

    /**
     * 停止管理器
     * 停止所有后台服务并清理资源
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            this.log('warn', 'Bundle manager is not running')
            return
        }

        this.isRunning = false

        // 停止状态检查定时器
        if (this.statusCheckTimer) {
            clearInterval(this.statusCheckTimer)
            this.statusCheckTimer = undefined
        }

        // 等待所有处理中的 Bundle 完成或者超时
        await this.waitForActiveBundles()

        this.log('info', 'Bundle manager stopped')
    }

    // ==================== 更多私有辅助方法 ====================

    /**
     * 验证创建 Bundle 的输入参数
     */
    private validateCreateBundleInput(transactions: Transaction[], options?: Partial<BundleOptions>): void {
        if (!transactions || transactions.length === 0) {
            throw new Error('Transactions array cannot be empty')
        }

        if (transactions.length > 5) {
            throw new Error('Bundle cannot contain more than 5 transactions')
        }

        // 验证交易是否已签名
        for (let i = 0; i < transactions.length; i++) {
            const tx = transactions[i]
            if (!tx.signature) {
                throw new Error(`Transaction at index ${i} is not signed`)
            }
        }
    }

    /**
   * 等待并发槽位
   * 确保不超过最大并发限制
   */
    private async waitForConcurrencySlot(): Promise<void> {
        while (this.getActiveBundleCount() >= this.config.maxConcurrentBundles) {
            this.log('debug', `Waiting for concurrency slot (${this.getActiveBundleCount()}/${this.config.maxConcurrentBundles})`)
            await this.sleep(1000) // 等待1秒后重试
        }
    }

    /**
   * 获取活跃 Bundle 数量
   */
    private getActiveBundleCount(): number {
        return Array.from(this.bundles.values()).filter(bundle =>
            bundle.status === BundleStatus.PROCESSING
        ).length
    }


    /**
   * 更新统计信息
   */
    private updateStats(event: 'created' | 'submitted' | 'confirmed' | 'failed' | 'cancelled'): void {
        switch (event) {
            case 'created':
                this.stats.totalBundles++
                break
            case 'submitted':
                // 提交时不改变总数，因为在创建时已经计算
                break
            case 'confirmed':
                this.stats.successfulBundles++
                break
            case 'failed':
            case 'cancelled':
                this.stats.failedBundles++
                break
        }

        // 重新计算成功率
        if (this.stats.totalBundles > 0) {
            this.stats.successRate = (this.stats.successfulBundles / this.stats.totalBundles) * 100
        }

        this.stats.lastUpdated = new Date()
    }

    /**
     * 更新实时统计信息
     */
    private updateRealTimeStats(): void {
        this.stats.activeBundles = this.getActiveBundleCount()

        // 计算平均确认时间
        const completedBundles = Array.from(this.bundles.values()).filter(bundle =>
            bundle.completedAt && bundle.metrics.totalTime
        )

        if (completedBundles.length > 0) {
            const totalTime = completedBundles.reduce((sum, bundle) =>
                sum + (bundle.metrics.totalTime || 0), 0
            )
            this.stats.averageConfirmationTime = totalTime / completedBundles.length
        }

        // 计算平均小费金额
        const bundlesWithTips = Array.from(this.bundles.values()).filter(bundle =>
            bundle.metrics.tipAmount > 0
        )

        if (bundlesWithTips.length > 0) {
            const totalTips = bundlesWithTips.reduce((sum, bundle) =>
                sum + bundle.metrics.tipAmount, 0
            )
            this.stats.averageTipAmount = totalTips / bundlesWithTips.length
        }
    }

    /**
   * 触发事件
   */
    private async emitEvent(type: BundleEventType, bundle: BundleInstance, data?: any): Promise<void> {
        const listeners = this.eventListeners.get(type)
        if (!listeners || listeners.length === 0) return

        const event: BundleEvent = {
            type,
            bundle: { ...bundle }, // 复制对象避免外部修改
            timestamp: new Date(),
            data
        }

        // 并发执行所有监听器
        const promises = listeners.map(async (listener) => {
            try {
                await listener(event)
            } catch (error) {
                this.log('error', `Event listener error for ${type}: ${error}`)
            }
        })

        await Promise.allSettled(promises)
    }

    /**
     *  从Jito 状态更新 Bundle
     */
    private updateBundleFromJitoStatus(bundle: BundleInstance, jitoStatus: BundleStatusResult): void {
        // 更新状态
        if (jitoStatus.status !== bundle.status) {
            const oldStatus = bundle.status
            bundle.status = jitoStatus.status
            this.log('debug', `Bundle ${bundle.id} status changed: ${oldStatus} -> ${jitoStatus.status}`)
        }

        // 如果 Bundle 已完成，更新完成和指标
        if (jitoStatus.status === BundleStatus.LANDED || jitoStatus.status === BundleStatus.FAILED) {
            if (!bundle.completedAt) {
                bundle.completedAt = new Date()

                // 计算总执行时间
                if (bundle.submittedAt) {
                    bundle.metrics.confirmationTime = bundle.completedAt.getTime() - bundle.submittedAt.getTime()
                    bundle.metrics.totalTime = bundle.completedAt.getTime() - bundle.createdAt.getTime()
                    bundle.metrics.success = jitoStatus.status === BundleStatus.LANDED

                    // 更新统计
                    this.updateStats(jitoStatus.status === BundleStatus.LANDED ? 'confirmed' : 'failed')
                }
            }
        }

        // 更新错误信息
        if (jitoStatus.error && !bundle.error) {
            bundle.error = {
                code: 'JITO_ERROR',
                message: jitoStatus.error,
                details: jitoStatus,
                timestamp: new Date()
            }
        }
    }

    /**
     * 执行状态检查
     * 定期检查所有活跃 Bundle 的状态
     */
    private async performStatusCheck(): Promise<void> {
        if (!this.isRunning) return

        try {
            const activeBundles = Array.from(this.bundles.values()).filter(bundle => bundle.status === BundleStatus.PROCESSING && bundle.bundleId)
            this.log('debug', `Performing status check for ${activeBundles.length} active bundles`)

            // 并发检查所有活跃 Bundle
            const promises = activeBundles.map(async (bundle) => {
                try {
                    // 检查超时
                    if (this.isBundleTimeOut(bundle)) {
                        await this.handleBundleTimeout(bundle)
                        return
                    }

                    // 查询 Jito 状态
                    const jitoStatus = await this.jitoClient.monitorBundleStatus(bundle.bundleId)
                    this.updateBundleFromJitoStatus(bundle, jitoStatus)

                    // 触发状态变化事件
                    if (bundle.status === BundleStatus.LANDED) {
                        await this.emitEvent(BundleEventType.CONFIRMED, bundle)
                    } else if (bundle.status === BundleStatus.FAILED) {
                        await this.emitEvent(BundleEventType.FAILED, bundle)
                    }
                } catch (error) {
                    this.log('warn', `Failed to check status for bundle ${bundle.id}: ${error}`)
                }
            })

            await Promise.allSettled(promises)
        } catch (error) {
            this.log('error', `Status check failed: ${error}`)
        }
    }

    /**
     * 检查Bundle 是否超时
     */
    private isBundleTimeOut(bundle: BundleInstance): boolean {
        if (!bundle.submittedAt) return false

        const now = Date.now()
        const submittedTime = bundle.submittedAt.getTime()
        return (now - submittedTime) > this.config.bundleTimeout
    }

    /**
     * 处理 Bundle 超时
     */
    private async handleBundleTimeout(bundle: BundleInstance): Promise<void> {
        bundle.status = BundleStatus.TIMEOUT
        bundle.completedAt = new Date()
        bundle.error = {
            code: 'TIMEOUT',
            message: `Bundle timed out after ${this.config.bundleTimeout}ms`,
            details: null,
            timestamp: new Date()
        }

        // 更新统计
        this.updateStats('failed')

        // 触发超时事件
        await this.emitEvent(BundleEventType.TIMEOUT, bundle)
        this.log('warn', `Bundle ${bundle.id} timed out`)
    }

    /**
     * 等待所有活跃 Bundle 完成
     */
    private async waitForActiveBundles(): Promise<void> {
        const maxWaitTime = 30000 // 最大等待时间 30秒
        const startTime = Date.now()

        while (this.getActiveBundleCount() > 0 && (Date.now() - startTime < maxWaitTime)) {
            this.log('debug', `Waiting for ${this.getActiveBundleCount()} active bundles to complete`)
            await this.sleep(1000) // 等待1秒后重试
        }
        // 该循环最多等待30秒，如果还有活跃的 Bundle，就不再等待

        if (this.getActiveBundleCount() > 0) {
            this.log('warn', `Stopped with ${this.getActiveBundleCount()} active bundles still processing`)
        }
        // 30秒后，如果还有活跃的 Bundle，就报错log
    }

    /**
     * 休眠指定毫秒数
     */
    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}