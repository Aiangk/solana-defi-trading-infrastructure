import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    NATIVE_MINT,
    createInitializeAccountInstruction,
    createCloseAccountInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { LiquidityPoolKeys } from "@raydium-io/raydium-sdk";
import BN = require('bn.js');

// 常量定义
const RAYDIUM_LIQUIDITY_PROGRAM_ID = new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8");
const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

// Swap 指令构造结果接口
export interface SwapInstructionResult {
    instructions: TransactionInstruction[];
    signers: Keypair[];
}

/**
 * 手动构造 Raydium swap 指令的核心函数
 * 这是完整的 swap 指令构造过程，包括 WSOL 处理和账户管理
 */
export async function createRaydiumSwapInstructionOfficial({
    connection,
    wallet,
    poolKeys,
    userSourceTokenAccount,
    userDestinationTokenAccount,
    amountIn,
    minAmountOut,
}: {
    connection: Connection;
    wallet: PublicKey;
    poolKeys: LiquidityPoolKeys;
    userSourceTokenAccount: PublicKey;
    userDestinationTokenAccount: PublicKey;
    amountIn: BN;
    minAmountOut: BN;
}): Promise<SwapInstructionResult> {
    console.log("🔧 开始手动构造 Raydium swap 指令...");

    const instructions: TransactionInstruction[] = [];
    const signers: Keypair[] = [];

    // 1. 检查并创建必要的代币账户
    console.log("🔍 检查用户代币账户...");

    try {
        await connection.getAccountInfo(userDestinationTokenAccount);
        console.log("✅ USDC 账户已存在");
    } catch (error) {
        console.log("🔧 创建 USDC 关联代币账户...");
        instructions.push(
            createAssociatedTokenAccountInstruction(
                wallet,
                userDestinationTokenAccount,
                wallet,
                USDC_MINT
            )
        );
    }

    // 2. WSOL 处理 - 创建临时账户
    console.log("🔄 处理 WSOL 账户...");

    // 创建临时 WSOL 账户来处理原生 SOL
    const tempWsolAccount = Keypair.generate();
    const rentExemption = await connection.getMinimumBalanceForRentExemption(165);

    console.log(`💰 创建临时 WSOL 账户: ${tempWsolAccount.publicKey.toBase58()}`);
    console.log(`💰 租金豁免金额: ${rentExemption / 10 ** 9} SOL`);
    console.log(`💰 总转入金额: ${(amountIn.toNumber() + rentExemption) / 10 ** 9} SOL`);

    // 2.1 创建临时 WSOL 账户
    instructions.push(
        SystemProgram.createAccount({
            fromPubkey: wallet,
            newAccountPubkey: tempWsolAccount.publicKey,
            lamports: amountIn.add(new BN(rentExemption)).toNumber(),
            space: 165, // SPL Token 账户的标准大小
            programId: TOKEN_PROGRAM_ID,
        })
    );

    // 2.2 初始化 WSOL 账户
    instructions.push(
        createInitializeAccountInstruction(
            tempWsolAccount.publicKey,
            NATIVE_MINT, // Wrapped SOL 的 mint 地址
            wallet
        )
    );

    signers.push(tempWsolAccount);

    // 3. 构造 Raydium swap 指令
    console.log("📋 构造官方格式的 swap 指令...");

    // 3.1 构造指令数据
    // Raydium swap 指令格式：[指令索引(1字节), 输入金额(8字节), 最小输出金额(8字节)]
    const instructionData = Buffer.concat([
        Buffer.from([9]), // Raydium swap 指令的索引
        amountIn.toArrayLike(Buffer, 'le', 8), // 输入金额 (8字节，小端序)
        minAmountOut.toArrayLike(Buffer, 'le', 8), // 最小输出金额 (8字节，小端序)
    ]);

    console.log("📊 指令数据详情:");
    console.log(`   指令索引: 9 (swap)`);
    console.log(`   输入金额: ${amountIn.toString()} (${amountIn.toNumber() / 10 ** 9} SOL)`);
    console.log(`   最小输出: ${minAmountOut.toString()} (${minAmountOut.toNumber() / 10 ** 6} USDC)`);

    // 3.2 构造账户列表
    // Raydium swap 需要的所有账户，顺序很重要！
    const swapInstruction = new TransactionInstruction({
        keys: [
            // SPL Token 程序
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },

            // AMM 相关账户
            { pubkey: poolKeys.id, isSigner: false, isWritable: true },
            { pubkey: poolKeys.authority, isSigner: false, isWritable: false },
            { pubkey: poolKeys.openOrders, isSigner: false, isWritable: true },
            { pubkey: poolKeys.targetOrders, isSigner: false, isWritable: true },
            { pubkey: poolKeys.baseVault, isSigner: false, isWritable: true },
            { pubkey: poolKeys.quoteVault, isSigner: false, isWritable: true },

            // Serum 市场相关账户
            { pubkey: poolKeys.marketProgramId, isSigner: false, isWritable: false },
            { pubkey: poolKeys.marketId, isSigner: false, isWritable: true },
            { pubkey: poolKeys.marketBids, isSigner: false, isWritable: true },
            { pubkey: poolKeys.marketAsks, isSigner: false, isWritable: true },
            { pubkey: poolKeys.marketEventQueue, isSigner: false, isWritable: true },
            { pubkey: poolKeys.marketBaseVault, isSigner: false, isWritable: true },
            { pubkey: poolKeys.marketQuoteVault, isSigner: false, isWritable: true },
            { pubkey: poolKeys.marketAuthority, isSigner: false, isWritable: false },

            // 用户账户
            { pubkey: tempWsolAccount.publicKey, isSigner: false, isWritable: true }, // 用户 SOL 账户
            { pubkey: userDestinationTokenAccount, isSigner: false, isWritable: true }, // 用户 USDC 账户
            { pubkey: wallet, isSigner: true, isWritable: false }, // 用户钱包
        ],
        programId: RAYDIUM_LIQUIDITY_PROGRAM_ID, // Devnet AMM 程序 ID
        data: instructionData,
    });

    instructions.push(swapInstruction);

    // 4. 关闭临时 WSOL 账户，回收租金
    console.log("🔄 添加 WSOL 账户关闭指令...");
    instructions.push(
        createCloseAccountInstruction(
            tempWsolAccount.publicKey,
            wallet, // 租金接收者
            wallet  // 账户所有者
        )
    );

    console.log("✅ 所有指令构造完成！");
    console.log(`📊 总共 ${instructions.length} 个指令:`);
    console.log("   1. 创建关联代币账户 (如需要)");
    console.log("   2. 创建临时 WSOL 账户");
    console.log("   3. 初始化 WSOL 账户");
    console.log("   4. 执行 Raydium swap");
    console.log("   5. 关闭临时 WSOL 账户");

    return { instructions, signers };
}

/**
 * 验证 swap 指令参数
 * 确保所有参数都是有效的
 */
export function validateSwapParameters({
    poolKeys,
    amountIn,
    minAmountOut,
}: {
    poolKeys: LiquidityPoolKeys;
    amountIn: BN;
    minAmountOut: BN;
}): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查金额
    if (amountIn.lte(new BN(0))) {
        errors.push("输入金额必须大于 0");
    }

    if (minAmountOut.lte(new BN(0))) {
        errors.push("最小输出金额必须大于 0");
    }

    if (amountIn.lt(new BN(1000))) { // 最小 0.000001 SOL
        errors.push("输入金额太小，最小值为 0.000001 SOL");
    }

    // 检查池子密钥
    if (!poolKeys.id || poolKeys.id.equals(PublicKey.default)) {
        errors.push("无效的池子 ID");
    }

    if (!poolKeys.authority || poolKeys.authority.equals(PublicKey.default)) {
        errors.push("无效的池子权限账户");
    }

    if (!poolKeys.baseVault || poolKeys.baseVault.equals(PublicKey.default)) {
        errors.push("无效的基础代币金库");
    }

    if (!poolKeys.quoteVault || poolKeys.quoteVault.equals(PublicKey.default)) {
        errors.push("无效的报价代币金库");
    }

    // 检查滑点是否合理
    const slippagePercent = (amountIn.sub(minAmountOut)).mul(new BN(10000)).div(amountIn).toNumber() / 100;
    if (slippagePercent > 50) {
        errors.push(`滑点过大: ${slippagePercent.toFixed(2)}%，建议小于 5%`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * 分析指令构造结果
 * 用于调试和学习目的
 */
export function analyzeSwapInstructions(result: SwapInstructionResult): void {
    console.log("\n🔍 Swap 指令分析:");
    console.log("=".repeat(50));

    result.instructions.forEach((instruction, index) => {
        console.log(`\n指令 ${index + 1}:`);
        console.log(`  程序 ID: ${instruction.programId.toBase58()}`);
        console.log(`  账户数量: ${instruction.keys.length}`);
        console.log(`  数据长度: ${instruction.data.length} 字节`);

        // 识别指令类型
        if (instruction.programId.equals(TOKEN_PROGRAM_ID)) {
            if (instruction.data.length === 1 && instruction.data[0] === 1) {
                console.log(`  类型: 初始化代币账户`);
            } else if (instruction.data.length === 1 && instruction.data[0] === 9) {
                console.log(`  类型: 关闭代币账户`);
            } else {
                console.log(`  类型: SPL Token 操作`);
            }
        } else if (instruction.programId.equals(SystemProgram.programId)) {
            console.log(`  类型: 系统程序操作 (创建账户)`);
        } else if (instruction.programId.equals(RAYDIUM_LIQUIDITY_PROGRAM_ID)) {
            console.log(`  类型: Raydium swap 操作`);
            if (instruction.data.length >= 17) {
                const instructionIndex = instruction.data[0];
                const amountIn = new BN(instruction.data.slice(1, 9), 'le');
                const minAmountOut = new BN(instruction.data.slice(9, 17), 'le');

                console.log(`    指令索引: ${instructionIndex}`);
                console.log(`    输入金额: ${amountIn.toString()}`);
                console.log(`    最小输出: ${minAmountOut.toString()}`);
            }
        } else {
            console.log(`  类型: 未知程序`);
        }

        // 显示可写账户
        const writableAccounts = instruction.keys.filter(key => key.isWritable);
        console.log(`  可写账户: ${writableAccounts.length} 个`);

        // 显示签名者
        const signers = instruction.keys.filter(key => key.isSigner);
        console.log(`  签名者: ${signers.length} 个`);
    });

    console.log(`\n📊 总体统计:`);
    console.log(`  总指令数: ${result.instructions.length}`);
    console.log(`  总签名者: ${result.signers.length}`);
    console.log(`  预估计算单元: ${estimateComputeUnits(result)}`);
    console.log("=".repeat(50));
}

/**
 * 估算交易的计算单元消耗
 * 帮助设置合适的计算单元限制
 */
function estimateComputeUnits(result: SwapInstructionResult): number {
    let totalUnits = 0;

    result.instructions.forEach(instruction => {
        if (instruction.programId.equals(SystemProgram.programId)) {
            totalUnits += 1000; // 系统程序操作
        } else if (instruction.programId.equals(TOKEN_PROGRAM_ID)) {
            totalUnits += 3000; // SPL Token 操作
        } else if (instruction.programId.equals(RAYDIUM_LIQUIDITY_PROGRAM_ID)) {
            totalUnits += 50000; // Raydium swap 操作
        } else {
            totalUnits += 5000; // 其他程序
        }
    });

    return totalUnits;
}

/**
 * 创建计算单元限制指令
 * 为交易设置合适的计算单元限制
 */
export function createComputeBudgetInstructions(
    computeUnits: number,
    microLamports: number = 1
): TransactionInstruction[] {
    const instructions: TransactionInstruction[] = [];

    // 设置计算单元限制
    const setComputeUnitLimitInstruction = new TransactionInstruction({
        keys: [],
        programId: new PublicKey("ComputeBudget111111111111111111111111111111"),
        data: Buffer.concat([
            Buffer.from([2]), // SetComputeUnitLimit 指令
            new BN(computeUnits).toArrayLike(Buffer, 'le', 4),
        ]),
    });

    // 设置计算单元价格
    const setComputeUnitPriceInstruction = new TransactionInstruction({
        keys: [],
        programId: new PublicKey("ComputeBudget111111111111111111111111111111"),
        data: Buffer.concat([
            Buffer.from([3]), // SetComputeUnitPrice 指令
            new BN(microLamports).toArrayLike(Buffer, 'le', 8),
        ]),
    });

    instructions.push(setComputeUnitLimitInstruction);
    instructions.push(setComputeUnitPriceInstruction);

    return instructions;
}
