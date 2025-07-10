// checkBalance.ts - 检查钱包余额和费用估算
// 查询SOL和USDC余额
// 估算创建OpenBook市场的总费用
// 判断余额是否足够

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// 配置
const RPC_ENDPOINT_URL = "https://devnet.helius-rpc.com/?api-key=61040956-f7ed-40fa-84d3-40c986ab834a";
const USDC_MINT_ADDRESS = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

async function checkBalance(walletAddress: string) {
    console.log("💰 查询钱包余额...");
    console.log(`📍 钱包地址: ${walletAddress}`);
    console.log("=".repeat(60));

    const connection = new Connection(RPC_ENDPOINT_URL, "confirmed");
    const publicKey = new PublicKey(walletAddress);

    try {
        // 1. 查询SOL余额
        const solBalance = await connection.getBalance(publicKey);
        const solAmount = solBalance / LAMPORTS_PER_SOL;
        console.log(`🟡 SOL余额: ${solAmount} SOL`);

        // 2. 计算USDC ATA地址
        const usdcAta = getAssociatedTokenAddressSync(USDC_MINT_ADDRESS, publicKey);
        console.log(`📍 USDC ATA地址: ${usdcAta.toBase58()}`);

        // 3. 查询USDC余额
        try {
            const usdcBalance = await connection.getTokenAccountBalance(usdcAta);
            const usdcAmount = Number(usdcBalance.value.amount) / 10 ** usdcBalance.value.decimals;
            console.log(`💵 USDC余额: ${usdcAmount} USDC`);
        } catch (error) {
            console.log(`❌ USDC ATA不存在或余额为0`);
        }

        // 4. 计算创建 OpenBook 市场需要的费用
        console.log("\n💡 创建 OpenBook 市场费用估算:");
        console.log("-".repeat(40));

        try {
            const marketRent = await connection.getMinimumBalanceForRentExemption(388);
            const requestQueueRent = await connection.getMinimumBalanceForRentExemption(640);
            const eventQueueRent = await connection.getMinimumBalanceForRentExemption(8192);
            const bidsRent = await connection.getMinimumBalanceForRentExemption(4096);
            const asksRent = await connection.getMinimumBalanceForRentExemption(4096);
            const baseVaultRent = await connection.getMinimumBalanceForRentExemption(165);
            const quoteVaultRent = await connection.getMinimumBalanceForRentExemption(165);

            const totalMarketRent = marketRent + requestQueueRent + eventQueueRent + bidsRent + asksRent + baseVaultRent + quoteVaultRent;

            console.log(`📊 市场账户 (388 bytes): ${(marketRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
            console.log(`📊 请求队列 (640 bytes): ${(requestQueueRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
            console.log(`📊 事件队列 (8192 bytes): ${(eventQueueRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
            console.log(`📊 Bids账户 (4096 bytes): ${(bidsRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
            console.log(`📊 Asks账户 (4096 bytes): ${(asksRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
            console.log(`📊 Base Vault (165 bytes): ${(baseVaultRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
            console.log(`📊 Quote Vault (165 bytes): ${(quoteVaultRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
            console.log("-".repeat(40));
            console.log(`💰 创建市场总费用: ${(totalMarketRent / LAMPORTS_PER_SOL).toFixed(6)} SOL`);

            // 5. 检查余额是否足够
            const isEnough = solBalance >= totalMarketRent;
            console.log(`${isEnough ? '✅' : '❌'} 余额${isEnough ? '足够' : '不足'}创建市场`);

            if (!isEnough) {
                const needed = (totalMarketRent - solBalance) / LAMPORTS_PER_SOL;
                console.log(`💡 还需要: ${needed.toFixed(6)} SOL`);
                console.log(`💡 建议: 使用 'solana airdrop ${Math.ceil(needed)} ${publicKey.toBase58()} --url devnet' 获取更多 SOL`);
            }

        } catch (error) {
            console.error("❌ 费用计算失败:", error);
        }

        console.log("=".repeat(60));

    } catch (error) {
        console.error("❌ 查询失败:", error);
    }
}

// 从命令行参数获取钱包地址，如果没有提供则使用默认的开发钱包地址
const WALLET_ADDRESS = process.argv[2] || "BkKsmbeuhbeKSLgHBLQaJMdfKhx8ccsqr2jbWm7TGWNz";

console.log("🔍 Solana钱包余额查询工具");
console.log("使用方法: npx ts-node checkBalance.ts [钱包地址]");
console.log("如果不提供地址，将查询默认开发钱包\n");

checkBalance(WALLET_ADDRESS).catch(console.error);
