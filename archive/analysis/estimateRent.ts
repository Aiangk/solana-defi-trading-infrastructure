// estimateRent.ts - 估算租金成本
// 计算各种账户的租金需求
// 提供费用预算建议

import { Connection, PublicKey } from "@solana/web3.js";
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function estimateOpenBookMarketRent() {
    console.log("💰 估算创建 OpenBook 市场所需的 SOL...");

    const connection = new Connection(
        process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
    );

    // OpenBook 市场各种账户的大小
    const accountSizes = {
        market: 388,           // 市场账户
        requestQueue: 640,     // 请求队列
        eventQueue: 1024,      // 事件队列  
        bids: 65536,          // 买单账户
        asks: 65536,          // 卖单账户
        baseVault: 165,       // 基础代币 vault
        quoteVault: 165,      // 报价代币 vault
    };

    let totalRent = 0;

    console.log("📊 各账户租金估算:");

    for (const [accountType, size] of Object.entries(accountSizes)) {
        const rent = await connection.getMinimumBalanceForRentExemption(size);
        const solAmount = rent / 1e9; // 转换为 SOL
        console.log(`   ${accountType.padEnd(12)}: ${size.toString().padStart(6)} bytes = ${solAmount.toFixed(6)} SOL`);
        totalRent += rent;
    }

    const totalSol = totalRent / 1e9;
    const recommendedSol = totalSol * 1.2; // 加 20% 缓冲

    console.log("\n💡 总计:");
    console.log(`   最少需要: ${totalSol.toFixed(6)} SOL`);
    console.log(`   推荐准备: ${recommendedSol.toFixed(6)} SOL (包含缓冲)`);
    console.log(`   当前余额: ${(await connection.getBalance(new PublicKey(process.env.WALLET_PUBLIC_KEY!))).toFixed(6)} SOL`);

    return recommendedSol;
}

// 运行估算
estimateOpenBookMarketRent().catch(console.error);
