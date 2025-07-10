// //findDevnetPools.ts - 查找现有的Raydium Devnet池子
// 通过Raydium程序ID搜索现有的AMM池
// 目的是寻找可用的测试池，避免重复创建



import { Connection, PublicKey } from "@solana/web3.js";
import * as dotenv from "dotenv";

dotenv.config();

// 代币元数据缓存
const tokenMetadataCache = new Map<string, { symbol: string; name: string }>();

// Devnet 常见代币地址和符号（使用正确的官方 devToken 地址）
const DEVNET_TOKENS = {
    SOL: "So11111111111111111111111111111111111111112", // Wrapped SOL
    USDC: "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k", // 正确的 devUSDC
    USDT: "H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPmR", // 正确的 devUSDT
};

// 已知代币符号映射（使用正确的官方 Devnet devToken 地址）
const KNOWN_TOKEN_SYMBOLS: { [key: string]: string } = {
    "So11111111111111111111111111111111111111112": "SOL",
    "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k": "devUSDC",  // 正确的 devUSDC 地址
    "H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPmR": "devUSDT",  // 正确的 devUSDT 地址
    // 从之前输出中发现的测试代币（保留以防有用）
    "zXcTwQUwbX9N8yy2TLJRXeJvhpb2cRSSwPBoPuWSNBo": "WSOL",
    "5bPX9gLmtaF4X86x9dG8y2Guesa2M1p4svpEJ2KUaq6Y": "TEST1",
    "2CoeqVYta5aUK6HJpchLuEGJRrW8KmEGbCWUdCEV61Dn": "TEST2",
    "H28yqidUMEtamRctA56TGPuPXQPjAWUaHnVu6VCy7RzS": "TEST3",
    "oKrFMCiuDfMf424trXa5KJYD29Y3LP79Cuf8yoFkVMc": "TEST4",
    "986saLShBa9Lj4d73BdYCUd2TCMxNbE3msC5yjjNDKVR": "TEST5",
};

// 主流代币优先级定义（更新为正确的 devnet 代币符号）
const MAINSTREAM_TOKENS = ["SOL", "devUSDC", "devUSDT", "WSOL"];
const SOL_ADDRESS = "So11111111111111111111111111111111111111112";

// 已知的高流动性 Orca Whirlpool 池地址
const KNOWN_HIGH_LIQUIDITY_POOLS = {
    "3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt": {
        name: "SOL ↔ devUSDC",
        tokenA: "So11111111111111111111111111111111111111112", // SOL
        tokenB: "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k", // devUSDC
        description: "官方推荐的高流动性 SOL/devUSDC 池"
    }
};

/**
 * 获取代币的符号（symbol）
 * 首先检查已知代币映射，对于 devnet，直接返回地址前缀，不尝试获取元数据
 */
async function getTokenSymbol(_connection: Connection, mintAddress: string): Promise<string> {
    // 检查缓存
    if (tokenMetadataCache.has(mintAddress)) {
        return tokenMetadataCache.get(mintAddress)!.symbol;
    }

    // 检查已知代币
    if (KNOWN_TOKEN_SYMBOLS[mintAddress]) {
        const symbol = KNOWN_TOKEN_SYMBOLS[mintAddress];
        tokenMetadataCache.set(mintAddress, { symbol, name: symbol });
        return symbol;
    }

    // 对于 devnet，直接返回地址前缀，不尝试获取元数据
    const fallbackSymbol = `${mintAddress.substring(0, 8)}...`;
    tokenMetadataCache.set(mintAddress, { symbol: fallbackSymbol, name: fallbackSymbol });
    return fallbackSymbol;
}

/**
 * 检查是否为已知代币组合
 */
function isKnownTokenPair(tokenA: string, tokenB: string): boolean {
    return Boolean(KNOWN_TOKEN_SYMBOLS[tokenA]) && Boolean(KNOWN_TOKEN_SYMBOLS[tokenB]);
}

/**
 * 检查是否为 SOL 交易对
 */
function isSOLPair(tokenA: string, tokenB: string): boolean {
    return (tokenA === SOL_ADDRESS || tokenB === SOL_ADDRESS);
}


/**
 * 检查是否为主流代币交易对
 */
function isMainstreamPair(tokenA: string, tokenB: string): boolean {
    const symbolA = KNOWN_TOKEN_SYMBOLS[tokenA];
    const symbolB = KNOWN_TOKEN_SYMBOLS[tokenB];
    return MAINSTREAM_TOKENS.includes(symbolA) && MAINSTREAM_TOKENS.includes(symbolB);
}

/**
 * 获取交易对类型
 */
function getPairType(tokenA: string, tokenB: string): 'SOL' | 'MAINSTREAM' | 'OTHER' | 'UNKNOWN' {
    if (!isKnownTokenPair(tokenA, tokenB)) return 'UNKNOWN';
    if (isSOLPair(tokenA, tokenB)) return 'SOL';
    if (isMainstreamPair(tokenA, tokenB)) return 'MAINSTREAM';
    return 'OTHER';
}

/**
 * 验证已知的高流动性池
 */
async function verifyKnownHighLiquidityPools(connection: Connection): Promise<any[]> {
    console.log("🎯 正在验证已知的高流动性池...");
    const verifiedPools: any[] = [];

    for (const [poolAddress, poolInfo] of Object.entries(KNOWN_HIGH_LIQUIDITY_POOLS)) {
        try {
            console.log(`\n🔍 验证池子: ${poolInfo.name}`);
            console.log(`   地址: ${poolAddress}`);

            const poolPubkey = new PublicKey(poolAddress);
            const accountInfo = await connection.getAccountInfo(poolPubkey);

            if (accountInfo) {
                // 使用 Orca SDK 分析池子
                const poolData = await analyzeOrcaPoolData(connection, poolPubkey, accountInfo.data, false);

                if (poolData.hasLiquidity) {
                    console.log(`   ✅ 池子验证成功，有流动性！`);
                    verifiedPools.push({
                        account: { pubkey: poolPubkey, account: accountInfo },
                        liquidity: poolData.liquidity,
                        containsSOL: poolData.containsSOL,
                        tokenASymbol: poolData.tokenASymbol,
                        tokenBSymbol: poolData.tokenBSymbol,
                        tokenAAddress: poolData.tokenAAddress,
                        tokenBAddress: poolData.tokenBAddress,
                        pairType: poolData.pairType,
                        isKnownPool: true,
                        poolName: poolInfo.name
                    });
                } else {
                    console.log(`   ⚠️  池子存在但流动性为0`);
                }
            } else {
                console.log(`   ❌ 池子不存在或无法访问`);
            }
        } catch (error) {
            console.log(`   ❌ 验证池子时出错: ${error}`);
        }
    }

    return verifiedPools;
}

// Raydium 程序 ID (Devnet)
const RAYDIUM_PROGRAM_ID = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");

// Orca Whirlpool 程序 ID (Devnet)
const ORCA_WHIRLPOOL_PROGRAM_ID = new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");


/**
 * 分析 Raydium 池子数据
 */
async function analyzeRaydiumPoolData(connection: Connection, _poolAddress: PublicKey, data: Buffer): Promise<void> {
    try {
        // Raydium AMM 池子数据结构解析（简化版）
        if (data.length >= 752) {
            // 读取关键字段（这是简化的解析，实际结构更复杂）
            const coinMintOffset = 8;  // 基础代币mint地址偏移
            const pcMintOffset = 40;   // 报价代币mint地址偏移
            const coinVaultOffset = 72; // 基础代币vault偏移
            const pcVaultOffset = 104;  // 报价代币vault偏移

            // 提取mint地址
            const coinMint = new PublicKey(data.slice(coinMintOffset, coinMintOffset + 32));
            const pcMint = new PublicKey(data.slice(pcMintOffset, pcMintOffset + 32));
            const coinVault = new PublicKey(data.slice(coinVaultOffset, coinVaultOffset + 32));
            const pcVault = new PublicKey(data.slice(pcVaultOffset, pcVaultOffset + 32));

            console.log(`    基础代币 Mint: ${coinMint.toBase58()}`);
            console.log(`    报价代币 Mint: ${pcMint.toBase58()}`);
            console.log(`    基础代币 Vault: ${coinVault.toBase58()}`);
            console.log(`    报价代币 Vault: ${pcVault.toBase58()}`);
            // 调试：检查是否匹配SOL
            console.log(`    是否为SOL (coinMint): ${coinMint.toBase58() === DEVNET_TOKENS.SOL}`);
            console.log(`    是否为SOL (pcMint): ${pcMint.toBase58() === DEVNET_TOKENS.SOL}`);
            console.log(`    预期SOL地址: ${DEVNET_TOKENS.SOL}`);

            // 检查是否含有 SOL 的池子
            const containsSOL = (
                coinMint.toBase58() == DEVNET_TOKENS.SOL ||
                pcMint.toBase58() == DEVNET_TOKENS.SOL
            );

            if (containsSOL) {
                console.log(`    🎯 这是包含 SOL 的池子！`);

                //确定另一个代币
                const otherTokenAddress = coinMint.toBase58() === DEVNET_TOKENS.SOL ? pcMint.toBase58() : coinMint.toBase58();
                const otherTokenSymbol = await getTokenSymbol(connection, otherTokenAddress);
                console.log(`    💰 交易对: SOL / ${otherTokenSymbol}`);
            }

            // 尝试获取vault余额
            try {
                const coinVaultInfo = await connection.getAccountInfo(coinVault);
                const pcVaultInfo = await connection.getAccountInfo(pcVault);

                if (coinVaultInfo && pcVaultInfo) {
                    console.log(`    ✅ Vault账户存在，池子可能是活跃的`);
                } else {
                    console.log(`    ⚠️  Vault账户不存在，池子可能已废弃`);
                }
            } catch (error) {
                console.log(`    ❌ 无法检查vault状态: ${error}`);
            }
        }
    } catch (error) {
        console.log(`    ❌ 解析池子数据失败: ${error}`);
    }
}

/**
 * 分析 Orca Whirlpool 数据 （使用官方SDK）
 */
async function analyzeOrcaPoolData(connection: Connection, poolAddress: PublicKey, _data: Buffer, silent: boolean = false):
    Promise<{
        hasLiquidity: boolean;
        containsSOL: boolean;
        liquidity: any;
        tokenASymbol: string;
        tokenBSymbol: string;
        tokenAAddress: string;
        tokenBAddress: string;
        pairType: 'SOL' | 'MAINSTREAM' | 'OTHER' | 'UNKNOWN';
    }> {
    try {
        // 使用 Orca SDK 解析池子数据
        const { WhirlpoolContext, buildWhirlpoolClient } = require("@orca-so/whirlpools-sdk");
        const { AnchorProvider, Wallet } = require("@coral-xyz/anchor");

        // 创建一个临时钱包用于查询（不需要私钥）
        const dummyKeypair = require("@solana/web3.js").Keypair.generate();
        const wallet = new Wallet(dummyKeypair);
        const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

        // 创建 Whirlpool 客户端
        const ctx = WhirlpoolContext.withProvider(provider, ORCA_WHIRLPOOL_PROGRAM_ID);
        const client = buildWhirlpoolClient(ctx);

        // 获取池子信息
        const whirlpool = await client.getPool(poolAddress);
        const poolData = whirlpool.getData();

        if (!silent) {
            console.log(`    📊 Orca Whirlpool 池子 (使用官方 SDK 解析)`);
            console.log(`    代币A: ${poolData.tokenMintA.toBase58()}`);
            console.log(`    代币B: ${poolData.tokenMintB.toBase58()}`);
            console.log(`    当前价格: ${poolData.sqrtPrice.toString()}`);
            console.log(`    流动性: ${poolData.liquidity.toString()}`);
            console.log(`    手续费率: ${poolData.feeRate / 10000}%`);
        }


        // 检查是否包含 SOL
        const containsSOL = (
            poolData.tokenMintA.toBase58() === DEVNET_TOKENS.SOL ||
            poolData.tokenMintB.toBase58() === DEVNET_TOKENS.SOL
        );

        if (!silent && containsSOL) {
            console.log(`    🎯 这是包含 SOL 的池子！`);
        }

        const tokenAAddress = poolData.tokenMintA.toBase58();
        const tokenBAddress = poolData.tokenMintB.toBase58();
        const tokenASymbol = await getTokenSymbol(connection, tokenAAddress);
        const tokenBSymbol = await getTokenSymbol(connection, tokenBAddress);
        const pairType = getPairType(tokenAAddress, tokenBAddress);

        if (!silent) {
            console.log(`    💰 交易对: ${tokenASymbol} / ${tokenBSymbol}`);
            console.log(`    🏷️  交易对类型: ${pairType}`);
        }

        // 检查流动性
        const hasLiquidity = poolData.liquidity.gt(new (require("bn.js"))(0));
        if (!silent) {
            if (hasLiquidity > 0) {
                console.log(`    ✅ 池子有流动性，可以进行交易`);
            } else {
                console.log(`    ⚠️  池子流动性为0`);

            }
        }
        return {
            hasLiquidity,
            containsSOL,
            liquidity: poolData.liquidity,
            tokenASymbol,
            tokenBSymbol,
            tokenAAddress,
            tokenBAddress,
            pairType
        };

    } catch (error) {
        console.log(`    ❌ 使用 Orca SDK 解析失败: ${error}`);
        return {
            hasLiquidity: false,
            containsSOL: false,
            liquidity: new (require("bn.js"))(0),
            tokenASymbol: '',
            tokenBSymbol: '',
            tokenAAddress: '',
            tokenBAddress: '',
            pairType: 'UNKNOWN'
        };
    }
}

async function findRaydiumDevnetPools() {
    const RPC_ENDPOINT_URL = process.env.DEVNET_RPC_URL;
    if (!RPC_ENDPOINT_URL) {
        throw new Error("请在 .env 文件中设置 DEVNET_RPC_URL");
    }

    const connection = new Connection(RPC_ENDPOINT_URL, "confirmed");

    console.log("🔍 正在搜索 Devnet 上的流动性池...");

    try {
        // 方法1：通过 Raydium 程序查找所有相关账户
        const accounts = await connection.getProgramAccounts(RAYDIUM_PROGRAM_ID, {
            filters: [
                {
                    dataSize: 752, // Raydium AMM 池的数据大小
                }
            ]
        });

        // 筛选出包含 SOL 的池子
        const solPools: any[] = [];
        for (const account of accounts) {
            const data = account.account.data;
            if (data.length >= 752) {
                const coinMintOffset = 8;
                const pcMintOffset = 40;
                const coinMint = new PublicKey(data.slice(coinMintOffset, coinMintOffset + 32));
                const pcMint = new PublicKey(data.slice(pcMintOffset, pcMintOffset + 32));

                const containsSOL = (
                    coinMint.toBase58() == DEVNET_TOKENS.SOL ||
                    pcMint.toBase58() == DEVNET_TOKENS.SOL
                );

                if (containsSOL) {
                    solPools.push(account);
                }
            }
        }

        console.log(`🎯 在 ${accounts.length} 个池子中找到 ${solPools.length} 个包含 SOL 的池子`);

        // 显示前几个池的详细信息
        for (let i = 0; i < Math.min(5, solPools.length); i++) {
            const account = solPools[i];
            console.log(`\nSOL池 ${i + 1}:`);
            console.log(`  地址: ${account.pubkey.toBase58()}`);
            console.log(`  数据大小: ${account.account.data.length} bytes`);

            // 尝试解析池子的基本信息
            await analyzeRaydiumPoolData(connection, account.pubkey, account.account.data);
        }

        // 如果找到池子，提供使用建议
        if (solPools.length > 0) {
            console.log(`\n✅ 发现 ${solPools.length} 个 包含 SOL 的池子！`);
            console.log("💡 建议使用第一个活跃的SOL池子进行测试:");
            console.log(`   池子地址: ${solPools[0].pubkey.toBase58()}`);
            console.log("💡 你可以在 raydiumSwap.ts 中使用这个池子地址");
            return solPools;
        } else {
            console.log("\n❌ 没有找到包含 SOL 的活跃池子");
            console.log("💡 建议尝试使用 Orca 池子或创建新的测试池子");
            return [];
        }

    } catch (error) {
        console.error("❌ 搜索池时出错:", error);
    }
}


/**
 * 查找 Orca 池子
 */
async function findOrcaPools() {
    const RPC_ENDPOINT_URL = process.env.DEVNET_RPC_URL;
    if (!RPC_ENDPOINT_URL) {
        throw new Error("请在 .env 文件中设置 DEVNET_RPC_URL");
    }

    const connection = new Connection(RPC_ENDPOINT_URL, "confirmed");

    console.log("\n🌊 正在搜索 Orca Whirlpool 池子...");

    try {
        // 首先验证已知的高流动性池
        const knownPools = await verifyKnownHighLiquidityPools(connection);

        if (knownPools.length > 0) {
            console.log(`\n🎯 已验证 ${knownPools.length} 个已知高流动性池！`);
            console.log("💡 建议直接使用已验证的高流动性池:");

            knownPools.forEach((pool, index) => {
                console.log(`\n✅ 推荐池子 ${index + 1}: ${pool.poolName}`);
                console.log(`   地址: ${pool.account.pubkey.toBase58()}`);
                console.log(`   交易对: ${pool.tokenASymbol} / ${pool.tokenBSymbol}`);
                console.log(`   流动性: ${pool.liquidity.toString()}`);
                console.log(`   类型: ${pool.pairType}`);
            });

            return knownPools.map(p => p.account);
        }

        // 如果已知池子验证失败，继续搜索其他池子
        console.log("\n🔍 已知池子验证失败，继续搜索其他 Orca 池子...");

        const accounts = await connection.getProgramAccounts(ORCA_WHIRLPOOL_PROGRAM_ID, {
            filters: [
                {
                    dataSize: 653, // Orca Whirlpool 的数据大小
                }
            ]
        });

        console.log(`✅ 找到 ${accounts.length} 个 Orca 池子`);


        // 分类收集池子数据
        const solPools: any[] = [];
        const mainstreamPools: any[] = [];
        const otherKnownPools: any[] = [];

        console.log("🔍 正在分析池子数据，寻找主流代币交易对...");

        let analyzedCount = 0;
        let liquidityCount = 0;
        let knownTokenCount = 0;

        for (let i = 0; i < Math.min(100, accounts.length) && analyzedCount < 50; i++) {
            const account = accounts[i];

            // 静默模式分析池子
            const poolInfo = await analyzeOrcaPoolData(connection, account.pubkey, account.account.data, true);
            analyzedCount++;

            if (poolInfo.hasLiquidity) {
                liquidityCount++;
                console.log(`💧 发现有流动性的池子: ${poolInfo.tokenASymbol}/${poolInfo.tokenBSymbol} (${poolInfo.pairType})`);
            }

            if (poolInfo.pairType !== 'UNKNOWN') {
                knownTokenCount++;
            }

            // 只显示有流动性的池子且为已知代币对的池子
            if (poolInfo.hasLiquidity && poolInfo.pairType !== 'UNKNOWN') {
                const poolData = {
                    account: account,
                    liquidity: poolInfo.liquidity,
                    containsSOL: poolInfo.containsSOL,
                    tokenASymbol: poolInfo.tokenASymbol,
                    tokenBSymbol: poolInfo.tokenBSymbol,
                    tokenAAddress: poolInfo.tokenAAddress,
                    tokenBAddress: poolInfo.tokenBAddress,
                    pairType: poolInfo.pairType
                };

                // 按类型分类存储
                switch (poolInfo.pairType) {
                    case 'SOL':
                        solPools.push(poolData);
                        break;
                    case 'MAINSTREAM':
                        mainstreamPools.push(poolData);
                        break;
                    case 'OTHER':
                        otherKnownPools.push(poolData);
                        break;
                }
            }
        }

        console.log(`\n🔍 分析统计:`);
        console.log(`   📊 总共分析: ${analyzedCount} 个池子`);
        console.log(`   💧 有流动性: ${liquidityCount} 个池子`);
        console.log(`   🏷️  已知代币: ${knownTokenCount} 个池子`);

        // 按流动性排序各类池子
        const sortByLiquidity = (a: any, b: any) => {
            if (a.liquidity.gt(b.liquidity)) return -1;
            if (a.liquidity.lt(b.liquidity)) return 1;
            return 0;
        };

        solPools.sort(sortByLiquidity);
        mainstreamPools.sort(sortByLiquidity);
        otherKnownPools.sort(sortByLiquidity);

        console.log(`\n📊 发现主流代币交易对统计:`);
        console.log(`   🎯 SOL 交易对: ${solPools.length} 个`);
        console.log(`   💎 主流代币交易对: ${mainstreamPools.length} 个`);
        console.log(`   🔹 其他已知代币交易对: ${otherKnownPools.length} 个`);

        // 显示函数
        const displayPools = (pools: any[], title: string, emoji: string) => {
            if (pools.length === 0) return;

            console.log(`\n${emoji} ${title}（按流动性排序）:`);
            pools.forEach((poolData, index) => {
                console.log(`\n${title.includes('SOL') ? '🎯' : '💎'} 池子 ${index + 1}:`);
                console.log(`  地址: ${poolData.account.pubkey.toBase58()}`);
                console.log(`  💰 交易对: ${poolData.tokenASymbol} / ${poolData.tokenBSymbol}`);
                console.log(`  💧 流动性: ${poolData.liquidity.toString()}`);
                console.log(`  🏷️  类型: ${poolData.pairType}`);
            });
        };

        // 按优先级显示
        displayPools(solPools, 'SOL 交易对', '🎯');
        displayPools(mainstreamPools, '主流代币交易对', '💎');

        // 如果前两类都没有，显示其他已知代币交易对
        if (solPools.length === 0 && mainstreamPools.length === 0) {
            displayPools(otherKnownPools.slice(0, 3), '其他已知代币交易对', '🔹');
        }


        // 推荐逻辑
        let recommendedPool: any = null;
        let recommendationType = "";

        if (solPools.length > 0) {
            recommendedPool = solPools[0];
            recommendationType = "SOL 交易对";
        } else if (mainstreamPools.length > 0) {
            recommendedPool = mainstreamPools[0];
            recommendationType = "主流代币交易对";
        } else if (otherKnownPools.length > 0) {
            recommendedPool = otherKnownPools[0];
            recommendationType = "已知代币交易对";
        }

        if (recommendedPool) {
            console.log(`\n💡 推荐使用第一个${recommendationType}进行测试:`);
            console.log(`   池子地址: ${recommendedPool.account.pubkey.toBase58()}`);
            console.log(`   交易对: ${recommendedPool.tokenASymbol} / ${recommendedPool.tokenBSymbol}`);
            console.log(`   流动性: ${recommendedPool.liquidity.toString()}`);

            // 返回所有符合条件的池子，优先级排序
            return [...solPools, ...mainstreamPools, ...otherKnownPools].map(p => p.account);
        } else {
            console.log("\n❌ 没有找到包含主流代币的有流动性池子");
            console.log("💡 建议检查 KNOWN_TOKEN_SYMBOLS 映射或尝试其他代币");
            return [];
        }

    } catch (error) {
        console.error("❌ 搜索 Orca 池子时出错:", error);
        return [];
    }
}



async function main() {
    console.log("🚀 Devnet 池子查找工具 (Raydium 与 Orca)");
    console.log("=".repeat(60));

    // 1. 查找 Raydium 池子 - 打印详细日志
    await findRaydiumDevnetPools();

    // 2. 查找 Orca 池子 - 打印详细日志
    await findOrcaPools();

}

main().catch(console.error);
