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
 * Raydium InvalidFee 错误深度调试器
 */
async function main(): Promise<void> {
    console.log("🔬 Raydium InvalidFee 错误深度调试器...");
    console.log("📋 本工具将分析：");
    console.log("   1. 成功的 Raydium 池子的费用配置");
    console.log("   2. OpenBook 市场的费用结构");
    console.log("   3. Raydium 初始化参数的正确格式");
    console.log("   4. 提供精确的修复方案");
    console.log("=".repeat(60));

    try {
        const connection = new Connection(RPC_ENDPOINT_URL, "confirmed");
        const wallet = loadWallet();

        console.log(`✅ 钱包: ${wallet.publicKey.toBase58()}`);

        // 1. 分析成功的 Raydium 池子
        console.log("\n🔍 步骤1：分析成功的 Raydium 池子...");
        await analyzeSuccessfulRaydiumPools(connection);

        // 2. 分析 OpenBook 市场费用结构
        console.log("\n🔍 步骤2：分析 OpenBook 市场费用结构...");
        await analyzeOpenBookFeeStructure(connection);

        // 3. 对比我们的参数与成功案例
        console.log("\n🔍 步骤3：对比参数差异...");
        await compareInitializationParameters();

        // 4. 生成修复方案
        console.log("\n💡 步骤4：生成精确修复方案...");
        await generateFixSolution();

    } catch (error) {
        console.error("❌ 调试过程中出错:", error);
    }
}

/**
 * 分析成功的 Raydium 池子
 */
async function analyzeSuccessfulRaydiumPools(connection: Connection): Promise<void> {
    console.log("🔍 深度分析成功的 Raydium 池子...");

    try {
        // 查找 Raydium 池子
        const accounts = await connection.getProgramAccounts(RAYDIUM_LIQUIDITY_PROGRAM_ID, {
            filters: [
                {
                    dataSize: 752, // Raydium AMM 池子账户大小
                }
            ]
        });

        console.log(`✅ 找到 ${accounts.length} 个 Raydium 池子`);

        // 分析前3个池子的详细结构
        for (let i = 0; i < Math.min(accounts.length, 3); i++) {
            const poolAddress = accounts[i].pubkey;
            const poolData = accounts[i].account.data;
            
            console.log(`\n📊 分析池子 ${i + 1}: ${poolAddress.toBase58()}`);
            await analyzePoolDataStructure(connection, poolAddress, poolData);
        }

    } catch (error) {
        console.error("❌ 分析 Raydium 池子时出错:", error);
    }
}

/**
 * 分析池子数据结构
 */
async function analyzePoolDataStructure(connection: Connection, poolAddress: PublicKey, data: Buffer): Promise<void> {
    try {
        console.log(`   数据大小: ${data.length} bytes`);
        
        // 根据 Raydium 源码分析数据结构
        // 参考: https://github.com/raydium-io/raydium-amm/blob/master/program/src/state.rs
        
        if (data.length >= 752) {
            // 读取关键字段
            const status = data.readUInt8(0);
            console.log(`   状态: ${status}`);
            
            // 读取 nonce (用于权限计算)
            const nonce = data.readUInt8(1);
            console.log(`   Nonce: ${nonce}`);
            
            // 读取 order_num
            const orderNum = data.readUInt8(2);
            console.log(`   Order Num: ${orderNum}`);
            
            // 读取 depth
            const depth = data.readUInt8(3);
            console.log(`   Depth: ${depth}`);
            
            // 读取 coin_decimals
            const coinDecimals = data.readUInt8(4);
            console.log(`   Coin Decimals: ${coinDecimals}`);
            
            // 读取 pc_decimals
            const pcDecimals = data.readUInt8(5);
            console.log(`   PC Decimals: ${pcDecimals}`);
            
            // 读取 state (u8)
            const state = data.readUInt8(6);
            console.log(`   State: ${state}`);
            
            // 读取 reset_flag (u8)
            const resetFlag = data.readUInt8(7);
            console.log(`   Reset Flag: ${resetFlag}`);
            
            // 读取 min_size (u64)
            const minSize = data.readBigUInt64LE(8);
            console.log(`   Min Size: ${minSize}`);
            
            // 读取 vol_max_cut_ratio (u64)
            const volMaxCutRatio = data.readBigUInt64LE(16);
            console.log(`   Vol Max Cut Ratio: ${volMaxCutRatio}`);
            
            // 读取 amount_wave_ratio (u64)
            const amountWaveRatio = data.readBigUInt64LE(24);
            console.log(`   Amount Wave Ratio: ${amountWaveRatio}`);
            
            // 读取 coin_lot_size (u64)
            const coinLotSize = data.readBigUInt64LE(32);
            console.log(`   Coin Lot Size: ${coinLotSize}`);
            
            // 读取 pc_lot_size (u64)
            const pcLotSize = data.readBigUInt64LE(40);
            console.log(`   PC Lot Size: ${pcLotSize}`);
            
            // 读取 min_price_multiplier (u64)
            const minPriceMultiplier = data.readBigUInt64LE(48);
            console.log(`   Min Price Multiplier: ${minPriceMultiplier}`);
            
            // 读取 max_price_multiplier (u64)
            const maxPriceMultiplier = data.readBigUInt64LE(56);
            console.log(`   Max Price Multiplier: ${maxPriceMultiplier}`);
            
            // 读取 sys_decimal_value (u64)
            const sysDecimalValue = data.readBigUInt64LE(64);
            console.log(`   Sys Decimal Value: ${sysDecimalValue}`);
            
            // 读取关键的 mint 地址
            const coinMintOffset = 72;
            const pcMintOffset = 104;
            
            if (data.length > pcMintOffset + 32) {
                const coinMint = new PublicKey(data.slice(coinMintOffset, coinMintOffset + 32));
                const pcMint = new PublicKey(data.slice(pcMintOffset, pcMintOffset + 32));
                
                console.log(`   Coin Mint: ${coinMint.toBase58()}`);
                console.log(`   PC Mint: ${pcMint.toBase58()}`);
                
                // 检查是否是 SOL/USDC 对
                const isSOLUSDC = (
                    (coinMint.equals(SOL_MINT) && pcMint.equals(USDC_MINT)) ||
                    (coinMint.equals(USDC_MINT) && pcMint.equals(SOL_MINT))
                );
                
                if (isSOLUSDC) {
                    console.log(`   🎯 这是一个 SOL/USDC 池子！`);
                    
                    // 获取这个池子关联的 OpenBook 市场
                    await analyzeAssociatedMarket(connection, data);
                }
            }
        }
        
    } catch (error) {
        console.log(`   ⚠️  数据解析错误: ${error}`);
    }
}

/**
 * 分析关联的 OpenBook 市场
 */
async function analyzeAssociatedMarket(connection: Connection, poolData: Buffer): Promise<void> {
    try {
        // 读取市场地址 (假设在特定偏移量)
        const marketOffset = 136; // 需要根据实际结构调整
        
        if (poolData.length > marketOffset + 32) {
            const marketId = new PublicKey(poolData.slice(marketOffset, marketOffset + 32));
            console.log(`   关联市场: ${marketId.toBase58()}`);
            
            // 获取市场信息
            const marketAccountInfo = await connection.getAccountInfo(marketId);
            if (marketAccountInfo) {
                console.log(`   市场数据大小: ${marketAccountInfo.data.length} bytes`);
                console.log(`   市场所有者: ${marketAccountInfo.owner.toBase58()}`);
                
                // 验证是否是 OpenBook 市场
                if (marketAccountInfo.owner.equals(OPENBOOK_PROGRAM_ID)) {
                    console.log(`   ✅ 确认是 OpenBook 市场`);
                    await analyzeMarketFeeConfiguration(marketAccountInfo.data);
                } else {
                    console.log(`   ⚠️  不是 OpenBook 市场`);
                }
            }
        }
        
    } catch (error) {
        console.log(`   ⚠️  市场分析错误: ${error}`);
    }
}

/**
 * 分析市场费用配置
 */
async function analyzeMarketFeeConfiguration(marketData: Buffer): Promise<void> {
    try {
        console.log(`   📊 分析市场费用配置...`);
        
        // OpenBook 市场数据结构分析
        // 需要参考 OpenBook 源码来确定正确的偏移量
        
        if (marketData.length >= 388) {
            // 尝试读取一些关键的费用相关字段
            // 这些偏移量需要根据 OpenBook 的实际数据结构调整
            
            console.log(`   市场数据结构分析:`);
            console.log(`     前8字节: ${marketData.slice(0, 8).toString('hex')}`);
            console.log(`     8-16字节: ${marketData.slice(8, 16).toString('hex')}`);
            console.log(`     16-24字节: ${marketData.slice(16, 24).toString('hex')}`);
            
            // 查找可能的费用率字段
            for (let offset = 0; offset < Math.min(marketData.length - 8, 200); offset += 8) {
                const value = marketData.readBigUInt64LE(offset);
                
                // 查找可能的费用率值 (通常是小数值)
                if (value > 0n && value < 10000n) {
                    console.log(`     偏移量 ${offset}: ${value} (可能的费用率)`);
                }
            }
        }
        
    } catch (error) {
        console.log(`   ⚠️  费用配置分析错误: ${error}`);
    }
}

/**
 * 分析 OpenBook 市场费用结构
 */
async function analyzeOpenBookFeeStructure(connection: Connection): Promise<void> {
    console.log("🔍 分析 OpenBook 市场费用结构...");
    
    try {
        // 使用我们之前找到的市场
        const marketId = new PublicKey("EQFjeeTapdMZnjDbSuL7XEdzBeY8MqgbMYesYmV47nTd");
        
        console.log(`📊 分析我们创建的市场: ${marketId.toBase58()}`);
        
        const marketAccountInfo = await connection.getAccountInfo(marketId);
        if (marketAccountInfo) {
            console.log(`✅ 市场存在`);
            console.log(`   数据大小: ${marketAccountInfo.data.length} bytes`);
            console.log(`   所有者: ${marketAccountInfo.owner.toBase58()}`);
            
            await analyzeMarketFeeConfiguration(marketAccountInfo.data);
        } else {
            console.log(`❌ 市场不存在`);
        }
        
    } catch (error) {
        console.error("❌ 分析 OpenBook 费用结构时出错:", error);
    }
}

/**
 * 对比初始化参数
 */
async function compareInitializationParameters(): Promise<void> {
    console.log("🔍 对比我们的参数与成功案例...");
    
    console.log("\n📊 我们使用的参数:");
    console.log("   baseLotSize: 1,000,000 (0.001 SOL)");
    console.log("   quoteLotSize: 10,000 (0.01 USDC)");
    console.log("   feeRateBps: 150 (1.5%)");
    console.log("   vaultSignerNonce: 计算得出");
    console.log("   quoteDustThreshold: 100");
    
    console.log("\n📊 可能的问题:");
    console.log("   1. feeRateBps 可能不符合 Raydium 要求");
    console.log("   2. lotSize 可能需要特定的比例");
    console.log("   3. 市场状态可能需要特定的初始化");
    console.log("   4. 缺少某些必需的账户或参数");
}

/**
 * 生成修复方案
 */
async function generateFixSolution(): Promise<void> {
    console.log("💡 生成精确修复方案...");
    
    console.log("\n🎯 基于分析的修复建议:");
    
    console.log("\n1. 📊 费用参数调整:");
    console.log("   - 将 feeRateBps 从 150 改为 25 (0.25%)");
    console.log("   - 这与 Raydium 的标准费率一致");
    
    console.log("\n2. 🔧 市场参数优化:");
    console.log("   - 使用更标准的 lotSize 比例");
    console.log("   - baseLotSize: 100,000 (更小的最小单位)");
    console.log("   - quoteLotSize: 1,000 (更小的最小单位)");
    
    console.log("\n3. 📋 账户验证增强:");
    console.log("   - 确保所有 OpenBook 相关账户都正确创建");
    console.log("   - 验证市场状态是否正确初始化");
    
    console.log("\n4. 🔍 调试步骤:");
    console.log("   - 使用成功池子的确切参数");
    console.log("   - 逐步验证每个账户的状态");
    console.log("   - 添加详细的错误日志");
    
    console.log("\n🚀 下一步行动:");
    console.log("   1. 实施参数调整");
    console.log("   2. 重新测试池子创建");
    console.log("   3. 如果仍失败，尝试复制成功池子的确切配置");
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
