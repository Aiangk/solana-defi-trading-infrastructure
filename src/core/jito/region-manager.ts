import { JitoRegion, RegionHealthMetrics, RegionSwitchEvent } from '../../types/jito/jito-types'
import { JITO_REGIONAL_ENDPOINTS, REGION_PRIORITY_CONFIG, RegionSwitchConfig, DEFAULT_REGION_SWITCH_CONFIG, RegionHealthStatus } from '../../config/jito-config'


/**
 * Jito 区域管理器
 * 负责多区域端点的健康监控、自动切换和负载均衡
 */
export class JitoRegionManager {
    private config: RegionSwitchConfig
    private network: 'mainnet' | 'testnet' | 'devnet'
    private currentRegion: JitoRegion
    private regionHealth: Map<JitoRegion, RegionHealthStatus>
    private switchHistory: RegionSwitchEvent[]
    private healthCheckTimer?: NodeJS.Timeout
    private isHealthChecking: boolean = false

    constructor(
        network: 'mainnet' | 'testnet' | 'devnet' = 'mainnet',
        config?: Partial<RegionSwitchConfig>
    ) {
        this.network = network
        this.config = { ...DEFAULT_REGION_SWITCH_CONFIG, ...config }
        this.regionHealth = new Map()
        this.switchHistory = []

        // 初始化区域健康状态
        this.initializeRegionHealth()

        // 选择初始区域
        this.currentRegion = this.selectBestRegion()

        // 启动健康检查
        if (this.config.enableAutoSwitch) {
            this.startHealthCheck()
        }

        this.log('info', `Region Manager initialized for ${network}, current region: ${this.currentRegion}`)
    }

    /**
     * 获取当前最佳端点
     */
    getCurrentEndpoint(): string {
        const endpoints = JITO_REGIONAL_ENDPOINTS[this.network]
        return endpoints[this.currentRegion] || endpoints.global
    }

    /**
     * 获取当前区域
     */
    getCurrentRegion(): JitoRegion {
        return this.currentRegion
    }

    /**
     * 手动切换到指定区域
     */
    async switchToRegion(region: JitoRegion, reason: string = 'manual'): Promise<boolean> {
        const endpoints = JITO_REGIONAL_ENDPOINTS[this.network]

        if (!endpoints[region]) {
            this.log('warn', `Region ${region} not available for ${this.network}`)
            return false
        }

        const oldRegion = this.currentRegion
        this.currentRegion = region

        // 记录切换事件
        const switchEvent: RegionSwitchEvent = {
            fromRegion: oldRegion,
            toRegion: region,
            reason: reason as any,
            timestamp: new Date()
        }

        this.switchHistory.push(switchEvent)
        this.log('info', `Switched from ${oldRegion} to ${region}, reason: ${reason}`)

        return true
    }

    /**
     * 报告区域错误（用于触发自动切换）
     */
    async reportRegionError(region: JitoRegion, error: Error, responseTime?: number): Promise<void> {
        const health = this.regionHealth.get(region)
        if (!health) return

        health.errorCount++
        health.lastChecked = new Date()

        if (responseTime) {
            health.responseTime = responseTime
        }

        // 检查是否是限流错误
        if (error.message.includes('429') || error.message.includes('rate limit')) {
            health.rateLimitHit = true
            health.lastRateLimitTime = new Date()
            this.log('warn', `Rate limit hit for region ${region}`)
        }

        // 更新健康状态
        this.updateRegionHealthStatus(region)

        // 如果当前区域不健康，尝试切换
        if (region === this.currentRegion && !health.isHealthy && this.config.enableAutoSwitch) {
            await this.autoSwitchRegion('error_rate')
        }
    }

    /**
     * 报告区域成功（用于健康状态更新）
     */
    async reportRegionSuccess(region: JitoRegion, responseTime: number): Promise<void> {
        const health = this.regionHealth.get(region)
        if (!health) return

        health.successCount++
        health.responseTime = responseTime
        health.lastChecked = new Date()
        health.rateLimitHit = false

        // 更新健康状态
        this.updateRegionHealthStatus(region)
    }

    /**
     * 获取所有区域健康状态
     */
    getRegionHealthStatus(): RegionHealthStatus[] {
        return Array.from(this.regionHealth.values())
    }

    /**
     * 获取区域切换历史
     */
    getSwitchHistory(): RegionSwitchEvent[] {
        return [...this.switchHistory]
    }

    /**
     * 停止健康检查
     */
    stop(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer)
            this.healthCheckTimer = undefined
        }
        this.log('info', 'Region Manager stopped')
    }

    // ==================== 私有方法 ====================

    /**
     * 初始化区域健康状态
     */
    private initializeRegionHealth(): void {
        const endpoints = JITO_REGIONAL_ENDPOINTS[this.network]

        for (const [region, endpoint] of Object.entries(endpoints)) {
            const health: RegionHealthStatus = {
                region,
                endpoint,
                isHealthy: true,
                lastChecked: new Date(),
                responseTime: 0,
                errorCount: 0,
                successCount: 0,
                rateLimitHit: false
            }

            this.regionHealth.set(region as JitoRegion, health)
        }
    }

    /**
     * 选择最佳区域
     */
    private selectBestRegion(): JitoRegion {
        const priorities = REGION_PRIORITY_CONFIG[this.config.userRegion]
        const availableRegions = Object.keys(JITO_REGIONAL_ENDPOINTS[this.network])

        // 找到第一个可用且健康的区域
        for (const region of priorities) {
            if (availableRegions.includes(region)) {
                const health = this.regionHealth.get(region as JitoRegion)
                if (health?.isHealthy && !health.rateLimitHit) {
                    return region as JitoRegion
                }
            }
        }

        // 如果没有找到，返回全局端点
        return 'global'
    }

    /**
     * 自动切换区域
     */
    private async autoSwitchRegion(reason: 'rate_limit' | 'timeout' | 'error_rate'): Promise<void> {
        const newRegion = this.selectBestRegion()

        if (newRegion !== this.currentRegion) {
            await this.switchToRegion(newRegion, reason)
        }
    }

    /**
     * 更新区域健康状态
     */
    private updateRegionHealthStatus(region: JitoRegion): void {
        const health = this.regionHealth.get(region)
        if (!health) return

        const totalRequests = health.errorCount + health.successCount
        const errorRate = totalRequests > 0 ? health.errorCount / totalRequests : 0

        // 检查限流冷却
        const rateLimitCooledDown = !health.lastRateLimitTime ||
            (Date.now() - health.lastRateLimitTime.getTime()) > this.config.switchThresholds.rateLimitCooldown

        // 更新健康状态
        health.isHealthy =
            errorRate <= this.config.switchThresholds.maxErrorRate &&
            health.responseTime <= this.config.switchThresholds.maxResponseTime &&
            (!health.rateLimitHit || rateLimitCooledDown)

        if (rateLimitCooledDown && health.rateLimitHit) {
            health.rateLimitHit = false
            this.log('info', `Rate limit cooldown completed for region ${region}`)
        }
    }

    /**
     * 启动健康检查
     */
    private startHealthCheck(): void {
        this.healthCheckTimer = setInterval(async () => {
            if (this.isHealthChecking) return

            this.isHealthChecking = true
            try {
                await this.performHealthCheck()
            } catch (error) {
                this.log('error', `Health check failed: ${error}`)
            } finally {
                this.isHealthChecking = false
            }
        }, this.config.healthCheckInterval)
    }

    /**
     * 执行健康检查
     */
    private async performHealthCheck(): Promise<void> {
        const endpoints = JITO_REGIONAL_ENDPOINTS[this.network]
        const healthCheckPromises: Promise<void>[] = []

        for (const [region, endpoint] of Object.entries(endpoints)) {
            if (this.config.enableConcurrentHealthCheck) {
                healthCheckPromises.push(this.checkRegionHealth(region as JitoRegion, endpoint))
            } else {
                await this.checkRegionHealth(region as JitoRegion, endpoint)
            }
        }

        if (this.config.enableConcurrentHealthCheck) {
            await Promise.allSettled(healthCheckPromises)
        }

        // 检查当前区域是否需要切换
        const currentHealth = this.regionHealth.get(this.currentRegion)
        if (currentHealth && !currentHealth.isHealthy) {
            await this.autoSwitchRegion('error_rate')
        }
    }

    /**
     * 检查单个区域健康状态
     */
    private async checkRegionHealth(region: JitoRegion, endpoint: string): Promise<void> {
        const startTime = Date.now()

        try {
            // 简单的健康检查 - 调用 getTipAccounts
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTipAccounts',
                    params: []
                }),
                signal: AbortSignal.timeout(5000) // 5秒超时
            })

            const responseTime = Date.now() - startTime

            if (response.ok) {
                await this.reportRegionSuccess(region, responseTime)
            } else if (response.status === 429) {
                throw new Error('Rate limit exceeded')
            } else {
                throw new Error(`HTTP ${response.status}`)
            }
        } catch (error) {
            const responseTime = Date.now() - startTime
            await this.reportRegionError(region, error as Error, responseTime)
        }
    }

    /**
     * 日志记录
     */
    private log(level: 'info' | 'warn' | 'error', message: string): void {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] [RegionManager] [${level.toUpperCase()}] ${message}`)
    }
}