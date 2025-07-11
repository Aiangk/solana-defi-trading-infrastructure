/**
 * 真实 Swap 交易演示
 * 
 * 这个演示会执行真实的代币交换，可以在区块链浏览器中查看
 * 
 * 使用方法：
 * 1. 确保钱包有足够的 SOL 余额
 * 2. 运行: npx ts-node src/examples/real-swap-demo.ts
 * 3. 在 Solana Explorer 中查看交易结果
 * 
 * 警告：这会消耗真实的代币！
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import BN from 'bn.js';
import bs58 from 'bs58';

// 导入我们的交易组件
import { SwapEngine } from '../core/swap/swap-engine';
import { DEXAggregator } from '../core/aggregator/dex-aggregator';
import { createDevelopmentConnection } from '../config/network-config';
import { NetworkType } from '../types/token/token-types';
import { SwapDirection } from '../types/swap/swap-types';

/**
 * 真实 Swap 演示类
 */
class RealSwapDemo {
    private connection: Connection;
    private wallet: Wallet;
    private swapEngine: SwapEngine;

    constructor() {
        // 使用 Helius RPC 以避免网络问题
        const heliusRpcUrl = 'https://devnet.helius-rpc.com/?api-key=61040956-f7ed-40fa-84d3-40c986ab834a';
        this.connection = new Connection(heliusRpcUrl, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 60000,
            disableRetryOnRateLimit: false
        });

        // 使用测试钱包
        const testPrivateKey = '5h4KiRELYrdPqacLfAuPXRZj5zmn65pkDSEs4PuJcJk6ttEKJUwpJVcquPvdpFcwenFogeFUPrXTfTnYUYss3N2i';
        const secretKeyBytes = bs58.decode(testPrivateKey);
        const testKeypair = Keypair.fromSecretKey(secretKeyBytes);
        this.wallet = new Wallet(testKeypair);

        // 初始化交换引擎
        this.swapEngine = new SwapEngine(this.connection, this.wallet, NetworkType.DEVNET);
    }

    /**
     * 运行真实交换演示
     */
    async run(): Promise<void> {
        console.log('🚀 === 真实 Swap 交易演示 ===\n');
        console.log('⚠️  警告：这将执行真实的代币交换！\n');

        try {
            // 1. 显示钱包信息
            await this.displayWalletInfo();

            // 2. 检查余额
            await this.checkBalances();

            // 3. 获取交换报价
            await this.getSwapQuote();

            // 4. 确认执行
            const shouldExecute = await this.confirmExecution();

            if (shouldExecute) {
                // 5. 执行真实交换
                await this.executeRealSwap();
            } else {
                console.log('❌ 用户取消了交易执行');
            }

        } catch (error) {
            console.error('❌ 演示执行失败:', error);
        }
    }

    /**
     * 显示钱包信息
     */
    private async displayWalletInfo(): Promise<void> {
        console.log('💼 钱包信息:');
        console.log(`   地址: ${this.wallet.publicKey.toBase58()}`);
        console.log(`   网络: Devnet`);
        console.log(`   RPC: ${this.connection.rpcEndpoint}\n`);
    }

    /**
     * 检查余额
     */
    private async checkBalances(): Promise<void> {
        console.log('💰 检查余额...');

        try {
            const balance = await this.connection.getBalance(this.wallet.publicKey);
            const solBalance = balance / 1e9; // 转换为 SOL

            console.log(`   SOL 余额: ${solBalance.toFixed(6)} SOL`);

            if (solBalance < 0.01) {
                console.log('⚠️  警告: SOL 余额不足，建议至少有 0.01 SOL');
                console.log('   可以从 https://faucet.solana.com 获取测试 SOL');
            } else {
                console.log('✅ SOL 余额充足，可以执行交易');
            }

        } catch (error) {
            console.log('❌ 余额检查失败 (可能是网络问题)');
            console.log('   这不会影响演示的其他功能');
            console.log('   如果要执行真实交易，请确保网络连接正常');
        }

        console.log('');
    }

    /**
     * 获取交换报价
     */
    private async getSwapQuote(): Promise<void> {
        console.log('📊 获取交换报价...');

        try {
            // 定义交换参数
            const swapParams = {
                direction: SwapDirection.SOL_TO_USDC,
                inputAmount: new BN(1000000), // 0.001 SOL (1,000,000 lamports)
                slippageTolerance: 0.01, // 1%
                minimumOutputAmount: new BN(0) // 将根据报价计算
            };

            console.log('   交换参数:');
            console.log(`     方向: ${swapParams.direction}`);
            console.log(`     输入: ${swapParams.inputAmount.toNumber() / 1e9} SOL`);
            console.log(`     滑点容忍: ${swapParams.slippageTolerance * 100}%`);

            // 获取报价
            const quote = await this.swapEngine.getSwapQuote(swapParams);

            console.log('\n   📋 报价结果:');
            console.log(`     推荐 DEX: ${quote.recommendedDEX}`);
            console.log(`     预期输出: ${quote.bestQuote.outputAmount.toString()} tokens`);
            console.log(`     价格影响: ${(quote.bestQuote.priceImpact * 100).toFixed(3)}%`);
            console.log(`     预估费用: ${quote.bestQuote.fee.toString()} lamports`);

        } catch (error) {
            console.error('❌ 报价获取失败:', error);
        }

        console.log('');
    }

    /**
     * 确认执行
     */
    private async confirmExecution(): Promise<boolean> {
        console.log('⚠️  确认执行真实交易:');
        console.log('   这将消耗真实的 SOL 和网络费用');
        console.log('   交易将在 Solana Devnet 上执行');
        console.log('   你可以在 Solana Explorer 中查看交易结果');
        console.log('');

        // 检查环境变量
        const enableRealTrading = process.env.ENABLE_REAL_TRADING === 'true';

        if (enableRealTrading) {
            console.log('✅ 真实交易模式已启用 (ENABLE_REAL_TRADING=true)');
            console.log('   将执行真实的代币交换！');
            return true;
        } else {
            console.log('🔒 安全模式：默认不执行真实交易');
            console.log('   如需执行真实交易，请运行:');
            console.log('   ENABLE_REAL_TRADING=true npm run demo:real-swap');
            return false;
        }
    }

    /**
     * 执行真实交换
     */
    private async executeRealSwap(): Promise<void> {
        console.log('🔄 执行真实交换...');

        try {
            const swapParams = {
                direction: SwapDirection.SOL_TO_USDC,
                inputAmount: new BN(1000000), // 0.001 SOL
                slippageTolerance: 0.01,
                minimumOutputAmount: new BN(0)
            };

            console.log('   提交交易到区块链...');
            const result = await this.swapEngine.executeSwap(swapParams);

            if (result.success) {
                console.log('\n✅ 交易成功执行！');
                console.log(`   交易签名: ${result.signature}`);
                console.log(`   实际输出: ${result.outputAmount.toString()}`);
                console.log(`   价格影响: ${(result.priceImpact * 100).toFixed(3)}%`);
                console.log(`   Devnet Explorer: https://explorer.solana.com/tx/${result.signature}?cluster=devnet`);
                console.log('');
                console.log('🎉 你可以在上面的链接中查看交易详情！');
            } else {
                console.log('\n❌ 交易执行失败');
                console.log(`   错误: ${result.error}`);
            }

        } catch (error) {
            console.error('❌ 交易执行异常:', error);
        }
    }
}

/**
 * 主函数
 */
async function main() {
    const demo = new RealSwapDemo();
    await demo.run();
}

// 运行演示
if (require.main === module) {
    main().catch(console.error);
}

export { RealSwapDemo };
