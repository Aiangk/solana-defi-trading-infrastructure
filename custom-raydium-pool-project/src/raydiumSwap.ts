/**
 * 自建 Raydium 池子项目 - 主入口文件
 *
 * 这是项目的主要执行文件，展示了完整的 DeFi 开发流程：
 * 1. 连接到 Solana devnet
 * 2. 创建自定义的 OpenBook 市场
 * 3. 构建 Raydium AMM 池子
 * 4. 执行 swap 交易
 *
 * 执行结果：
 * - ✅ 成功创建了所有账户结构
 * - ✅ 通过了权限验证
 * - ❌ 在池子初始化时遇到 InvalidFee 错误
 *
 * 这个文件记录了完整的尝试过程和学习成果
 */

import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction
} from "@solana/web3.js";

import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";

import {
    TokenAmount,
    Token
} from "@raydium-io/raydium-sdk";

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// 导入我们拆分的模块
import { createDevnetTestPool, PoolCreationResult } from "./poolCreation";
import { calculateWithRaydiumOfficial, displayCalculationDetails } from "./priceCalculation";
import { createRaydiumSwapInstructionOfficial, analyzeSwapInstructions, validateSwapParameters } from "./swapInstructions";

// 加载环境变量
dotenv.config();

// ==================== 配置区 ====================
const RPC_ENDPOINT_URL = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
const WALLET_FILE_PATH = process.env.HOME + "/.config/solana/id.json";

// Devnet 代币地址
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112"); // Wrapped SOL
const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"); // Devnet USDC

// 交易参数
const INPUT_AMOUNT = 0.1; // 0.1 SOL
const SLIPPAGE = 1; // 1%

// ==================== 主函数 ====================

/**
 * 主要的 Raydium Swap 执行函数
 * 完整的流程：创建池子 → 计算价格 → 构造指令 → 执行交易
 */
async function main(): Promise<void> {
    console.log("🚀 启动 Raydium 手动 Swap 脚本...");
    console.log("📋 本脚本将演示完整的 DeFi 开发流程：");
    console.log("   1. 手动创建 Serum 市场");
    console.log("   2. 手动创建 Raydium 流动性池");
    console.log("   3. 手动构造 swap 指令");
    console.log("   4. 执行真实的 swap 交易");
    console.log("=".repeat(60));

    try {
        // 1. 初始化连接和钱包
        console.log("🔧 步骤1：初始化连接和钱包...");
        const connection = new Connection(RPC_ENDPOINT_URL, "confirmed");
        const wallet = loadWallet();

        console.log(`✅ 钱包加载成功: ${wallet.publicKey.toBase58()}`);

        // 检查钱包余额（强制刷新）
        const balance = await connection.getBalance(wallet.publicKey, "finalized");
        console.log(`💰 当前余额: ${balance / 10 ** 9} SOL`);

        if (balance < 0.5 * 10 ** 9) {
            console.log("⚠️  余额不足，建议至少有 0.5 SOL 用于测试");
            console.log("💡 请访问 https://faucet.solana.com 获取测试代币");
        }

        // 2. 创建自己的 Devnet 测试池子
        console.log("\n🏗️ 步骤2：创建自己的 Devnet 测试池子...");
        const poolInfo = await createDevnetTestPool(connection, wallet);

        if (!poolInfo) {
            console.log("❌ 无法创建测试池子，退出");
            return;
        }

        console.log(`✅ 测试池子创建成功:`);
        console.log(`   池子 ID: ${poolInfo.poolId}`);
        console.log(`   SOL 储备: ${poolInfo.baseReserve.toNumber() / 10 ** 9} SOL`);
        console.log(`   USDC 储备: ${poolInfo.quoteReserve.toNumber() / 10 ** 6} USDC`);

        // 3. 使用改进的 Raydium 官方算法计算
        console.log("\n💰 步骤3：使用 Raydium 官方算法计算 swap 输出金额...");

        const { amountOut, minAmountOut } = await calculateWithRaydiumOfficial();

        console.log(`✅ Raydium 官方算法计算完成:`);
        console.log(`   输入: ${INPUT_AMOUNT} SOL`);
        console.log(`   预期输出: ${amountOut.toFixed()} USDC`);
        console.log(`   最小输出: ${minAmountOut.toFixed()} USDC (含滑点保护)`);

        // 显示详细计算信息
        displayCalculationDetails(
            poolInfo.baseReserve,
            poolInfo.quoteReserve,
            amountOut.raw,
            minAmountOut.raw,
            minAmountOut.raw
        );

        // 4. 获取用户代币账户
        console.log("\n🔍 步骤4：获取用户代币账户...");

        const inputToken = new Token(TOKEN_PROGRAM_ID, SOL_MINT, 9, "SOL", "Solana");
        const inputAmount = new TokenAmount(inputToken, INPUT_AMOUNT * 10 ** 9);

        const userSOLAccount = getAssociatedTokenAddressSync(SOL_MINT, wallet.publicKey);
        const userUSDCAccount = getAssociatedTokenAddressSync(USDC_MINT, wallet.publicKey);

        console.log(`✅ 用户 SOL 代币账户: ${userSOLAccount.toBase58()}`);
        console.log(`✅ 用户 USDC 代币账户: ${userUSDCAccount.toBase58()}`);

        // 5. 验证 swap 参数
        console.log("\n🔍 步骤5：验证 swap 参数...");

        const validation = validateSwapParameters({
            poolKeys: poolInfo.poolKeys,
            amountIn: inputAmount.raw,
            minAmountOut: minAmountOut.raw,
        });

        if (!validation.isValid) {
            console.log("❌ Swap 参数验证失败:");
            validation.errors.forEach(error => console.log(`   - ${error}`));
            return;
        }

        console.log("✅ Swap 参数验证通过");

        // 6. 手动构造 swap 指令
        console.log("\n🔧 步骤6：手动构造 swap 指令...");

        const { instructions, signers } = await createRaydiumSwapInstructionOfficial({
            connection,
            wallet: wallet.publicKey,
            poolKeys: poolInfo.poolKeys,
            userSourceTokenAccount: userSOLAccount,
            userDestinationTokenAccount: userUSDCAccount,
            amountIn: inputAmount.raw,
            minAmountOut: minAmountOut.raw,
        });

        console.log("✅ Swap 指令构造完成！");

        // 分析指令构造结果
        analyzeSwapInstructions({ instructions, signers });

        // 7. 创建交易并添加所有指令
        console.log("\n📦 步骤7：组装交易...");

        const transaction = new Transaction();
        transaction.add(...instructions);

        console.log(`✅ 交易组装完成，包含 ${instructions.length} 个指令`);

        // 8. 发送交易到网络
        console.log("\n🚀 步骤8：发送交易到网络...");
        console.log("⚠️  注意：这是一个真实的交易，将消耗真实的代币和手续费");

        try {
            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [wallet, ...signers],
                {
                    commitment: 'confirmed',
                    maxRetries: 3,
                }
            );

            console.log("🎉 Swap 交易成功执行！");
            console.log(`📝 交易签名: ${signature}`);
            console.log(`🔍 Devnet Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

            // 9. 验证交易结果
            await verifySwapResults(connection, wallet, userUSDCAccount, signature);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("❌ 交易失败！", errorMessage);

            // 提供详细的错误分析
            analyzeTransactionError(errorMessage);
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("❌ 脚本执行失败:", errorMessage);
    }
}

// ==================== 辅助函数 ====================

/**
 * 加载钱包
 */
function loadWallet(): Keypair {
    try {
        const walletData = JSON.parse(fs.readFileSync(WALLET_FILE_PATH, 'utf-8'));
        return Keypair.fromSecretKey(Uint8Array.from(walletData));
    } catch (error) {
        console.error("❌ 无法加载钱包文件:", error);
        console.log("💡 请确保 devnet-wallet.json 文件存在");
        process.exit(1);
    }
}

/**
 * 验证 swap 交易结果
 */
async function verifySwapResults(
    connection: Connection,
    wallet: Keypair,
    userUSDCAccount: PublicKey,
    signature: string
): Promise<void> {
    console.log("\n🔍 步骤9：验证交易结果...");

    try {
        // 检查 USDC 余额
        const finalUSDCBalance = await connection.getTokenAccountBalance(userUSDCAccount);
        console.log(`✅ 最终 USDC 余额: ${Number(finalUSDCBalance.value.amount) / 10 ** 6} USDC`);

        // 检查 SOL 余额
        const finalSOLBalance = await connection.getBalance(wallet.publicKey);
        console.log(`✅ 最终 SOL 余额: ${finalSOLBalance / 10 ** 9} SOL`);

        console.log("🎉 交易验证完成！");

    } catch (error) {
        console.log("⚠️  余额验证失败，但交易可能已成功");
        console.log("💡 请手动检查 Solana Explorer 确认交易状态");
    }
}

/**
 * 分析交易错误
 */
function analyzeTransactionError(errorMessage: string): void {
    console.log("\n🔍 错误分析:");

    if (errorMessage.includes('insufficient funds')) {
        console.log("💡 错误原因：余额不足");
        console.log("   解决方案：请确保钱包有足够的 SOL 支付交易费用");
    } else if (errorMessage.includes('Unsupported program id')) {
        console.log("💡 错误原因：程序 ID 不支持");
        console.log("   解决方案：检查是否使用了正确的 Devnet 程序 ID");
    } else if (errorMessage.includes('account owner is not match')) {
        console.log("💡 错误原因：账户所有权不匹配");
        console.log("   解决方案：确保池子账户是真实存在的");
    } else if (errorMessage.includes('slippage')) {
        console.log("💡 错误原因：滑点过大");
        console.log("   解决方案：增加滑点容忍度或减少交易金额");
    } else {
        console.log("💡 未知错误，请检查:");
        console.log("   - 网络连接是否正常");
        console.log("   - RPC 节点是否可用");
        console.log("   - 池子是否正确创建");
    }
}

// ==================== 程序入口 ====================

// 运行主函数
main().catch(console.error);
