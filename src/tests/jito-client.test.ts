import { EnhancedJitoClient } from '../core/jito/jito-client'
import { Keypair } from '@solana/web3.js'

/**
 *  简单的 Jito 客户端测试
 */

async function testJitoClient() {
    console.log('🧪 开始测试 Enhanced Jito Client...')

    try {
        // 1. 创建测试钱包
        const testWallet = Keypair.generate()
        console.log(`📝 测试钱包地址: ${testWallet.publicKey.toBase58()}`)

        // 2. 初始化客户端(开发环境)
        const jitoClient = new EnhancedJitoClient(
            { network: 'devnet' },
            testWallet
        )
        console.log('✅ Jito 客户端初始化成功')

        // 3. 测试网络状况分析
        console.log('🌐 测试网络状况分析...')
        const networkStatus = jitoClient.getNetworkStatus()
        console.log(`网络状态：${JSON.stringify(networkStatus, null, 2)}`)

        // 4. 测试小费计算
        console.log('💸 测试小费计算...')
        const tipAmount = await jitoClient.calculateOptimalTip(
            { mode: 'auto', percentile: 50 },
            'medium'
        )
        console.log(`计算的最优小费: ${tipAmount} lamports`)

        // 5. 测试性能指标
        console.log('📊 测试性能指标...')
        const metrics = jitoClient.getPerformanceMetrics()
        console.log(`性能指标: ${JSON.stringify(metrics, null, 2)}`)

        console.log('🎉 所有测试通过!')

    } catch (error) {
        console.log('❌ 测试失败:', error)
    }
}


// 运行测试
if (require.main === module) {
    testJitoClient()
}

export { testJitoClient }