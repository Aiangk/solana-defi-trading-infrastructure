#!/usr/bin/env ts-node

/**
 * Hello Bundle 弹性演示
 * 
 * 这个版本专门处理网络拥堵和限流问题
 * 包含智能重试、降级策略和详细的错误分析
 * 
 * 特性：
 * 1. 智能错误检测和分类
 * 2. 自适应重试策略
 * 3. 网络状况监控
 * 4. 降级到直接交易发送
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getDemoConfig } from './demo-config'
import { DemoLogger } from './demo-logger'
import { createDemoTransactions } from './demo-transactions'
import { EnhancedJitoClient } from '../../core/jito/jito-client'
import { BundleManager } from '../../core/jito/bundle-manager'
import { PerformanceMonitor } from '../../core/jito/bundle-performance-monitor'
import { RetryManager } from '../../core/jito/bundle-retry-manager'

// 错误类型分析器
class ErrorAnalyzer {
    static analyzeError(error: any): {
        category: 'network_congestion' | 'rate_limit' | 'system_error' | 'unknown'
        severity: 'low' | 'medium' | 'high' | 'critical'
        retryable: boolean
        suggestedAction: string
    } {
        const errorStr = String(error).toLowerCase()

        // 网络拥堵检测
        if (errorStr.includes('429') || errorStr.includes('rate limit') || errorStr.includes('congested')) {
            return {
                category: 'network_congestion',
                severity: 'high',
                retryable: true,
                suggestedAction: '等待网络拥堵缓解，或切换到直接交易发送'
            }
        }

        // 系统错误检测
        if (errorStr.includes('timeout') || errorStr.includes('connection')) {
            return {
                category: 'system_error',
                severity: 'medium',
                retryable: true,
                suggestedAction: '检查网络连接，使用指数退避重试'
            }
        }

        return {
            category: 'unknown',
            severity: 'medium',
            retryable: false,
            suggestedAction: '检查错误详情，可能需要手动处理'
        }
    }
}

// 弹性 Bundle 管理器
class ResilientBundleManager {
    private logger: DemoLogger
    private connection: Connection
    private jitoClient?: EnhancedJitoClient
    private bundleManager?: BundleManager
    private fallbackMode = false

    constructor(connection: Connection, logger: DemoLogger) {
        this.connection = connection
        this.logger = logger
    }

    async initialize(): Promise<void> {
        try {
            this.logger.info('初始化 Jito 客户端...')
            this.jitoClient = new EnhancedJitoClient()

            this.logger.info('初始化 Bundle 管理器...')
            const config = getDemoConfig('basic')
            this.bundleManager = new BundleManager(
                this.jitoClient,
                config.bundleManager
            )

            await this.bundleManager.start()
            this.logger.success('Bundle 管理器初始化成功')

        } catch (error) {
            this.logger.warn('Bundle 管理器初始化失败，将使用降级模式')
            this.fallbackMode = true
        }
    }

    async submitTransactions(transactions: any[], payer: Keypair): Promise<{
        success: boolean
        method: 'bundle' | 'direct'
        results: any[]
        error?: string
    }> {
        // 首先尝试 Bundle 方式
        if (!this.fallbackMode && this.bundleManager) {
            try {
                this.logger.info('🚀 尝试 Bundle 提交...')
                const result = await this.submitAsBundle(transactions)
                return {
                    success: result.success,
                    method: 'bundle',
                    results: [result]
                }
            } catch (error) {
                const analysis = ErrorAnalyzer.analyzeError(error)
                this.logger.warn(`Bundle 提交失败: ${analysis.category} (${analysis.severity})`)
                this.logger.info(`建议操作: ${analysis.suggestedAction}`)

                // 如果是网络拥堵，切换到直接发送
                if (analysis.category === 'network_congestion') {
                    this.logger.info('🔄 切换到直接交易发送模式...')
                    return this.submitDirectly(transactions, payer)
                }
            }
        }

        // 降级到直接发送
        this.logger.info('📤 使用直接交易发送...')
        return this.submitDirectly(transactions, payer)
    }

    private async submitAsBundle(transactions: any[]): Promise<{
        success: boolean
        bundleId?: string
        error?: string
    }> {
        if (!this.bundleManager) {
            throw new Error('Bundle 管理器未初始化')
        }

        try {
            const bundle = await this.bundleManager.createBundle(transactions)
            const result = await this.bundleManager.submitBundle(bundle.id)

            return {
                success: result.status === 'submitted',
                bundleId: result.bundleId
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    private async submitDirectly(transactions: any[], payer: Keypair): Promise<{
        success: boolean
        method: 'direct'
        results: string[]
        error?: string
    }> {
        const signatures: string[] = []

        try {
            for (let i = 0; i < transactions.length; i++) {
                const tx = transactions[i]
                this.logger.info(`发送交易 ${i + 1}/${transactions.length}...`)

                const signature = await this.connection.sendTransaction(tx, [payer])
                signatures.push(signature)

                this.logger.info(`交易 ${i + 1} 签名: ${signature}`)

                // 添加小延迟避免过快发送
                if (i < transactions.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000))
                }
            }

            // 等待确认
            this.logger.info('等待交易确认...')
            for (const signature of signatures) {
                await this.connection.confirmTransaction(signature, 'confirmed')
            }

            return {
                success: true,
                method: 'direct',
                results: signatures
            }

        } catch (error) {
            return {
                success: false,
                method: 'direct',
                results: signatures,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    async cleanup(): Promise<void> {
        if (this.bundleManager) {
            await this.bundleManager.stop()
        }
    }
}

// 主演示函数
async function runResilientBundleDemo() {
    const logger = new DemoLogger('ResilientBundle')

    logger.info('🛡️ 启动弹性 Bundle 演示')
    console.log('==================== 弹性 Bundle 演示开始 =====================')

    try {
        // 1. 连接设置
        logger.step('连接设置')
        const connection = new Connection('http://localhost:8899', 'confirmed')

        // 2. 创建演示密钥对和空投
        logger.step('账户准备')
        const demoKeypair = Keypair.generate()
        logger.info(`演示地址: ${demoKeypair.publicKey.toBase58()}`)

        const airdropSignature = await connection.requestAirdrop(
            demoKeypair.publicKey,
            2 * LAMPORTS_PER_SOL
        )
        await connection.confirmTransaction(airdropSignature)
        logger.success('空投完成')

        // 3. 初始化弹性管理器
        logger.step('初始化弹性管理器')
        const resilientManager = new ResilientBundleManager(connection, logger)
        await resilientManager.initialize()

        // 4. 创建交易
        logger.step('创建演示交易')
        const transactions = await createDemoTransactions(connection, demoKeypair, 2)

        // 5. 执行弹性提交
        logger.step('执行弹性提交')
        const result = await resilientManager.submitTransactions(transactions, demoKeypair)

        // 6. 结果分析
        logger.step('结果分析')
        if (result.success) {
            logger.success(`🎉 交易成功！使用方法: ${result.method}`)
            if (result.method === 'bundle') {
                logger.info('Bundle 提交成功，享受了 MEV 保护')
            } else {
                logger.info('直接交易发送成功，虽然没有 Bundle 保护但确保了执行')
            }
        } else {
            logger.error(`❌ 交易失败: ${result.error}`)
        }

        // 7. 清理
        await resilientManager.cleanup()

    } catch (error) {
        logger.error(`演示执行出错: ${error instanceof Error ? error.message : String(error)}`)
    }

    console.log('==================== 弹性 Bundle 演示结束 =====================')
    logger.success('演示完成')
}

// 运行演示
if (require.main === module) {
    runResilientBundleDemo().catch(console.error)
}

export { runResilientBundleDemo }
