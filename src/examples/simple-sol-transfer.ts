/**
 * 简化的真实 SOL 转账演示
 * 
 * 这个演示展示项目的真实区块链交互能力：
 * 1. 使用项目专用的测试钱包
 * 2. 执行真实的 SOL 转账交易
 * 3. 可在 Solana Explorer 中查看交易结果
 * 4. 验证项目的区块链交互能力
 * 
 * 使用方法：
 * npm run demo:sol-transfer
 */

import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import bs58 from 'bs58';

/**
 * 真实 SOL 转账演示 - 验证区块链交互能力
 */
class RealSolTransferDemo {
    private connection: Connection;
    private wallet: Wallet;

    constructor() {
        // 使用 Helius RPC
        const heliusRpcUrl = 'https://devnet.helius-rpc.com/?api-key=61040956-f7ed-40fa-84d3-40c986ab834a';
        this.connection = new Connection(heliusRpcUrl, 'confirmed');
        
        // 使用测试钱包
        const testPrivateKey = '5h4KiRELYrdPqacLfAuPXRZj5zmn65pkDSEs4PuJcJk6ttEKJUwpJVcquPvdpFcwenFogeFUPrXTfTnYUYss3N2i';
        const secretKeyBytes = bs58.decode(testPrivateKey);
        const testKeypair = Keypair.fromSecretKey(secretKeyBytes);
        this.wallet = new Wallet(testKeypair);
    }

    /**
     * 运行真实 SOL 转账演示
     */
    async run(): Promise<void> {
        console.log('🚀 === 真实 SOL 转账演示 - 验证区块链交互能力 ===\n');
        
        console.log('📋 演示说明:');
        console.log('   本演示执行真实的 SOL 转账交易');
        console.log('   使用项目专用测试钱包: BkKsmbeuhbeKSLgHBLQaJMdfKhx8ccsqr2jbWm7TGWNz');
        console.log('   验证项目的真实区块链交互能力');
        console.log('   交易将在 Solana Devnet 上执行，可在浏览器中查看\n');

        const enableRealTrading = process.env.ENABLE_REAL_TRADING === 'true';
        
        if (!enableRealTrading) {
            console.log('❌ 真实交易未启用');
            console.log('   这是安全保护机制，防止意外执行真实交易');
            console.log('   如需执行真实交易，请运行: ENABLE_REAL_TRADING=true npm run demo:sol-transfer');
            console.log('\n💡 建议先运行以下演示了解系统功能:');
            console.log('   npm run demo:live     # 查看完整系统功能');
            console.log('   npm run demo:routing  # 查看智能路由算法');
            return;
        }

        console.log('⚠️  警告：这将执行真实的区块链交易！\n');

        try {
            // 1. 显示钱包信息
            await this.displayWalletInfo();

            // 2. 检查余额
            await this.checkBalance();

            // 3. 执行真实的 SOL 转账
            await this.executeRealTransfer();

        } catch (error) {
            console.error('❌ 演示执行失败:', error);
        }
    }

    /**
     * 显示钱包信息
     */
    private async displayWalletInfo(): Promise<void> {
        console.log('💼 项目专用测试钱包信息:');
        console.log(`   地址: ${this.wallet.publicKey.toBase58()}`);
        console.log(`   网络: Solana Devnet`);
        console.log(`   RPC: ${this.connection.rpcEndpoint}`);
        console.log(`   用途: 专门用于演示项目的真实区块链交互能力\n`);
    }

    /**
     * 检查余额
     */
    private async checkBalance(): Promise<void> {
        console.log('💰 检查余额...');
        
        try {
            const balance = await this.connection.getBalance(this.wallet.publicKey);
            const solBalance = balance / 1e9;
            
            console.log(`   SOL 余额: ${solBalance.toFixed(6)} SOL`);
            
            if (solBalance < 0.01) {
                console.log('⚠️  警告: SOL 余额不足，无法执行转账');
                console.log('   请访问 https://faucet.solana.com 申请测试 SOL');
                console.log('   建议申请至少 1 SOL 用于测试');
                throw new Error('余额不足');
            } else {
                console.log('✅ SOL 余额充足，可以执行转账交易\n');
            }
            
        } catch (error) {
            if (error instanceof Error && error.message === '余额不足') {
                throw error;
            }
            console.log('❌ 无法检查余额，可能是网络问题');
            console.log('   继续尝试执行交易...\n');
        }
    }

    /**
     * 执行真实的 SOL 转账
     */
    private async executeRealTransfer(): Promise<void> {
        console.log('🔄 执行真实的 SOL 转账...');
        console.log('   转账金额: 0.001 SOL');
        console.log('   转账方式: 自转账（转给自己）');
        console.log('   目的: 验证真实的区块链交互能力\n');

        try {
            // 创建转账指令
            const transferAmount = 1000000; // 0.001 SOL in lamports
            const transferInstruction = SystemProgram.transfer({
                fromPubkey: this.wallet.publicKey,
                toPubkey: this.wallet.publicKey, // 转给自己
                lamports: transferAmount,
            });

            // 创建交易
            const transaction = new Transaction().add(transferInstruction);
            
            // 获取最新的区块哈希
            console.log('📡 获取最新区块哈希...');
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.wallet.publicKey;

            // 签名交易
            console.log('✍️  签名交易...');
            transaction.sign(this.wallet.payer);

            // 发送交易
            console.log('📤 发送交易到区块链...');
            const signature = await this.connection.sendRawTransaction(transaction.serialize());

            console.log(`✅ 交易已发送！`);
            console.log(`   交易签名: ${signature}`);
            console.log(`   Devnet Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

            // 等待确认
            console.log('\n⏳ 等待交易确认...');
            const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
            
            if (confirmation.value.err) {
                console.log('❌ 交易确认失败:', confirmation.value.err);
            } else {
                console.log('✅ 交易确认成功！');
                console.log('\n🎉 项目区块链交互能力验证成功！');
                console.log('   ✅ 成功连接到 Solana Devnet');
                console.log('   ✅ 成功构建和签名交易');
                console.log('   ✅ 成功发送交易到区块链');
                console.log('   ✅ 交易在区块链上确认成功');
                console.log('   ✅ 可在区块链浏览器中查看交易详情');
                console.log('\n💼 这证明了项目具备真实的区块链交互能力！');
            }

        } catch (error) {
            console.error('❌ 转账执行失败:', error);
            
            if (error instanceof Error) {
                if (error.message.includes('insufficient funds')) {
                    console.log('\n💡 解决方案:');
                    console.log('   1. 访问 https://faucet.solana.com');
                    console.log('   2. 输入钱包地址获取测试 SOL');
                    console.log('   3. 重新运行演示');
                } else if (error.message.includes('fetch')) {
                    console.log('\n💡 网络问题解决方案:');
                    console.log('   1. 检查网络连接');
                    console.log('   2. 尝试使用 VPN');
                    console.log('   3. 稍后重试');
                }
            }
        }
    }
}

/**
 * 主函数
 */
async function main() {
    const demo = new RealSolTransferDemo();
    await demo.run();
}

// 运行演示
if (require.main === module) {
    main().catch(console.error);
}

export { RealSolTransferDemo };
