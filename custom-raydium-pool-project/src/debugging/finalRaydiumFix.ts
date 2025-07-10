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
 * 最终的 Raydium 自建池子修复方案
 */
async function main(): Promise<void> {
    console.log("🔧 最终的 Raydium 自建池子修复方案...");
    console.log("📋 本方案将尝试：");
    console.log("   1. 从成功的 Raydium 池子中提取真实的市场信息");
    console.log("   2. 使用完全相同的市场配置");
    console.log("   3. 复制成功案例的所有参数");
    console.log("   4. 最终解决 InvalidFee 错误");
    console.log("=".repeat(60));

    try {
        const connection = new Connection(RPC_ENDPOINT_URL, "confirmed");
        const wallet = loadWallet();

        console.log(`✅ 钱包: ${wallet.publicKey.toBase58()}`);

        // 1. 找到一个真实的 SOL/USDC Raydium 池子
        console.log("\n🔍 步骤1：找到真实的 SOL/USDC Raydium 池子...");
        const realPool = await findRealSOLUSDCPool(connection);

        if (!realPool) {
            console.log("❌ 没有找到真实的 SOL/USDC 池子");
            return;
        }

        // 2. 提取真实市场信息
        console.log("\n🔍 步骤2：提取真实市场信息...");
        const marketInfo = await extractRealMarketInfo(connection, realPool);

        if (!marketInfo) {
            console.log("❌ 无法提取市场信息");
            return;
        }

        // 3. 分析成功的配置
        console.log("\n📊 步骤3：分析成功的配置...");
        await analyzeSuccessfulConfiguration(connection, realPool, marketInfo);

        // 4. 提供最终解决方案
        console.log("\n💡 步骤4：提供最终解决方案...");
        await provideFinalSolution(realPool, marketInfo);

    } catch (error) {
        console.error("❌ 修复过程中出错:", error);
    }
}

/**
 * 找到真实的 SOL/USDC Raydium 池子
 */
async function findRealSOLUSDCPool(connection: Connection): Promise<{
    poolId: PublicKey,
    poolData: Buffer
} | null> {
    console.log("🔍 搜索真实的 SOL/USDC Raydium 池子...");

    try {
        // 查找所有 Raydium 池子
        const accounts = await connection.getProgramAccounts(RAYDIUM_LIQUIDITY_PROGRAM_ID, {
            filters: [
                {
                    dataSize: 752, // Raydium AMM 池子账户大小
                }
            ]
        });

        console.log(`✅ 找到 ${accounts.length} 个 Raydium 池子`);

        // 检查前 50 个池子，寻找真实的 SOL/USDC 对
        for (let i = 0; i < Math.min(accounts.length, 50); i++) {
            const poolAddress = accounts[i].pubkey;
            const poolData = accounts[i].account.data;

            try {
                // 解析池子数据来找到代币 mint
                const coinMintOffset = 72;
                const pcMintOffset = 104;

                if (poolData.length > pcMintOffset + 32) {
                    const coinMint = new PublicKey(poolData.slice(coinMintOffset, coinMintOffset + 32));
                    const pcMint = new PublicKey(poolData.slice(pcMintOffset, pcMintOffset + 32));

                    // 检查是否是 SOL/USDC 对
                    const isSOLUSDC = (
                        (coinMint.equals(SOL_MINT) && pcMint.equals(USDC_MINT)) ||
                        (coinMint.equals(USDC_MINT) && pcMint.equals(SOL_MINT))
                    );

                    if (isSOLUSDC) {
                        console.log(`🎯 找到真实的 SOL/USDC 池子: ${poolAddress.toBase58()}`);
                        console.log(`   Coin Mint: ${coinMint.toBase58()}`);
                        console.log(`   PC Mint: ${pcMint.toBase58()}`);
                        
                        return {
                            poolId: poolAddress,
                            poolData: poolData
                        };
                    }
                }
            } catch (error) {
                // 继续检查下一个池子
            }
        }

        console.log("⚠️  没有找到 SOL/USDC 池子，使用第一个池子作为参考");
        return {
            poolId: accounts[0].pubkey,
            poolData: accounts[0].account.data
        };

    } catch (error) {
        console.error("❌ 查找池子时出错:", error);
        return null;
    }
}

/**
 * 提取真实市场信息
 */
async function extractRealMarketInfo(connection: Connection, poolInfo: {
    poolId: PublicKey,
    poolData: Buffer
}): Promise<{
    marketId: PublicKey,
    marketData: Buffer
} | null> {
    try {
        console.log("🔍 从池子数据中提取市场信息...");

        // 根据 Raydium 数据结构提取市场地址
        const marketOffset = 136; // 市场地址在池子数据中的偏移量

        if (poolInfo.poolData.length > marketOffset + 32) {
            const marketId = new PublicKey(poolInfo.poolData.slice(marketOffset, marketOffset + 32));
            console.log(`📊 提取到市场 ID: ${marketId.toBase58()}`);

            // 获取市场数据
            const marketAccountInfo = await connection.getAccountInfo(marketId);
            if (marketAccountInfo) {
                console.log(`✅ 市场数据获取成功`);
                console.log(`   数据大小: ${marketAccountInfo.data.length} bytes`);
                console.log(`   所有者: ${marketAccountInfo.owner.toBase58()}`);

                // 验证是否是 OpenBook 市场
                if (marketAccountInfo.owner.equals(OPENBOOK_PROGRAM_ID)) {
                    console.log(`✅ 确认是 OpenBook 市场`);
                    return {
                        marketId: marketId,
                        marketData: marketAccountInfo.data
                    };
                } else {
                    console.log(`⚠️  不是 OpenBook 市场，所有者: ${marketAccountInfo.owner.toBase58()}`);
                }
            } else {
                console.log(`❌ 无法获取市场数据`);
            }
        }

        return null;

    } catch (error) {
        console.error("❌ 提取市场信息时出错:", error);
        return null;
    }
}

/**
 * 分析成功的配置
 */
async function analyzeSuccessfulConfiguration(
    connection: Connection,
    poolInfo: { poolId: PublicKey, poolData: Buffer },
    marketInfo: { marketId: PublicKey, marketData: Buffer }
): Promise<void> {
    console.log("📊 分析成功的池子和市场配置...");

    try {
        // 分析池子配置
        console.log("\n📋 池子配置分析:");
        const poolData = poolInfo.poolData;
        
        if (poolData.length >= 752) {
            const status = poolData.readUInt8(0);
            const nonce = poolData.readUInt8(1);
            const coinDecimals = poolData.readUInt8(4);
            const pcDecimals = poolData.readUInt8(5);
            const coinLotSize = poolData.readBigUInt64LE(32);
            const pcLotSize = poolData.readBigUInt64LE(40);

            console.log(`   状态: ${status}`);
            console.log(`   Nonce: ${nonce}`);
            console.log(`   Coin Decimals: ${coinDecimals}`);
            console.log(`   PC Decimals: ${pcDecimals}`);
            console.log(`   Coin Lot Size: ${coinLotSize}`);
            console.log(`   PC Lot Size: ${pcLotSize}`);
        }

        // 分析市场配置
        console.log("\n📋 市场配置分析:");
        const marketData = marketInfo.marketData;
        
        console.log(`   市场 ID: ${marketInfo.marketId.toBase58()}`);
        console.log(`   数据大小: ${marketData.length} bytes`);
        
        // 尝试解析市场的关键字段
        if (marketData.length >= 388) {
            console.log(`   前8字节: ${marketData.slice(0, 8).toString('hex')}`);
            console.log(`   8-16字节: ${marketData.slice(8, 16).toString('hex')}`);
        }

    } catch (error) {
        console.error("❌ 分析配置时出错:", error);
    }
}

/**
 * 提供最终解决方案
 */
async function provideFinalSolution(
    poolInfo: { poolId: PublicKey, poolData: Buffer },
    marketInfo: { marketId: PublicKey, marketData: Buffer }
): Promise<void> {
    console.log("💡 基于真实成功案例的最终解决方案:");

    console.log("\n🎯 关键发现:");
    console.log("   1. 真实的 Raydium 池子使用特定的市场配置");
    console.log("   2. InvalidFee 错误可能与市场的内部状态有关");
    console.log("   3. 我们需要使用与成功池子完全相同的市场");

    console.log("\n🔧 修复方案:");
    console.log(`   1. 使用真实市场: ${marketInfo.marketId.toBase58()}`);
    console.log("   2. 复制成功池子的所有参数");
    console.log("   3. 确保市场状态与 Raydium 要求一致");

    console.log("\n📋 具体实施步骤:");
    console.log("   1. 修改 poolCreation.ts 中的市场 ID");
    console.log(`   2. 将 useExistingOpenBookMarket 函数中的市场 ID 改为: ${marketInfo.marketId.toBase58()}`);
    console.log("   3. 使用从真实池子中提取的参数");
    console.log("   4. 重新测试池子创建");

    console.log("\n🚨 重要提示:");
    console.log("   如果使用真实市场仍然失败，这可能表明:");
    console.log("   1. Raydium devnet 程序有特殊的限制");
    console.log("   2. 需要特定的权限或白名单");
    console.log("   3. 某些账户状态需要特定的初始化顺序");

    console.log("\n🎯 替代方案:");
    console.log("   1. 专注于使用现有池子进行 swap 开发");
    console.log("   2. 在 mainnet 上测试池子创建 (成本更高但可能更稳定)");
    console.log("   3. 联系 Raydium 团队获取 devnet 池子创建的具体指导");

    console.log(`\n📝 下一步行动:`);
    console.log(`   修改代码使用市场: ${marketInfo.marketId.toBase58()}`);
    console.log(`   然后运行: npx ts-node raydiumSwap.ts`);
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
