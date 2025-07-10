import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";

/**
 * DEX协议接口定义
 * 定义了所有DEX协议必须实现的标准接口
 */
export interface DEXProtocol {
    /** 协议名称 */
    name: string;
    
    /** 协议程序ID */
    programId: PublicKey;
    
    /**
     * 获取交易报价
     * @param tokenA 输入代币mint地址
     * @param tokenB 输出代币mint地址  
     * @param amount 输入金额
     * @param slippage 滑点容忍度 (0.01 = 1%)
     * @returns 交易报价信息
     */
    getQuote(
        tokenA: PublicKey,
        tokenB: PublicKey,
        amount: BN,
        slippage: number
    ): Promise<DEXQuote>;
    
    /**
     * 构建交换指令
     * @param quote 报价信息
     * @param userWallet 用户钱包地址
     * @param tokenAccountA 代币A账户地址
     * @param tokenAccountB 代币B账户地址
     * @returns 交换指令
     */
    buildSwapInstruction(
        quote: DEXQuote,
        userWallet: PublicKey,
        tokenAccountA: PublicKey,
        tokenAccountB: PublicKey
    ): Promise<TransactionInstruction>;
}

/**
 * DEX交易报价信息
 */
export interface DEXQuote {
    /** DEX名称 */
    dexName: string;
    
    /** 输入金额 */
    inputAmount: BN;
    
    /** 预期输出金额 */
    outputAmount: BN;
    
    /** 价格影响 (0.01 = 1%) */
    priceImpact: number;
    
    /** 交易手续费 */
    fee: BN;
    
    /** 交易路径 [输入代币, 输出代币] */
    route: PublicKey[];
    
    /** 预估gas费用 */
    estimatedGas: number;
    
    /** 报价可信度 (0-1) */
    confidence: number;
}

/**
 * 聚合路由结果
 */
export interface AggregatedRoute {
    /** 最佳报价 */
    bestQuote: DEXQuote;
    
    /** 所有报价列表 */
    allQuotes: DEXQuote[];
    
    /** 推荐的DEX */
    recommendedDEX: string;
    
    /** 相比其他选项的节省金额 */
    totalSavings: BN;
    
    /** 执行策略 */
    executionStrategy: 'SINGLE' | 'SPLIT' | 'ROUTE';
}

/**
 * 支持的DEX协议枚举
 */
export enum SupportedDEX {
    ORCA = 'Orca',
    RAYDIUM = 'Raydium', 
    JUPITER = 'Jupiter'
}

/**
 * DEX协议配置
 */
export interface DEXConfig {
    /** 协议名称 */
    name: SupportedDEX;
    
    /** 是否启用 */
    enabled: boolean;
    
    /** 程序ID */
    programId: string;
    
    /** 优先级 (数字越小优先级越高) */
    priority: number;
    
    /** 最大滑点容忍度 */
    maxSlippage: number;
}
