import {createGlobalStyle} from "styled-components";

export const GlobalStyle = createGlobalStyle`
  /* * 喵~ 装修第一步：样式重置 (CSS Reset)
 * 我们把所有元素默认的 margin, padding 和盒模型计算方式都统一起来
 * 这样能避免很多浏览器兼容性问题
*/
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    // 更平滑的滚动体验
    scroll-behavior: smooth;
<<<<<<< HEAD
    /* Firefox 全局滚动条颜色设置 */
    scrollbar-width: thin;
    scrollbar-color: ${props => props.theme.colors.border} transparent;
=======
>>>>>>> d486bf613bb0678ec82dc354105f86e17488dffe
  }

  /*
   * 喵~ 装修第二步：设定全局基调
   * 我们在这里为 <body> 设置基础的字体、背景色和文字颜色
   * 最神奇的是，它能自动读取到我们通过 <ThemeProvider> 提供的 theme！
  */
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;

    /* 喵~ 从我们的 theme 设计规范里，读取背景色和文字颜色！*/
    background-color: ${props => props.theme.colors.background};
    color: ${props => props.theme.colors.text};

    /* 让字体渲染更平滑，看起来更舒服 */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;

    /* 确保应用在视口高度不足时，也能撑满整个屏幕 */
    min-height: 100vh;
  }
<<<<<<< HEAD

  /* 全局滚动条样式（Chromium/Electron） */
  *::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  *::-webkit-scrollbar-track {
    background: transparent;
  }

  *::-webkit-scrollbar-thumb {
    background-color: ${props => props.theme.colors.border};
    border-radius: 3px;
  }

  *::-webkit-scrollbar-thumb:hover {
    background-color: ${props => props.theme.colors.textSecondary};
  }
=======
>>>>>>> d486bf613bb0678ec82dc354105f86e17488dffe
`