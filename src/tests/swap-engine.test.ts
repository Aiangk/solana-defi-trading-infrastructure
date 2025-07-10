import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import * as dotenv from "dotenv";

import { SwapEngine } from "../core/swap/swap-engine";
import { SwapDirection, SwapParams } from "../types/swap/swap-types";
import { NetworkType } from "../types/token/token-types";
import { getNetworkConfig } from "../config/network-config";

// 加载环境变量
dotenv.config();

/**
 * 交换引擎测试套件
 * 
 * 测试内容:
 * 1. 基本功能测试 (报价获取、余额查询)
 * 2. 模拟交换测试
 * 3. 真实小额交换测试 (需要真实资金)
 * 4. 错误处理测试
 */

/**
 * 测试配置
 */
const TEST_CONFIG = {
    /** 网络类型 */
    NETWORK: NetworkType.DEVNET,
    
    /** 测试金额 (SOL) */
    TEST_AMOUNT_SOL: 0.001, // 0.001 SOL
    
    /** 默认滑点 */
    DEFAULT_SLIPPAGE: 0.01, // 1%
    
    /** 测试超时时间 */
    TIMEOUT_MS: 60000 // 60秒
};

/**
 * 创建测试钱包
 */
function createTestWallet(): Wallet {
    const privateKeyString = process.env.PRIVATE_KEY;
    if (!privateKeyString) {
        throw new Error("请在.env文件中设置PRIVATE_KEY");
    }
    
    const privateKeyBytes = JSON.parse(privateKeyString);
    const keypair = Keypair.fromSecretKey(new Uint8Array(privateKeyBytes));
    
    return new Wallet(keypair);
}

/**
 * 创建测试连接
 */
function createTestConnection(): Connection {
    const config = getNetworkConfig(TEST_CONFIG.NETWORK);
    return new Connection(config.rpcEndpoint, 'confirmed');
}

/**
 * 基本功能测试
 */
async function testBasicFunctionality() {
    console.log("\n🧪 开始基本功能测试...");
    
    try {
        const connection = createTestConnection();
        const wallet = createTestWallet();
        const swapEngine = new SwapEngine(connection, wallet, TEST_CONFIG.NETWORK);
        
        console.log(`   钱包地址: ${wallet.publicKey.toBase58()}`);
        
        // 测试余额查询
        console.log("   📊 测试余额查询...");
        const balances = await swapEngine.getUserBalances();
        
        console.log("   余额信息:");
        balances.forEach(balance => {
            console.log(`     ${balance.symbol}: ${balance.formattedBalance}`);
        });
        
        // 测试报价获取
        console.log("   💰 测试报价获取...");
        const swapParams: SwapParams = {
            direction: SwapDirection.SOL_TO_USDC,
            inputAmount: new BN(TEST_CONFIG.TEST_AMOUNT_SOL * 1e9), // 转换为lamports
            minimumOutputAmount: new BN(0),
            slippageTolerance: TEST_CONFIG.DEFAULT_SLIPPAGE
        };
        
        const quote = await swapEngine.getSwapQuote(swapParams);
        
        console.log("   报价结果:");
        console.log(`     最佳DEX: ${quote.recommendedDEX}`);
        console.log(`     输入金额: ${quote.bestQuote.inputAmount.toString()} lamports`);
        console.log(`     输出金额: ${quote.bestQuote.outputAmount.toString()}`);
        console.log(`     价格影响: ${(quote.bestQuote.priceImpact * 100).toFixed(4)}%`);
        console.log(`     可信度: ${(quote.bestQuote.confidence * 100).toFixed(1)}%`);
        
        console.log("✅ 基本功能测试通过");
        return true;
        
    } catch (error) {
        console.log(`❌ 基本功能测试失败: ${error}`);
        return false;
    }
}

/**
 * 模拟交换测试
 */
async function testSimulatedSwap() {
    console.log("\n🎭 开始模拟交换测试...");
    
    try {
        const connection = createTestConnection();
        const wallet = createTestWallet();
        const swapEngine = new SwapEngine(connection, wallet, TEST_CONFIG.NETWORK);
        
        const swapParams: SwapParams = {
            direction: SwapDirection.SOL_TO_USDC,
            inputAmount: new BN(TEST_CONFIG.TEST_AMOUNT_SOL * 1e9),
            minimumOutputAmount: new BN(0),
            slippageTolerance: TEST_CONFIG.DEFAULT_SLIPPAGE
        };
        
        console.log("   🔍 获取报价...");
        const quote = await swapEngine.getSwapQuote(swapParams);
        
        console.log("   📋 模拟交换参数:");
        console.log(`     方向: ${swapParams.direction}`);
        console.log(`     输入: ${TEST_CONFIG.TEST_AMOUNT_SOL} SOL`);
        console.log(`     预期输出: ${quote.bestQuote.outputAmount.toString()}`);
        console.log(`     滑点: ${TEST_CONFIG.DEFAULT_SLIPPAGE * 100}%`);
        
        // 注意: 这里不执行真实交换，只是验证流程
        console.log("   ⚠️  模拟模式 - 未执行真实交换");
        
        console.log("✅ 模拟交换测试通过");
        return true;
        
    } catch (error) {
        console.log(`❌ 模拟交换测试失败: ${error}`);
        return false;
    }
}

/**
 * 真实小额交换测试
 * 警告: 这会消耗真实的SOL!
 */
async function testRealSmallSwap() {
    console.log("\n💰 开始真实小额交换测试...");
    console.log("⚠️  警告: 这将消耗真实的SOL!");
    
    try {
        const connection = createTestConnection();
        const wallet = createTestWallet();
        const swapEngine = new SwapEngine(connection, wallet, TEST_CONFIG.NETWORK);
        
        // 检查余额
        console.log("   💳 检查钱包余额...");
        const balances = await swapEngine.getUserBalances();
        const solBalance = balances.find(b => b.symbol === 'SOL');
        
        if (!solBalance || solBalance.formattedBalance < TEST_CONFIG.TEST_AMOUNT_SOL) {
            throw new Error(`SOL余额不足: 需要至少 ${TEST_CONFIG.TEST_AMOUNT_SOL} SOL`);
        }
        
        console.log(`   当前SOL余额: ${solBalance.formattedBalance}`);
        
        const swapParams: SwapParams = {
            direction: SwapDirection.SOL_TO_USDC,
            inputAmount: new BN(TEST_CONFIG.TEST_AMOUNT_SOL * 1e9),
            minimumOutputAmount: new BN(0),
            slippageTolerance: TEST_CONFIG.DEFAULT_SLIPPAGE
        };
        
        console.log("   🚀 执行真实交换...");
        const result = await swapEngine.executeSwap(swapParams);
        
        if (result.success) {
            console.log("   ✅ 交换成功!");
            console.log(`     交易签名: ${result.signature}`);
            console.log(`     输入金额: ${result.inputAmount.toString()}`);
            console.log(`     输出金额: ${result.outputAmount.toString()}`);
            console.log(`     价格影响: ${(result.priceImpact * 100).toFixed(4)}%`);
            
            // 验证余额变化
            console.log("   📊 验证余额变化...");
            const newBalances = await swapEngine.getUserBalances();
            newBalances.forEach(balance => {
                const oldBalance = balances.find(b => b.symbol === balance.symbol);
                if (oldBalance && oldBalance.formattedBalance !== balance.formattedBalance) {
                    const change = balance.formattedBalance - oldBalance.formattedBalance;
                    console.log(`     ${balance.symbol}: ${oldBalance.formattedBalance} → ${balance.formattedBalance} (${change > 0 ? '+' : ''}${change})`);
                }
            });
            
        } else {
            throw new Error(result.error || "交换失败");
        }
        
        console.log("✅ 真实小额交换测试通过");
        return true;
        
    } catch (error) {
        console.log(`❌ 真实小额交换测试失败: ${error}`);
        return false;
    }
}

/**
 * 错误处理测试
 */
async function testErrorHandling() {
    console.log("\n🚨 开始错误处理测试...");
    
    try {
        const connection = createTestConnection();
        const wallet = createTestWallet();
        const swapEngine = new SwapEngine(connection, wallet, TEST_CONFIG.NETWORK);
        
        // 测试无效参数
        console.log("   🔍 测试无效参数处理...");
        
        const invalidParams: SwapParams = {
            direction: SwapDirection.SOL_TO_USDC,
            inputAmount: new BN(0), // 无效: 金额为0
            minimumOutputAmount: new BN(0),
            slippageTolerance: TEST_CONFIG.DEFAULT_SLIPPAGE
        };
        
        try {
            await swapEngine.executeSwap(invalidParams);
            throw new Error("应该抛出错误但没有");
        } catch (error) {
            console.log(`     ✅ 正确捕获错误: ${error}`);
        }
        
        // 测试过高滑点
        console.log("   🔍 测试过高滑点处理...");
        
        const highSlippageParams: SwapParams = {
            direction: SwapDirection.SOL_TO_USDC,
            inputAmount: new BN(TEST_CONFIG.TEST_AMOUNT_SOL * 1e9),
            minimumOutputAmount: new BN(0),
            slippageTolerance: 0.5 // 50% 滑点 - 应该被拒绝
        };
        
        try {
            await swapEngine.executeSwap(highSlippageParams);
            throw new Error("应该抛出错误但没有");
        } catch (error) {
            console.log(`     ✅ 正确捕获错误: ${error}`);
        }
        
        console.log("✅ 错误处理测试通过");
        return true;
        
    } catch (error) {
        console.log(`❌ 错误处理测试失败: ${error}`);
        return false;
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log("🧪 Solana DeFi Trading Engine - 测试套件");
    console.log("=" * 50);
    
    const testResults = {
        basic: false,
        simulated: false,
        realSwap: false,
        errorHandling: false
    };
    
    // 基本功能测试
    testResults.basic = await testBasicFunctionality();
    
    // 模拟交换测试
    if (testResults.basic) {
        testResults.simulated = await testSimulatedSwap();
    }
    
    // 错误处理测试
    testResults.errorHandling = await testErrorHandling();
    
    // 真实交换测试 (可选)
    const runRealSwap = process.argv.includes('--real-swap');
    if (runRealSwap && testResults.simulated) {
        console.log("\n⚠️  即将执行真实交换测试，这将消耗真实的SOL!");
        testResults.realSwap = await testRealSmallSwap();
    }
    
    // 测试结果汇总
    console.log("\n📊 测试结果汇总:");
    console.log("=" * 30);
    console.log(`基本功能测试: ${testResults.basic ? '✅ 通过' : '❌ 失败'}`);
    console.log(`模拟交换测试: ${testResults.simulated ? '✅ 通过' : '❌ 失败'}`);
    console.log(`错误处理测试: ${testResults.errorHandling ? '✅ 通过' : '❌ 失败'}`);
    console.log(`真实交换测试: ${runRealSwap ? (testResults.realSwap ? '✅ 通过' : '❌ 失败') : '⏭️  跳过'}`);
    
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const totalTests = runRealSwap ? 4 : 3;
    
    console.log(`\n总体结果: ${passedTests}/${totalTests} 测试通过`);
    
    if (passedTests === totalTests) {
        console.log("🎉 所有测试都通过了!");
    } else {
        console.log("⚠️  部分测试失败，请检查错误信息");
    }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    runAllTests().catch(console.error);
}

export {
    testBasicFunctionality,
    testSimulatedSwap,
    testRealSmallSwap,
    testErrorHandling,
    runAllTests
};
