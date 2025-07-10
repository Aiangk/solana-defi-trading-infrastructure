import { PublicKey } from "@solana/web3.js";
import { DEXConfig, SupportedDEX } from "../types/dex/protocol";
import { SwapConfig } from "../types/swap/swap-types";

/**
 * Orca协议配置
 */
export const ORCA_CONFIG: DEXConfig = {
    name: SupportedDEX.ORCA,
    enabled: true,
    programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
    priority: 1, // 最高优先级，因为我们有完整的CLMM实现
    maxSlippage: 0.05 // 5%最大滑点
};

/**
 * Raydium协议配置
 */
export const RAYDIUM_CONFIG: DEXConfig = {
    name: SupportedDEX.RAYDIUM,
    enabled: false, // 暂时禁用，因为devnet没有可用池子
    programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    priority: 2,
    maxSlippage: 0.03 // 3%最大滑点
};

/**
 * Jupiter协议配置
 */
export const JUPITER_CONFIG: DEXConfig = {
    name: SupportedDEX.JUPITER,
    enabled: true,
    programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter V6
    priority: 3,
    maxSlippage: 0.02 // 2%最大滑点
};

/**
 * 所有DEX配置
 */
export const DEX_CONFIGS: DEXConfig[] = [
    ORCA_CONFIG,
    RAYDIUM_CONFIG,
    JUPITER_CONFIG
];

/**
 * 获取启用的DEX配置
 * @returns 启用的DEX配置列表，按优先级排序
 */
export function getEnabledDEXConfigs(): DEXConfig[] {
    return DEX_CONFIGS
        .filter(config => config.enabled)
        .sort((a, b) => a.priority - b.priority);
}

/**
 * 根据名称获取DEX配置
 * @param dexName DEX名称
 * @returns DEX配置
 */
export function getDEXConfig(dexName: SupportedDEX): DEXConfig {
    const config = DEX_CONFIGS.find(c => c.name === dexName);
    if (!config) {
        throw new Error(`未找到DEX配置: ${dexName}`);
    }
    return config;
}

/**
 * 交换配置
 */
export const SWAP_CONFIG: SwapConfig = {
    /** 默认滑点容忍度 1% */
    defaultSlippage: 0.01,
    
    /** 最大滑点容忍度 5% */
    maxSlippage: 0.05,
    
    /** 最小SOL交易量 0.001 SOL */
    minSolAmount: 0.001,
    
    /** 最小USDC交易量 0.01 USDC */
    minUsdcAmount: 0.01,
    
    /** 交易超时时间 60秒 */
    timeoutSeconds: 60,
    
    /** 暂时禁用MEV保护 */
    mevProtection: false
};

/**
 * Orca特定配置
 */
export const ORCA_SPECIFIC_CONFIG = {
    /** Whirlpool程序ID */
    WHIRLPOOL_PROGRAM_ID: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
    
    /** 默认tick spacing */
    DEFAULT_TICK_SPACING: 64,
    
    /** 支持的tick spacing列表 */
    SUPPORTED_TICK_SPACINGS: [1, 8, 64, 128],
    
    /** 最大tick arrays数量 */
    MAX_TICK_ARRAYS: 3,
    
    /** 默认手续费率 */
    DEFAULT_FEE_RATE: 0.003 // 0.3%
};

/**
 * Raydium特定配置
 */
export const RAYDIUM_SPECIFIC_CONFIG = {
    /** AMM程序ID */
    AMM_PROGRAM_ID: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
    
    /** OpenBook程序ID */
    OPENBOOK_PROGRAM_ID: new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"),
    
    /** 默认手续费率 */
    DEFAULT_FEE_RATE: 0.0025 // 0.25%
};

/**
 * Jupiter特定配置
 */
export const JUPITER_SPECIFIC_CONFIG = {
    /** Jupiter API基础URL */
    API_BASE_URL: "https://quote-api.jup.ag/v6",
    
    /** 最大路由数量 */
    MAX_ROUTES: 3,
    
    /** 是否只使用直接路由 */
    ONLY_DIRECT_ROUTES: false,
    
    /** API超时时间 */
    API_TIMEOUT: 10000 // 10秒
};

/**
 * 获取协议特定配置
 * @param protocol 协议名称
 * @returns 协议特定配置
 */
export function getProtocolSpecificConfig(protocol: SupportedDEX) {
    switch (protocol) {
        case SupportedDEX.ORCA:
            return ORCA_SPECIFIC_CONFIG;
        case SupportedDEX.RAYDIUM:
            return RAYDIUM_SPECIFIC_CONFIG;
        case SupportedDEX.JUPITER:
            return JUPITER_SPECIFIC_CONFIG;
        default:
            throw new Error(`不支持的协议: ${protocol}`);
    }
}
