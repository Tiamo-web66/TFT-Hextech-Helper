/**
 * 全局设置存储 - 单例模式
 * 作为前端与后端 SettingsStore 通信的唯一入口
 *
 * 使用方式：
 * 1. settingsStore.subscribe(callback) - 订阅变化
 * 2. settingsStore.setShowDebugPage(value) - 修改值并通知订阅者
 *
 * 注意：其他组件不应该直接调用 window.settings，应该通过本 store 访问
 */

/**
 * 窗口遮挡行为枚举（与后端保持一致）
 */
export enum WindowOcclusionBehavior {
    /** 自动聚焦：自动将游戏窗口置于前台，继续操作 */
    AUTO_FOCUS = 'auto_focus',
    /** 暂停并提醒：暂停操作，等待用户手动切换窗口 */
    PAUSE_AND_WARN = 'pause_and_warn',
}

// 设置变化监听器类型
type SettingsListener = (settings: SettingsState) => void;

// 设置状态接口（前端关心的设置项）
interface SettingsState {
    showDebugPage: boolean;
    darkMode: boolean;  // 喵~ 新增：暗黑模式开关
    windowOcclusionBehavior: WindowOcclusionBehavior;  // 窗口遮挡时的行为
}

class SettingsStore {
    // 内部状态（从后端同步的缓存）
    private state: SettingsState = {
        showDebugPage: false,
        darkMode: false,  // 喵~ 默认为浅色模式
        windowOcclusionBehavior: WindowOcclusionBehavior.AUTO_FOCUS,  // 默认自动聚焦
    };
    
    // 订阅者列表
    private listeners: Set<SettingsListener> = new Set();
    
    // 是否已初始化
    private initialized = false;

    /**
     * 初始化：从后端加载设置（只执行一次）
     */
    async init(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        try {
            // 通过通用 settings API 读取后端设置
            const showDebugPage = await window.settings.get<boolean>('showDebugPage');
            this.state.showDebugPage = showDebugPage;

            // 喵~ 读取暗黑模式设置（如果后端没有存过，则默认 false）
            const darkMode = await window.settings.get<boolean>('darkMode');
            this.state.darkMode = darkMode !== undefined ? darkMode : false;

            // 读取窗口遮挡行为设置
            const windowOcclusionBehavior = await window.settings.get<WindowOcclusionBehavior>('windowOcclusionBehavior');
            this.state.windowOcclusionBehavior = windowOcclusionBehavior || WindowOcclusionBehavior.AUTO_FOCUS;

            this.notifyListeners();
        } catch (error) {
            console.error('[SettingsStore] 初始化失败:', error);
        }
    }

    /**
     * 获取当前设置状态（返回副本，防止外部直接修改）
     */
    getState(): SettingsState {
        return { ...this.state };
    }

    /**
     * 获取 showDebugPage 的值
     */
    getShowDebugPage(): boolean {
        return this.state.showDebugPage;
    }

    /**
     * 喵~ 获取 darkMode 的值
     */
    getDarkMode(): boolean {
        return this.state.darkMode;
    }

    /**
     * 获取窗口遮挡行为设置
     */
    getWindowOcclusionBehavior(): WindowOcclusionBehavior {
        return this.state.windowOcclusionBehavior;
    }

    /**
     * 设置 showDebugPage 并通知所有订阅者
     * @param value 新的值
     * @param persist 是否同步到后端（默认 true）
     */
    async setShowDebugPage(value: boolean, persist = true): Promise<void> {
        this.state.showDebugPage = value;

        // 同步到后端 SettingsStore
        if (persist) {
            try {
                await window.settings.set('showDebugPage', value);
            } catch (error) {
                console.error('[SettingsStore] 保存设置失败:', error);
            }
        }

        // 通知所有订阅者
        this.notifyListeners();
    }

    /**
     * 喵~ 设置 darkMode 并通知所有订阅者
     * @param value 新的值
     * @param persist 是否同步到后端（默认 true）
     */
    async setDarkMode(value: boolean, persist = true): Promise<void> {
        this.state.darkMode = value;

        // 同步到后端 SettingsStore
        if (persist) {
            try {
                await window.settings.set('darkMode', value);
            } catch (error) {
                console.error('[SettingsStore] 保存暗黑模式设置失败:', error);
            }
        }

        // 通知所有订阅者
        this.notifyListeners();
    }

    /**
     * 设置窗口遮挡行为并通知所有订阅者
     * @param value 新的值
     * @param persist 是否同步到后端（默认 true）
     */
    async setWindowOcclusionBehavior(value: WindowOcclusionBehavior, persist = true): Promise<void> {
        this.state.windowOcclusionBehavior = value;

        // 同步到后端 SettingsStore
        if (persist) {
            try {
                await window.settings.set('windowOcclusionBehavior', value);
            } catch (error) {
                console.error('[SettingsStore] 保存窗口遮挡行为设置失败:', error);
            }
        }

        // 通知所有订阅者
        this.notifyListeners();
    }

    /**
     * 订阅设置变化
     * @param listener 回调函数，当设置变化时调用
     * @returns 取消订阅的函数
     */
    subscribe(listener: SettingsListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * 通知所有监听器
     */
    private notifyListeners(): void {
        const currentState = this.getState();
        this.listeners.forEach(listener => listener(currentState));
    }
}

// 导出单例实例
export const settingsStore = new SettingsStore();
