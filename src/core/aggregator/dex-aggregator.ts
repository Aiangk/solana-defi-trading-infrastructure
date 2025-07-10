import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { 
    getAssociatedTokenAddress, 
    getAccount, 
    createAssociatedTokenAccountInstruction,
    createSyncNativeInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    NATIVE_MINT
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";

import { DEXProtocol, DEXQuote, AggregatedRoute } from "../../types/dex/protocol";
import { getEnabledDEXConfigs } from "../../config/dex-config";

/**
 * DEX聚合器
 * 负责聚合多个DEX的报价，选择最优路径，并构建完整的交易指令
 */
export class DEXAggregator {
    private _connection: Connection;
    private _protocols: DEXProtocol[];

    /**
     * 构造函数
     * @param connection Solana连接实例
     * @param protocols 支持的DEX协议列表
     */
    constructor(connection: Connection, protocols: DEXProtocol[]) {
        this._connection = connection;
        this._protocols = protocols;
        
        console.log(`🔗 DEX聚合器初始化完成，支持 ${protocols.length} 个协议:`);
        protocols.forEach(protocol => {
            console.log(`   - ${protocol.name}: ${protocol.programId.toBase58()}`);
        });
    }

    /**
     * 获取聚合报价
     * 从所有启用的DEX获取报价，并选择最优方案
     * @param tokenA 输入代币mint地址
     * @param tokenB 输出代币mint地址
     * @param amount 输入金额
     * @param slippage 滑点容忍度
     * @returns 聚合路由结果
     */
    async getAggregatedQuote(
        tokenA: PublicKey,
        tokenB: PublicKey,
        amount: BN,
        slippage: number
    ): Promise<AggregatedRoute> {
        console.log(`🔍 开始聚合报价查询...`);
        console.log(`   输入代币: ${tokenA.toBase58()}`);
        console.log(`   输出代币: ${tokenB.toBase58()}`);
        console.log(`   输入金额: ${amount.toString()}`);
        console.log(`   滑点容忍: ${(slippage * 100).toFixed(2)}%`);

        const quotes: DEXQuote[] = [];
        const enabledConfigs = getEnabledDEXConfigs();

        // 并行获取所有DEX的报价
        const quotePromises = this._protocols
            .filter(protocol => enabledConfigs.some(config => config.name === protocol.name))
            .map(async (protocol) => {
                try {
                    console.log(`   📊 查询 ${protocol.name} 报价...`);
                    const quote = await protocol.getQuote(tokenA, tokenB, amount, slippage);
                    console.log(`   ✅ ${protocol.name} 报价: ${quote.outputAmount.toString()}`);
                    return quote;
                } catch (error) {
                    console.log(`   ❌ ${protocol.name} 报价失败: ${error}`);
                    return null;
                }
            });

        const results = await Promise.all(quotePromises);
        quotes.push(...results.filter(quote => quote !== null) as DEXQuote[]);

        if (quotes.length === 0) {
            throw new Error("所有DEX报价都失败了");
        }

        // 选择最优报价 (输出金额最大的)
        const bestQuote = quotes.reduce((best, current) => 
            current.outputAmount.gt(best.outputAmount) ? current : best
        );

        // 计算节省金额
        const secondBest = quotes
            .filter(q => q.dexName !== bestQuote.dexName)
            .reduce((best, current) => 
                !best || current.outputAmount.gt(best.outputAmount) ? current : best, 
                null as DEXQuote | null
            );

        const totalSavings = secondBest 
            ? bestQuote.outputAmount.sub(secondBest.outputAmount)
            : new BN(0);

        console.log(`🎯 最优选择: ${bestQuote.dexName}`);
        console.log(`   最佳输出: ${bestQuote.outputAmount.toString()}`);
        console.log(`   价格影响: ${(bestQuote.priceImpact * 100).toFixed(4)}%`);
        console.log(`   节省金额: ${totalSavings.toString()}`);

        return {
            bestQuote,
            allQuotes: quotes.sort((a, b) => b.outputAmount.cmp(a.outputAmount)),
            recommendedDEX: bestQuote.dexName,
            totalSavings,
            executionStrategy: 'SINGLE'
        };
    }

    /**
     * 执行最优交换
     * 使用最佳DEX执行交换操作
     * @param route 聚合路由结果
     * @param userWallet 用户钱包地址
     * @param tokenAccountA 代币A账户地址
     * @param tokenAccountB 代币B账户地址
     * @returns 交换指令
     */
    async executeOptimalSwap(
        route: AggregatedRoute,
        userWallet: PublicKey,
        tokenAccountA: PublicKey,
        tokenAccountB: PublicKey
    ): Promise<TransactionInstruction> {
        console.log(`🚀 执行最优交换: ${route.recommendedDEX}`);

        const protocol = this._protocols.find(p => p.name === route.recommendedDEX);
        if (!protocol) {
            throw new Error(`未找到协议: ${route.recommendedDEX}`);
        }

        // 构建交换指令
        return await protocol.buildSwapInstruction(
            route.bestQuote,
            userWallet,
            tokenAccountA,
            tokenAccountB
        );
    }

    /**
     * 构建完整的交换交易
     * 包括代币账户创建、SOL包装等预处理指令
     * @param route 聚合路由结果
     * @param userWallet 用户钱包地址
     * @param tokenMintA 输入代币mint地址
     * @param tokenMintB 输出代币mint地址
     * @returns 完整的交易指令数组
     */
    async buildCompleteSwapTransaction(
        route: AggregatedRoute,
        userWallet: PublicKey,
        tokenMintA: PublicKey,
        tokenMintB: PublicKey
    ): Promise<TransactionInstruction[]> {
        console.log("🔧 构建完整的交换交易...");
        
        const instructions: TransactionInstruction[] = [];
        
        // 获取代币账户地址
        const tokenAccountA = await getAssociatedTokenAddress(tokenMintA, userWallet);
        const tokenAccountB = await getAssociatedTokenAddress(tokenMintB, userWallet);
        
        console.log(`   代币账户A: ${tokenAccountA.toBase58()}`);
        console.log(`   代币账户B: ${tokenAccountB.toBase58()}`);

        // 检查并创建代币账户A
        await this._ensureTokenAccount(
            instructions, 
            userWallet, 
            tokenAccountA, 
            tokenMintA, 
            route,
            true // 是输入代币
        );

        // 检查并创建代币账户B
        await this._ensureTokenAccount(
            instructions, 
            userWallet, 
            tokenAccountB, 
            tokenMintB, 
            route,
            false // 是输出代币
        );
        
        // 添加交换指令
        const swapIx = await this.executeOptimalSwap(
            route,
            userWallet,
            tokenAccountA,
            tokenAccountB
        );
        instructions.push(swapIx);
        
        console.log(`✅ 完整交易构建完成，共 ${instructions.length} 个指令`);
        return instructions;
    }

    /**
     * 确保代币账户存在，如果不存在则创建
     * @param instructions 指令数组
     * @param userWallet 用户钱包地址
     * @param tokenAccount 代币账户地址
     * @param tokenMint 代币mint地址
     * @param route 路由信息
     * @param isInputToken 是否为输入代币
     */
    private async _ensureTokenAccount(
        instructions: TransactionInstruction[],
        userWallet: PublicKey,
        tokenAccount: PublicKey,
        tokenMint: PublicKey,
        route: AggregatedRoute,
        isInputToken: boolean
    ): Promise<void> {
        try {
            await getAccount(this._connection, tokenAccount);
            console.log(`✅ 代币账户已存在: ${tokenAccount.toBase58()}`);
        } catch (error) {
            console.log(`🔨 创建代币账户: ${tokenAccount.toBase58()}`);
            
            // 创建关联代币账户
            const createAccountIx = createAssociatedTokenAccountInstruction(
                userWallet,     // 付费者
                tokenAccount,   // 要创建的代币账户地址
                userWallet,     // 代币账户所有者
                tokenMint,      // 代币mint
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            );
            instructions.push(createAccountIx);
            
            // 如果是SOL代币且是输入代币，需要包装SOL
            if (tokenMint.equals(NATIVE_MINT) && isInputToken) {
                console.log(`💰 包装 SOL 到 WSOL 账户`);
                
                // 转移SOL到WSOL账户
                const transferIx = SystemProgram.transfer({
                    fromPubkey: userWallet,
                    toPubkey: tokenAccount,
                    lamports: route.bestQuote.inputAmount.toNumber(),
                });
                instructions.push(transferIx);
                
                // 同步原生代币
                const syncIx = createSyncNativeInstruction(tokenAccount);
                instructions.push(syncIx);
            }
        }
    }
}
