import { PublicKey } from "@solana/web3.js";
import { NetworkType, NetworkTokenMapping } from "../types/token/token-types";

// 重新导出类型
export { NetworkType } from "../types/token/token-types";

/**
 * 网络配置
 * 包含不同网络环境下的RPC端点、代币地址等配置信息
 */
export interface NetworkConfig {
    /** 网络类型 */
    type: NetworkType;

    /** RPC端点 */
    rpcEndpoint: string;

    /** WebSocket端点 */
    wsEndpoint?: string;

    /** 网络名称 */
    name: string;

    /** 是否为测试网络 */
    isTestnet: boolean;

    /** 代币地址映射 */
    tokens: NetworkTokenMapping;
}

/**
 * Devnet网络配置
 */
export const DEVNET_CONFIG: NetworkConfig = {
    type: NetworkType.DEVNET,
    rpcEndpoint: "https://api.devnet.solana.com",
    wsEndpoint: "wss://api.devnet.solana.com",
    name: "Solana Devnet",
    isTestnet: true,
    tokens: {
        SOL: "So11111111111111111111111111111111111111112", // Wrapped SOL
        USDC: {
            ORCA: "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k",     // Orca devUSDC
            JUPITER: "7UTBhm5Q88UqEUNkp1hvDCEV4VpWwfvDME1jUeEe3nE2",   // Jupiter devUSDC
            OFFICIAL: "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"   // 使用Orca作为默认
        }
    }
};

/**
 * Mainnet网络配置
 */
export const MAINNET_CONFIG: NetworkConfig = {
    type: NetworkType.MAINNET,
    rpcEndpoint: "https://api.mainnet-beta.solana.com",
    wsEndpoint: "wss://api.mainnet-beta.solana.com",
    name: "Solana Mainnet",
    isTestnet: false,
    tokens: {
        SOL: "So11111111111111111111111111111111111111112", // Wrapped SOL
        USDC: {
            ORCA: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",     // USDC
            JUPITER: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",   // USDC
            OFFICIAL: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"   // 官方USDC
        }
    }
};

/**
 * 获取当前网络配置
 * @param networkType 网络类型
 * @returns 网络配置
 */
export function getNetworkConfig(networkType: NetworkType = NetworkType.DEVNET): NetworkConfig {
    switch (networkType) {
        case NetworkType.MAINNET:
            return MAINNET_CONFIG;
        case NetworkType.DEVNET:
            return DEVNET_CONFIG;
        default:
            throw new Error(`不支持的网络类型: ${networkType}`);
    }
}

/**
 * 获取代币mint地址
 * @param symbol 代币符号
 * @param protocol 协议名称 (可选)
 * @param networkType 网络类型
 * @returns 代币mint地址
 */
export function getTokenMint(
    symbol: 'SOL' | 'USDC',
    protocol?: 'ORCA' | 'JUPITER' | 'OFFICIAL',
    networkType: NetworkType = NetworkType.DEVNET
): PublicKey {
    const config = getNetworkConfig(networkType);

    if (symbol === 'SOL') {
        return new PublicKey(config.tokens.SOL);
    }

    if (symbol === 'USDC') {
        const usdcAddress = protocol
            ? config.tokens.USDC[protocol]
            : config.tokens.USDC.OFFICIAL;
        return new PublicKey(usdcAddress);
    }

    throw new Error(`不支持的代币符号: ${symbol}`);
}

/**
 * 常用代币地址常量
 */
export const TOKEN_ADDRESSES = {
    DEVNET: {
        SOL: new PublicKey("So11111111111111111111111111111111111111112"),
        USDC_ORCA: new PublicKey("BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k"),
        USDC_JUPITER: new PublicKey("7UTBhm5Q88UqEUNkp1hvDCEV4VpWwfvDME1jUeEe3nE2"),
        USDT: new PublicKey("H8UekPGwePSmQ3ttuYGPU1szyFfjZR4N53rymSFwpLPmR")
    },
    MAINNET: {
        SOL: new PublicKey("So11111111111111111111111111111111111111112"),
        USDC: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        USDT: new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
    }
};

/**
 * 知名池子地址
 */
export const WELL_KNOWN_POOLS = {
    DEVNET: {
        ORCA: {
            SOL_USDC: "3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt"
        }
    },
    MAINNET: {
        ORCA: {
            SOL_USDC: "HJPjoWUrhoZzkNfRpHuieeFk9WcPEQ4yFn79kpZZFdpw"
        }
    }
};
