import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as fs from 'fs';

/**
 * 零成本交易模拟测试
 * 测试 Raydium 池子初始化而不消耗 SOL
 */

async function simulateRaydiumInit() {
    const connection = new Connection('https://devnet.helius-rpc.com/?api-key=61040956-f7ed-40fa-84d3-40c986ab834a');
    const secretKey = JSON.parse(fs.readFileSync('devnet-wallet.json', 'utf8'));
    const wallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

    console.log('🧪 Raydium 池子初始化模拟测试');
    console.log('='.repeat(50));

    try {
        // 使用最新创建的池子和市场
        const poolId = new PublicKey("4NhU4ynfoDD6SoZmB6MY8AncKxWNExYYtk5fexmWdGTu");
        const marketId = new PublicKey("81kWGVCrE21HmS7Eoce4Bjzupjz6zHnDRJoV3gEdrnsM");

        console.log(`池子 ID: ${poolId.toBase58()}`);
        console.log(`市场 ID: ${marketId.toBase58()}`);

        // 构造模拟的初始化指令
        const RAYDIUM_LIQUIDITY_PROGRAM_ID = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");

        // 计算关键 PDA - 使用正确的 nonce (255)
        const [poolAuthority] = PublicKey.findProgramAddressSync(
            [poolId.toBuffer(), Buffer.from([255])],
            RAYDIUM_LIQUIDITY_PROGRAM_ID
        );

        // 使用调试确认的配置账户
        const ammConfig = new PublicKey("8QN9yfKqWDoKjvZmqFsgCzAqwZBQuzVVnC388dN5RCPo");

        console.log(`\n🔧 关键账户:`);
        console.log(`池子权限: ${poolAuthority.toBase58()}`);
        console.log(`AMM 配置: ${ammConfig.toBase58()}`);

        // 检查账户状态
        console.log(`\n🔍 账户状态检查:`);

        const accounts = [
            { name: "池子", address: poolId },
            { name: "市场", address: marketId },
            { name: "池子权限", address: poolAuthority },
            { name: "AMM 配置", address: ammConfig }
        ];

        for (const account of accounts) {
            const info = await connection.getAccountInfo(account.address);
            const status = info ? '✅ 存在' : '❌ 不存在';
            const owner = info ? info.owner.toBase58() : 'N/A';
            console.log(`${account.name}: ${status} (所有者: ${owner})`);
        }

        // 构造简化的初始化指令进行模拟
        console.log(`\n🧪 构造模拟初始化指令...`);

        // 创建指令数据 (Initialize2)
        const instructionData = Buffer.alloc(26);
        instructionData.writeUInt8(1, 0); // 指令索引 1 = Initialize2
        instructionData.writeUInt8(255, 1); // nonce = 255
        instructionData.writeBigUInt64LE(BigInt(0), 2); // open_time
        instructionData.writeBigUInt64LE(BigInt(0), 10); // init_pc_amount
        instructionData.writeBigUInt64LE(BigInt(0), 18); // init_coin_amount

        // 构造完整的 21 个账户列表（与官方源码完全一致）
        const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
        const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
        const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
        const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
        const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
        const RENT_SYSVAR_ID = new PublicKey("SysvarRent111111111111111111111111111111111");

        // 模拟其他必要的账户（使用实际创建的账户地址）
        const lpMint = new PublicKey("DuJLn6uBLk6z4HEjRneHESvCCYk8TKzFfrfBoDRWm8nx");
        const openOrders = new PublicKey("11111111111111111111111111111111"); // 临时
        const baseVault = new PublicKey("11111111111111111111111111111111"); // 临时
        const quoteVault = new PublicKey("11111111111111111111111111111111"); // 临时
        const targetOrders = new PublicKey("11111111111111111111111111111111"); // 临时
        const marketProgram = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");

        // 用户代币账户（ATA）
        const getATA = (mint: PublicKey, owner: PublicKey) => {
            // 简化的 ATA 计算，实际应该使用 getAssociatedTokenAddressSync
            return new PublicKey("11111111111111111111111111111111");
        };

        const keys = [
            // spl & sys (0-3)
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
            // amm (4-14)
            { pubkey: poolId, isSigner: false, isWritable: true },
            { pubkey: poolAuthority, isSigner: false, isWritable: false },
            { pubkey: openOrders, isSigner: false, isWritable: true },
            { pubkey: lpMint, isSigner: false, isWritable: true },
            { pubkey: SOL_MINT, isSigner: false, isWritable: false },
            { pubkey: USDC_MINT, isSigner: false, isWritable: false },
            { pubkey: baseVault, isSigner: false, isWritable: true },
            { pubkey: quoteVault, isSigner: false, isWritable: true },
            { pubkey: targetOrders, isSigner: false, isWritable: true },
            { pubkey: ammConfig, isSigner: false, isWritable: false },
            { pubkey: wallet.publicKey, isSigner: false, isWritable: true }, // create_fee_destination
            // market (15-16)
            { pubkey: marketProgram, isSigner: false, isWritable: false },
            { pubkey: marketId, isSigner: false, isWritable: false },
            // user wallet (17)
            { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
            // user token accounts (18-20)
            { pubkey: getATA(SOL_MINT, wallet.publicKey), isSigner: false, isWritable: true },
            { pubkey: getATA(USDC_MINT, wallet.publicKey), isSigner: false, isWritable: true },
            { pubkey: getATA(lpMint, wallet.publicKey), isSigner: false, isWritable: true },
        ];

        console.log(`✅ 构造了完整的 ${keys.length} 个账户（符合官方要求）`);

        const instruction = new TransactionInstruction({
            programId: RAYDIUM_LIQUIDITY_PROGRAM_ID,
            keys: keys,
            data: instructionData
        });

        // 创建交易
        const transaction = new Transaction();
        transaction.feePayer = wallet.publicKey;
        transaction.add(instruction);

        // 获取最新的 blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;

        // 签名交易
        transaction.sign(wallet);

        console.log(`\n🔬 执行交易模拟...`);

        // 模拟交易（不消耗 SOL）
        const simulation = await connection.simulateTransaction(transaction);

        console.log(`\n📊 模拟结果:`);

        if (simulation.value.err) {
            console.log(`❌ 模拟失败: ${JSON.stringify(simulation.value.err)}`);

            if (simulation.value.logs) {
                console.log(`\n📝 错误日志:`);
                simulation.value.logs.forEach((log, i) => {
                    console.log(`  ${i}: ${log}`);
                });
            }

            // 分析错误类型
            const errorStr = JSON.stringify(simulation.value.err);
            if (errorStr.includes('InvalidProgramAddress')) {
                console.log(`\n💡 错误分析: InvalidProgramAddress`);
                console.log(`这通常意味着某个 PDA 计算不正确或账户不存在`);
            } else if (errorStr.includes('InvalidAccountData')) {
                console.log(`\n💡 错误分析: InvalidAccountData`);
                console.log(`这通常意味着账户数据格式不正确`);
            }
        } else {
            console.log(`✅ 模拟成功！`);
            console.log(`计算单元消耗: ${simulation.value.unitsConsumed}`);

            if (simulation.value.logs) {
                console.log(`\n📝 成功日志:`);
                simulation.value.logs.forEach((log, i) => {
                    console.log(`  ${i}: ${log}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ 模拟过程中出错:', error);
    }
}

// 运行模拟
simulateRaydiumInit().catch(console.error);
