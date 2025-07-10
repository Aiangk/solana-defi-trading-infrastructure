// analyzeOpenBookInstructions.ts - 分析OpenBook V2 SDK生成的指令
// 详细分析创建市场所需的指令和账户
// 计算租金成本和资源需求
// 诊断"insufficient lamports"等错误


import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { OpenBookV2Client } from '@openbook-dex/openbook-v2';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';
import BN = require('bn.js');

async function analyzeInstructions() {
    const connection = new Connection('https://devnet.helius-rpc.com/?api-key=61040956-f7ed-40fa-84d3-40c986ab834a');
    const secretKey = JSON.parse(fs.readFileSync('devnet-wallet.json', 'utf8'));
    const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
    const wallet = new Wallet(keypair);

    const OPENBOOK_PROGRAM_ID = new PublicKey('opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb');
    const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
    const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');

    try {
        const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
        const client = new OpenBookV2Client(provider, OPENBOOK_PROGRAM_ID);

        console.log('🔍 分析 OpenBook V2 SDK 生成的指令...');
        console.log(`钱包地址: ${wallet.publicKey.toBase58()}`);
        console.log(`当前余额: ${(await connection.getBalance(wallet.publicKey)) / 10 ** 9} SOL`);

        // 生成指令
        const name = 'SOL-USDC';
        const [ixs, signers] = await client.createMarketIx(
            wallet.publicKey,
            name,
            USDC_MINT,
            SOL_MINT,
            new BN(1),
            new BN(1000000),
            new BN(1000),
            new BN(1000),
            new BN(0),
            null, null, null, null, null
        );

        console.log(`\n📊 生成了 ${ixs.length} 个指令，${signers.length} 个签名者`);

        // 分析每个指令
        for (let i = 0; i < ixs.length; i++) {
            const ix = ixs[i];
            console.log(`\n🔧 指令 ${i}:`);
            console.log(`  程序ID: ${ix.programId.toBase58()}`);
            console.log(`  数据长度: ${ix.data.length} bytes`);
            console.log(`  账户数量: ${ix.keys.length}`);

            // 如果是 System Program 指令
            if (ix.programId.equals(SystemProgram.programId)) {
                console.log(`  📋 System Program 指令分析:`);

                if (ix.data.length >= 4) {
                    const instructionType = ix.data.readUInt32LE(0);
                    console.log(`    指令类型: ${instructionType}`);

                    if (instructionType === 0 && ix.data.length >= 52) { // CreateAccount
                        const lamports = ix.data.readBigUInt64LE(4);
                        const space = ix.data.readBigUInt64LE(12);
                        const owner = new PublicKey(ix.data.slice(20, 52));

                        console.log(`    💰 CreateAccount 指令:`);
                        console.log(`      需要 lamports: ${Number(lamports)} (${Number(lamports) / 10 ** 9} SOL)`);
                        console.log(`      账户空间: ${Number(space)} bytes`);
                        console.log(`      所有者: ${owner.toBase58()}`);

                        // 检查目标账户
                        if (ix.keys.length >= 2) {
                            const targetAccount = ix.keys[1].pubkey;
                            console.log(`      目标账户: ${targetAccount.toBase58()}`);

                            const balance = await connection.getBalance(targetAccount);
                            console.log(`      当前余额: ${balance} lamports (${balance / 10 ** 9} SOL)`);

                            if (balance > 0) {
                                console.log(`      ⚠️  账户已存在！这可能导致 "account already in use" 错误`);
                            }
                        }
                    }
                }
            } else {
                console.log(`  📋 OpenBook 程序指令`);
            }

            // 显示账户信息
            console.log(`  📋 涉及的账户:`);
            for (let j = 0; j < Math.min(ix.keys.length, 5); j++) { // 只显示前5个账户
                const key = ix.keys[j];
                console.log(`    ${j}: ${key.pubkey.toBase58()} (${key.isSigner ? 'signer' : 'non-signer'}, ${key.isWritable ? 'writable' : 'readonly'})`);
            }
            if (ix.keys.length > 5) {
                console.log(`    ... 还有 ${ix.keys.length - 5} 个账户`);
            }
        }

        // 分析签名者
        console.log(`\n🔑 签名者分析:`);
        for (let i = 0; i < signers.length; i++) {
            const signer = signers[i];
            const balance = await connection.getBalance(signer.publicKey);
            console.log(`  签名者 ${i}: ${signer.publicKey.toBase58()}`);
            console.log(`    余额: ${balance} lamports (${balance / 10 ** 9} SOL)`);

            if (balance > 0) {
                console.log(`    ⚠️  这个账户已经存在，可能会导致冲突`);
            }
        }

        // 计算总的租金需求
        let totalRentNeeded = 0;
        for (const ix of ixs) {
            if (ix.programId.equals(SystemProgram.programId) && ix.data.length >= 52) {
                const instructionType = ix.data.readUInt32LE(0);
                if (instructionType === 0) { // CreateAccount
                    const lamports = Number(ix.data.readBigUInt64LE(4));
                    totalRentNeeded += lamports;
                }
            }
        }

        console.log(`\n💰 总租金需求: ${totalRentNeeded} lamports (${totalRentNeeded / 10 ** 9} SOL)`);
        console.log(`💰 当前余额: ${await connection.getBalance(wallet.publicKey)} lamports`);
        console.log(`💰 余额是否足够: ${await connection.getBalance(wallet.publicKey) >= totalRentNeeded ? '✅ 是' : '❌ 否'}`);

    } catch (error) {
        console.error('❌ 分析失败:', error);
    }
}

analyzeInstructions().catch(console.error);
