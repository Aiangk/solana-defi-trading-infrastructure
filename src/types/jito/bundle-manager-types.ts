import { Transaction, PublicKey } from '@solana/web3.js'
import { BundleOptions, BundleSubmissionResult, BundleStatusResult, BundleStatus } from './bundle-types'
import { JitoError } from './jito-types'

//为什么时间字段有些是可选的？ 因为 Bundle 在不同阶段可能还没有到达某些时间点
//为什么需要两个 ID？ id 是内部管理用的唯一标识，bundleId 是 Jito 返回的官方 ID
// 为什么需要事件系统？ 允许异步处理 Bundle 状态变化，支持松耦合的架构
// 事件监听器为什么支持异步？ 某些事件处理可能需要网络调用或复杂计算

/**
 *  Bundle 管理器配置
 * 这个接口定义了 Bundle 管理器的核心配置参数
 */
export interface BundleManagerConfig {
  // 最大并发 Bundle 数量 -- 防止网络拥堵
  maxConcurrentBundles: number

  // Bundle 状态检查间隔（毫秒） -- 控制监控频率
  statusCheckInterval: number

  // Bundle 超时时间（毫秒） -- 避免无限等待
  bundleTimeout: number

  // 是否启用自动重试 -- 提高成功率
  enableAutoRetry: boolean

  // 是否启用性能监控 -- 收集执行数据
  enablePerformanceMonitoring: boolean

  // 是否启用事件通知 -- 支持异步处理
  enableEventNotifications: boolean
}

/**
 * Bundle 实例信息
 * 这个接口定义了单个 Bundle 的完整生命周期信息
 */
export interface BundleInstance {
  // Bundle 唯一标识符 -- 内部管理用
  id: string

  // Budle ID (来自 Jito) -- 官方返回的 ID
  bundleId: string

  // 交易列表 -- 包含所有的交易
  transactions: Transaction[]

  // Bundle 选项 -- 提交时的配置
  options: BundleOptions

  // 创建时间 -- 用于性能分析
  createdAt: Date

  // 提交时间 -- 记录提交时刻
  submittedAt?: Date

  // 完成时间 -- 记录确认时刻
  completedAt?: Date

  // 当前状态 -- 实时状态跟踪
  status: BundleStatus

  // 重试次数 -- 失败重试计数
  retryCount: number

  // 错误信息 -- 失败时的详细信息
  error?: JitoError

  // 性能指标 -- 执行性能数据
  metrics: BundleMetrics
}

/**
 * Bundle 性能指标
 * 用于收集和分析 Bundle 执行性能
 */
export interface BundleMetrics {
  // 创建到提交的时间 （毫秒） -- 处理延迟
  submissionTime?: number

  // 提交到确认的时间 （毫秒） -- 网络延迟
  confirmationTime?: number

  // 总执行时间 （毫秒） -- 完整周期时间
  totalTime?: number

  // 小费金额 （lamports） -- 支付的费用
  tipAmount: number

  // 交易数量 -- Bundle 大小
  transactionCount: number

  // 是否成功 -- 最终结果
  success: boolean
}

/**
 * Bundle 事件类型
 * 定义 Bundle 生命周期中的关键事件
 */
export enum BundleEventType {
  CREATED = 'created',  // Bundle 创建
  SUBMITTED = 'submitted', // Bundle 提交
  CONFIRMED = 'confirmed', // Bundle 确认
  FAILED = 'failed', // Bundle 失败
  TIMEOUT = 'timeout', // Bundle 超时
  RETRY = 'retry' // Bundle 重试
}

/**
 * Bundle 事件
 * 事件系统的核心数据结构
 */
export interface BundleEvent {
  // 事件类型 --标识事件种类
  type: BundleEventType

  // Bundle 实例 -- 事件关联的 Bundle
  bundle: BundleInstance

  // 事件时间 -- 事件发生时刻
  timestamp: Date

  // 事件数据 -- 额外的事件信息
  data?: any
}

/**
 * Bundle 事件监听器
 * 用于处理 Bundle 事件的回调函数
 */
export type BundleEventListener = (event: BundleEvent) => void | Promise<void>

/**
 * Bundle 管理器统计信息
 * 提供整体性能和状态的统计数据
 */
export interface BundleManagerStats {
  // 总 Bundle 数量 -- 历史总数
  totalBundles: number

  // 活跃 Bundle 数量 -- 当前处理中的数量
  activeBundles: number

  // 成功 Bundle 数量 -- 成功确认的数量
  successfulBundles: number

  // 失败 Bundle 数量 -- 失败的数量
  failedBundles: number

  // 平均确认时间 （毫秒） -- 性能指标
  averageConfirmationTime: number

  // 平均小费金额（lamports） -- 成本分析
  averageTipAmount: number

  // 成功率（百分比）  -- 质量指标
  successRate: number

  // 最后更新事件 -- 数据时效性
  lastUpdated: Date
}


/**
 * Bundle 查询选项
 * 支持灵活的 Bundle 查询和过滤
 */
export interface BundleQueryOptions {
  // 状态过滤 -- 按状态筛选 Bundle
  status?: BundleStatus[]

  // 时间范围过滤 -- 按时间范围筛选
  timeRange?: {
    start: Date
    end: Date
  }

  // 分页选项 -- 支持大量数据的分页查询
  pagination?: {
    offset: number
    limit: number
  }

  // 排序选项 -- 自定义排序规则
  sort?: {
    field: keyof BundleInstance
    order: 'asc' | 'desc'
  }
}

/**
 * Bundle 批量操作结果
 * 批量操作的统一返回格式
 */
export interface BundleBatchResult {
  // 成功的 Bundle -- 操作成功的 Bundle 列表
  successful: BundleInstance[]

  // 失败的 Bundle -- 操作失败的 Bundle 和错误信息
  failed: Array<{
    bundle: BundleInstance
    error: JitoError
  }>

  // 总数 -- 操作的总 Bundle 数量
  total: number

  // 成功数 -- 成功操作的数量
  successCount: number

  // 失败数 -- 失败操作的数量
  failureCount: number
}

/**
 * Bundle 优先级队列项
 * 支持优先级调度的队列项
 */
export interface BundleQueueItem {
  // Bundle 实例 -- 队列中的 Bundle
  bundle: BundleInstance

  // 优先级（数字越大优先级越高） -- 调度优先级
  priority: number

  // 加入队列时间 -- 用于队列管理
  queuedAt: Date
}

/**
 * Bundle 管理器接口
 * 定义 Bundle 管理器的核心功能和方法
 */
export interface IBundleManager {
  // 创建 Bundle -- 创建新的 Bundle 实例但不提交
  createBundle(transactions: Transaction[], options?: Partial<BundleOptions>): Promise<BundleInstance>

  // 提交 Bundle -- 将 Bundle 提交到 Jito 网络
  submitBundle(bundleId: string): Promise<BundleSubmissionResult>

  // 批量提交 Bundle -- 同时提交多个 Bundle
  submitBundles(bundleIds: string[]): Promise<BundleBatchResult>

  // 获取 Bundle 状态 -- 查询 Bundle 的当前状态
  getBundleStatus(bundleId: string): Promise<BundleStatusResult>

  // 取消 Bundle -- 取消未提交或处理中的 Bundle
  cancelBundle(bundleId: string): Promise<boolean>

  // 重试 Bundle -- 重新提交失败的 Bundle
  retryBundle(bundleId: string): Promise<BundleSubmissionResult>

  // 查询 Bundle -- 根据条件查询 Bundle 列表
  queryBundles(options?: BundleQueryOptions): Promise<BundleInstance[]>

  // 获取统计信息 -- 获取管理器的性能统计
  getStats(): BundleManagerStats

  // 添加事件监听器 -- 监听 Bundle 事件
  addEventListener(type: BundleEventType, listener: BundleEventListener): void

  // 移除事件监听器 -- 移除事件监听
  removeEventListener(type: BundleEventType, listener: BundleEventListener): void

  // 启动管理器 -- 启动后台监控和处理服务
  start(): Promise<void>

  // 停止管理器 -- 停止所有服务并清理资源
  stop(): Promise<void>

}