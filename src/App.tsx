import './App.css'
import {router} from "./Router.tsx";
import {RouterProvider} from "react-router-dom";
import {ThemeProvider} from "styled-components";
import {lightTheme, darkTheme} from "./styles/theme.ts";  // 喵~ 同时导入两套主题
import {settingsStore} from "./stores/settingsStore.ts";  // 喵~ 导入设置管理器

import {GlobalStyle} from "./styles/GlobalStyle.ts";
import {Toaster} from "./components/toast/Toast.tsx";
import {useEffect, useState} from "react";
import {toast, ToastType, ToastPosition} from "./components/toast/toast-core.ts";
import {FirstLaunchModal} from "./components/FirstLaunchModal.tsx";

// Toast 消息的类型定义
interface ToastPayload {
    message: string;
    type?: ToastType;
    position?: ToastPosition;
}

function App() {
    // 喵~ 1. 创建主题状态，根据 settingsStore 决定使用哪套主题
    const [isDarkMode, setIsDarkMode] = useState(false);
    const currentTheme = isDarkMode ? darkTheme : lightTheme;

    // 首次启动弹窗状态
    const [showFirstLaunchModal, setShowFirstLaunchModal] = useState(false);

    // 喵~ 2. 初始化设置并订阅暗黑模式变化
    useEffect(() => {
        const initSettings = async () => {
            // 初始化 settingsStore（从后端加载设置）
            await settingsStore.init();
            // 获取初始暗黑模式状态
            setIsDarkMode(settingsStore.getDarkMode());
        };
        initSettings();

        // 订阅设置变化（当用户切换暗黑模式时自动更新）
        const unsubscribe = settingsStore.subscribe((settings) => {
            setIsDarkMode(settings.darkMode);
        });

        return unsubscribe;  // 组件卸载时取消订阅
    }, []);

    // 监听主进程发来的 Toast 事件
    useEffect(() => {
        // @ts-ignore - window.ipc 由 preload.ts 暴露
        const cleanup = window.ipc?.on('show-toast', (payload: ToastPayload) => {
            toast(payload.message, {
                type: payload.type || 'info',
                position: payload.position || 'top-right'
            });
        });
        return () => cleanup?.();
    }, []);
    
    // 检查是否首次启动
    useEffect(() => {
        const checkFirstLaunch = async () => {
            const isFirstLaunch = await window.settings.get<boolean>('isFirstLaunch');
            if (isFirstLaunch) {
                setShowFirstLaunchModal(true);
            }
        };
        checkFirstLaunch();
    }, []);
    
    // 用户确认首次启动弹窗
    const handleFirstLaunchConfirm = async () => {
        // 标记为非首次启动
        await window.settings.set('isFirstLaunch', false);
        setShowFirstLaunchModal(false);
    };

    return (
        <ThemeProvider theme={currentTheme}>
            <GlobalStyle/>
            <Toaster/>
            <FirstLaunchModal 
                isOpen={showFirstLaunchModal}
                onClose={() => setShowFirstLaunchModal(false)}
                onConfirm={handleFirstLaunchConfirm}
            />
            <RouterProvider router={router}/>
        </ThemeProvider>
    );
}

export default App;