/**
 * @file 窗口查找器
 * @description 使用 nut-js 动态查找 TFT 游戏窗口，获取窗口位置、检测遮挡状态
 *
 * 核心功能：
 * - 通过窗口标题查找游戏窗口
 * - 获取窗口左上角坐标（用于截图和鼠标操作的基准点）
 * - 检测窗口是否在前台
 * - 自动聚焦窗口
 *
 * @author TFT-Hextech-Helper
 */

import { getWindows, getActiveWindow, Window, Region } from "@nut-tree-fork/nut-js";
import { logger } from "../../utils/Logger";
import { GAME_WIDTH, GAME_HEIGHT } from "../types";
import { SimplePoint } from "../../TFTProtocol";

/**
 * 窗口查找结果
 */
export interface WindowFindResult {
    /** 是否找到窗口 */
    found: boolean;
    /** 窗口左上角坐标 (游戏窗口基准点) */
    origin: SimplePoint | null;
    /** 窗口标题 */
    title: string;
    /** 错误信息 (如果有) */
    error?: string;
}

/**
 * 窗口状态检查结果
 */
export interface WindowStatusResult {
    /** 窗口是否存在 */
    exists: boolean;
    /** 窗口是否在前台（活动状态） */
    isForeground: boolean;
    /** 窗口位置是否与上次相同 */
    positionChanged: boolean;
    /** 当前窗口位置 */
    currentOrigin: SimplePoint | null;
}

/**
 * TFT 游戏窗口标题匹配规则
 * @description LOL/TFT 游戏窗口的标题可能包含这些关键词
 *              使用数组支持多种可能的标题格式
 */
const GAME_WINDOW_TITLES = [
    "League of Legends",  // 游戏主窗口标题
    "League of Legends (TM) Client",  // 有时候带 TM
];

/**
 * 窗口查找器
 * @description 单例模式，负责查找和管理游戏窗口
 *
 * 使用缓存机制减少频繁的窗口查找调用：
 * - 缓存上次找到的窗口句柄
 * - 缓存窗口位置，检测位置变化
 * - 设置最小查找间隔，避免性能问题
 */
class WindowFinder {
    private static instance: WindowFinder;

    /** 缓存的游戏窗口引用 */
    private cachedWindow: Window | null = null;

    /** 缓存的窗口位置 */
    private cachedOrigin: SimplePoint | null = null;

    /** 上次查找时间戳 */
    private lastFindTime: number = 0;

    /** 最小查找间隔 (ms)，避免频繁调用 */
    private readonly MIN_FIND_INTERVAL = 1000;

    /** 最小状态检查间隔 (ms) */
    private readonly MIN_STATUS_CHECK_INTERVAL = 500;

    /** 上次状态检查时间戳 */
    private lastStatusCheckTime: number = 0;

    private constructor() {}

    /**
     * 获取 WindowFinder 单例
     */
    public static getInstance(): WindowFinder {
        if (!WindowFinder.instance) {
            WindowFinder.instance = new WindowFinder();
        }
        return WindowFinder.instance;
    }

    /**
     * 查找游戏窗口并返回窗口位置
     * @param forceRefresh 是否强制刷新（忽略缓存）
     * @returns 窗口查找结果
     *
     * @description
     * 查找逻辑：
     * 1. 获取所有窗口列表
     * 2. 遍历查找标题匹配的窗口
     * 3. 验证窗口尺寸是否符合预期 (1024x768)
     * 4. 返回窗口左上角坐标作为基准点
     */
    public async findGameWindow(forceRefresh: boolean = false): Promise<WindowFindResult> {
        const now = Date.now();

        // 检查缓存是否有效
        if (!forceRefresh &&
            this.cachedWindow &&
            this.cachedOrigin &&
            (now - this.lastFindTime) < this.MIN_FIND_INTERVAL) {
            return {
                found: true,
                origin: this.cachedOrigin,
                title: "(cached)",
            };
        }

        try {
            // 获取所有窗口
            const windows = await getWindows();
            logger.debug(`[WindowFinder] 获取到 ${windows.length} 个窗口`);

            // 遍历查找匹配的窗口
            for (const win of windows) {
                const title = await win.getTitle();

                // 检查标题是否匹配
                const isMatch = GAME_WINDOW_TITLES.some(pattern =>
                    title.includes(pattern)
                );

                if (isMatch) {
                    // 获取窗口区域
                    const region = await win.getRegion();

                    // 验证窗口尺寸
                    // 注意：region 返回的是 { left, top, width, height }
                    const sizeValid = this.validateWindowSize(region);

                    if (!sizeValid) {
                        logger.warn(
                            `[WindowFinder] 找到窗口 "${title}" 但尺寸不符: ` +
                            `${region.width}x${region.height} (期望 ${GAME_WIDTH}x${GAME_HEIGHT})`
                        );
                        // 继续查找，可能有多个 LOL 相关窗口
                        continue;
                    }

                    // 计算窗口左上角坐标
                    const origin: SimplePoint = {
                        x: region.left,
                        y: region.top,
                    };

                    // 更新缓存
                    this.cachedWindow = win;
                    this.cachedOrigin = origin;
                    this.lastFindTime = now;

                    logger.info(
                        `[WindowFinder] 找到游戏窗口: "${title}" ` +
                        `位置: (${origin.x}, ${origin.y}), 尺寸: ${region.width}x${region.height}`
                    );

                    return {
                        found: true,
                        origin,
                        title,
                    };
                }
            }

            // 未找到匹配的窗口
            this.clearCache();
            logger.warn("[WindowFinder] 未找到游戏窗口，请确保游戏已启动");

            return {
                found: false,
                origin: null,
                title: "",
                error: "未找到游戏窗口",
            };

        } catch (e: any) {
            this.clearCache();
            logger.error(`[WindowFinder] 查找窗口异常: ${e.message}`);

            return {
                found: false,
                origin: null,
                title: "",
                error: e.message,
            };
        }
    }

    /**
     * 检查游戏窗口状态
     * @description 检查窗口是否存在、是否在前台、位置是否变化
     * @param lastKnownOrigin 上次已知的窗口位置（用于比较位置变化）
     * @returns 窗口状态结果
     */
    public async checkWindowStatus(lastKnownOrigin?: SimplePoint): Promise<WindowStatusResult> {
        const now = Date.now();

        // 节流检查
        if ((now - this.lastStatusCheckTime) < this.MIN_STATUS_CHECK_INTERVAL) {
            // 返回缓存的状态
            return {
                exists: this.cachedWindow !== null,
                isForeground: false, // 无法确定，返回 false
                positionChanged: false,
                currentOrigin: this.cachedOrigin,
            };
        }

        this.lastStatusCheckTime = now;

        try {
            // 1. 检查窗口是否存在
            const findResult = await this.findGameWindow();

            if (!findResult.found) {
                return {
                    exists: false,
                    isForeground: false,
                    positionChanged: false,
                    currentOrigin: null,
                };
            }

            // 2. 检查是否在前台
            const activeWindow = await getActiveWindow();
            const activeTitle = await activeWindow.getTitle();
            const isForeground = GAME_WINDOW_TITLES.some(pattern =>
                activeTitle.includes(pattern)
            );

            // 3. 检查位置是否变化
            let positionChanged = false;
            if (lastKnownOrigin && findResult.origin) {
                positionChanged = (
                    lastKnownOrigin.x !== findResult.origin.x ||
                    lastKnownOrigin.y !== findResult.origin.y
                );
            }

            if (positionChanged) {
                logger.info(
                    `[WindowFinder] 检测到窗口位置变化: ` +
                    `(${lastKnownOrigin?.x}, ${lastKnownOrigin?.y}) -> ` +
                    `(${findResult.origin?.x}, ${findResult.origin?.y})`
                );
            }

            return {
                exists: true,
                isForeground,
                positionChanged,
                currentOrigin: findResult.origin,
            };

        } catch (e: any) {
            logger.error(`[WindowFinder] 检查窗口状态异常: ${e.message}`);
            return {
                exists: false,
                isForeground: false,
                positionChanged: false,
                currentOrigin: null,
            };
        }
    }

    /**
     * 尝试聚焦游戏窗口
     * @description 将游戏窗口置于前台
     * @returns 是否成功聚焦
     */
    public async focusGameWindow(): Promise<boolean> {
        try {
            // 如果没有缓存的窗口，先查找
            if (!this.cachedWindow) {
                const findResult = await this.findGameWindow(true);
                if (!findResult.found) {
                    logger.warn("[WindowFinder] 无法聚焦：未找到游戏窗口");
                    return false;
                }
            }

            // 聚焦窗口
            const success = await this.cachedWindow!.focus();

            if (success) {
                logger.info("[WindowFinder] 已聚焦游戏窗口");
            } else {
                logger.warn("[WindowFinder] 聚焦游戏窗口失败");
            }

            return success;

        } catch (e: any) {
            logger.error(`[WindowFinder] 聚焦窗口异常: ${e.message}`);
            return false;
        }
    }

    /**
     * 获取当前缓存的窗口位置
     * @description 快速获取缓存位置，不触发新的窗口查找
     */
    public getCachedOrigin(): SimplePoint | null {
        return this.cachedOrigin;
    }

    /**
     * 清除缓存
     * @description 在窗口丢失或需要强制刷新时调用
     */
    public clearCache(): void {
        this.cachedWindow = null;
        this.cachedOrigin = null;
        this.lastFindTime = 0;
        logger.debug("[WindowFinder] 缓存已清除");
    }

    /**
     * 验证窗口尺寸是否符合预期
     * @param region 窗口区域
     * @returns 尺寸是否有效
     *
     * @description
     * TFT 游戏窗口固定为 1024x768，但实际窗口可能有边框
     * 允许一定的误差范围 (±10 像素)
     */
    private validateWindowSize(region: Region): boolean {
        const tolerance = 10; // 允许的误差

        const widthValid = Math.abs(region.width - GAME_WIDTH) <= tolerance;
        const heightValid = Math.abs(region.height - GAME_HEIGHT) <= tolerance;

        return widthValid && heightValid;
    }
}

// ============================================================================
// 导出
// ============================================================================

/** WindowFinder 单例实例 */
export const windowFinder = WindowFinder.getInstance();
