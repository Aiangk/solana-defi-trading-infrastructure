import { Transaction, Connection, Keypair } from '@solana/web3.js';
import BN from 'bn.js';
import bs58 from 'bs58';

// 导入类型定义
import {
    SwapRequest,
    ProtectedSwapRequest,
    BatchSwapRequest,
    BatchStrategy
} from '../../types/facade/swap-types';

import {
    SwapResult,
    BundleResult,
    BatchResult,
    SwapError,
    ErrorType
} from '../../types/facade/result-types';

// 导入核心组件
import { DEXAggregator } from '../aggregator/dex-aggregator';
import { BundleManager } from '../jito/bundle-manager';
import { BundleOptions } from '../../types/jito/bundle-types';

/**
 * 交易编排器
 * 
 * 负责协调 DEX 聚合器和 Bundle 管理器, 提供智能的交易执行策略.
 * 这是 Facade 层的核心组件, 将复杂的教育逻辑封装成简单的接口.
 */
export class SwapOrchestrator {
    constructor(
        private dexAggregator: DEXAggregator,
        private bundleManager: BundleManager,
        private connection: Connection
    ) {
        console.log('🎭 SwapOrchestrator 初始化完成');
    }

    // ==================== 核心执行方法 ====================

    /**
     * 执行标准交换
     * 使用 DEX 聚合器选择最优路径并执行交易
     */
    async executeStandardSwap(request: SwapRequest): Promise<SwapResult> {
        const startTime = Date.now();

        try {
            console.log('🔄 开始执行标准交换...');
            console.log(`   策略: 标准模式 (无 MEV 保护)`);

            // 1. 获取最优报价
            const aggregatedRoute = await this.dexAggregator.getAggregatedQuote(
                request.inputToken,
                request.outputToken,
                request.inputAmount,
                request.slippage
            );

            console.log(`   选择的 DEX: ${aggregatedRoute.recommendedDEX}`);
            console.log(`   预期输出: ${aggregatedRoute.bestQuote.outputAmount.toString()}`);

            // 2. 构建交换指令
            const swapInstruction = await this.dexAggregator.executeOptimalSwap(
                aggregatedRoute,
                request.userWallet,
                request.inputToken,   // 需要实际的 token account
                request.outputToken
            );

            // 3. 创建并提交交易
            const transaction = new Transaction().add(swapInstruction);

            // 4. 模拟执行结果 (在实际实现中应该真正提交交易)
            const executionTime = Date.now() - startTime;

            const result: SwapResult = {
                success: true,
                signature: 'simulated_signature_' + Date.now(),
                executedDex: aggregatedRoute.recommendedDEX,
                actualInputAmount: request.inputAmount,
                actualOutputAmount: aggregatedRoute.bestQuote.outputAmount,
                actualPriceImpact: aggregatedRoute.bestQuote.priceImpact,
                transactionFee: aggregatedRoute.bestQuote.fee,
                executionTime,
                details: {
                    route: aggregatedRoute.bestQuote.route,
                    instructionCount: 1,
                    computeUnitsUsed: aggregatedRoute.bestQuote.estimatedGas,
                    networkCongestion: this.assessNetworkCongestion(),
                    executionStrategy: 'STANDARD_SWAP'
                }
            };

            console.log(`✅ 标准交换完成，耗时: ${executionTime}ms`);
            return result;
        } catch (error) {
            console.error('❌ 标准交换失败:', error);
            return this.createErrorResult(error, Date.now() - startTime, 'STANDARD_SWAP');
        }
    }

    /**
     * 执行 MEV 保护交换
     * 使用 Jito Bundle 系统提供 MEV 保护
     */
    async executeProtectedSwap(request: ProtectedSwapRequest): Promise<BundleResult> {
        const startTime = Date.now();

        try {
            console.log('🛡️ 开始执行 MEV 保护交换...');
            console.log(`   Bundle 优先级: ${request.bundlePriority}`);
            console.log(`   前置运行保护: ${request.enableFrontrunProtection}`);

            // 1. 获取最优报价
            const aggregatedRoute = await this.dexAggregator.getAggregatedQuote(
                request.inputToken,
                request.outputToken,
                request.inputAmount,
                request.slippage
            );

            // 2. 构建交换指令
            const swapInstruction = await this.dexAggregator.executeOptimalSwap(
                aggregatedRoute,
                request.userWallet,
                request.inputToken,
                request.outputToken
            );

            // 3. 创建交易
            const transaction = new Transaction().add(swapInstruction);

            // 4. 签名交易 (MEV 保护需要签名的交易)
            console.log('🔐 对交易进行签名...');
            try {
                // 设置最新的 blockhash
                const { blockhash } = await this.connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = request.userWallet;

                // 使用测试钱包私钥签名交易
                const testWalletPrivateKey = '5h4KiRELYrdPqacLfAuPXRZj5zmn65pkDSEs4PuJcJk6ttEKJUwpJVcquPvdpFcwenFogeFUPrXTfTnYUYss3N2i';
                const testWalletAddress = 'BkKsmbeuhbeKSLgHBLQaJMdfKhx8ccsqr2jbWm7TGWNz';

                // 验证请求的钱包是否是我们的测试钱包
                if (request.userWallet.toBase58() === testWalletAddress) {
                    console.log('🔑 使用测试钱包私钥签名交易...');

                    // 解码私钥并创建 Keypair
                    const secretKeyBytes = bs58.decode(testWalletPrivateKey);
                    const testKeypair = Keypair.fromSecretKey(secretKeyBytes);

                    // 签名交易
                    transaction.sign(testKeypair);

                    console.log('✅ 交易签名完成');
                    console.log(`   签名者: ${testKeypair.publicKey.toBase58()}`);
                    console.log(`   签名: ${transaction.signature?.toString('base64').slice(0, 20)}...`);
                } else {
                    console.warn('⚠️  警告: 请求的钱包不是测试钱包，无法签名');
                    console.warn(`   请求钱包: ${request.userWallet.toBase58()}`);
                    console.warn(`   测试钱包: ${testWalletAddress}`);
                    throw new Error('无法为非测试钱包签名交易');
                }

            } catch (error) {
                console.error('❌ 交易签名失败:', error);
                throw new Error(`交易签名失败: ${error}`);
            }

            // 5. 配置 Bundle 选项
            const bundleOptions: BundleOptions = {
                encoding: 'base64',
                priority: request.bundlePriority,
                maxRetries: 3,
                timeoutMs: request.maxWaitTime || 30000,
                enableMevProtection: true,
                tipStrategy: {
                    mode: request.customTip ? 'manual' : 'auto',
                    amount: request.customTip,
                    percentile: 75, // 75th percentile for auto mode
                    maxTip: 10000 // 0.01 SOL max tip
                }
            };

            // 5. 创建并提交 Bundle
            const bundle = await this.bundleManager.createBundle([transaction], bundleOptions);
            const submissionResult = await this.bundleManager.submitBundle(bundle.id);

            // 6. 构建结果
            const executionTime = Date.now() - startTime;

            const result: BundleResult = {
                success: submissionResult.status === 'submitted',
                signature: submissionResult.bundleId,
                bundleId: submissionResult.bundleId,
                bundleStatus: 'processing',
                executedDex: aggregatedRoute.recommendedDEX,
                actualInputAmount: request.inputAmount,
                actualOutputAmount: aggregatedRoute.bestQuote.outputAmount,
                actualPriceImpact: aggregatedRoute.bestQuote.priceImpact,
                transactionFee: aggregatedRoute.bestQuote.fee,
                executionTime,
                mevProtection: {
                    protectionLevel: 'premium',
                    detectedThreats: request.enableFrontrunProtection ? ['frontrun_risk'] : [],
                    appliedProtections: ['jito_bundle', 'tip_priority'],
                    tipAmount: submissionResult.tipAmount,
                    protectionCost: new BN(submissionResult.tipAmount)
                },
                details: {
                    route: aggregatedRoute.bestQuote.route,
                    instructionCount: 1,
                    computeUnitsUsed: aggregatedRoute.bestQuote.estimatedGas,
                    networkCongestion: this.assessNetworkCongestion(),
                    executionStrategy: 'MEV_PROTECTED_BUNDLE'
                },
                bundleInstance: bundle
            };

            console.log(`✅ MEV 保护交换完成，Bundle ID: ${submissionResult.bundleId}`);
            return result;

        } catch (error) {
            console.error('❌ MEV 保护交换失败:', error);
            throw error;
        }
    }

    /**
     * 执行批量交换
     * 支持多种批量执行策略
     */
    async executeBatchSwaps(request: BatchSwapRequest): Promise<BatchResult> {
        const startTime = Date.now();

        try {
            console.log(`🔄 开始执行批量交换，数量: ${request.swaps.length}`);
            console.log(`   执行策略: ${request.strategy}`);
            console.log(`   原子操作: ${request.atomic}`);

            let results: SwapResult[] = [];

            switch (request.strategy) {
                case BatchStrategy.PARALLEL:
                    results = await this.executeParallelSwaps(request.swaps, request.enableMevProtection);
                    break;

                case BatchStrategy.SEQUENTIAL:
                    results = await this.executeSequentialSwaps(request.swaps, request.enableMevProtection);
                    break;

                case BatchStrategy.SMART:
                    results = await this.executeSmartSwaps(request.swaps, request.enableMevProtection);
                    break;

                default:
                    throw new Error(`不支持的批量执行策略: ${request.strategy}`);
            }

            // 统计结果
            const successCount = results.filter(r => r.success).length;
            const failureCount = results.length - successCount;
            const totalExecutionTime = Date.now() - startTime;

            const batchResult: BatchResult = {
                overallSuccess: request.atomic ? successCount === results.length : successCount > 0,
                successCount,
                failureCount,
                results,
                totalExecutionTime,
                statistics: {
                    averageExecutionTime: totalExecutionTime / results.length,
                    totalSavings: this.calculateTotalSavings(results),
                    successRate: (successCount / results.length) * 100,
                    dexDistribution: this.calculateDexDistribution(results),
                    mevProtectionStats: request.enableMevProtection ? {
                        protectedTransactions: successCount,
                        totalProtectionCost: new BN(successCount * 2000), // 估算
                        threatsBlocked: 0 // 需要实际统计
                    } : undefined
                }
            };

            console.log(`✅ 批量交换完成: ${successCount}/${results.length} 成功`);
            return batchResult;

        } catch (error) {
            console.error('❌ 批量交换失败:', error);
            throw error;
        }
    }
    // ==================== 私有辅助方法 ====================

    /**
     * 并行执行交换
     */
    private async executeParallelSwaps(swaps: SwapRequest[], enableMevProtection?: boolean): Promise<SwapResult[]> {
        console.log('⚡ 使用并行执行策略...');

        const promises = swaps.map(swap => {
            if (enableMevProtection) {
                const protectedRequest: ProtectedSwapRequest = {
                    ...swap,
                    bundlePriority: 'medium',
                    enableFrontrunProtection: true
                };
                return this.executeProtectedSwap(protectedRequest)
                    .then(result => this.convertBundleResultToSwapResult(result))
                    .catch(error => this.createErrorResult(error, 0, 'PARALLEL_PROTECTED'));
            } else {
                return this.executeStandardSwap(swap)
                    .catch(error => this.createErrorResult(error, 0, 'PARALLEL_STANDARD'));
            }
        });

        return Promise.all(promises);
    }

    /**
     * 顺序执行交换
     */
    private async executeSequentialSwaps(swaps: SwapRequest[], enableMevProtection?: boolean): Promise<SwapResult[]> {
        console.log('📋 使用顺序执行策略...');

        const results: SwapResult[] = [];

        for (const swap of swaps) {
            try {
                let result: SwapResult;

                if (enableMevProtection) {
                    const protectedRequest: ProtectedSwapRequest = {
                        ...swap,
                        bundlePriority: 'medium',
                        enableFrontrunProtection: true
                    };
                    const bundleResult = await this.executeProtectedSwap(protectedRequest);
                    result = this.convertBundleResultToSwapResult(bundleResult);
                } else {
                    result = await this.executeStandardSwap(swap);
                }

                results.push(result);

                // 短暂延迟避免网络拥堵
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                const errorResult = this.createErrorResult(error, 0, 'SEQUENTIAL');
                results.push(errorResult);
            }
        }

        return results;
    }

    /**
     * 智能执行交换
     * 根据交易特征自动选择最优策略
     */
    private async executeSmartSwaps(swaps: SwapRequest[], enableMevProtection?: boolean): Promise<SwapResult[]> {
        console.log('🧠 使用智能执行策略...');

        // 分析交易特征
        const analysis = this.analyzeSwapCharacteristics(swaps);

        if (analysis.recommendParallel) {
            console.log('   → 推荐并行执行');
            return this.executeParallelSwaps(swaps, enableMevProtection);
        } else {
            console.log('   → 推荐顺序执行');
            return this.executeSequentialSwaps(swaps, enableMevProtection);
        }
    }

    /**
     * 分析交换特征
     */
    private analyzeSwapCharacteristics(swaps: SwapRequest[]): { recommendParallel: boolean } {
        // 简化的分析逻辑
        const hasLargeAmounts = swaps.some(swap => swap.inputAmount.gt(new BN(1000000000))); // > 1 SOL
        const hasSameTokenPairs = this.hasDuplicateTokenPairs(swaps);

        // 如果有大额交易或重复交易对，推荐顺序执行
        const recommendParallel = !hasLargeAmounts && !hasSameTokenPairs && swaps.length <= 5;

        return { recommendParallel };
    }

    /**
     * 检查是否有重复的交易对
     */
    private hasDuplicateTokenPairs(swaps: SwapRequest[]): boolean {
        const pairs = new Set();

        for (const swap of swaps) {
            const pairKey = `${swap.inputToken.toBase58()}-${swap.outputToken.toBase58()}`;
            if (pairs.has(pairKey)) {
                return true;
            }
            pairs.add(pairKey);
        }

        return false;
    }

    /**
     * 评估网络拥堵程度
     */
    private assessNetworkCongestion(): 'low' | 'medium' | 'high' {
        // 简化实现 - 在实际环境中应该基于真实的网络数据
        const random = Math.random();
        if (random < 0.3) return 'low';
        if (random < 0.7) return 'medium';
        return 'high';
    }

    /**
     * 将 BundleResult 转换为 SwapResult
     */
    private convertBundleResultToSwapResult(bundleResult: BundleResult): SwapResult {
        return {
            success: bundleResult.success,
            signature: bundleResult.signature,
            executedDex: bundleResult.executedDex,
            actualInputAmount: bundleResult.actualInputAmount,
            actualOutputAmount: bundleResult.actualOutputAmount,
            actualPriceImpact: bundleResult.actualPriceImpact,
            transactionFee: bundleResult.transactionFee,
            executionTime: bundleResult.executionTime,
            error: bundleResult.error,
            details: bundleResult.details
        };
    }

    /**
     * 创建错误结果
     */
    private createErrorResult(error: any, executionTime: number, context: string): SwapResult {
        const swapError: SwapError = {
            code: 'ORCHESTRATOR_ERROR',
            message: error instanceof Error ? error.message : String(error),
            type: ErrorType.UNKNOWN_ERROR,
            retryable: true,
            suggestion: '请检查网络连接和交易参数，然后重试'
        };

        return {
            success: false,
            executedDex: 'unknown',
            actualInputAmount: new BN(0),
            actualOutputAmount: new BN(0),
            actualPriceImpact: 0,
            transactionFee: new BN(0),
            executionTime,
            error: swapError,
            details: {
                route: [],
                instructionCount: 0,
                computeUnitsUsed: 0,
                networkCongestion: 'medium',
                executionStrategy: context
            }
        };
    }

    /**
     * 计算总节省金额
     */
    private calculateTotalSavings(results: SwapResult[]): BN {
        return results
            .filter(r => r.success)
            .reduce((total, result) => total.add(result.transactionFee), new BN(0));
    }

    /**
     * 计算 DEX 分布
     */
    private calculateDexDistribution(results: SwapResult[]): Record<string, number> {
        const distribution: Record<string, number> = {};

        results
            .filter(r => r.success)
            .forEach(result => {
                distribution[result.executedDex] = (distribution[result.executedDex] || 0) + 1;
            });

        return distribution;
    }
}

