import {
    Connection,
    Transaction,
    SystemProgram,
    PublicKey,
    Keypair,
    LAMPORTS_PER_SOL
} from '@solana/web3.js'

/**
 * 演示交易生成器
 * 创建用于测试的模拟交易
 */
export class DemoTransactionGenerator {
    private connection: Connection
    private payer: Keypair

    constructor(connection: Connection, payer: Keypair) {
        this.connection = connection
        this.payer = payer
    }

    /**
     * 创建简单的转账交易
     * 用于基础 Bundle 测试
     */
    async createSimpleTransfer(
        recipient: PublicKey,
        amount: number = 900000 // 默认 0.0009 SOL，足够支付租金豁免
    ): Promise<Transaction> {
        const transaction = new Transaction()

        // 添加转账指令
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: this.payer.publicKey,
                toPubkey: recipient,
                lamports: amount
            })
        )

        // 获取最新区块哈希
        const { blockhash } = await this.connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = this.payer.publicKey

        // 签名交易
        transaction.sign(this.payer)

        return transaction
    }

    /**
     * 创建多个测试交易
     * 用于 Bundle 批量测试
     */
    async createMultipleTransactions(count: number): Promise<Transaction[]> {
        const transactions: Transaction[] = []

        for (let i = 0; i < count; i++) {
            // 创建随机接收者
            const recipient = Keypair.generate().publicKey
            // 确保转账金额足够支付租金豁免（约 0.00089 SOL = 890000 lamports）
            const rentExemptAmount = 890000 // Solana 账户租金豁免最低金额
            const extraAmount = Math.floor(Math.random() * 100000) + 10000 // 额外的随机金额
            const amount = rentExemptAmount + extraAmount

            const transaction = await this.createSimpleTransfer(recipient, amount)
            transactions.push(transaction)

            // 添加小延迟避免重复区块哈希
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        return transactions
    }

    /**
     * 创建带备注的交易
     * 用于追踪和调试
     */
    async createMemoTransaction(memo: string): Promise<Transaction> {
        const transaction = new Transaction()

        // 添加真正的备注指令
        const memoInstruction = {
            keys: [],
            programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), // Memo Program ID
            data: Buffer.from(memo, 'utf8')
        }
        transaction.add(memoInstruction)

        // 可选：同时添加一个小额转账以确保交易有足够的费用
        const recipient = Keypair.generate().publicKey
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: this.payer.publicKey,
                toPubkey: recipient,
                lamports: 1000 // 最小转账金额
            })
        )

        const { blockhash } = await this.connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = this.payer.publicKey

        transaction.sign(this.payer)

        return transaction
    }
}

/**
 * 创建测试用的密钥对
 * 使用固定的测试密钥，方便转账测试
 * 仅用于演示，生产环境请使用安全的密钥管理
 */
export function createDemoKeypair(): Keypair {
    // 生产环境警告
    console.warn('⚠️  演示密钥对仅用于测试，请勿在生产环境使用')

    // 生成一个新的密钥对，但使用固定的种子确保可重现
    // 这样每次运行都会得到相同的地址
    const seed = 'demo-keypair-for-jito-bundle-testing-only'
    const seedBytes = new TextEncoder().encode(seed)

    // 使用 crypto.subtle.digest 创建32字节的种子
    const hash = require('crypto').createHash('sha256').update(seedBytes).digest()
    const keypair = Keypair.fromSeed(hash)

    console.log(`📍 固定测试账户: ${keypair.publicKey.toBase58()}`)

    return keypair
}

/**
 * 智能空投管理器
 * 处理空投限制和重试逻辑
 */
export class AirdropManager {
    private connection: Connection
    private lastAirdropTime: Map<string, number> = new Map()
    private readonly AIRDROP_COOLDOWN = 60000 // 1分钟冷却时间
    private readonly MAX_AIRDROP_RETRIES = 3

    constructor(connection: Connection) {
        this.connection = connection
    }

    /**
     * 智能空投：处理限制和重试
     */
    async smartAirdrop(publicKey: PublicKey, amount: number): Promise<boolean> {
        const address = publicKey.toBase58()
        const now = Date.now()
        const lastAirdrop = this.lastAirdropTime.get(address) || 0

        // 检查冷却时间
        if (now - lastAirdrop < this.AIRDROP_COOLDOWN) {
            const remainingTime = Math.ceil((this.AIRDROP_COOLDOWN - (now - lastAirdrop)) / 1000)
            console.log(`⏰ 空投冷却中，还需等待 ${remainingTime} 秒`)
            return false
        }

        // 尝试空投，带重试机制
        for (let attempt = 1; attempt <= this.MAX_AIRDROP_RETRIES; attempt++) {
            try {
                console.log(`🪂 尝试空投 (${attempt}/${this.MAX_AIRDROP_RETRIES}): ${amount / LAMPORTS_PER_SOL} SOL`)

                const signature = await this.connection.requestAirdrop(publicKey, amount)

                // 等待确认
                const latestBlockhash = await this.connection.getLatestBlockhash()
                await this.connection.confirmTransaction({
                    signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                }, 'confirmed')

                // 记录成功时间
                this.lastAirdropTime.set(address, now)
                console.log(`✅ 空投成功: ${signature}`)
                return true

            } catch (error: any) {
                console.warn(`⚠️ 空投尝试 ${attempt} 失败:`, error.message)

                // 如果是速率限制错误，等待更长时间
                if (error.message.includes('rate limit') || error.message.includes('429')) {
                    console.log('⏳ 遇到速率限制，等待 30 秒后重试...')
                    await new Promise(resolve => setTimeout(resolve, 30000))
                } else if (attempt < this.MAX_AIRDROP_RETRIES) {
                    // 其他错误，短暂等待后重试
                    await new Promise(resolve => setTimeout(resolve, 5000))
                }
            }
        }

        console.error('❌ 所有空投尝试都失败了')
        return false
    }

    /**
     * 批量空投：为多个账户申请空投
     */
    async batchAirdrop(accounts: PublicKey[], amountPerAccount: number): Promise<boolean[]> {
        const results: boolean[] = []

        for (const account of accounts) {
            const result = await this.smartAirdrop(account, amountPerAccount)
            results.push(result)

            // 批量操作间隔，避免速率限制
            if (accounts.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }

        return results
    }
}

/**
 * 请求 Solana Devnet 空投
 * 自动为测试账户申请 SOL
 */
export async function requestAirdrop(
    connection: Connection,
    publicKey: PublicKey,
    amount: number = 2 * LAMPORTS_PER_SOL // 默认申请 2 SOL
): Promise<boolean> {
    try {
        console.log(`🪂 正在申请空投 ${amount / LAMPORTS_PER_SOL} SOL 到账户 ${publicKey.toBase58()}...`)

        // 请求空投
        const signature = await connection.requestAirdrop(publicKey, amount)
        console.log(`空投交易签名: ${signature}`)

        // 等待确认
        console.log('⏳ 等待空投确认...')
        const latestBlockhash = await connection.getLatestBlockhash()
        await connection.confirmTransaction({
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        })

        console.log('✅ 空投成功确认')
        return true

    } catch (error) {
        console.error('❌ 空投失败:', error)

        // 如果是限流错误，尝试更小的金额
        if (String(error).includes('Rate limit') || String(error).includes('403')) {
            console.log('⏳ 遇到限流，尝试更小金额...')

            // 尝试更小的金额
            const smallerAmounts = [0.5 * LAMPORTS_PER_SOL, 0.1 * LAMPORTS_PER_SOL, 0.01 * LAMPORTS_PER_SOL]

            for (const smallAmount of smallerAmounts) {
                try {
                    console.log(`🪂 尝试申请更小空投 ${smallAmount / LAMPORTS_PER_SOL} SOL...`)
                    const signature = await connection.requestAirdrop(publicKey, smallAmount)

                    const latestBlockhash = await connection.getLatestBlockhash()
                    await connection.confirmTransaction({
                        signature,
                        blockhash: latestBlockhash.blockhash,
                        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                    })

                    console.log(`✅ 小额空投成功: ${smallAmount / LAMPORTS_PER_SOL} SOL`)
                    return true
                } catch (smallError) {
                    console.log(`❌ ${smallAmount / LAMPORTS_PER_SOL} SOL 空投也失败: ${smallError}`)
                    continue
                }
            }
        }

        return false
    }
}

/**
 * 检查账户余额并自动申请空投
 * 确保有足够的 SOL 进行测试
 */
export async function checkAccountBalance(
    connection: Connection,
    publicKey: PublicKey,
    requiredAmount: number = 0.1 * LAMPORTS_PER_SOL
): Promise<boolean> {
    try {
        const balance = await connection.getBalance(publicKey)
        console.log(`账户余额: ${balance / LAMPORTS_PER_SOL} SOL`)

        if (balance < requiredAmount) {
            console.warn(`⚠️ 余额不足，需要至少 ${requiredAmount / LAMPORTS_PER_SOL} SOL`)

            // 自动申请空投
            const airdropAmount = Math.max(2 * LAMPORTS_PER_SOL, requiredAmount * 2)
            console.log(`🎯 自动申请空投 ${airdropAmount / LAMPORTS_PER_SOL} SOL...`)

            const airdropSuccess = await requestAirdrop(connection, publicKey, airdropAmount)
            if (!airdropSuccess) {
                console.error('❌ 空投失败，无法继续测试')
                return false
            }

            // 重新检查余额
            const newBalance = await connection.getBalance(publicKey)
            console.log(`🎉 空投后余额: ${newBalance / LAMPORTS_PER_SOL} SOL`)

            if (newBalance < requiredAmount) {
                console.error('❌ 空投后余额仍然不足')
                return false
            }
        }

        return true
    } catch (error) {
        console.error('检查余额失败:', error)
        return false
    }
}

/**
 * 便捷函数：创建演示交易
 * 为演示脚本提供简单的接口
 */
export async function createDemoTransactions(
    connection: Connection,
    payer: Keypair,
    count: number = 2
): Promise<Transaction[]> {
    const generator = new DemoTransactionGenerator(connection, payer)
    return await generator.createMultipleTransactions(count)
}