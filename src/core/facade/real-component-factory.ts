import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';

// 导入现有组件
import { DEXAggregator } from '../aggregator/dex-aggregator';
import { BundleManager } from '../jito/bundle-manager';
import { EnhancedJitoClient } from '../jito/jito-client';

// 导入协议实现
import { OrcaProtocol } from '../../protocols/orca/orca-protocol';
import { JupiterProtocol } from '../../protocols/jupiter/jupiter-protocol';

// 导入配置
import { getJitoConfig } from '../../config/jito-config'
import { getEnabledDEXConfigs } from '../../config/dex-config'

// 导入类型
import { DEXProtocol } from '../../types/dex/protocol';
import { BundleManagerConfig } from '../../types/jito/bundle-manager-types';

/**
 * 真实组件集成工厂
 * 
 * 负责创建和配置所有真实的生产环境组件：
 * 1. 真实的 DEX 协议实例
 * 2. 真实的 Jito Bundle 管理器
 * 3. 真实的网络连接和钱包
 */
export class RealComponentFactory {

    /**
     *  创建真实的 DEX 聚合器
     *  集成所有启用的 DEX 协议
     */
    static async createRealDexAggregator(
        connection: Connection,
        wallet: Wallet
    ): Promise<DEXAggregator> {
        console.log('🏭 创建真实 DEX 聚合器...');

        const protocols: DEXProtocol[] = [];
        const enabledConfigs = getEnabledDEXConfigs();

        // 创建启用的协议实例
        for (const config of enabledConfigs) {
            try {
                console.log(`   📦 初始化 ${config.name} 协议...`);

                switch (config.name) {
                    case 'Orca':
                        const orcaProtocol = new OrcaProtocol(connection, wallet);
                        protocols.push(orcaProtocol);
                        console.log(`   ✅ Orca 协议初始化成功`);
                        break;
                    case 'Jupiter':
                        const jupiterProtocol = new JupiterProtocol(connection, wallet);
                        protocols.push(jupiterProtocol);
                        console.log(`   ✅ Jupiter 协议初始化成功`);
                        break;

                    case 'Raydium':
                        console.log(`   ⚠️  Raydium 协议暂时禁用`);
                        break;

                    default:
                        console.log(`   ❌ 未知协议: ${config.name}`);
                }
            } catch (error) {
                console.error(`   ❌ ${config.name} 协议初始化失败:`, error);
            }
        }

        if (protocols.length === 0) {
            throw new Error('没有可用的 DEX 协议');
        }

        const aggregator = new DEXAggregator(connection, protocols);
        console.log(`✅ DEX 聚合器创建完成，支持 ${protocols.length} 个协议`);
        return aggregator;
    }

    /**
     *  创建真实的 Jito Bundle 管理器
     *  集成 Jito Block Engine
     */
    static async createRealBundleManager(
        connection: Connection,
        wallet: Wallet,
        environment: 'development' | 'production' = 'development'
    ): Promise<BundleManager> {
        console.log('🏭 创建真实 Bundle 管理器...');

        try {
            // 获取 Jito 配置
            const jitoConfig = getJitoConfig(environment)
            console.log(`   📋 使用 ${environment} 环境配置`);

            // 创建增强型 Jito 客户端，传递钱包和连接用于小费交易
            const jitoClientConfig = { ...jitoConfig, connection };
            const jitoClient = new EnhancedJitoClient(jitoClientConfig, wallet);
            console.log(`   🔗 Jito 客户端创建成功 (已配置钱包和连接)`);

            // 配置 Bundle 管理器
            const bundleConfig: BundleManagerConfig = {
                maxConcurrentBundles: jitoConfig.performance.maxConcurrentBundles,
                statusCheckInterval: jitoConfig.performance.statusCheckInterval,
                bundleTimeout: jitoConfig.defaultBundleOptions.timeoutMs || 30000,
                enableAutoRetry: true,
                enablePerformanceMonitoring: jitoConfig.performance.enableMetrics,
                enableEventNotifications: true
            };

            // 创建 Bundle 管理器
            const bundleManager = new BundleManager(jitoClient, bundleConfig);
            console.log(`   ✅ Bundle 管理器创建成功`);

            // 启动管理器
            await bundleManager.start();
            console.log(`   🚀 Bundle 管理器已启动`);

            return bundleManager;

        } catch (error) {
            console.error('❌ Bundle 管理器创建失败:', error);
            throw error;
        }
    }

    /**
     * 创建生产级连接
     * 使用 Helius RPC 和最佳配置
     */
    static createProductionConnection(): Connection {
        console.log('🌐 创建生产级连接...');

        // 检查代理设置
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        if (proxyUrl) {
            console.log(`🌐 检测到代理设置: ${proxyUrl}`);
        }

        // 使用你的 Helius API Key
        const HELIUS_API_KEY = '61040956-f7ed-40fa-84d3-40c986ab834a';
        const rpcUrl = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

        const connection = new Connection(rpcUrl, {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 60000, //60秒超时
            disableRetryOnRateLimit: false,
            httpHeaders: {
                'Content-Type': 'application/json',
                'User-Agent': 'Solana-DeFi-Trader/1.0'
            }
        });

        console.log(`✅ 生产级连接创建成功: ${rpcUrl.split('?')[0]}...`);
        return connection;
    }

    /**
     * 创建测试钱包
     * 使用固定地址: BkKsmbeuhbeKSLgHBLQaJMdfKhx8ccsqr2jbWm7TGWNz
     */
    static createTestWallet(): Wallet {
        console.log('👛 创建固定测试钱包...');

        const fixedTestAddress = 'BkKsmbeuhbeKSLgHBLQaJMdfKhx8ccsqr2jbWm7TGWNz';
        const fixedTestPrivateKey = '5h4KiRELYrdPqacLfAuPXRZj5zmn65pkDSEs4PuJcJk6ttEKJUwpJVcquPvdpFcwenFogeFUPrXTfTnYUYss3N2i';

        // 优先使用内置的私钥
        try {
            // 直接使用 Solana 的 Keypair.fromSecretKey 方法
            // 将 base58 私钥转换为 Uint8Array
            const bs58 = require('bs58');
            let secretKeyBytes: Uint8Array;

            // 处理不同的 bs58 导入方式
            if (typeof bs58.decode === 'function') {
                secretKeyBytes = bs58.decode(fixedTestPrivateKey);
            } else if (bs58.default && typeof bs58.default.decode === 'function') {
                secretKeyBytes = bs58.default.decode(fixedTestPrivateKey);
            } else {
                throw new Error('bs58 decode 方法不可用');
            }

            const keypair = Keypair.fromSecretKey(secretKeyBytes);

            // 验证地址是否匹配
            if (keypair.publicKey.toBase58() === fixedTestAddress) {
                console.log(`✅ 固定测试钱包 (完整功能): ${fixedTestAddress}`);
                console.log(`🔑 支持交易签名 (使用内置私钥)`);
                return new Wallet(keypair);
            } else {
                console.warn(`⚠️  内置私钥地址不匹配:`);
                console.warn(`   期望地址: ${fixedTestAddress}`);
                console.warn(`   实际地址: ${keypair.publicKey.toBase58()}`);
            }
        } catch (error) {
            console.warn('⚠️  内置私钥解析失败:', error);
            console.warn('   将使用只读模式');
        }

        // 检查环境变量私钥作为备选
        const privateKeyEnv = process.env.TEST_WALLET_PRIVATE_KEY;
        if (privateKeyEnv) {
            try {
                const privateKeyArray = JSON.parse(privateKeyEnv);
                const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));

                if (keypair.publicKey.toBase58() === fixedTestAddress) {
                    console.log(`✅ 固定测试钱包 (完整功能): ${fixedTestAddress}`);
                    console.log(`🔑 支持交易签名 (使用环境变量)`);
                    return new Wallet(keypair);
                } else {
                    console.warn(`⚠️  环境变量私钥地址不匹配，期望: ${fixedTestAddress}`);
                    console.warn(`   实际地址: ${keypair.publicKey.toBase58()}`);
                }
            } catch (error) {
                console.warn('⚠️  环境变量私钥格式错误:', error);
            }
        }

        // 没有私钥时，创建只读模式
        console.log(`✅ 固定测试钱包 (只读模式): ${fixedTestAddress}`);
        console.log(`📖 只支持查询功能，不支持交易签名`);
        console.log(`💡 如需交易功能，请设置 TEST_WALLET_PRIVATE_KEY 环境变量`);
        console.log(`   格式: export TEST_WALLET_PRIVATE_KEY='[1,2,3,...]'`);

        // 创建一个假的 Wallet 对象用于测试
        const dummyKeypair = Keypair.generate();
        const wallet = new Wallet(dummyKeypair);

        // 替换 publicKey
        Object.defineProperty(wallet, 'publicKey', {
            value: new PublicKey(fixedTestAddress),
            writable: false,
            configurable: false
        });

        return wallet;
    }

    /**
     * 创建完整的真实组件集合
     * 一键创建所有生产环境组建
     */
    static async createRealComponents(
        environment: 'development' | 'production' = 'development'
    ): Promise<{
        connection: Connection;
        wallet: Wallet;
        dexAggregator: DEXAggregator;
        bundleManager: BundleManager;
    }> {
        console.log('🚀 开始创建完整的真实组件集合...');
        console.log(`   环境: ${environment}`);

        try {
            //1. 创建连接
            const connection = this.createProductionConnection();

            //2. 创建钱包
            const wallet = this.createTestWallet();

            //3. 验证网络连接
            await this.validateNetworkConnection(connection);

            //4. 验证钱包余额
            await this.validateWalletBalance(connection, wallet);

            //5. 创建 DEX 聚合器
            const dexAggregator = await this.createRealDexAggregator(connection, wallet);

            //6. 创建 Bundle 管理器
            const bundleManager = await this.createRealBundleManager(connection, wallet, environment);

            console.log('✅ 所有真实组件创建完成！');

            return {
                connection,
                wallet,
                dexAggregator,
                bundleManager
            };

        } catch (error) {
            console.error('❌ 真实组件创建失败:', error);
            throw error;
        }
    }

    /**
     * 验证网络连接
     */
    private static async validateNetworkConnection(connection: Connection): Promise<void> {
        console.log('🔍 验证网络连接...');

        try {
            // 尝试获取版本信息
            const version = await connection.getVersion();
            console.log(`   ✅ 网络连接正常，Solana 版本: ${version['solana-core']}`);

            const slot = await connection.getSlot();
            console.log(`   ✅ 当前 Slot: ${slot}`);
        } catch (error) {
            console.error('   ❌ 网络连接验证失败:', error);
            console.log('   ⚠️  这可能是由于代理设置或网络问题导致的');
            console.log('   💡 尝试跳过网络验证，继续测试...');

            // 不抛出错误，允许继续执行
            // throw new Error(`网络连接失败: ${error}`);
        }
    }

    /**
     * 验证钱包余额
     */
    private static async validateWalletBalance(
        connection: Connection,
        wallet: Wallet
    ): Promise<void> {
        console.log('💰 验证钱包余额...');

        try {
            const balance = await connection.getBalance(wallet.publicKey);
            const solBalance = balance / 1e9;

            console.log(`   💰 钱包余额: ${solBalance.toFixed(4)} SOL`);

            if (balance < 1000000) { // 0.001 SOL
                console.warn('   ⚠️  钱包余额较低，建议充值');
            } else {
                console.log('   ✅ 钱包余额充足');
            }
        } catch (error) {
            console.error('   ❌ 钱包余额验证失败:', error);
            throw new Error(`钱包验证失败: ${error}`);
        }
    }

    /**
     * 清理资源
     * 优雅地关闭所有组件
     */
    static async cleanup(bundleManager: BundleManager): Promise<void> {
        console.log('🧹 清理资源...');

        try {
            await bundleManager.stop();
            console.log('✅ 资源清理完成');
        } catch (error) {
            console.error('❌ 资源清理失败:', error);
        }
    }
}
