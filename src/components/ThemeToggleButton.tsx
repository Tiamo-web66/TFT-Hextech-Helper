import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { WbSunny, DarkMode } from '@mui/icons-material';
import { settingsStore } from '../stores/settingsStore';
import { toast } from './toast/toast-core';
import { ThemeType } from '../styles/theme';

// 旋转动画 - 图标切换时的过渡效果
const rotateIn = keyframes`
  from {
    transform: rotate(-180deg) scale(0.8);
    opacity: 0;
  }
  to {
    transform: rotate(0deg) scale(1);
    opacity: 1;
  }
`;

// 按钮容器样式
const ToggleButton = styled.button<{ theme: ThemeType }>`
  background: ${props => props.theme.colors.elementBg};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 50%;  /* 圆形按钮 */
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;

  /* 悬停效果 */
  &:hover {
    background: ${props => props.theme.colors.elementHover};
    border-color: ${props => props.theme.colors.primary};
    transform: scale(1.1);  /* 轻微放大 */
  }

  /* 点击效果 */
  &:active {
    transform: scale(0.95);
  }

  /* 图标样式 */
  .MuiSvgIcon-root {
    font-size: 24px;
    color: ${props => props.theme.colors.primary};
    animation: ${rotateIn} 0.4s ease-out;
  }
`;

/**
 * 主题切换按钮组件
 * 显示太阳图标（亮色模式）或月亮图标（暗黑模式）
 */
export const ThemeToggleButton: React.FC = () => {
  // 从 settingsStore 获取当前主题状态
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 初始化并订阅主题变化
  useEffect(() => {
    const init = async () => {
      await settingsStore.init();
      setIsDarkMode(settingsStore.getDarkMode());
    };
    init();

    // 订阅主题变化（其他地方修改时同步更新图标）
    const unsubscribe = settingsStore.subscribe((settings) => {
      setIsDarkMode(settings.darkMode);
    });

    return unsubscribe;
  }, []);

  // 点击切换主题
  const handleToggle = async () => {
    const newValue = !isDarkMode;
    await settingsStore.setDarkMode(newValue);
    toast.success(newValue ? '已切换到暗黑模式 🌙' : '已切换到亮色模式 ☀️');
  };

  return (
    <ToggleButton onClick={handleToggle} title={isDarkMode ? '切换到亮色模式' : '切换到暗黑模式'}>
      {isDarkMode ? <DarkMode key="dark" /> : <WbSunny key="light" />}
    </ToggleButton>
  );
};
