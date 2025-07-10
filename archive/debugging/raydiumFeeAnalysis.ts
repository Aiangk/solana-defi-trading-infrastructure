import {
    Connection,
    Keypair,
    PublicKey,
} from "@solana/web3.js";

import * as fs from "fs";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config();

// ==================== 配置区 ====================
const RPC_ENDPOINT_URL = process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com";
const WALLET_FILE_PATH = process.env.HOME + "/.config/solana/id.json";

// 程序 ID
const RAYDIUM_LIQUIDITY_PROGRAM_ID = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");
const OPENBOOK_PROGRAM_ID = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");

// 代币地址
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

/**
 * 分析 Raydium 费用机制
 */
async function main(): Promise<void> {
    console.log("🔍 Raydium 费用机制深度分析...");
    console.log("📋 本分析将研究：");
    console.log("   1. Raydium 程序的费用验证逻辑");
    console.log("   2. OpenBook 市场的费用配置要求");
    console.log("   3. 费用收集账户的设置");
    console.log("   4. 可能的解决方案");
    console.log("=".repeat(60));

    try {
        const connection = new Connection(RPC_ENDPOINT_URL, "confirmed");
        const wallet = loadWallet();

        console.log(`✅ 钱包: ${wallet.publicKey.toBase58()}`);

        // 1. 分析现有的 Raydium 池子
        console.log("\n🔍 步骤1：分析现有的 Raydium 池子...");
        await analyzeExistingRaydiumPools(connection);

        // 2. 分析 OpenBook 市场费用配置
        console.log("\n🔍 步骤2：分析 OpenBook 市场费用配置...");
        await analyzeOpenBookMarketFees(connection);

        // 3. 研究费用验证逻辑
        console.log("\n🔍 步骤3：研究费用验证逻辑...");
        await researchFeeValidationLogic();

        // 4. 提供解决方案建议
        console.log("\n💡 步骤4：解决方案建议...");
        provideSolutionRecommendations();

    } catch (error) {
        console.error("❌ 分析过程中出错:", error);
    }
}

/**
 * 分析现有的 Raydium 池子
 */
async function analyzeExistingRaydiumPools(connection: Connection): Promise<void> {
    console.log("🔍 查找现有的 Raydium 池子...");

    try {
        // 查找 Raydium 程序的账户
        const accounts = await connection.getProgramAccounts(RAYDIUM_LIQUIDITY_PROGRAM_ID, {
            filters: [
                {
                    dataSize: 752, // Raydium AMM 池子账户大小
                }
            ]
        });

        console.log(`✅ 找到 ${accounts.length} 个 Raydium 池子`);

        if (accounts.length === 0) {
            console.log("❌ Devnet 上没有找到 Raydium 池子");
            console.log("💡 这可能解释了为什么创建新池子会失败");
            return;
        }

        // 分析前几个池子
        console.log("\n📊 池子分析:");
        for (let i = 0; i < Math.min(accounts.length, 3); i++) {
            const poolAddress = accounts[i].pubkey;
            const accountInfo = accounts[i].account;

            console.log(`\n   池子 ${i + 1}: ${poolAddress.toBase58()}`);
            console.log(`     数据大小: ${accountInfo.data.length} bytes`);
            console.log(`     所有者: ${accountInfo.owner.toBase58()}`);

            // 尝试解析池子数据
            try {
                await analyzePoolData(connection, poolAddress, accountInfo.data);
            } catch (error) {
                console.log(`     ⚠️  无法解析池子数据: ${error}`);
            }
        }

    } catch (error) {
        console.error("❌ 分析 Raydium 池子时出错:", error);
    }
}

/**
 * 分析池子数据
 */
async function analyzePoolData(connection: Connection, poolAddress: PublicKey, data: Buffer): Promise<void> {
    try {
        // 简化的数据解析（实际需要根据 Raydium 的数据结构）
        if (data.length >= 752) {
            // 尝试读取一些关键字段
            const status = data.readUIntLE(0, 8);
            console.log(`     状态: ${status}`);

            // 读取代币 mint 地址（假设的偏移量）
            const coinMintOffset = 8;
            const pcMintOffset = 40;

            if (data.length > pcMintOffset + 32) {
                const coinMint = new PublicKey(data.slice(coinMintOffset, coinMintOffset + 32));
                const pcMint = new PublicKey(data.slice(pcMintOffset, pcMintOffset + 32));

                console.log(`     Coin Mint: ${coinMint.toBase58()}`);
                console.log(`     PC Mint: ${pcMint.toBase58()}`);

                // 检查是否是 SOL/USDC 对
                const isSOLUSDC = (
                    (coinMint.equals(SOL_MINT) && pcMint.equals(USDC_MINT)) ||
                    (coinMint.equals(USDC_MINT) && pcMint.equals(SOL_MINT))
                );

                if (isSOLUSDC) {
                    console.log(`     🎯 这是一个 SOL/USDC 池子！`);
                }
            }
        }
    } catch (error) {
        console.log(`     ⚠️  数据解析错误: ${error}`);
    }
}

/**
 * 分析 OpenBook 市场费用配置
 */
async function analyzeOpenBookMarketFees(connection: Connection): Promise<void> {
    console.log("🔍 分析 OpenBook 市场费用配置...");

    try {
        // 使用我们之前找到的市场
        const marketId = new PublicKey("EQFjeeTapdMZnjDbSuL7XEdzBeY8MqgbMYesYmV47nTd");

        console.log(`📊 分析市场: ${marketId.toBase58()}`);

        const marketAccountInfo = await connection.getAccountInfo(marketId);
        if (!marketAccountInfo) {
            console.log("❌ 市场账户不存在");
            return;
        }

        console.log(`✅ 市场账户存在`);
        console.log(`   数据大小: ${marketAccountInfo.data.length} bytes`);
        console.log(`   所有者: ${marketAccountInfo.owner.toBase58()}`);

        // 尝试解析市场数据中的费用相关信息
        if (marketAccountInfo.data.length >= 388) {
            console.log("📊 尝试解析市场费用配置...");

            // OpenBook 市场数据结构分析（简化版）
            // 实际需要参考 OpenBook 的源代码
            try {
                // 假设费用率在特定偏移量
                const feeRateOffset = 200; // 需要根据实际结构调整
                if (marketAccountInfo.data.length > feeRateOffset + 8) {
                    const feeRate = marketAccountInfo.data.readUIntLE(feeRateOffset, 8);
                    console.log(`   费用率: ${feeRate} (原始值)`);
                    console.log(`   费用率: ${feeRate / 10000}% (百分比)`);
                }
            } catch (error) {
                console.log(`   ⚠️  无法解析费用配置: ${error}`);
            }
        }

    } catch (error) {
        console.error("❌ 分析 OpenBook 市场费用时出错:", error);
    }
}

/**
 * 研究费用验证逻辑
 */
async function researchFeeValidationLogic(): Promise<void> {
    console.log("🔍 研究 Raydium 费用验证逻辑...");

    console.log("\n📚 基于错误分析的发现:");
    console.log("   错误代码: 0x30 (InvalidFee)");
    console.log("   错误位置: Raydium AMM Initialize2 指令");

    console.log("\n🔍 可能的原因分析:");
    console.log("   1. 市场费用配置不符合 Raydium 要求");
    console.log("   2. 缺少必要的费用收集账户");
    console.log("   3. 费用计算方法不正确");
    console.log("   4. OpenBook 市场状态不正确");

    console.log("\n📖 Raydium 费用验证可能检查:");
    console.log("   ✓ OpenBook 市场的费用率设置");
    console.log("   ✓ 费用收集账户的存在和权限");
    console.log("   ✓ 市场的激活状态");
    console.log("   ✓ 费用计算的数学正确性");
}

/**
 * 提供解决方案建议
 */
function provideSolutionRecommendations(): void {
    console.log("💡 解决方案建议:");

    console.log("\n🎯 立即可尝试的方案:");
    console.log("   1. 使用现有的 Raydium 池子进行 swap 测试");
    console.log("   2. 研究现有池子的配置参数");
    console.log("   3. 复制成功池子的费用设置");

    console.log("\n🔬 深入研究方案:");
    console.log("   1. 反编译 Raydium 程序分析费用验证逻辑");
    console.log("   2. 联系 Raydium 开发团队获取指导");
    console.log("   3. 研究 Raydium 官方示例代码");

    console.log("\n🚀 替代方案:");
    console.log("   1. 专注于 Orca 生态系统开发");
    console.log("   2. 使用其他 AMM 协议 (如 Meteora)");
    console.log("   3. 在 mainnet 上测试 Raydium (费用更高但可能更稳定)");

    console.log("\n📋 下一步行动计划:");
    console.log("   1. 先完善 Orca swap 功能");
    console.log("   2. 并行研究 Raydium 费用问题");
    console.log("   3. 构建通用的 DeFi 交易框架");
}

/**
 * 加载钱包
 */
function loadWallet(): Keypair {
    try {
        const walletData = JSON.parse(fs.readFileSync(WALLET_FILE_PATH, 'utf-8'));
        return Keypair.fromSecretKey(Uint8Array.from(walletData));
    } catch (error) {
        console.error("❌ 无法加载钱包文件:", error);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}
