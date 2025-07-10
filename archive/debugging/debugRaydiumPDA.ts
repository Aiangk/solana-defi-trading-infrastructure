import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import * as fs from 'fs';

/**
 * 不消耗 SOL 的 PDA 调试工具
 * 使用交易模拟来分析 InvalidProgramAddress 错误
 */

async function debugRaydiumPDA() {
    const connection = new Connection('https://devnet.helius-rpc.com/?api-key=61040956-f7ed-40fa-84d3-40c986ab834a');
    const secretKey = JSON.parse(fs.readFileSync('devnet-wallet.json', 'utf8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
    
    // 常量定义
    const RAYDIUM_LIQUIDITY_PROGRAM_ID = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");
    const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
    const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
    
    console.log('🔍 Raydium PDA 调试工具 - 零成本分析');
    console.log('=' .repeat(60));
    
    try {
        // 1. 分析 Raydium 官方 PDA 计算方法
        console.log('\n📊 步骤1: 分析 Raydium 官方 PDA 计算');
        
        // 模拟池子 ID（使用固定种子以便重现）
        const poolSeed = "test-pool-seed";
        const poolId = Keypair.fromSeed(Buffer.from(poolSeed.padEnd(32, '0').slice(0, 32)));
        
        console.log(`池子 ID: ${poolId.publicKey.toBase58()}`);
        
        // 2. 计算所有相关的 PDA
        console.log('\n🔧 步骤2: 计算关键 PDA 地址');
        
        // 2.1 池子权限 PDA
        const [poolAuthority, poolAuthorityBump] = PublicKey.findProgramAddressSync(
            [poolId.publicKey.toBuffer()],
            RAYDIUM_LIQUIDITY_PROGRAM_ID
        );
        console.log(`池子权限 PDA: ${poolAuthority.toBase58()} (bump: ${poolAuthorityBump})`);
        
        // 2.2 AMM 配置 PDA
        const [ammConfig, ammConfigBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("amm_config_account_seed")],
            RAYDIUM_LIQUIDITY_PROGRAM_ID
        );
        console.log(`AMM 配置 PDA: ${ammConfig.toBase58()} (bump: ${ammConfigBump})`);
        
        // 2.3 创建费用目标 PDA
        const [createFeeDestination, createFeeBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("create_fee_destination_seed")],
            RAYDIUM_LIQUIDITY_PROGRAM_ID
        );
        console.log(`创建费用目标 PDA: ${createFeeDestination.toBase58()} (bump: ${createFeeBump})`);
        
        // 3. 验证 PDA 是否存在于链上
        console.log('\n🔍 步骤3: 验证 PDA 账户状态');
        
        const pdaAccounts = [
            { name: "池子权限", address: poolAuthority },
            { name: "AMM 配置", address: ammConfig },
            { name: "创建费用目标", address: createFeeDestination }
        ];
        
        for (const pda of pdaAccounts) {
            try {
                const accountInfo = await connection.getAccountInfo(pda.address);
                if (accountInfo) {
                    console.log(`✅ ${pda.name}: 存在 (所有者: ${accountInfo.owner.toBase58()})`);
                } else {
                    console.log(`❌ ${pda.name}: 不存在 - 这可能是问题所在！`);
                }
            } catch (error) {
                console.log(`⚠️  ${pda.name}: 查询失败 - ${error}`);
            }
        }
        
        // 4. 分析 Raydium 源码中的 PDA 种子
        console.log('\n📚 步骤4: Raydium 官方 PDA 种子分析');
        console.log('根据 Raydium 源码，常见的 PDA 种子包括:');
        console.log('- 池子权限: [pool_id]');
        console.log('- AMM 配置: ["amm_config_account_seed"] 或 ["amm_config"]');
        console.log('- 创建费用: ["create_fee_destination_seed"] 或 ["fee_destination"]');
        
        // 5. 尝试不同的种子组合
        console.log('\n🧪 步骤5: 尝试不同的 PDA 种子组合');
        
        const seedVariations = [
            ["amm_config"],
            ["amm_config_account_seed"],
            ["config"],
            ["fee_destination"],
            ["create_fee_destination_seed"]
        ];
        
        for (const seeds of seedVariations) {
            try {
                const [pda, bump] = PublicKey.findProgramAddressSync(
                    seeds.map(s => Buffer.from(s)),
                    RAYDIUM_LIQUIDITY_PROGRAM_ID
                );
                
                const accountInfo = await connection.getAccountInfo(pda);
                const status = accountInfo ? '✅ 存在' : '❌ 不存在';
                console.log(`种子 [${seeds.join(', ')}]: ${pda.toBase58()} ${status}`);
            } catch (error) {
                console.log(`种子 [${seeds.join(', ')}]: 计算失败`);
            }
        }
        
        // 6. 检查现有的 Raydium 池子作为参考
        console.log('\n🔍 步骤6: 查找现有 Raydium 池子作为参考');
        
        // 这些是一些已知的 mainnet Raydium 池子，我们可以分析它们的结构
        const knownPools = [
            "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2", // SOL-USDC
            "7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX"  // RAY-USDC
        ];
        
        console.log('分析已知池子的 PDA 模式...');
        for (const poolAddress of knownPools) {
            try {
                const poolPubkey = new PublicKey(poolAddress);
                const [authority] = PublicKey.findProgramAddressSync(
                    [poolPubkey.toBuffer()],
                    RAYDIUM_LIQUIDITY_PROGRAM_ID
                );
                console.log(`池子 ${poolAddress} -> 权限: ${authority.toBase58()}`);
            } catch (error) {
                console.log(`池子 ${poolAddress}: 分析失败`);
            }
        }
        
        // 7. 生成修复建议
        console.log('\n💡 步骤7: PDA 错误修复建议');
        console.log('基于分析，可能的问题和解决方案:');
        console.log('');
        console.log('1. AMM 配置账户不存在:');
        console.log('   - 检查是否使用了正确的种子');
        console.log('   - 可能需要先初始化 AMM 配置账户');
        console.log('');
        console.log('2. 创建费用目标账户不存在:');
        console.log('   - 检查 Raydium devnet 是否已部署此账户');
        console.log('   - 可能需要使用不同的费用目标');
        console.log('');
        console.log('3. 池子权限计算错误:');
        console.log('   - 确保使用正确的池子 ID');
        console.log('   - 检查 bump seed 是否正确');
        
    } catch (error) {
        console.error('❌ 调试过程中出错:', error);
    }
}

// 运行调试
debugRaydiumPDA().catch(console.error);
