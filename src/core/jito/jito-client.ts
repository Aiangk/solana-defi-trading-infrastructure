// 封装模式: 我们不直接使用官方 SDK，而是在其基础上添加增强功能
// 智能小费: 基于网络状况和历史数据动态计算最优小费
// 错误恢复: 完善的重试机制和错误处理
// 状态监控: 实时跟踪 Bundle 执行状态

import { Transaction, PublicKey, Connection } from '@solana/web3.js'
import { JitoJsonRpcClient } from 'jito-js-rpc'
import { JitoConfig, BundlePerformanceMetrics, NetworkStatus, JitoError, RetryInfo } from '../../types/jito/jito-types'
import { BundleOptions, BundleSubmissionResult, BundleStatusResult, BundleStatus, TipStrategy } from '../../types/jito/bundle-types'
import { getJitoConfig, JITO_ENDPOINTS } from '../../config/jito-config'
import bs58 from 'bs58'
import { TipFloorResponse, TipStatistics, NetworkConditions } from '../../types/jito/api-types'
import { JitoRegionManager } from './region-manager'

/**
 *  增强的 Jito 客户端
 *  基于官方 jito-js-rpc SDK , 添加企业级功能
 */
export class EnhancedJitoClient {
    private jitoClient: JitoJsonRpcClient
    private config: JitoConfig
    private performanceMetrics: BundlePerformanceMetrics
    private networkStatus: NetworkStatus
    private activeRetries: Map<string, RetryInfo>
    private wallet?: any //可以是 Keypair 或其他钱包类型
    private regionManager: JitoRegionManager
    private connection?: Connection // Solana 连接实例

    // 并发控制 - 基于 GPT 建议
    private concurrentRequests: number = 0
    private maxConcurrentRequests: number = 2  // 限制最大并发请求数（保守设置）
    private requestQueue: Array<() => Promise<any>> = []
    private isProcessingQueue: boolean = false

    constructor(config?: Partial<JitoConfig>, wallet?: any) {
        // 合并默认配置和用户配置
        this.config = { ...getJitoConfig(), ...config }
        this.wallet = wallet
        this.connection = (config as any)?.connection

        // 初始化区域管理器
        this.regionManager = new JitoRegionManager(this.config.network, {
            userRegion: 'global',  //可以根据用户位置配置
            enableAutoSwitch: true
        })

        // 使用区域管理器获取最佳端点
        const endpoint = this.regionManager.getCurrentEndpoint()

        // 初始化官方 SDK
        this.jitoClient = new JitoJsonRpcClient(endpoint, this.config.uuid || '')

        // 启用官方 SDK 日志（生产环境）
        if (this.config.performance.logLevel === 'debug') {
            this.jitoClient.enableConsoleLog()
        }

        // 初始化内部状态
        this.performanceMetrics = this.initializeMetrics()
        this.networkStatus = this.initializeNetworkStatus()
        this.activeRetries = new Map()

        this.log('info', `Enhanced Jito Client initialized for ${this.config.network}, region: ${this.regionManager.getCurrentRegion()}`)
    }

    /**
     *  发送 Bundle (增强版)
     *  @param transactions 交易数组
     *  @param options Bundle 选项
     *  @param connection Solana 连接实例
     *  @returns Bundle 提交结果
     */
    async sendBundle(
        transactions: Transaction[],
        options?: Partial<BundleOptions>,
        connection?: Connection
    ): Promise<BundleSubmissionResult> {
        const startTime = Date.now()

        try {
            // 1. 验证输入参数
            this.validateBundleInput(transactions, options)

            // 2. 合并配置选项
            const bundleOptions = { ...this.config.defaultBundleOptions, ...options }

            // 3. 计算最优小费
            const tipAmount = await this.calculateOptimalTip(
                bundleOptions.tipStrategy || this.config.tipConfig.defaultStrategy,
                bundleOptions.priority || 'medium')

            // 4. 添加小费交易（如果需要）
            const enhancedTransactions = await this.addTipTransaction(transactions, tipAmount, connection)

            // 5. 应用 MEV 保护（如果启用）
            const protectedTransactions = bundleOptions.enableMevProtection ? await this.applyMevProtection(enhancedTransactions) : enhancedTransactions

            // 6. 序列化交易
            const serializedTransactions = this.serializeTransactions(protectedTransactions, bundleOptions.encoding)

            // 7. 发送到 Jito Block Engine
            const response = await this.jitoClient.sendBundle([
                serializedTransactions,
                { encoding: bundleOptions.encoding || 'base64' }
            ])

            // 8. 处理响应
            if (response.result) {
                const result: BundleSubmissionResult = {
                    bundleId: response.result,
                    status: 'submitted',
                    estimatedConfirmationTime: this.estimateConfirmationTime(bundleOptions.priority || 'medium'),
                    tipAmount,
                    transactionCount: protectedTransactions.length
                }

                // 更新性能指标
                this.updateMetrics('bundle_submitted', Date.now() - startTime)

                // 报告成功到区域管理器
                await this.reportSuccess(Date.now() - startTime)

                this.log('info', `Bundle submitted successfully: ${response.result}`)
                return result
            } else {
                throw new Error('Failed to get bundle ID from response')
            }
        } catch (error) {
            // 错误处理和重试逻辑
            const jitoError = await this.handleJitoError(error, 'BUNDLE_SUBMISSION_FAILED')

            // 判断是否需要重试
            if (this.shouldRetry(jitoError, options?.maxRetries)) {
                return this.retryBundleSubmission(transactions, options, jitoError)
            }

            // 更新性能指标
            this.updateMetrics('bundle_failed', Date.now() - startTime)

            return {
                bundleId: '',
                status: 'failed',
                estimatedConfirmationTime: 0,
                tipAmount: 0,
                transactionCount: transactions.length,
                error: jitoError.message
            }

        }

    }

    /**
     *  监控 Bundle 状态 (增强版)
     *  @param bundleId Bundle ID
     *  @returns Bundle 状态结果
     */
    async monitorBundleStatus(bundleId: string): Promise<BundleStatusResult> {
        try {
            this.log('debug', `Monitoring bundle status: ${bundleId}`)

            // 使用官方 SDK 的确认方法
            const result = await this.jitoClient.confirmInflightBundle(
                bundleId,
                this.config.defaultBundleOptions.timeoutMs || 60000
            )

            // 转换为我们的状态格式
            return this.convertToStatusResult(bundleId, result)

        } catch (error) {
            this.log('error', `Failed to monitor bundle ${bundleId}: ${error}`)

            return {
                bundleId,
                status: BundleStatus.FAILED,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    /**
     *  计算最优小费(智能算法)
     *  @param strategy 小费策略
     *  @param priority 优先级
     *  @returns 建议的小费金额（lamports）
     */
    async calculateOptimalTip(strategy: TipStrategy, priority: string): Promise<number> {
        try {
            if (strategy.mode === 'manual' && strategy.amount) {
                // 手动模式：使用你指定金额
                return Math.max(strategy.amount, this.config.tipConfig.minTip)
            }

            // 自动模式： 基于网络数据计算
            const tipStats = await this.fetchTipStatistics()
            const networkConditions = await this.analyzeNetworkConditions()

            // 基于百分位数选择基础小费
            const percentile = strategy.percentile || 50
            const baseTip = this.getTipByPercentile(tipStats, percentile)

            // 根据网络拥堵情况调整
            const adjustTip = this.adjustTipForNetworkConditions(baseTip, networkConditions, priority)

            // 应用限制
            const finalTip = Math.min(
                Math.max(adjustTip, this.config.tipConfig.minTip),
                strategy.maxTip || this.config.tipConfig.maxTip
            )

            this.log('debug', `Calculated optimal tip: ${finalTip} lamports (percentile: ${percentile}, priority: ${priority})`)

            return finalTip
        } catch (error) {
            this.log('warn', `Failed to calculate optimal tip, using default: ${error}`)
            return this.config.tipConfig.minTip
        }
    }


    /**
     *  获取性能指标
     */
    getPerformanceMetrics(): BundlePerformanceMetrics {
        return { ...this.performanceMetrics }
    }

    /**
     *  获取网络状态
     */
    getNetworkStatus(): NetworkStatus {
        return { ...this.networkStatus }
    }

    // 添加区域管理相关的公共方法

    /**
     * 获取当前区域信息
     */
    getCurrentRegion(): string {
        return this.regionManager.getCurrentRegion()
    }

    /**
     * 手动切换区域
     */
    async switchRegion(region: string): Promise<boolean> {
        const success = await this.regionManager.switchToRegion(region as any, 'manual')
        if (success) {
            // 重新初始化 Jito 客户端
            const newEndpoint = this.regionManager.getCurrentEndpoint()
            this.jitoClient = new JitoJsonRpcClient(newEndpoint, this.config.uuid || '')
            this.log('info', `Switched to region ${region}, endpoint: ${newEndpoint}`)
        }
        return success
    }

    /**
     * 获取区域健康状态
     */
    getRegionHealthStatus() {
        return this.regionManager.getRegionHealthStatus()
    }

    /**
     * 获取区域切换历史
     */
    getRegionSwitchHistory() {
        return this.regionManager.getSwitchHistory()
    }


    // ==================== 私有方法 ====================
    private validateBundleInput(transactions: Transaction[], options?: Partial<BundleOptions>): void {
        if (!transactions || transactions.length === 0) {
            throw new Error('Transactions array cannot be empty')
        }

        if (transactions.length > 5) {
            throw new Error('Bundle connot contain more than 5 transactions')
        }

        // 验证交易是否已经签名
        for (const tx of transactions) {
            if (!tx.signature) {
                throw new Error('All transactions must be signed before bunding')
            }
        }
    }

    private async addTipTransaction(transactions: Transaction[], tipAmount: number, connection?: Connection): Promise<Transaction[]> {
        // 检查是否已经包含小费交易
        const hasTipTransaction = await this.checkForExistingTip(transactions)

        if (hasTipTransaction) {
            this.log('debug', 'Bundle already contains tip transaction')
            return transactions
        }

        // 创建小费交易
        const tipTransaction = await this.createTipTransaction(tipAmount, connection)

        // 将小费交易添加到末尾
        return [...transactions, tipTransaction]
    }

    private async applyMevProtection(transactions: Transaction[]): Promise<Transaction[]> {
        try {
            // 实现 MEV 保护逻辑

            this.log('debug', 'Applying MEV protection to transaction')

            // 1. 添加 jitodontfront 保护
            const protectedTransactions = await this.addJitoDontFrontProtection(transactions)

            // 2. 应用时间随机化 （如果配置启用）
            if (this.config.defaultBundleOptions.enableMevProtection) {
                await this.applyTimingRandomization()
            }
            return protectedTransactions
        } catch (error) {
            this.log('warn', `MEV protection failed, using original transactions: ${error}`)
            return transactions
        }
    }

    /**
     * 添加 jitodontfront 保护
     */
    private async addJitoDontFrontProtection(transactions: Transaction[]): Promise<Transaction[]> {
        // 实现 jitodontfront 逻辑
        try {
            // 创建 jitodontfront 保护账户
            const jitoDontFrontKey = new PublicKey('jitodontfront111111111111111111111111111111')

            // 为每个交易添加只读的 jitodontfront 账户
            const protectedTransactions = transactions.map(tx => {
                // 检查是否已经包含保护账户
                const hasProtection = tx.instructions.some(ix =>
                    ix.keys.some(key => key.pubkey.equals
                        (jitoDontFrontKey))
                )

                if (!hasProtection) {
                    // 为第一个指令添加只读账户
                    if (tx.instructions.length > 0) {
                        tx.instructions[0].keys.push({
                            pubkey: jitoDontFrontKey,
                            isSigner: false,
                            isWritable: false
                        })
                    }
                }
                return tx
            })
            this.log('debug', 'Added jitodontfront protection to transactions')
            return protectedTransactions

        } catch (error) {
            this.log('warn', `Failed to add jitodontfront protection: ${error}`)
            return transactions
        }
    }

    /**
     * 应用时间随机化
     */
    private async applyTimingRandomization(): Promise<void> {
        // 添加随机延迟（1-5秒）
        const delay = Math.random() * 4000 + 1000 // 1000-5000ms
        this.log('debug', `Applying timing randomization: ${delay}ms delay`)
        await this.sleep(delay)
    }

    private serializeTransactions(
        transactions: Transaction[],
        encoding: 'base64' | 'base58' = 'base64'
    ): string[] {
        return transactions.map(tx => {
            const serialized = tx.serialize({ verifySignatures: false })
            return encoding === 'base64'
                ? Buffer.from(serialized).toString('base64')
                : bs58.encode(serialized)
        })
    }

    private estimateConfirmationTime(priority: string): number {
        // 基于优先级估算确认时间
        const baseTime = 30000 // 30秒基础时间

        switch (priority) {
            case 'urgent':
                return baseTime * 0.5
            case 'high':
                return baseTime * 0.75
            case 'medium':
                return baseTime * 1.0
            case 'low':
                return baseTime * 1.5
            default:
                return baseTime
        }
    }

    private createJitoError(error: any, code: string): JitoError {
        return {
            code,
            message: error instanceof Error ? error.message : String(error),
            details: error,
            timestamp: new Date()
        }
    }

    private shouldRetry(error: JitoError, maxRetries?: number): boolean {
        const retries = maxRetries || this.config.retry.maxAttempts

        // 429 错误总是可以重试（但需要更长的延迟）
        if (error.code === 'RATE_LIMIT_ERROR') {
            return retries > 0
        }

        // 检查是否是可重试的错误
        const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT', 'REAL_LIMIT']
        return retryableErrors.some(code => error.code.includes(code) && retries > 0)
    }

    private async retryBundleSubmission(
        transactions: Transaction[],
        options?: Partial<BundleOptions>,
        lastError?: JitoError
    ): Promise<BundleSubmissionResult> {
        // 实现重试逻辑
        const retryOptions = { ...options, maxRetries: (options?.maxRetries || 3) - 1 }

        // 计算退避延迟
        const delay = this.calculateBackoffDelay(lastError)
        await this.sleep(delay)

        this.log('info', `Retrying bundle submission after ${delay}ms delay`)

        return this.sendBundle(transactions, retryOptions)
    }

    private calculateBackoffDelay(error?: JitoError): number {
        const baseDelay = this.config.retry.baseDelay
        const multiplier = this.config.retry.backoffMultiplier
        const maxDelay = this.config.retry.maxDelay

        // 简单的指数退避
        const delay = baseDelay * Math.pow(multiplier, 1)
        return Math.min(delay, maxDelay)
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    private convertToStatusResult(bundleId: string, result: any): BundleStatusResult {
        // 转换官方 SDK 返回的结果为我们的格式
        return {
            bundleId,
            status: this.mapStatus(result.status || result.confirmation_status),
            slot: result.slot,
            confirmationStatus: result.confirmation_status,
            transactions: result.transactions,
            landedAt: result.solt ? new Date() : undefined,
            error: result.err
        }
    }

    private mapStatus(status: string): BundleStatus {
        switch (status?.toLowerCase()) {
            case 'pending':
                return BundleStatus.PENDING
            case 'landed':
                return BundleStatus.LANDED
            case 'failed':
                return BundleStatus.FAILED
            case 'invalid':
                return BundleStatus.INVALID
            case 'timeout':
                return BundleStatus.TIMEOUT
            default:
                return BundleStatus.PENDING
        }
    }

    private initializeMetrics(): BundlePerformanceMetrics {
        return {
            totalBundles: 0,
            successfulBundles: 0,
            failedBundles: 0,
            averageConfirmationTime: 0,
            averageTipAmount: 0,
            successRate: 0,
            lastHourMetrics: {
                bundleCount: 0,
                successRate: 0,
                averageTip: 0
            }
        }
    }

    private initializeNetworkStatus(): NetworkStatus {
        return {
            isHealthy: true,
            latency: 0,
            congestionLevel: 'low',
            recommendedTipPercentile: 50,
            lastUpdated: new Date()
        }
    }

    private updateMetrics(event: string, duration?: number): void {
        // 更新性能指标
        this.performanceMetrics.totalBundles++

        if (event === 'bundle_submitted' && duration) {
            this.performanceMetrics.averageConfirmationTime =
                (this.performanceMetrics.averageConfirmationTime + duration) / 2
        }

        if (event === 'bundle_failed') {
            this.performanceMetrics.failedBundles++
        }

        // 计算成功率
        this.performanceMetrics.successRate = this.performanceMetrics.successfulBundles / this.performanceMetrics.totalBundles
    }

    private log(level: string, message: string): void {
        if (this.shouldLog(level)) {
            const timestamp = new Date().toISOString()
            console.log(`[${timestamp}] [${level.toUpperCase()}] [JitoClient] ${message}`)
        }
    }

    private shouldLog(level: string): boolean {
        const levels = ['debug', 'info', 'warn', 'error']
        const configLevel = this.config.performance.logLevel
        return levels.indexOf(level) >= levels.indexOf(configLevel)
    }


    private async fetchTipStatistics(): Promise<TipStatistics> {
        // 实现从官方 API 获取小费统计
        try {
            const response = await fetch('https://bundles.jito.wtf/api/v1/bundles/tip_floor')

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const rawData = await response.json()

            // 处理数组格式的响应
            let data: TipFloorResponse
            if (Array.isArray(rawData) && rawData.length > 0) {
                data = rawData[0]
            } else {
                data = rawData as TipFloorResponse
            }

            this.log('debug', `Fetched tip statistics: ${JSON.stringify(data)}`)


            return {
                percentile_25: Math.round((data.landed_tips_25th_percentile || 0.00001) * 1_000_000_000), // 转换为 lamports
                percentile_50: Math.round((data.landed_tips_50th_percentile || 0.00002) * 1_000_000_000),
                percentile_75: Math.round((data.landed_tips_75th_percentile || 0.00005) * 1_000_000_000),
                percentile_95: Math.round((data.landed_tips_95th_percentile || 0.0001) * 1_000_000_000),
                ema_landed_tips_50th_percentile: Math.round((data.ema_landed_tips_50th_percentile || 0.00002) * 1_000_000_000)
            }

        } catch (error: unknown) {
            this.log('warn', `Failed to fetch tip statistics: ${error}`)

            // 返回默认值
            return {
                percentile_25: 10000,
                percentile_50: 20000,
                percentile_75: 50000,
                percentile_95: 100000,
                ema_landed_tips_50th_percentile: 20000
            }
        }
    }

    private async analyzeNetworkConditions(): Promise<NetworkConditions> {
        try {
            // 简单的网络状况分析
            const startTime = Date.now()

            // 测试网络延迟
            const response = await fetch(this.config.endpoint || JITO_ENDPOINTS[this.config.network], {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000) // 5秒超时
            })

            const latency = Date.now() - startTime

            // 根据延迟判断网络拥堵程度
            let congestionLevel: 'low' | 'medium' | 'high'
            if (latency < 100) {
                congestionLevel = 'low'
            } else if (latency < 300) {
                congestionLevel = 'medium'
            } else {
                congestionLevel = 'high'
            }

            const conditions: NetworkConditions = {
                latency,
                congestion: congestionLevel,
                timestamp: new Date(),
                isHealthy: response.ok && latency < 500
            }

            // 更新网络状态
            this.networkStatus = {
                isHealthy: conditions.isHealthy,
                latency: conditions.latency,
                congestionLevel: conditions.congestion,
                recommendedTipPercentile: congestionLevel === 'high' ? 75 : congestionLevel === 'medium' ? 50 : 25,
                lastUpdated: conditions.timestamp
            }

            this.log('debug', `Network conditions: ${JSON.stringify(conditions)}`)

            return conditions
        } catch (error) {
            this.log('warn', `Failed to analyze network conditions: ${error}`)

            // 返回保守的默认值
            return {
                latency: 500,
                congestion: 'medium',
                timestamp: new Date(),
                isHealthy: false
            }
        }
    }

    private getTipByPercentile(stats: TipStatistics, percentile: number): number {
        // 实现基于百分位数的消费计算
        try {
            switch (percentile) {
                case 25:
                    return stats.percentile_25 || 10000
                case 50:
                    return stats.percentile_50 || 20000
                case 75:
                    return stats.percentile_75 || 50000
                case 95:
                    return stats.percentile_95 || 100000
                default:
                    // 对于其他百分位数，进行线性插值
                    if (percentile < 25) {
                        return stats.percentile_25 || 10000
                    } else if (percentile < 50) {
                        const ratio = (percentile - 25) / 25
                        return Math.round(stats.percentile_25 + (stats.percentile_50 - stats.percentile_25) * ratio)
                    } else if (percentile < 75) {
                        const ratio = (percentile - 50) / 25
                        return Math.round(stats.percentile_50 + (stats.percentile_75 - stats.percentile_50) * ratio)
                    } else {
                        const ratio = (percentile - 75) / 20
                        return Math.round(stats.percentile_75 + (stats.percentile_95 - stats.percentile_75) * ratio)
                    }
            }
        } catch (error) {
            this.log('warn', `Failed to get tip by percentile: ${error}`)
            return this.config.tipConfig.minTip
        }
    }


    private adjustTipForNetworkConditions(baseTip: number, conditions: NetworkConditions, priority: string): number {
        // 实现基于网络条件的小费调整
        try {
            let adjustedTip = baseTip

            // 根据网络拥堵情况调整
            switch (conditions.congestion) {
                case 'high':
                    adjustedTip = baseTip * 1.5 // 高拥堵时增加50%
                    break
                case 'medium':
                    adjustedTip = baseTip * 1.2 // 中等拥堵时增加20%
                    break
                case 'low':
                    adjustedTip = baseTip * 1.0 // 低拥堵时保持不变
                    break
            }

            // 根据优先级进一步调整
            switch (priority) {
                case 'urgent':
                    adjustedTip = adjustedTip * 1.5
                    break
                case 'high':
                    adjustedTip = adjustedTip * 1.2
                    break
                case 'medium':
                    adjustedTip = adjustedTip * 1.0
                    break
                case 'low':
                    adjustedTip = adjustedTip * 0.8
                    break
            }

            // 根据网络延迟微调
            if (conditions.latency > 500) {
                adjustedTip = adjustedTip * 1.1 // 高延迟时增加10%
            }

            const finalTip = Math.round(adjustedTip)

            this.log('debug', `Adjusted tip: ${baseTip} -> ${finalTip} (congestion: ${conditions.congestion}, priority: ${priority})`)

            return finalTip

        } catch (error) {
            this.log('warn', `Failed to adjust tip for network conditions: ${error}`)
            return baseTip
        }
    }

    private async checkForExistingTip(transactions: Transaction[]): Promise<boolean> {
        // 检查交易中是否已经包含小费交易
        try {
            // 获取官方小费账户列表
            const tipAccountsResponse = await this.jitoClient.getTipAccounts()
            if (!tipAccountsResponse.result) {
                return false
            }

            const tipAccountStrings = tipAccountsResponse.result
            const tipAccountKeys = tipAccountStrings.map(addr => new PublicKey(addr))


            // 检查每个交易的每个指令
            for (const transaction of transactions) {
                for (const instruction of transaction.instructions) {
                    //检查是否 是转账到小费账户的指令
                    if (this.isTransferToTipAccount(instruction, tipAccountKeys)) {
                        this.log('debug', 'Found existing tip transaction in bundle')
                        return true
                    }
                }
            }
            return false
        } catch (error) {
            this.log('error', `Failed to check for existing tip: ${error}`)
            return false // 如果检查失败，假设没有小费交易
        }
    }

    /**
     *  检查指令是否是转账到小费账户的指令
     *  @param instruction 要检查的指令
     *  @param tipAccountKeys 小费账户的公钥数组
     *  @returns 如果是转账到小费账户的指令，返回 true
     */
    private isTransferToTipAccount(instruction: any, tipAccounts: PublicKey[]): boolean {
        try {
            // 检查是否是 SystemProgram.transfer 指令
            const { SystemProgram } = require('@solana/web3.js')

            if (!instruction.programId.equals(SystemProgram.programId)) {
                return false
            }

            // 检查指令的账户是否包含小费账户
            for (const account of instruction.keys) {
                for (const tipAccount of tipAccounts) {
                    if (account.pubkey.equals(tipAccount) && account.isWritable) {
                        return true
                    }
                }
            }
            return false
        } catch (error) {
            return false
        }
    }

    private async createTipTransaction(amount: number, connection?: Connection): Promise<Transaction> {
        // 创建小费交易，带重试和区域切换
        const maxRetries = 3
        let lastError: any

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.log('debug', `Creating tip transaction, attempt ${attempt}/${maxRetries}`)

                // 1. 获取随机小费账户（使用增强版方法，包含区域切换）
                const tipAccountStrings = await this.getTipAccounts()
                if (!tipAccountStrings || tipAccountStrings.length === 0) {
                    throw new Error('No tip accounts available')
                }

                // 2. 随机选取一个小费账户（减少竞争）
                const randomIndex = Math.floor(Math.random() * tipAccountStrings.length)
                const tipAccount = new PublicKey(tipAccountStrings[randomIndex])

                // 3. 创建转账指令
                const { SystemProgram } = await import('@solana/web3.js')

                const tipInstruction = SystemProgram.transfer({
                    fromPubkey: this.getWalletPublicKey(),
                    toPubkey: tipAccount,
                    lamports: amount
                })

                // 4. 创建交易并设置区块哈希
                const transaction = new Transaction()
                transaction.add(tipInstruction)

                // 获取最新区块哈希
                const conn = connection || this.connection
                if (!conn) {
                    throw new Error('Connection is required for tip transaction')
                }
                const { blockhash } = await conn.getLatestBlockhash()
                transaction.recentBlockhash = blockhash
                transaction.feePayer = this.getWalletPublicKey()

                this.log('debug', `Created tip transaction: ${amount} lamports to ${tipAccount.toBase58()}`)
                return transaction

            } catch (error) {
                lastError = error
                this.log('warn', `Tip transaction creation attempt ${attempt} failed: ${error}`)

                // 如果是 429 错误，等待后重试
                if (String(error).includes('429') && attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000 // 指数退避：2s, 4s, 8s
                    this.log('info', `Rate limited, waiting ${delay}ms before retry...`)
                    await this.sleep(delay)
                    continue
                }

                // 如果不是 429 错误或已达到最大重试次数，直接抛出
                if (attempt === maxRetries) {
                    break
                }
            }
        }

        this.log('error', `Failed to create tip transaction after ${maxRetries} attempts: ${lastError}`)
        throw new Error(`Tip transaction creation failed after ${maxRetries} attempts: ${lastError}`)
    }

    /**
     * 获取钱包公钥
     * 注意：这个方法需要在构造函数中设置钱包实例
     */
    private getWalletPublicKey(): PublicKey {
        // 这里需要从配置获构造函数参数中获取钱包
        if (!this.wallet) {
            throw new Error('Wallet not configured. Please provide wallet in constructor or config.')
        }

        // 支持不同类型的钱包
        if (this.wallet.publicKey) {
            return this.wallet.publicKey //Keypair 类型
        } else if (this.wallet.payer) {
            return this.wallet.payer.publicKey // 其他钱包类型
        } else {
            throw new Error('Invalid wallet format. wallet must have publicKey property.')
        }
    }

    // ==================== 并发控制机制 ====================

    /**
     * 执行受并发控制的请求
     */
    private async executeWithConcurrencyControl<T>(requestFn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const wrappedRequest = async () => {
                try {
                    this.concurrentRequests++
                    this.log('debug', `Concurrent requests: ${this.concurrentRequests}/${this.maxConcurrentRequests}`)

                    const result = await requestFn()
                    resolve(result)
                } catch (error) {
                    reject(error)
                } finally {
                    this.concurrentRequests--
                    this.processQueue()
                }
            }

            if (this.concurrentRequests < this.maxConcurrentRequests) {
                wrappedRequest()
            } else {
                this.log('debug', `Request queued, current queue size: ${this.requestQueue.length + 1}`)
                this.requestQueue.push(wrappedRequest)
            }
        })
    }

    /**
     * 处理请求队列
     */
    private processQueue(): void {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return
        }

        if (this.concurrentRequests < this.maxConcurrentRequests) {
            this.isProcessingQueue = true
            const nextRequest = this.requestQueue.shift()
            if (nextRequest) {
                nextRequest().finally(() => {
                    this.isProcessingQueue = false
                    this.processQueue()
                })
            } else {
                this.isProcessingQueue = false
            }
        }
    }

    // ==================== 区域错误处理和成功报告 ====================
    /**
     * 报告区域成功（用于健康状态更新）
     */
    private async reportSuccess(responseTime: number): Promise<void> {
        try {
            await this.regionManager.reportRegionSuccess(
                this.regionManager.getCurrentRegion(),
                responseTime
            )
        } catch (error) {
            this.log('warn', `Failed to report region success: ${error}`)
        }
    }

    /**
     * 处理 Jito 错误并报告给区域管理器
     */
    private async handleJitoError(error: any, operation: string): Promise<JitoError> {
        const jitoError: JitoError = {
            code: this.extractErrorCode(error),
            message: error.message || 'Unknown Jito error',
            details: error,
            timestamp: new Date(),
            operation,
            retryable: this.isRetryableError(error)
        }

        // 报告区域错误
        try {
            if (error.message?.includes('429') || error.message?.includes('rate limit')) {
                await this.regionManager.reportRegionError(
                    this.regionManager.getCurrentRegion(),
                    error
                )

                // 如果是限流错误，尝试自动切换区域
                const switched = await this.autoSwitchOnRateLimit()
                if (switched) {
                    jitoError.message += ' (Auto-switched to different region)'
                }
            } else {
                // 其他类型的错误也报告给区域管理器
                await this.regionManager.reportRegionError(
                    this.regionManager.getCurrentRegion(),
                    error
                )
            }
        } catch (reportError) {
            this.log('warn', `Failed to report error to region manager: ${reportError}`)
        }

        this.log('error', `Jito ${operation} error: ${jitoError.message}`)
        return jitoError
    }

    /**
     * 提取错误代码
     */
    private extractErrorCode(error: any): string {
        if (error.message?.includes('429')) return 'RATE_LIMIT_ERROR'
        if (error.message?.includes('timeout')) return 'TIMEOUT_ERROR'
        if (error.message?.includes('network')) return 'NETWORK_ERROR'
        if (error.code) return error.code
        return 'UNKNOWN_ERROR'
    }

    /**
     * 判断错误是否可重试
     */
    private isRetryableError(error: any): boolean {
        const retryablePatterns = [
            '429',
            'rate limit',
            'timeout',
            'network',
            'connection',
            'ECONNRESET',
            'ENOTFOUND'
        ]

        const errorMessage = error.message?.toLowerCase() || ''
        return retryablePatterns.some(pattern => errorMessage.includes(pattern))
    }

    /**
     * 限流时自动切换区域
     */
    private async autoSwitchOnRateLimit(): Promise<boolean> {
        try {
            // 获取当前最健康的区域
            const healthStatus = this.regionManager.getRegionHealthStatus()
            const healthyRegions = healthStatus
                .filter(status => status.isHealthy && !status.rateLimitHit)
                .sort((a, b) => a.responseTime - b.responseTime)

            if (healthyRegions.length > 0) {
                const bestRegion = healthyRegions[0].region
                const currentRegion = this.regionManager.getCurrentRegion()

                if (bestRegion !== currentRegion) {
                    const success = await this.switchRegion(bestRegion)
                    if (success) {
                        this.log('info', `Auto-switched from ${currentRegion} to ${bestRegion} due to rate limit`)
                        return true
                    }
                }
            }

            return false
        } catch (error) {
            this.log('warn', `Failed to auto-switch region: ${error}`)
            return false
        }
    }

    /**
     * 获取小费账户（增强版，包含错误处理、区域报告和并发控制）
     */
    async getTipAccounts(): Promise<string[]> {
        return this.executeWithConcurrencyControl(async () => {
            const maxRetries = 3  // 减少重试次数，避免过度请求
            let lastError: any

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                const startTime = Date.now()

                try {
                    this.log('debug', `Getting tip accounts, attempt ${attempt}/${maxRetries}`)
                    const response = await this.jitoClient.getTipAccounts()
                    const responseTime = Date.now() - startTime

                    // 报告成功
                    await this.reportSuccess(responseTime)

                    if (response.result) {
                        this.log('debug', `Successfully fetched ${response.result.length} tip accounts`)
                        return response.result
                    } else {
                        throw new Error('No tip accounts in response')
                    }
                } catch (error) {
                    lastError = error
                    const responseTime = Date.now() - startTime

                    // 处理 429 限流错误
                    if (String(error).includes('429')) {
                        this.log('warn', `Rate limited on attempt ${attempt}, error: ${error}`)

                        // 报告区域错误
                        await this.regionManager.reportRegionError(
                            this.regionManager.getCurrentRegion(),
                            error as Error,
                            responseTime
                        )

                        if (attempt < maxRetries) {
                            // 更长的延迟：5s, 15s, 30s（基于 GPT 建议）
                            const delay = Math.min(5000 * Math.pow(3, attempt - 1), 30000)
                            this.log('info', `Rate limited, waiting ${delay}ms before retry...`)
                            await this.sleep(delay)
                            continue
                        }
                    } else {
                        // 非 429 错误，直接抛出
                        const jitoError = await this.handleJitoError(error, 'GET_TIP_ACCOUNTS')
                        throw new Error(`Failed to get tip accounts: ${jitoError.message}`)
                    }
                }
            }

            // 所有重试都失败了，使用后备方案
            this.log('error', `Failed to get tip accounts after ${maxRetries} attempts: ${lastError}`)
            this.log('warn', 'Using fallback tip accounts (based on Jito official docs)')

            // 返回官方文档中的小费账户作为后备方案
            return [
                '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
                'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
                'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
                'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
                'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
                'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
                'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
                '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'
            ]
        })
    }

    /**
     * 停止客户端并清理资源
     */
    public stop(): void {
        try {
            this.regionManager.stop()
            this.log('info', 'Enhanced Jito Client stopped')
        } catch (error) {
            this.log('error', `Error stopping client: ${error}`)
        }
    }
}

// 导出别名以保持向后兼容
export { EnhancedJitoClient as JitoClient };