import { Connection, Keypair } from '@solana/web3.js'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { BundleManager } from '../../core/jito/bundle-manager'
import { BundlePerformanceMonitor } from '../../core/jito/bundle-performance-monitor'
import { BundleRetryManager } from '../../core/jito/bundle-retry-manager'
import { EnhancedJitoClient } from '../../core/jito/jito-client'
import { BundleEventType } from '../../types/jito/bundle-manager-types'
import { BundleStatus } from '../../types/jito/bundle-types'
import { getDemoConfig } from './demo-config'
import { DemoTransactionGenerator, createDemoKeypair, checkAccountBalance, AirdropManager } from './demo-transactions'
import { DemoLogger, createSeparator } from './demo-logger'

/**
 * Hello Bundle 演示
 * 验证四个核心模块的集成和协作
 */
export class HelloBundleDemo {
    private connection: Connection
    private payer: Keypair
    private jitoClient!: EnhancedJitoClient  // 使用 ! 断言，在 initializeModules 中初始化
    private bundleManager!: BundleManager
    private performanceMonitor!: BundlePerformanceMonitor
    private retryManager!: BundleRetryManager
    private transactionGenerator!: DemoTransactionGenerator
    private airdropManager!: AirdropManager
    private logger: DemoLogger
    private config: ReturnType<typeof getDemoConfig>

    constructor(scenario: 'basic' | 'stress' | 'production' = 'basic') {
        this.config = getDemoConfig(scenario)
        this.logger = new DemoLogger(this.config.demo.enableVerboseLogging)

        // 连接将在 run() 方法中异步初始化
        this.connection = null as any // 临时设置，将在 initializeConnection 中设置
        this.payer = createDemoKeypair() // 生产环境请使用安全的密钥管理

        this.logger.info(`初始化 Hello Bundle 演示 （场景：${scenario}）`)
    }

    /**
     * 创建并测试 Solana 连接 - 仅使用真实网络（支持 Jito Bundle）
     */
    private async createAndTestConnection(): Promise<Connection> {
        const rpcEndpoints = [
            // 使用你的 Helius API Key（优先级最高，稳定可靠）
            'https://devnet.helius-rpc.com/?api-key=61040956-f7ed-40fa-84d3-40c986ab834a',
            'https://mainnet.helius-rpc.com/?api-key=61040956-f7ed-40fa-84d3-40c986ab834a',

            // 官方 RPC（备选）
            'https://api.devnet.solana.com',
            'https://rpc-devnet.solana.com',
            'https://api.mainnet-beta.solana.com',

            // 其他免费端点
            'https://solana-devnet.g.alchemy.com/v2/demo'
        ]

        this.logger.info('🔍 网络诊断信息:')
        this.logger.info(`✅ 使用 Helius RPC 服务（已配置 API Key）`)
        this.logger.info(`代理设置: ${process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '无'}`)
        this.logger.info(`Node.js 版本: ${process.version}`)
        this.logger.info(`平台: ${process.platform}`)

        let lastError: any

        // 尝试不同的端点，直到找到一个可用的
        for (let i = 0; i < rpcEndpoints.length; i++) {
            const endpoint = rpcEndpoints[i]
            this.logger.info(`尝试 RPC 端点 ${i + 1}/${rpcEndpoints.length}: ${endpoint}`)

            try {
                // 创建连接对象
                let connection: Connection

                try {
                    // 首先尝试使用自定义 fetch
                    const connectionConfig: any = {
                        commitment: 'confirmed',
                        wsEndpoint: undefined,
                        fetch: this.createCustomFetch()
                    }
                    connection = new Connection(endpoint, connectionConfig)
                } catch (customFetchError) {
                    this.logger.warn(`自定义 fetch 失败，使用默认配置: ${customFetchError}`)

                    // 备选方案：使用默认 fetch
                    const defaultConfig: any = {
                        commitment: 'confirmed',
                        wsEndpoint: undefined
                    }
                    connection = new Connection(endpoint, defaultConfig)
                }

                // 测试网络连接
                await this.testConnectionEndpoint(connection)

                // 如果测试成功，返回这个连接
                this.logger.info(`✅ 成功连接到: ${endpoint}`)
                return connection

            } catch (error) {
                lastError = error
                this.logger.warn(`❌ 端点 ${endpoint} 连接失败: ${error}`)
                continue
            }
        }

        // 所有端点都失败了
        throw new Error(`所有 RPC 端点连接失败，最后错误: ${lastError}`)
    }

    /**
     * 测试单个连接端点
     */
    private async testConnectionEndpoint(connection: Connection): Promise<void> {
        const rpcEndpoint = connection.rpcEndpoint

        // 直接使用 fetch 进行 RPC 调用，避免 Web3.js 的结构验证问题
        const testRpcCall = async (method: string, params: any[] = []) => {
            const response = await fetch(rpcEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method,
                    params
                })
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const data: any = await response.json()
            if (data.error) {
                throw new Error(`RPC Error: ${data.error.message}`)
            }

            return data.result
        }

        // 测试基本连接
        try {
            const slot = await testRpcCall('getSlot')
            this.logger.info(`网络连接测试成功，当前区块高度: ${slot}`)
        } catch (slotError) {
            // 备选测试方法
            const blockHash = await testRpcCall('getLatestBlockhash')
            this.logger.info(`网络连接测试成功，最新区块哈希: ${blockHash.blockhash.substring(0, 8)}...`)
        }
    }

    /**
     * 测试网络连接 - 获取详细信息
     */
    private async testNetworkConnection(): Promise<void> {
        try {
            const rpcEndpoint = this.connection.rpcEndpoint
            this.logger.info(`当前连接端点: ${rpcEndpoint}`)

            // 连接已经在 createAndTestConnection 中测试过了，这里获取详细信息
            const testRpcCall = async (method: string, params: any[] = []) => {
                const response = await fetch(rpcEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method,
                        params
                    })
                })

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }

                const data: any = await response.json()
                if (data.error) {
                    throw new Error(`RPC Error: ${data.error.message}`)
                }

                return data.result
            }

            // 获取版本信息
            try {
                const version = await testRpcCall('getVersion')
                if (version && typeof version === 'object') {
                    const solanaCore = version['solana-core'] || 'unknown'
                    const featureSet = version['feature-set'] || 'unknown'
                    this.logger.info(`Solana 核心版本: ${solanaCore}`)
                    this.logger.info(`功能集版本: ${featureSet}`)
                }
            } catch (versionError) {
                this.logger.warn(`版本信息获取失败（非关键错误）: ${versionError}`)
            }

            // 3. 测试账户余额查询功能
            try {
                const balance = await this.connection.getBalance(this.payer.publicKey)
                this.logger.info(`账户余额查询成功: ${balance / 1000000000} SOL`)
            } catch (balanceError) {
                this.logger.warn(`余额查询失败: ${balanceError}`)
            }

            // 4. 检测网络类型和配置
            const endpoint = this.connection.rpcEndpoint
            if (endpoint.includes('devnet')) {
                this.logger.info('🧪 检测到 Devnet 网络 - 支持 Jito Bundle 测试')
                this.logger.info('💡 Devnet 适合开发和测试，支持空投功能')
            } else if (endpoint.includes('testnet')) {
                this.logger.info('🧪 检测到 Testnet 网络')
                this.logger.info('💡 Testnet 用于最终测试，接近生产环境')
            } else if (endpoint.includes('mainnet')) {
                this.logger.info('🌐 检测到 Mainnet 网络 - 生产环境')
                this.logger.warn('⚠️ 注意：这是生产网络，请谨慎操作')
            } else {
                this.logger.info(`🔗 连接到网络: ${endpoint}`)
            }

            this.logger.info('✅ 网络连接测试完成')

        } catch (error) {
            this.logger.error(`网络连接详细错误: ${error}`)
            throw new Error(`网络连接测试失败: ${error}`)
        }
    }

    /**
     * 创建自定义 fetch 函数，处理代理和超时，确保与 Solana Web3.js 兼容
     */
    private createCustomFetch() {
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY

        return async (url: string, options: any = {}): Promise<Response> => {
            try {
                // 设置默认请求头，确保兼容性
                const defaultHeaders = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers
                }

                const fetchOptions = {
                    ...options,
                    headers: defaultHeaders,
                    // 移除可能导致问题的 timeout 选项
                    // 使用 AbortController 替代
                }

                // 创建超时控制
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时

                fetchOptions.signal = controller.signal

                let response: Response

                if (proxyUrl && !url.includes('localhost') && !url.includes('127.0.0.1')) {
                    // 远程连接：使用代理
                    this.logger.info(`使用代理连接: ${proxyUrl}`)
                    try {
                        const agent = new HttpsProxyAgent(proxyUrl)
                        response = await fetch(url, {
                            ...fetchOptions,
                            agent: agent
                        })
                    } catch (proxyError) {
                        this.logger.warn(`代理连接失败，尝试直连: ${proxyError}`)
                        response = await fetch(url, fetchOptions)
                    }
                } else {
                    // 直连
                    response = await fetch(url, fetchOptions)
                }

                clearTimeout(timeoutId)
                return response

            } catch (error) {
                this.logger.error(`Fetch 请求失败: ${url} - ${error}`)
                throw error
            }
        }
    }



    /**
     * 运行完整的演示流程
     */
    async run(): Promise<void> {
        try {
            console.log(createSeparator('Hello Bundle 演示开始', 60))
            this.logger.startStep('完整演示流程')

            // 第零阶段：初始化网络连接
            this.logger.info('🌐 初始化网络连接...')
            this.connection = await this.createAndTestConnection()

            // 第一阶段： 初始化所有模块
            await this.initializeModules()

            // 第二阶段： 验证模块集成
            await this.verifyModuleIntegration()

            // 第三阶段： 执行 Bundle 操作
            await this.executeBundleOperations()

            // 第四阶段： 性能分析和清理
            await this.performanceAnalysisAndCleanup()

            this.logger.endStep('完整演示流程')
            this.logger.success(`演示完成，总耗时：${this.logger.getTotalTime() / 1000}秒`)

        } catch (error) {
            this.logger.error('演示执行失败:', error)
            throw error
        } finally {
            console.log(createSeparator('Hello Bundle 演示结束', 60))
        }
    }

    /**
     * 第一阶段：初始化所有模块
     */
    private async initializeModules(): Promise<void> {
        this.logger.startStep('模块初始化')

        try {
            // 1. 测试网络连接
            this.logger.info('测试网络连接...')
            await this.testNetworkConnection()

            // 2. 检查账户余额并自动空投
            this.logger.info('检查账户余额...')
            const hasBalance = await checkAccountBalance(this.connection, this.payer.publicKey, 1 * 1000000000) // 需要 1 SOL
            if (!hasBalance) {
                throw new Error('账户余额不足，空投失败')
            }

            // 2. 初始化 Jito 客户端
            this.logger.info('初始化 Jito 客户端...')
            // 创建一个包含 connection 的配置对象
            const jitoConfig = { ...this.config.jito, connection: this.connection }
            this.jitoClient = new EnhancedJitoClient(jitoConfig, this.payer)

            // 3. 初始化 Bundle 管理器
            this.logger.info('初始化 Bundle 管理器...')
            this.bundleManager = new BundleManager(this.jitoClient, this.config.bundleManager)

            // 4. 初始化性能监控器
            this.logger.info('初始化性能监控器...')
            this.performanceMonitor = new BundlePerformanceMonitor(this.config.performanceMonitor)

            // 5. 初始化重试管理器
            this.logger.info('初始化重试管理器...')
            this.retryManager = new BundleRetryManager(this.config.retryManager)

            // 6. 初始化交易生成器
            this.logger.info('初始化交易生成器...')
            this.transactionGenerator = new DemoTransactionGenerator(this.connection, this.payer)

            // 7. 初始化空投管理器
            this.logger.info('初始化空投管理器...')
            this.airdropManager = new AirdropManager(this.connection)

            this.logger.endStep('模块初始化')

        } catch (error) {
            this.logger.error('模块初始化失败:', error)
            throw error
        }
    }

    /**
     * 第二阶段：验证模块集成
     */
    private async verifyModuleIntegration(): Promise<void> {
        this.logger.startStep('模块集成验证')

        try {
            // 1. 启动 Bundle 管理器
            this.logger.info('启动 Bundle 管理器...')
            await this.bundleManager.start()

            // 2. 启动性能监控器
            this.logger.info('启动性能监控器...')
            this.performanceMonitor.start()

            // 3. 设置事件监听器
            this.logger.info('设置事件监听器...')
            this.setupEventListeners()

            // 4. 验证配置一致性
            this.logger.info('验证配置一致性...')
            this.verifyConfigConsistency()

            // 5. 测试模块间通信
            this.logger.info('测试模块间通信...')
            await this.testModuleCommunication()

            this.logger.endStep('模块集成验证')

        } catch (error) {
            this.logger.error('模块集成验证失败:', error)
            throw error
        }
    }

    /**
     * 第三阶段：执行 Bundle 操作
     */
    private async executeBundleOperations(): Promise<void> {
        this.logger.startStep('Bundle 操作执行')

        try {
            // 1. 创建测试交易
            this.logger.info(`创建 ${this.config.demo.transactionCount} 个测试交易...`)
            const transactions = await this.transactionGenerator.createMultipleTransactions(this.config.demo.transactionCount)

            // 2. 创建 Bundle
            this.logger.info('创建 Bundle...')
            const bundle = await this.bundleManager.createBundle(transactions)
            this.logger.info(`Bundle 创建成功: ${bundle.id}`)

            // 3. 提交 Bundle
            this.logger.info('提交 Bundle...')
            const submissionResult = await this.bundleManager.submitBundle(bundle.id)

            if (submissionResult.status === 'submitted') {
                this.logger.success(`Bundle 提交成功: ${submissionResult.bundleId}`)
            } else {
                this.logger.error(`Bundle 提交失败: ${submissionResult.error}`)
            }

            // 4. 监控 Bundle 状态
            this.logger.info('监控 Bundle 状态...')
            await this.monitorBundleStatus(bundle.id)

            this.logger.endStep('Bundle 操作执行')

        } catch (error) {
            this.logger.error('Bundle 操作执行失败:', error)
            throw error
        }
    }

    /**
     * 第四阶段：性能分析和清理
     */
    private async performanceAnalysisAndCleanup(): Promise<void> {
        this.logger.startStep('性能分析和清理')

        try {
            // 1. 收集性能数据
            this.logger.info('收集性能数据...')
            const performanceReport = this.performanceMonitor.generateDetailedReport()
            this.logger.logPerformanceStats(performanceReport)

            // 2. 获取管理器统计
            this.logger.info('获取管理器统计...')
            const managerStats = this.bundleManager.getStats()
            this.logger.logPerformanceStats(managerStats)

            // 3. 获取重试统计
            this.logger.info('获取重试统计...')
            const retryStats = this.retryManager.getRetryStatistics()
            this.logger.logPerformanceStats(retryStats)

            // 4. 分析潜在问题
            this.logger.info('分析潜在问题...')
            this.analyzeIssues(performanceReport, managerStats)

            // 5. 清理资源
            this.logger.info('清理资源...')
            await this.cleanup()

            this.logger.endStep('性能分析和清理')

        } catch (error) {
            this.logger.error('性能分析和清理失败:', error)
            throw error
        }
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        //  Bundle 创建事件
        this.bundleManager.addEventListener(BundleEventType.CREATED,
            (event) => {
                this.logger.logBundleStatus(event.bundle.id, 'CREATED', event.data)
                // 通知性能监控器
                this.performanceMonitor.handleBundleEvent(event)
            })

        // Bundle 提交事件
        this.bundleManager.addEventListener(BundleEventType.SUBMITTED,
            (event) => {
                this.logger.logBundleStatus(event.bundle.id, 'SUBMITTED', event.data)
                // 通知性能监控器
                this.performanceMonitor.handleBundleEvent(event)
            })

        // Bundle 确认事件
        this.bundleManager.addEventListener(BundleEventType.CONFIRMED,
            (event) => {
                this.logger.logBundleStatus(event.bundle.id, 'CONFIRMED', event.data)
                // 通知性能监控器
                this.performanceMonitor.handleBundleEvent(event)
            })

        // Bundle 失败事件
        this.bundleManager.addEventListener(BundleEventType.FAILED,
            (event) => {
                this.logger.logBundleStatus(event.bundle.id, 'FAILED', event.data)
                // 通知性能监控器
                this.performanceMonitor.handleBundleEvent(event)
            })

        // Bundle 超时事件
        this.bundleManager.addEventListener(BundleEventType.TIMEOUT,
            (event) => {
                this.logger.logBundleStatus(event.bundle.id, 'TIMEOUT', event.data)
                // 通知性能监控器
                this.performanceMonitor.handleBundleEvent(event)
            })

        // Bundle 重试事件
        this.bundleManager.addEventListener(BundleEventType.RETRY,
            (event) => {
                this.logger.logBundleStatus(event.bundle.id, 'RETRY', event.data)
                // 通知性能监控器
                this.performanceMonitor.handleBundleEvent(event)
            })
    }

    /**
     * 验证配置一致性
     */
    private verifyConfigConsistency(): void {
        // 检查超时配置是否一致
        const bundleTimeout = this.config.bundleManager.bundleTimeout
        const retryMaxDelay = this.config.retryManager.maxDelay

        if (bundleTimeout < retryMaxDelay) {
            this.logger.warn(`配置不一致: bundle 超时时间 (${bundleTimeout}ms) < 重试最大延迟时间 (${retryMaxDelay}ms)`)
        }

        // 检查重试次数配置
        const bundleRetries = this.config.jito.defaultBundleOptions.maxRetries
        const retryAttempts = this.config.retryManager.maxAttempts

        if (bundleRetries !== retryAttempts) {
            this.logger.warn(`配置不一致: Bundle 最大重试次数 (${bundleRetries}) != 重试管理器最大重试次数 (${retryAttempts})`)
        }

        this.logger.info('配置一致性检查完成')
    }

    /**
     * 测试模块间通信
     */
    private async testModuleCommunication(): Promise<void> {
        // 测试重试管理器的错误分析功能
        const testError = {
            code: 'NETWORK_ERROR',
            message: 'Connection timeout',
            timestamp: new Date(),
            details: 'Test error for communication verification'
        }

        // 创建模拟 Bundle 实例进行测试
        const testBundle = {
            id: 'test-bundle-' + Date.now(),
            bundleId: '',
            transactions: [],
            options: {},
            createdAt: new Date(),
            status: 'PENDING' as any,
            retryCount: 0,
            metrics: {
                tipAmount: 1000,
                transactionCount: 1,
                success: false
            }
        }

        // 测试重试决策
        const retryDecision = this.retryManager.makeRetryDecision(testBundle as any, testError as any)
        this.logger.info(`重试决策测试: ${retryDecision.shouldRetry ? '应该重试' : '不应重试'} - ${retryDecision.reason}`)

        this.logger.info('模块间通信测试完成')
    }

    /**
     * 监控 Bundle 状态
     */
    private async monitorBundleStatus(bundleId: string): Promise<void> {
        const maxWaitTime = this.config.demo.demoTimeoutMs
        const checkInterval = 3000 // 3秒检查一次
        let elapsedTime = 0 // 已经等待的时间

        while (elapsedTime < maxWaitTime) {
            try {
                const statusResult = await this.bundleManager.getBundleStatus(bundleId)
                this.logger.logBundleStatus(bundleId, statusResult.status)

                // 如果 Bundle 已完成（成功或失败），退出监控
                if (statusResult.status === BundleStatus.LANDED || statusResult.status === BundleStatus.FAILED) {
                    break
                }

                // 等待下次检查
                await new Promise(resolve => setTimeout(resolve, checkInterval))
                elapsedTime += checkInterval

            } catch (error) {
                this.logger.error(`状态检查失败: ${error}`)
                break
            }
        }
        if (elapsedTime >= maxWaitTime) {
            this.logger.warn(`Bundle ${bundleId} 监控超时`)
        }
    }

    /**
     * 分析潜在问题
     */
    private analyzeIssues(_performanceReport: any, managerStats: any): void {
        const issues: string[] = []

        // 检查成功率
        if (managerStats.successRate < this.config.performanceMonitor.thresholds.minSuccessRate) {
            issues.push(`成功率过低：${managerStats.successRate}%`)
        }

        // 检查确认时间
        if (managerStats.averageConfirmationTime > this.config.performanceMonitor.thresholds.maxConfirmationTime) {
            issues.push(`确认时间过长: ${managerStats.averageConfirmationTime}ms`)
        }

        // 检查小费金额
        if (managerStats.averageTipAmount > this.config.performanceMonitor.thresholds.maxAverageTip) {
            issues.push(`平均小费过高: ${managerStats.averageTipAmount} lamports`)
        }

        if (issues.length > 0) {
            this.logger.warn('发现潜在结果：')
            issues.forEach(issue => this.logger.warn(`- ${issue}`))
        } else {
            this.logger.success('未发现明显问题')
        }
    }

    /**
     * 清理资源
     */
    private async cleanup(): Promise<void> {
        try {
            // 停止 Bundle 管理器
            await this.bundleManager.stop()

            // 停止性能监控器
            this.performanceMonitor.stop()

            this.logger.info('资源清理完成')

        } catch (error) {
            this.logger.error('资源清理失败:', error)
        }
    }
}

/**
 * 演示入口函数
 */
export async function runHelloBundleDemo(scenario: 'basic' | 'stress' | 'production' = 'basic'): Promise<void> {
    const demo = new HelloBundleDemo(scenario)
    await demo.run()
}

// 如果直接运行此文件，则执行演示
// .then(...) 用于接收这个 Promise 成功（resolve）后返回的结果。
// process.exit(0)：表示成功退出，向系统返回状态码 0。
// process.exit(1)（或其他非 0 数值）：表示异常退出，通常用于报告错误，状态码为非 0。


if (require.main === module) {
    runHelloBundleDemo('basic')
        .then(() => {
            console.log('演示完成')
            process.exit(0)
        })
        .catch(error => {
            console.error('演示失败:', error)
            process.exit(1)
        })
}



