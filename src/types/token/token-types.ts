import { PublicKey } from "@solana/web3.js";

/**
 * 支持的网络类型
 */
export enum NetworkType {
    MAINNET = 'mainnet',
    DEVNET = 'devnet',
    TESTNET = 'testnet'
}

/**
 * 代币标准类型
 */
export enum TokenStandard {
    /** SPL Token标准 */
    SPL = 'SPL',
    /** 原生SOL */
    NATIVE = 'NATIVE',
    /** Wrapped SOL */
    WRAPPED = 'WRAPPED'
}

/**
 * 代币账户状态
 */
export enum TokenAccountStatus {
    /** 不存在 */
    NOT_EXISTS = 'NOT_EXISTS',
    /** 存在但未初始化 */
    UNINITIALIZED = 'UNINITIALIZED',
    /** 已初始化 */
    INITIALIZED = 'INITIALIZED',
    /** 已冻结 */
    FROZEN = 'FROZEN'
}

/**
 * 代币元数据
 */
export interface TokenMetadata {
    /** 代币mint地址 */
    mint: PublicKey;
    
    /** 代币符号 */
    symbol: string;
    
    /** 代币名称 */
    name: string;
    
    /** 小数位数 */
    decimals: number;
    
    /** 代币描述 */
    description?: string;
    
    /** 代币图标URI */
    image?: string;
    
    /** 外部链接 */
    externalUrl?: string;
    
    /** 代币标准 */
    standard: TokenStandard;
    
    /** 是否可铸造 */
    isMutable: boolean;
    
    /** 总供应量 */
    totalSupply?: string;
}

/**
 * 代币账户信息
 */
export interface TokenAccountInfo {
    /** 账户地址 */
    address: PublicKey;
    
    /** 代币mint地址 */
    mint: PublicKey;
    
    /** 账户所有者 */
    owner: PublicKey;
    
    /** 账户余额 */
    amount: string;
    
    /** 账户状态 */
    status: TokenAccountStatus;
    
    /** 是否为关联代币账户 */
    isAssociated: boolean;
    
    /** 账户创建时间 */
    createdAt?: Date;
}

/**
 * 代币余额信息
 */
export interface TokenBalance {
    /** 代币mint地址 */
    mint: PublicKey;
    
    /** 原始余额 (最小单位) */
    rawBalance: string;
    
    /** 格式化余额 */
    formattedBalance: number;
    
    /** 代币符号 */
    symbol: string;
    
    /** 小数位数 */
    decimals: number;
    
    /** USD价值 (如果可用) */
    usdValue?: number;
}

/**
 * 网络代币映射配置
 */
export interface NetworkTokenMapping {
    /** SOL地址 */
    SOL: string;
    
    /** USDC地址映射 */
    USDC: {
        /** Orca协议的USDC地址 */
        ORCA: string;
        /** Jupiter协议的USDC地址 */
        JUPITER: string;
        /** 官方USDC地址 */
        OFFICIAL: string;
    };
}

/**
 * 协议代币配置
 */
export interface ProtocolTokenConfig {
    /** SOL地址 */
    SOL: string;
    
    /** USDC地址 */
    USDC: string;
}

/**
 * 代币价格信息
 */
export interface TokenPrice {
    /** 代币mint地址 */
    mint: PublicKey;
    
    /** USD价格 */
    usdPrice: number;
    
    /** 24小时价格变化百分比 */
    priceChange24h: number;
    
    /** 市值 */
    marketCap?: number;
    
    /** 24小时交易量 */
    volume24h?: number;
    
    /** 价格更新时间 */
    updatedAt: Date;
}
