/**
 *  Jito API 响应类型定义
 */

// 小费统计 API 响应
export interface TipFloorResponse {
    landed_tips_25th_percentile?: number
    landed_tips_50th_percentile?: number
    landed_tips_75th_percentile?: number
    landed_tips_95th_percentile?: number
    ema_landed_tips_50th_percentile?: number
}

// 标准化的小费统计
export interface TipStatistics {
    percentile_25: number
    percentile_50: number
    percentile_75: number
    percentile_95: number
    ema_landed_tips_50th_percentile: number
}

// 网络状况
export interface NetworkConditions {
    latency: number
    congestion: 'low' | 'medium' | 'high'
    timestamp: Date
    isHealthy: boolean
}
