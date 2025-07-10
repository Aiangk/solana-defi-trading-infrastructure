// findDevnetMarkets.ts 和 findExistingMarkets.ts - 查找现有的OpenBook市场
// 搜索已存在的OpenBook Devnet市场
// 目的是复用现有市场，避免创建新市 场的高成本


import { Connection, PublicKey } from "@solana/web3.js";
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const OPENBOOK_PROGRAM_ID = new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

async function findExistingOpenBookMarkets() {
    console.log("🔍 查找现有的 OpenBook Devnet 市场...");

    const connection = new Connection(
        "https://api.devnet.solana.com",
        "confirmed"
    );

    try {
        // 查找所有 OpenBook 程序拥有的账户
        console.log("📊 搜索 OpenBook 程序账户...");

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
            console.log("💡 建议:");
            console.log("   1. 获取更多测试 SOL: https://faucet.solana.com");
            console.log("   2. 或者使用 Orca 池子进行测试");
            return null;
        }

        // 显示找到的市场
        console.log("\n📋 找到的市场:");
        for (let i = 0; i < Math.min(accounts.length, 5); i++) {
            const account = accounts[i];
            console.log(`   市场 ${i + 1}: ${account.pubkey.toBase58()}`);
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
        return null;
    }
}

// 运行查找
findExistingOpenBookMarkets().then(result => {
    if (result) {
        console.log("\n🎉 找到可用的市场！");
        console.log("💡 你可以在 poolCreation.ts 中使用这个市场 ID");
    } else {
        console.log("\n💰 建议获取更多测试 SOL 来创建新市场");
        console.log("🌐 访问: https://faucet.solana.com");
    }
}).catch(console.error);
