import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { 
    getAssociatedTokenAddress, 
    getAccount, 
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    AccountLayout
} from "@solana/spl-token";
import BN from "bn.js";

import { TokenAccountInfo, TokenAccountStatus, TokenBalance } from "../../types/token/token-types";

/**
 * 代币账户管理器
 * 负责代币账户的创建、查询、余额管理等功能
 */
export class TokenAccountManager {
    private _connection: Connection;

    /**
     * 构造函数
     * @param connection Solana连接实例
     */
    constructor(connection: Connection) {
        this._connection = connection;
    }

    /**
     * 获取或创建关联代币账户地址
     * @param mint 代币mint地址
     * @param owner 账户所有者地址
     * @returns 关联代币账户地址
     */
    async getAssociatedTokenAccountAddress(
        mint: PublicKey,
        owner: PublicKey
    ): Promise<PublicKey> {
        return await getAssociatedTokenAddress(mint, owner);
    }

    /**
     * 检查代币账户是否存在
     * @param tokenAccount 代币账户地址
     * @returns 账户状态信息
     */
    async checkTokenAccountStatus(tokenAccount: PublicKey): Promise<TokenAccountStatus> {
        try {
            const accountInfo = await this._connection.getAccountInfo(tokenAccount);
            
            if (!accountInfo) {
                return TokenAccountStatus.NOT_EXISTS;
            }
            
            if (accountInfo.data.length === 0) {
                return TokenAccountStatus.UNINITIALIZED;
            }
            
            // 检查账户是否被冻结
            if (accountInfo.data.length >= AccountLayout.span) {
                const accountData = AccountLayout.decode(accountInfo.data);
                if (accountData.state === 2) { // Frozen state
                    return TokenAccountStatus.FROZEN;
                }
            }
            
            return TokenAccountStatus.INITIALIZED;
        } catch (error) {
            console.log(`检查代币账户状态失败: ${error}`);
            return TokenAccountStatus.NOT_EXISTS;
        }
    }

    /**
     * 获取代币账户信息
     * @param tokenAccount 代币账户地址
     * @returns 代币账户信息
     */
    async getTokenAccountInfo(tokenAccount: PublicKey): Promise<TokenAccountInfo | null> {
        try {
            const account = await getAccount(this._connection, tokenAccount);
            
            return {
                address: tokenAccount,
                mint: account.mint,
                owner: account.owner,
                amount: account.amount.toString(),
                status: TokenAccountStatus.INITIALIZED,
                isAssociated: true, // 假设是关联账户
                createdAt: new Date()
            };
        } catch (error) {
            console.log(`获取代币账户信息失败: ${error}`);
            return null;
        }
    }

    /**
     * 获取代币余额
     * @param tokenAccount 代币账户地址
     * @param mint 代币mint地址
     * @param symbol 代币符号
     * @param decimals 小数位数
     * @returns 代币余额信息
     */
    async getTokenBalance(
        tokenAccount: PublicKey,
        mint: PublicKey,
        symbol: string,
        decimals: number
    ): Promise<TokenBalance | null> {
        try {
            const accountInfo = await this.getTokenAccountInfo(tokenAccount);
            if (!accountInfo) {
                return null;
            }

            const rawBalance = accountInfo.amount;
            const formattedBalance = parseFloat(rawBalance) / Math.pow(10, decimals);

            return {
                mint,
                rawBalance,
                formattedBalance,
                symbol,
                decimals
            };
        } catch (error) {
            console.log(`获取代币余额失败: ${error}`);
            return null;
        }
    }

    /**
     * 创建关联代币账户指令
     * @param payer 付费者地址
     * @param owner 账户所有者地址
     * @param mint 代币mint地址
     * @returns 创建指令和账户地址
     */
    async createAssociatedTokenAccountInstruction(
        payer: PublicKey,
        owner: PublicKey,
        mint: PublicKey
    ): Promise<{ instruction: TransactionInstruction; tokenAccount: PublicKey }> {
        const tokenAccount = await getAssociatedTokenAddress(mint, owner);
        
        const instruction = createAssociatedTokenAccountInstruction(
            payer,          // 付费者
            tokenAccount,   // 要创建的代币账户地址
            owner,          // 代币账户所有者
            mint,           // 代币mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        return {
            instruction,
            tokenAccount
        };
    }

    /**
     * 批量检查代币账户状态
     * @param tokenAccounts 代币账户地址数组
     * @returns 账户状态映射
     */
    async batchCheckTokenAccountStatus(
        tokenAccounts: PublicKey[]
    ): Promise<Map<string, TokenAccountStatus>> {
        const statusMap = new Map<string, TokenAccountStatus>();
        
        const promises = tokenAccounts.map(async (account) => {
            const status = await this.checkTokenAccountStatus(account);
            statusMap.set(account.toBase58(), status);
        });

        await Promise.all(promises);
        return statusMap;
    }

    /**
     * 获取用户所有代币余额
     * @param owner 用户地址
     * @param tokenMints 要查询的代币mint地址数组
     * @returns 代币余额数组
     */
    async getUserTokenBalances(
        owner: PublicKey,
        tokenMints: { mint: PublicKey; symbol: string; decimals: number }[]
    ): Promise<TokenBalance[]> {
        const balances: TokenBalance[] = [];

        for (const tokenInfo of tokenMints) {
            try {
                const tokenAccount = await getAssociatedTokenAddress(tokenInfo.mint, owner);
                const balance = await this.getTokenBalance(
                    tokenAccount,
                    tokenInfo.mint,
                    tokenInfo.symbol,
                    tokenInfo.decimals
                );
                
                if (balance) {
                    balances.push(balance);
                } else {
                    // 账户不存在，余额为0
                    balances.push({
                        mint: tokenInfo.mint,
                        rawBalance: "0",
                        formattedBalance: 0,
                        symbol: tokenInfo.symbol,
                        decimals: tokenInfo.decimals
                    });
                }
            } catch (error) {
                console.log(`获取 ${tokenInfo.symbol} 余额失败: ${error}`);
                // 添加0余额记录
                balances.push({
                    mint: tokenInfo.mint,
                    rawBalance: "0",
                    formattedBalance: 0,
                    symbol: tokenInfo.symbol,
                    decimals: tokenInfo.decimals
                });
            }
        }

        return balances;
    }

    /**
     * 验证代币账户所有权
     * @param tokenAccount 代币账户地址
     * @param expectedOwner 期望的所有者地址
     * @returns 是否为正确的所有者
     */
    async validateTokenAccountOwnership(
        tokenAccount: PublicKey,
        expectedOwner: PublicKey
    ): Promise<boolean> {
        try {
            const accountInfo = await this.getTokenAccountInfo(tokenAccount);
            return accountInfo?.owner.equals(expectedOwner) || false;
        } catch (error) {
            console.log(`验证代币账户所有权失败: ${error}`);
            return false;
        }
    }

    /**
     * 检查账户是否有足够余额
     * @param tokenAccount 代币账户地址
     * @param requiredAmount 需要的金额
     * @returns 是否有足够余额
     */
    async hasEnoughBalance(
        tokenAccount: PublicKey,
        requiredAmount: BN
    ): Promise<boolean> {
        try {
            const accountInfo = await this.getTokenAccountInfo(tokenAccount);
            if (!accountInfo) {
                return false;
            }

            const balance = new BN(accountInfo.amount);
            return balance.gte(requiredAmount);
        } catch (error) {
            console.log(`检查余额失败: ${error}`);
            return false;
        }
    }
}
