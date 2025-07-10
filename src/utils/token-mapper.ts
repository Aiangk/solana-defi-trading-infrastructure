import { PublicKey } from '@solana/web3.js';

/**
 * 智能代币映射器
 * 解决 Jupiter API 主要支持 mainnet 而我们需要在 devnet 测试的问题
 */
export class TokenMapper {
    // Devnet 代币映射
    private static readonly DEVNET_TOKENS = {
        SOL: 'So11111111111111111111111111111111111111112',
        USDC: 'BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k', // devUSDC
        USDT: 'H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPmR'  // devUSDT
    };

    // Mainnet 代币映射 (Jupiter 支持)
    private static readonly MAINNET_TOKENS = {
        SOL: 'So11111111111111111111111111111111111111112',
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
    };

    /**
     * 检查代币是否为 devnet 代币
     */
    static isDevnetToken(tokenMint: string): boolean {
        return Object.values(this.DEVNET_TOKENS).includes(tokenMint);
    }

    /**
     * 将 devnet 代币映射到对应的 mainnet 代币 (用于 Jupiter API)
     */
    static mapToMainnet(devnetToken: string): string {
        switch (devnetToken) {
            case this.DEVNET_TOKENS.SOL:
                return this.MAINNET_TOKENS.SOL;
            case this.DEVNET_TOKENS.USDC:
                return this.MAINNET_TOKENS.USDC;
            case this.DEVNET_TOKENS.USDT:
                return this.MAINNET_TOKENS.USDT;
            default:
                // 如果不是已知的 devnet 代币，假设它已经是 mainnet 代币
                return devnetToken;
        }
    }

    /**
     * 将 mainnet 代币映射回 devnet 代币 (用于实际交易)
     */
    static mapToDevnet(mainnetToken: string): string {
        switch (mainnetToken) {
            case this.MAINNET_TOKENS.SOL:
                return this.DEVNET_TOKENS.SOL;
            case this.MAINNET_TOKENS.USDC:
                return this.DEVNET_TOKENS.USDC;
            case this.MAINNET_TOKENS.USDT:
                return this.DEVNET_TOKENS.USDT;
            default:
                // 如果不是已知的 mainnet 代币，返回原值
                return mainnetToken;
        }
    }

    /**
     * 获取代币符号
     */
    static getTokenSymbol(tokenMint: string): string {
        // 检查 devnet 代币
        for (const [symbol, mint] of Object.entries(this.DEVNET_TOKENS)) {
            if (mint === tokenMint) {
                return `dev${symbol}`;
            }
        }

        // 检查 mainnet 代币
        for (const [symbol, mint] of Object.entries(this.MAINNET_TOKENS)) {
            if (mint === tokenMint) {
                return symbol;
            }
        }

        // 未知代币，返回截断的地址
        return `${tokenMint.slice(0, 4)}...${tokenMint.slice(-4)}`;
    }

    /**
     * 创建智能报价请求
     * 自动处理 devnet/mainnet 代币映射
     */
    static createSmartQuoteRequest(
        inputToken: PublicKey,
        outputToken: PublicKey,
        amount: string,
        slippage: number
    ) {
        const inputMint = inputToken.toBase58();
        const outputMint = outputToken.toBase58();

        // 如果是 devnet 代币，映射到 mainnet 用于 Jupiter API
        const jupiterInputMint = this.mapToMainnet(inputMint);
        const jupiterOutputMint = this.mapToMainnet(outputMint);

        return {
            // Jupiter API 使用的参数
            jupiterParams: {
                inputMint: jupiterInputMint,
                outputMint: jupiterOutputMint,
                amount,
                slippageBps: Math.floor(slippage * 10000).toString()
            },
            // 实际交易使用的参数
            actualParams: {
                inputMint,
                outputMint,
                amount,
                slippage
            },
            // 元数据
            metadata: {
                isDevnetPair: this.isDevnetToken(inputMint) || this.isDevnetToken(outputMint),
                inputSymbol: this.getTokenSymbol(inputMint),
                outputSymbol: this.getTokenSymbol(outputMint)
            }
        };
    }

    /**
     * 调整报价结果
     * 将 Jupiter 的 mainnet 报价调整为适合 devnet 的估算
     */
    static adjustQuoteForDevnet(jupiterQuote: any, isDevnetPair: boolean) {
        if (!isDevnetPair) {
            // 如果不是 devnet 交易对，直接返回原始报价
            return jupiterQuote;
        }

        // 对于 devnet 交易对，我们需要调整报价
        // 因为 devnet 的流动性和价格可能与 mainnet 不同
        const adjustedQuote = { ...jupiterQuote };

        // 应用保守的调整因子
        if (adjustedQuote.outAmount) {
            // 减少 5% 的输出金额以考虑 devnet 流动性差异
            const adjustmentFactor = 0.95;
            adjustedQuote.outAmount = Math.floor(
                parseInt(adjustedQuote.outAmount) * adjustmentFactor
            ).toString();
        }

        // 增加价格影响估算
        if (adjustedQuote.priceImpactPct) {
            const currentImpact = parseFloat(adjustedQuote.priceImpactPct);
            adjustedQuote.priceImpactPct = (currentImpact * 1.2).toString(); // 增加 20%
        }

        return adjustedQuote;
    }

    /**
     * 获取支持的交易对
     */
    static getSupportedPairs() {
        return {
            devnet: [
                {
                    input: this.DEVNET_TOKENS.SOL,
                    output: this.DEVNET_TOKENS.USDC,
                    symbol: 'SOL → devUSDC'
                },
                {
                    input: this.DEVNET_TOKENS.USDC,
                    output: this.DEVNET_TOKENS.SOL,
                    symbol: 'devUSDC → SOL'
                }
            ],
            mainnet: [
                {
                    input: this.MAINNET_TOKENS.SOL,
                    output: this.MAINNET_TOKENS.USDC,
                    symbol: 'SOL → USDC'
                },
                {
                    input: this.MAINNET_TOKENS.USDC,
                    output: this.MAINNET_TOKENS.SOL,
                    symbol: 'USDC → SOL'
                }
            ]
        };
    }
}

/**
 * 智能 Jupiter 客户端包装器
 * 自动处理 devnet/mainnet 代币映射
 */
export class SmartJupiterClient {
    /**
     * 获取智能报价
     * 自动处理 devnet 代币映射到 mainnet 进行报价
     */
    static async getSmartQuote(
        inputToken: PublicKey,
        outputToken: PublicKey,
        amount: string,
        slippage: number,
        jupiterApiCall: (params: any) => Promise<any>
    ) {
        const smartRequest = TokenMapper.createSmartQuoteRequest(
            inputToken,
            outputToken,
            amount,
            slippage
        );

        console.log(`📊 智能报价请求:`);
        console.log(`   交易对: ${smartRequest.metadata.inputSymbol} → ${smartRequest.metadata.outputSymbol}`);
        console.log(`   是否为 devnet 交易对: ${smartRequest.metadata.isDevnetPair}`);

        try {
            // 使用映射后的 mainnet 代币调用 Jupiter API
            const jupiterQuote = await jupiterApiCall(smartRequest.jupiterParams);

            // 如果是 devnet 交易对，调整报价
            const adjustedQuote = TokenMapper.adjustQuoteForDevnet(
                jupiterQuote,
                smartRequest.metadata.isDevnetPair
            );

            return {
                quote: adjustedQuote,
                metadata: smartRequest.metadata,
                actualParams: smartRequest.actualParams
            };
        } catch (error) {
            console.error(`❌ 智能报价失败:`, error);
            throw error;
        }
    }
}
