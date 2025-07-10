import { Connection, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

// 导入 Facade 系统
import { UnifiedDexFacadeFactory } from '../../core/facade/unified-dex-facade-impl'
import { SwapRequest, SwapPriority } from '../../types/facade/swap-types'

/**
 * UnifiedDexFacade 演示程序
 * 
 * 展示如何使用统一的 Facade 接口进行:
 * 1. 简单代币交换
 * 2. MEV 保护交换
 * 3. 批量交换
 * 4. 系统监控
 */
async function runFacadeDemo() {
    console.log('🚀 开始 UnifiedDexFacade 演示...\n');

    try {
        //1. 初始化连接
        const connection = new Connection('https://api.devnet.solana.com');
        console.log('✅ Solana 连接已建立');

        // 2. 创建 Facade 实例 (演示模式)
        const facade = UnifiedDexFacadeFactory.createDemo(connection);
        console.log('✅ UnifiedDexFacade 已创建');

        // 3. 演示简单交换
        await demostrateSimpleSwap(facade);

        // 4. 演示 MEV 保护交换
        await demonstrateMevProtectedSwap(facade);

        // 5. 演示批量交换
        await demonstrateBatchSwaps(facade);

        // 6. 演示系统监控
        await demonstrateSystemMonitoring(facade);

        console.log('\n🎉 UnifiedDexFacade 演示完成！');
    } catch (error) {
        console.error('❌ 演示过程中出错:', error);
    }
}

/**
 * 演示简单代币交换
 */
async function demostrateSimpleSwap(facade: any) {
    console.log('📋 === 演示 1: 简单代币交换 ===');

    try {
        const swapRequest: SwapRequest = {
            inputToken: new PublicKey('So11111111111111111111111111111111111111112'), // SOL
            outputToken: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
            inputAmount: new BN(1000000), // 0.001 SOL
            slippage: 0.01, // 1%
            userWallet: new PublicKey('BuJZo7Bsd6rcGKYBj4oJmseNyKCQffu5j1CwgrzTabEJ'), // 替换为实际钱包地址
            priority: SwapPriority.MEDIUM,
            enableMevProtection: false
        };

        console.log('🔄 发起简单交换请求...');
        console.log(`   输入: ${swapRequest.inputAmount.toString()} lamports SOL`);
        console.log(`   输出代币: USDC`);
        console.log(`   滑点: ${(swapRequest.slippage * 100).toFixed(2)}%`);

        // 注意：由于使用演示模式，这里会抛出错误
        // 在实际环境中，这将返回真实的交换结果
        try {
            const result = await facade.executeSwap(swapRequest);
            console.log('✅ 交换成功:', result);
        } catch (error) {
            console.log('ℹ️  演示模式 - 交换功能需要真实的组件实例');
        }
    } catch (error) {
        console.error('❌ 简单交换演示失败:', error);
    }
    console.log('');
}

/**
 * 演示 MEV 保护交换
 */
async function demonstrateMevProtectedSwap(facade: any) {
    console.log('📋 === 演示 2: MEV 保护交换 ===');

    try {
        const protectedSwapRequest = {
            inputToken: new PublicKey('So11111111111111111111111111111111111111112'), // SOL
            outputToken: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
            inputAmount: new BN(5000000), // 0.005 SOL
            slippage: 0.005,  //0.5%
            userWallet: new PublicKey('BuJZo7Bsd6rcGKYBj4oJmseNyKCQffu5j1CwgrzTabEJ'), // 替换为实际钱包地址
            priority: SwapPriority.HIGH,
            enableMevProtection: true,
            bundlePriority: 'high' as const,
            enableFrontrunProtection: true,
            maxWaitTime: 30000
        };

        console.log('🛡️ 发起 MEV 保护交换请求...');
        console.log(`   输入: ${protectedSwapRequest.inputAmount.toString()} lamports SOL`);
        console.log(`   Bundle 优先级: ${protectedSwapRequest.bundlePriority}`);
        console.log(`   前置运行保护: ${protectedSwapRequest.enableFrontrunProtection ? '启用' : '禁用'}`);

        try {
            const result = await facade.executeProtectedSwap(protectedSwapRequest);
            console.log('✅ MEV 保护交换成功:', result);
        } catch (error) {
            console.log('ℹ️  演示模式 - MEV 保护功能需要真实的组件实例');
        }
    } catch (error) {
        console.error('❌ MEV 保护交换演示失败:', error);
    }

    console.log('');
}

/**
 * 演示批量交换
 */
async function demonstrateBatchSwaps(facade: any) {
    console.log('📋 === 演示 3: 批量交换 ===');
    try {
        const batchRequest = {
            swaps: [
                {
                    inputToken: new PublicKey('So11111111111111111111111111111111111111112'),
                    outputToken: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
                    inputAmount: new BN(1000000),
                    slippage: 0.01,
                    userWallet: new PublicKey('BuJZo7Bsd6rcGKYBj4oJmseNyKCQffu5j1CwgrzTabEJ'),
                    priority: SwapPriority.MEDIUM
                },
                {
                    inputToken: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
                    outputToken: new PublicKey('So11111111111111111111111111111111111111112'),
                    inputAmount: new BN(100000),
                    slippage: 0.01,
                    userWallet: new PublicKey('BuJZo7Bsd6rcGKYBj4oJmseNyKCQffu5j1CwgrzTabEJ'),
                    priority: SwapPriority.MEDIUM
                }
            ],
            atomic: false,
            strategy: 'smart' as const,
            enableMevProtection: true
        };

        console.log('🔄 发起批量交换请求...');
        console.log(`   交换数量: ${batchRequest.swaps.length}`);
        console.log(`   执行策略: ${batchRequest.strategy}`);
        console.log(`   原子操作: ${batchRequest.atomic ? '是' : '否'}`);
        console.log(`   MEV 保护: ${batchRequest.enableMevProtection ? '启用' : '禁用'}`);

        try {
            const result = await facade.executeBatchSwaps(batchRequest);
            console.log('✅ 批量交换成功:', result);
        } catch (error) {
            console.log('ℹ️  演示模式 - 批量交换功能需要真实的组件实例');
        }
    } catch (error) {
        console.error('❌ 批量交换演示失败:', error);
    }
}

/**
 * 演示系统监控
 */
async function demonstrateSystemMonitoring(facade: any) {
    console.log('📋 === 演示 4: 系统监控 ===');
    try {
        console.log('📊 获取系统状态...');
        try {
            const systemStatus = await facade.getSystemStatus();
            console.log('✅ 系统状态:', systemStatus);
        } catch (error) {
            console.log('ℹ️  演示模式 - 系统状态功能需要真实的组件实例');
        }

        console.log('📈 获取性能统计...');
        try {
            const performanceStats = await facade.getPerformanceStats();
            console.log('✅ 性能统计:', performanceStats);
        } catch (error) {
            console.log('ℹ️  演示模式 - 性能统计功能需要真实的组件实例');
        }

        console.log('💰 估算交易成本...');
        try {
            const costEstimate = await facade.estimateTransactionCost({
                inputToken: new PublicKey('So11111111111111111111111111111111111111112'),
                outputToken: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
                inputAmount: new BN(1000000),
                slippage: 0.01,
                userWallet: new PublicKey('BuJZo7Bsd6rcGKYBj4oJmseNyKCQffu5j1CwgrzTabEJ'),
                enableMevProtection: true
            });
            console.log('✅ 成本估算:', costEstimate);
        } catch (error) {
            console.log('ℹ️  演示模式 - 成本估算功能需要真实的组件实例');
        }
    } catch (error) {
        console.error('❌ 系统监控演示失败:', error);
    }

    console.log('');
}

/**
 * 展示 Facade 模式的优势
 */
function showFacadeAdvantages() {
    console.log('🎯 === UnifiedDexFacade 的优势 ===');
    console.log('');
    console.log('1. 🎭 统一接口');
    console.log('   - 一个接口访问所有 DEX 协议');
    console.log('   - 隐藏复杂的内部实现');
    console.log('   - 简化开发者体验');
    console.log('');
    console.log('2. 🛡️ 自动 MEV 保护');
    console.log('   - 无缝集成 Jito Bundle 系统');
    console.log('   - 智能威胁检测');
    console.log('   - 动态保护策略');
    console.log('');
    console.log('3. 🧠 智能路由');
    console.log('   - 自动选择最优 DEX');
    console.log('   - 动态执行策略');
    console.log('   - 实时成本优化');
    console.log('');
    console.log('4. 📊 企业级监控');
    console.log('   - 实时性能统计');
    console.log('   - 系统健康检查');
    console.log('   - 详细错误报告');
    console.log('');
    console.log('5. 🔧 高度可扩展');
    console.log('   - 插件化架构');
    console.log('   - 配置驱动');
    console.log('   - 向后兼容');
    console.log('');
}

// 主函数
async function main() {
    console.log('🌟 ===== UnifiedDexFacade 完整演示 =====\n');

    // 展示优势
    showFacadeAdvantages();

    // 运行演示
    await runFacadeDemo();

    console.log('🏁 演示程序结束');
}

// 运行演示
if (require.main === module) {
    main().catch(console.error);
}

export { runFacadeDemo, demostrateSimpleSwap, demonstrateMevProtectedSwap };
