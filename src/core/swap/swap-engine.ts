import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";

import { DEXAggregator } from "../aggregator/dex-aggregator";
import { TokenAccountManager } from "../account-manager/token-account-manager";
import { OrcaProtocol } from "../../protocols/orca/orca-protocol";
import { SwapParams, SwapResult, SwapDirection } from "../../types/swap/swap-types";
import { getTokenMint, NetworkType } from "../../config/network-config";
import { SWAP_CONFIG } from "../../config/dex-config";

/**
 * 交换引擎
 * 整合DEX聚合器、账户管理器等组件，提供完整的交换功能
 */
export class SwapEngine {
    private _connection: Connection;
    private _wallet: Wallet;
    private _aggregator: DEXAggregator;
    private _accountManager: TokenAccountManager;
    private _networkType: NetworkType;

    /**
     * 构造函数
     * @param connection Solana连接实例
     * @param wallet 钱包实例
     * @param networkType 网络类型
     */
    constructor(
        connection: Connection, 
        wallet: Wallet, 
        networkType: NetworkType = NetworkType.DEVNET
    ) {
        this._connection = connection;
        this._wallet = wallet;
        this._networkType = networkType;
        
        // 初始化组件
        this._accountManager = new TokenAccountManager(connection);
        
        // 初始化支持的协议
        const protocols = [
            new OrcaProtocol(connection, wallet)
            // 可以在这里添加更多协议: Raydium, Jupiter等
        ];
        
        this._aggregator = new DEXAggregator(connection, protocols);
        
        console.log(`🚀 交换引擎初始化完成 (${networkType})`);
    }

    /**
     * 执行交换操作
     * @param params 交换参数
     * @returns 交换结果
     */
    async executeSwap(params: SwapParams): Promise<SwapResult> {
        console.log("🔄 开始执行交换操作...");
        console.log(`   方向: ${params.direction}`);
        console.log(`   金额: ${params.inputAmount.toString()}`);
        console.log(`   滑点: ${(params.slippageTolerance * 100).toFixed(2)}%`);

        try {
            // 1. 验证参数
            this._validateSwapParams(params);

            // 2. 获取代币mint地址
            const { tokenMintA, tokenMintB } = this._getTokenMints(params.direction);

            // 3. 检查用户余额
            await this._checkUserBalance(params, tokenMintA);

            // 4. 获取聚合报价
            const route = await this._aggregator.getAggregatedQuote(
                tokenMintA,
                tokenMintB,
                params.inputAmount,
                params.slippageTolerance
            );

            console.log(`🎯 选择最优DEX: ${route.recommendedDEX}`);
            console.log(`   预期输出: ${route.bestQuote.outputAmount.toString()}`);

            // 5. 检查最小输出金额
            if (route.bestQuote.outputAmount.lt(params.minimumOutputAmount)) {
                throw new Error(
                    `输出金额 ${route.bestQuote.outputAmount.toString()} 低于最小要求 ${params.minimumOutputAmount.toString()}`
                );
            }

            // 6. 构建完整交易
            const instructions = await this._aggregator.buildCompleteSwapTransaction(
                route,
                this._wallet.publicKey,
                tokenMintA,
                tokenMintB
            );

            // 7. 发送交易
            const signature = await this._sendTransaction(instructions);

            // 8. 验证交易结果
            const result = await this._verifySwapResult(signature, route);

            console.log("✅ 交换操作完成!");
            console.log(`   交易签名: ${signature}`);
            console.log(`   实际输出: ${result.outputAmount.toString()}`);

            return result;

        } catch (error) {
            console.log(`❌ 交换操作失败: ${error}`);
            return {
                signature: "",
                inputAmount: params.inputAmount,
                outputAmount: new BN(0),
                priceImpact: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 获取交换报价 (不执行交换)
     * @param params 交换参数
     * @returns 聚合报价结果
     */
    async getSwapQuote(params: SwapParams) {
        console.log("💰 获取交换报价...");

        const { tokenMintA, tokenMintB } = this._getTokenMints(params.direction);

        return await this._aggregator.getAggregatedQuote(
            tokenMintA,
            tokenMintB,
            params.inputAmount,
            params.slippageTolerance
        );
    }

    /**
     * 获取用户代币余额
     * @param userWallet 用户钱包地址
     * @returns 代币余额信息
     */
    async getUserBalances(userWallet?: PublicKey) {
        const wallet = userWallet || this._wallet.publicKey;
        
        const tokenInfos = [
            {
                mint: getTokenMint('SOL', undefined, this._networkType),
                symbol: 'SOL',
                decimals: 9
            },
            {
                mint: getTokenMint('USDC', 'ORCA', this._networkType),
                symbol: 'devUSDC',
                decimals: 6
            }
        ];

        return await this._accountManager.getUserTokenBalances(wallet, tokenInfos);
    }

    /**
     * 验证交换参数
     * @param params 交换参数
     */
    private _validateSwapParams(params: SwapParams): void {
        if (params.inputAmount.lte(new BN(0))) {
            throw new Error("输入金额必须大于0");
        }

        if (params.slippageTolerance < 0 || params.slippageTolerance > SWAP_CONFIG.maxSlippage) {
            throw new Error(`滑点容忍度必须在0-${SWAP_CONFIG.maxSlippage * 100}%之间`);
        }

        if (params.minimumOutputAmount.lt(new BN(0))) {
            throw new Error("最小输出金额不能为负数");
        }
    }

    /**
     * 获取代币mint地址
     * @param direction 交换方向
     * @returns 代币mint地址
     */
    private _getTokenMints(direction: SwapDirection): { tokenMintA: PublicKey; tokenMintB: PublicKey } {
        if (direction === SwapDirection.SOL_TO_USDC) {
            return {
                tokenMintA: getTokenMint('SOL', undefined, this._networkType),
                tokenMintB: getTokenMint('USDC', 'ORCA', this._networkType)
            };
        } else {
            return {
                tokenMintA: getTokenMint('USDC', 'ORCA', this._networkType),
                tokenMintB: getTokenMint('SOL', undefined, this._networkType)
            };
        }
    }

    /**
     * 检查用户余额
     * @param params 交换参数
     * @param tokenMint 输入代币mint地址
     */
    private async _checkUserBalance(params: SwapParams, tokenMint: PublicKey): Promise<void> {
        const tokenAccount = await this._accountManager.getAssociatedTokenAccountAddress(
            tokenMint,
            this._wallet.publicKey
        );

        // 对于SOL，检查原生余额
        if (tokenMint.equals(getTokenMint('SOL', undefined, this._networkType))) {
            const balance = await this._connection.getBalance(this._wallet.publicKey);
            const requiredBalance = params.inputAmount.toNumber() + 5000000; // 预留0.005 SOL作为手续费
            
            if (balance < requiredBalance) {
                throw new Error(`SOL余额不足: 需要 ${requiredBalance / 1e9} SOL，当前 ${balance / 1e9} SOL`);
            }
        } else {
            // 检查代币账户余额
            const hasEnough = await this._accountManager.hasEnoughBalance(tokenAccount, params.inputAmount);
            if (!hasEnough) {
                throw new Error("代币余额不足");
            }
        }
    }

    /**
     * 发送交易
     * @param instructions 交易指令数组
     * @returns 交易签名
     */
    private async _sendTransaction(instructions: TransactionInstruction[]): Promise<string> {
        console.log("📤 发送交易...");

        const transaction = new Transaction();
        
        console.log(`   添加 ${instructions.length} 个指令到交易`);
        instructions.forEach(ix => transaction.add(ix));

        // 发送并确认交易
        const signature = await this._connection.sendTransaction(transaction, [this._wallet.payer]);
        await this._connection.confirmTransaction(signature, 'confirmed');

        return signature;
    }

    /**
     * 验证交换结果
     * @param signature 交易签名
     * @param route 路由信息
     * @returns 交换结果
     */
    private async _verifySwapResult(signature: string, route: any): Promise<SwapResult> {
        // 这里可以添加更详细的结果验证逻辑
        // 比如检查实际的代币转移金额等
        
        return {
            signature,
            inputAmount: route.bestQuote.inputAmount,
            outputAmount: route.bestQuote.outputAmount,
            priceImpact: route.bestQuote.priceImpact,
            success: true
        };
    }
}
