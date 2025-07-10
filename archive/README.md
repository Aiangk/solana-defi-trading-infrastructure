# Archive 目录说明

这个目录包含了 DeFi 开发过程中的历史文件和实验性代码，按功能分类整理。

## 📁 目录结构

### debugging/ - 调试工具
- `raydiumFeeDebugger.ts` - 深度错误分析工具，专门用于调试 InvalidFee 错误
- `raydiumFeeAnalysis.ts` - 费用机制研究工具，分析现有池子的费用配置
- `finalRaydiumFix.ts` - 最终修复尝试，基于真实池子数据的解决方案
- `debugRaydiumPDA.ts` - PDA 计算调试工具
- `simulateRaydiumInit.ts` - 池子初始化模拟工具

### experimental/ - 实验性代码
- `orcaSwapTest.ts` - Orca SDK 集成实验
- `simpleOrcaSwap.ts` - 简化的 Orca swap 演示
- `universalDeFiFramework.ts` - 通用 DeFi 交易框架
- `selfBuiltPoolSwapDemo.ts` - 自建池子 swap 演示
- `swapInstructions.ts` - swap 指令构造实验
- `priceCalculation.ts` - 价格计算逻辑

### analysis/ - 分析工具
- `findExistingMarkets.ts` - 查找现有 OpenBook 市场
- `findDevnetMarkets.ts` - 查找 devnet 市场
- `findDevnetPools.ts` - 查找 devnet 池子
- `estimateRent.ts` - 租金费用估算工具
- `analyzeOpenBookInstructions.ts` - OpenBook 指令分析
- `checkBalance.ts` - 余额检查工具

### existing-pools/ - 现有池子相关
- `raydiumExistingPoolSwap.ts` - 基于现有 Raydium 池子的 swap 实现

## 🎯 文件价值说明

### 高价值文件 (建议保留)
- **调试工具**: 包含了深度的错误分析逻辑，对理解 DeFi 协议很有价值
- **分析工具**: 大规模数据分析的实现，可以复用到其他项目
- **实验框架**: 通用 DeFi 框架的原型，有扩展价值

### 学习价值文件
- **实验性代码**: 展示了不同的实现方法和思路
- **调试过程**: 记录了完整的问题解决过程

## 🔄 使用建议

1. **参考学习**: 这些文件记录了完整的 DeFi 开发学习过程
2. **代码复用**: 调试和分析工具可以在新项目中复用
3. **历史追溯**: 如果需要了解某个问题的解决过程，可以查看相关文件
4. **扩展开发**: 实验性框架可以作为新功能开发的起点

## ⚠️ 注意事项

- 这些文件主要用于参考和学习，不建议直接在生产环境使用
- 部分文件可能包含过时的配置或依赖
- 建议在使用前检查和更新相关依赖

## 🗂️ 整理日期

整理时间: 2025年1月
整理原因: 为继续深化 DeFi 开发做准备，突出主项目 `custom-raydium-pool-project`
