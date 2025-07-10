import { Connection, PublicKey } from "@solana/web3.js";
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const OPENBOOK_PROGRAM_ID = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

async function findExistingDevnetMarkets() {
    console.log("🔍 查找现有的 OpenBook Devnet 市场...");
    
    const connection = new Connection(
        process.env.DEVNET_RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
    );

    try {
        console.log("📊 搜索 OpenBook 程序账户...");
        
        // 查找所有 OpenBook 程序拥有的账户
        const accounts = await connection.getProgramAccounts(OPENBOOK_PROGRAM_ID, {
            filters: [
                {
                    dataSize: 388, // OpenBook 市场账户的标准大小
                }
            ]
        });

        console.log(`✅ 找到 ${accounts.length} 个可能的市场账户`);

        if (accounts.length === 0) {
            console.log("❌ 没有找到现有的 OpenBook 市场");
            return null;
        }

        // 显示找到的市场
        console.log("\n📋 找到的市场:");
        for (let i = 0; i < Math.min(accounts.length, 10); i++) {
            const account = accounts[i];
            console.log(`   市场 ${i + 1}: ${account.pubkey.toBase58()}`);
            
            // 尝试解析市场数据来获取更多信息
            try {
                const accountInfo = await connection.getAccountInfo(account.pubkey);
                if (accountInfo && accountInfo.data.length >= 388) {
                    console.log(`     数据大小: ${accountInfo.data.length} bytes`);
                    console.log(`     所有者: ${accountInfo.owner.toBase58()}`);
                }
            } catch (error) {
                console.log(`     无法获取详细信息: ${error}`);
            }
        }

        // 返回第一个市场作为示例
        const firstMarket = accounts[0];
        console.log(`\n✅ 可以使用的市场: ${firstMarket.pubkey.toBase58()}`);
        
        return {
            marketId: firstMarket.pubkey,
            // 注意：这里我们只有市场 ID，其他信息需要从市场数据中解析
            // 为了简化，我们可以使用一些默认值或者实现完整的市场数据解析
        };

    } catch (error) {
        console.error("❌ 查找市场时出错:", error);
        
        // 如果查找失败，尝试使用一些已知的测试市场
        console.log("\n💡 尝试使用已知的测试市场...");
        
        // 这些是一些可能存在的测试市场 ID（需要验证）
        const knownTestMarkets = [
            "8BnEgHoWFysVcuFFX7QztDmzuH8r5ZFvyP3sYwn1XTh6", // 示例市场 ID
            "9wFFyRfQjK8P1TwHW4nCNd4Y4jdtaRWKXP6q2LXuMiCz", // 示例市场 ID
        ];
        
        for (const marketId of knownTestMarkets) {
            try {
                const pubkey = new PublicKey(marketId);
                const accountInfo = await connection.getAccountInfo(pubkey);
                
                if (accountInfo && accountInfo.owner.equals(OPENBOOK_PROGRAM_ID)) {
                    console.log(`✅ 找到有效的测试市场: ${marketId}`);
                    return {
                        marketId: pubkey,
                    };
                }
            } catch (error) {
                console.log(`⚠️  市场 ${marketId} 无效或不存在`);
            }
        }
        
        return null;
    }
}

// 运行查找
findExistingDevnetMarkets().then(result => {
    if (result) {
        console.log("\n🎉 找到可用的市场！");
        console.log("💡 你可以在 poolCreation.ts 中使用这个市场 ID");
        console.log(`📋 市场 ID: ${result.marketId.toBase58()}`);
        
        // 提供使用说明
        console.log("\n📝 使用方法:");
        console.log("1. 复制上面的市场 ID");
        console.log("2. 在 poolCreation.ts 中修改 createDevnetTestPool 函数");
        console.log("3. 直接使用这个市场 ID 而不是创建新市场");
    } else {
        console.log("\n❌ 没有找到可用的市场");
        console.log("💡 需要尝试其他解决方案");
    }
}).catch(console.error);
