/**
 * Solana MEV 保护交易系统 - 主入口文件
 *
 * 这是一个生产级的 Solana DeFi 交易系统，具备以下核心功能：
 *
 * 🎯 核心功能：
 * 1. 高级指令提取+构建系统（VersionedTransaction vs Legacy Transaction）
 * 2. MEV 保护机制和 Jito Bundle 集成
 * 3. 智能代币映射和多协议聚合（Jupiter, Orca）
 * 4. 生产级错误处理和回退策略
 * 5. 模块化架构设计和接口抽象
 *
 * 🛠️ 技术栈：
 * - Solana Web3.js
 * - Jupiter V6 API
 * - Orca Whirlpools SDK
 * - Jito Bundle API
 * - TypeScript
 *
 * 📋 项目亮点：
 * - 深度理解 Solana 交易结构和账户权限计算
 * - 创新的指令解析和重建算法
 * - 完善的 MEV 保护和 Bundle 管理机制
 * - 生产级的错误处理和智能回退策略
 * - 模块化、可扩展的系统架构设计
 *
 * @author Aiangk
 * @version 1.0.0
 */

// 🎯 核心模块导出
export { UnifiedDexFacade } from './core/facade/unified-dex-facade';
export { DexAggregator } from './core/aggregator/dex-aggregator';
export { BundleManager } from './core/jito/bundle-manager';
export { JitoClient } from './core/jito/jito-client';

// 🔗 协议实现导出
export { JupiterProtocol } from './protocols/jupiter/jupiter-protocol';
export { OrcaProtocol } from './protocols/orca/orca-protocol';

// 📝 类型定义导出
export type { DEXProtocol, DEXQuote } from './types/dex/protocol';
export type { BundleConfig, BundleResult } from './types/jito/bundle';
export type { MevProtectionConfig } from './types/mev/protection';

// ⚙️ 配置导出
export { createProductionConnection, createDevelopmentConnection } from './config/network-config';
export { createJitoConfig } from './config/jito-config';

// 🛠️ 工具函数导出
export { SmartJupiterClient } from './utils/token-mapper';
export { AdvancedInstructionBuilder } from './utils/advanced-instruction-builder';

// 🎭 示例导出
export { ProductionDemo } from './examples/production-demo';

// 系统信息
const SYSTEM_INFO = {
    name: 'Solana MEV 保护交易系统',
    version: '1.0.0',
    author: 'Aiangk',
    description: '生产级 DeFi 交易系统，集成 MEV 保护和多协议聚合',
    features: [
        '高级指令提取+构建系统',
        'MEV 保护机制和 Jito Bundle 集成',
        '智能代币映射和多协议聚合',
        '生产级错误处理和回退策略',
        '模块化架构设计和接口抽象'
    ]
};

console.log(`🚀 ${SYSTEM_INFO.name} v${SYSTEM_INFO.version} 已加载`);
console.log(`📚 使用示例: import { UnifiedDexFacade, ProductionDemo } from "solana-mev-trader"`);

export { SYSTEM_INFO };
