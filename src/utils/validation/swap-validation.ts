import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import { SwapParams, SwapDirection } from "../../types/swap/swap-types";
import { DEXQuote } from "../../types/dex/protocol";
import { SWAP_CONFIG } from "../../config/dex-config";
import { validateTransactionAmount, TOKEN_AMOUNT_CONSTANTS } from "../token/token-utils";

/**
 * 交换验证工具
 * 提供交换操作相关的验证功能
 */

/**
 * 验证结果接口
 */
export interface ValidationResult {
    /** 是否通过验证 */
    isValid: boolean;
    
    /** 错误信息 (如果验证失败) */
    error?: string;
    
    /** 警告信息 */
    warnings?: string[];
}

/**
 * 验证交换参数
 * @param params 交换参数
 * @returns 验证结果
 */
export function validateSwapParams(params: SwapParams): ValidationResult {
    const warnings: string[] = [];
    
    // 验证输入金额
    if (params.inputAmount.lte(TOKEN_AMOUNT_CONSTANTS.ZERO)) {
        return {
            isValid: false,
            error: "输入金额必须大于0"
        };
    }
    
    // 验证滑点容忍度
    if (params.slippageTolerance < 0) {
        return {
            isValid: false,
            error: "滑点容忍度不能为负数"
        };
    }
    
    if (params.slippageTolerance > SWAP_CONFIG.maxSlippage) {
        return {
            isValid: false,
            error: `滑点容忍度不能超过 ${SWAP_CONFIG.maxSlippage * 100}%`
        };
    }
    
    // 滑点警告
    if (params.slippageTolerance > 0.03) { // 3%
        warnings.push(`滑点容忍度较高 (${(params.slippageTolerance * 100).toFixed(1)}%)，可能导致较大损失`);
    }
    
    // 验证最小输出金额
    if (params.minimumOutputAmount.lt(TOKEN_AMOUNT_CONSTANTS.ZERO)) {
        return {
            isValid: false,
            error: "最小输出金额不能为负数"
        };
    }
    
    // 验证交易方向
    if (!Object.values(SwapDirection).includes(params.direction)) {
        return {
            isValid: false,
            error: "无效的交换方向"
        };
    }
    
    // 验证最小交易金额
    const minAmountValidation = validateMinimumTradeAmount(params);
    if (!minAmountValidation.isValid) {
        return minAmountValidation;
    }
    
    if (minAmountValidation.warnings) {
        warnings.push(...minAmountValidation.warnings);
    }
    
    return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}

/**
 * 验证最小交易金额
 * @param params 交换参数
 * @returns 验证结果
 */
export function validateMinimumTradeAmount(params: SwapParams): ValidationResult {
    const warnings: string[] = [];
    
    if (params.direction === SwapDirection.SOL_TO_USDC) {
        // SOL交易验证
        const minSolAmount = new BN(SWAP_CONFIG.minSolAmount * 1e9); // 转换为lamports
        
        if (params.inputAmount.lt(minSolAmount)) {
            return {
                isValid: false,
                error: `SOL交易金额不能小于 ${SWAP_CONFIG.minSolAmount} SOL`
            };
        }
        
        // 小额交易警告
        const smallTradeThreshold = new BN(0.01 * 1e9); // 0.01 SOL
        if (params.inputAmount.lt(smallTradeThreshold)) {
            warnings.push("小额交易可能导致较高的相对手续费");
        }
        
    } else {
        // USDC交易验证
        const minUsdcAmount = new BN(SWAP_CONFIG.minUsdcAmount * 1e6); // 转换为micro USDC
        
        if (params.inputAmount.lt(minUsdcAmount)) {
            return {
                isValid: false,
                error: `USDC交易金额不能小于 ${SWAP_CONFIG.minUsdcAmount} USDC`
            };
        }
        
        // 小额交易警告
        const smallTradeThreshold = new BN(1 * 1e6); // 1 USDC
        if (params.inputAmount.lt(smallTradeThreshold)) {
            warnings.push("小额交易可能导致较高的相对手续费");
        }
    }
    
    return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}

/**
 * 验证DEX报价
 * @param quote DEX报价
 * @returns 验证结果
 */
export function validateDEXQuote(quote: DEXQuote): ValidationResult {
    const warnings: string[] = [];
    
    // 验证基本字段
    if (!quote.dexName || quote.dexName.trim() === '') {
        return {
            isValid: false,
            error: "DEX名称不能为空"
        };
    }
    
    if (quote.inputAmount.lte(TOKEN_AMOUNT_CONSTANTS.ZERO)) {
        return {
            isValid: false,
            error: "输入金额必须大于0"
        };
    }
    
    if (quote.outputAmount.lte(TOKEN_AMOUNT_CONSTANTS.ZERO)) {
        return {
            isValid: false,
            error: "输出金额必须大于0"
        };
    }
    
    // 验证价格影响
    if (quote.priceImpact < 0) {
        return {
            isValid: false,
            error: "价格影响不能为负数"
        };
    }
    
    if (quote.priceImpact > 0.1) { // 10%
        warnings.push(`价格影响过高 (${(quote.priceImpact * 100).toFixed(2)}%)，建议谨慎交易`);
    } else if (quote.priceImpact > 0.05) { // 5%
        warnings.push(`价格影响较高 (${(quote.priceImpact * 100).toFixed(2)}%)`);
    }
    
    // 验证手续费
    if (quote.fee.lt(TOKEN_AMOUNT_CONSTANTS.ZERO)) {
        return {
            isValid: false,
            error: "手续费不能为负数"
        };
    }
    
    // 验证路径
    if (!quote.route || quote.route.length < 2) {
        return {
            isValid: false,
            error: "交易路径至少需要包含2个代币"
        };
    }
    
    // 验证可信度
    if (quote.confidence < 0 || quote.confidence > 1) {
        return {
            isValid: false,
            error: "报价可信度必须在0-1之间"
        };
    }
    
    if (quote.confidence < 0.5) {
        warnings.push("报价可信度较低，建议谨慎交易");
    }
    
    return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}

/**
 * 验证钱包地址
 * @param address 钱包地址
 * @returns 验证结果
 */
export function validateWalletAddress(address: string | PublicKey): ValidationResult {
    try {
        if (typeof address === 'string') {
            new PublicKey(address);
        }
        return { isValid: true };
    } catch {
        return {
            isValid: false,
            error: "无效的钱包地址格式"
        };
    }
}

/**
 * 验证代币mint地址
 * @param mint 代币mint地址
 * @returns 验证结果
 */
export function validateTokenMint(mint: string | PublicKey): ValidationResult {
    try {
        if (typeof mint === 'string') {
            new PublicKey(mint);
        }
        return { isValid: true };
    } catch {
        return {
            isValid: false,
            error: "无效的代币mint地址格式"
        };
    }
}

/**
 * 验证交易超时设置
 * @param timeoutSeconds 超时时间 (秒)
 * @returns 验证结果
 */
export function validateTransactionTimeout(timeoutSeconds: number): ValidationResult {
    if (timeoutSeconds <= 0) {
        return {
            isValid: false,
            error: "交易超时时间必须大于0"
        };
    }
    
    if (timeoutSeconds > 300) { // 5分钟
        return {
            isValid: false,
            error: "交易超时时间不能超过5分钟"
        };
    }
    
    const warnings: string[] = [];
    
    if (timeoutSeconds < 30) {
        warnings.push("交易超时时间较短，可能导致交易失败");
    }
    
    return {
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}

/**
 * 验证网络连接状态
 * @param connection Solana连接实例
 * @returns 验证结果
 */
export async function validateNetworkConnection(connection: any): Promise<ValidationResult> {
    try {
        // 尝试获取最新区块高度
        const blockHeight = await connection.getBlockHeight();
        
        if (blockHeight <= 0) {
            return {
                isValid: false,
                error: "网络连接异常：无法获取区块高度"
            };
        }
        
        return { isValid: true };
    } catch (error) {
        return {
            isValid: false,
            error: `网络连接失败: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * 综合验证交换操作
 * @param params 交换参数
 * @param userWallet 用户钱包地址
 * @param connection 网络连接
 * @returns 验证结果
 */
export async function validateSwapOperation(
    params: SwapParams,
    userWallet: PublicKey,
    connection: any
): Promise<ValidationResult> {
    // 验证交换参数
    const paramsValidation = validateSwapParams(params);
    if (!paramsValidation.isValid) {
        return paramsValidation;
    }
    
    // 验证钱包地址
    const walletValidation = validateWalletAddress(userWallet);
    if (!walletValidation.isValid) {
        return walletValidation;
    }
    
    // 验证网络连接
    const networkValidation = await validateNetworkConnection(connection);
    if (!networkValidation.isValid) {
        return networkValidation;
    }
    
    // 合并所有警告
    const allWarnings: string[] = [];
    if (paramsValidation.warnings) allWarnings.push(...paramsValidation.warnings);
    if (walletValidation.warnings) allWarnings.push(...walletValidation.warnings);
    if (networkValidation.warnings) allWarnings.push(...networkValidation.warnings);
    
    return {
        isValid: true,
        warnings: allWarnings.length > 0 ? allWarnings : undefined
    };
}
