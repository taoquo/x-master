# x-master Extension UI / 设计说明

本文档描述的是当前 `apps/extension` 已实现界面的真实设计语言，不是外部参考稿，也不是未来愿景稿。目标是让后续改动基于现状演进，避免继续把视觉判断建立在不相关的 inspiration 上。

## 1. 范围与事实来源

当前 extension 的 UI 主要分为三类：

- `popup`：浏览器扩展弹窗，提供同步入口和库存快照
- `options`：完整书签工作台，包含侧边栏、结果区、详情检视器
- `content`：注入 X 站内的收藏按钮和标签弹层

当前设计事实主要来自这些文件：

- `apps/extension/src/styles/extension.css`
- `apps/extension/src/ui/components.tsx`
- `apps/extension/src/popup/App.tsx`
- `apps/extension/src/popup/components/SyncPanel.tsx`
- `apps/extension/src/options/OptionsApp.tsx`
- `apps/extension/src/content/site-controller.ts`
- `apps/extension/src/content/tag-popover.ts`

## 2. 总体风格判断

### 当前不是哪种风格

当前 extension 不是暗色优先、霓虹玻璃、Linear 风格，也不是重品牌营销页风格。

### 当前实际是什么风格

当前 UI 更接近「轻量化本地工作台 / 编辑器式管理界面」：

- 以浅色界面为主，暗色只是等价主题，不是主叙事
- 大面积使用白底、浅灰边框、低对比阴影
- 交互强调“可管理、可筛选、可浏览”，而不是“沉浸式品牌感”
- 信息层级主要靠字号、字重、留白和边框建立，不靠重装饰
- 品牌存在感较弱，更多出现在 logo、同步入口和状态色里

如果要一句话概括当前气质：

> 一个偏理性、偏内容运营、偏本地资料库的扩展工作台。

## 3. 界面结构

### Popup

`popup` 是一个固定宽度的小型入口页，核心是两张卡片：

- 上卡：品牌、库存统计、状态徽章、打开管理器
- 下卡：同步摘要、同步按钮、最近同步时间

特点：

- 外层宽度固定在 `366px`
- 主卡片是浅色面板
- 同步卡片单独切成深色块，形成局部强调
- 数字信息使用等宽字体，强化“库存 / 运行数据”感

### Options

`options` 是完整工作台，采用三栏布局：

- 左栏 `256px`：状态、同步入口、标签树、语言/主题切换
- 中栏 `1fr`：搜索、筛选、排序、视图切换、书签结果列表
- 右栏 `288px`：详情检视器、媒体预览、标签操作

特点：

- 典型桌面应用式信息架构
- 左右栏负责导航和详情，中间承担主内容密度
- 大量使用滚动容器，而不是整页长滚动
- 结果卡和检视器都偏“工具界面”，不是内容卡片秀场

### Content / Site Popover

站内 UI 有两部分：

- X 页面上的悬浮收藏按钮
- 点击后出现的标签弹层

这套 UI 明显和 `popup/options` 不是同一视觉分支：

- 使用青蓝色半透明高光
- 更强的玻璃拟物和发光感
- 圆角更大，动画更明显
- 更接近“悬浮操作器”而不是“后台工作台”

这说明当前 extension 实际上有两套视觉语言：

1. 工作台语言：浅色、平直、克制、蓝色点缀
2. 站内弹层语言：轻玻璃、青蓝高光、悬浮感更强

## 4. 颜色系统

### 主工作台颜色

工作台颜色都由 `extension.css` 里的 CSS 变量驱动。

亮色主题核心变量：

- `--page-bg: #f5f5f3`
- `--main-bg: #fafafa`
- `--side-bg: #ffffff`
- `--surface-bg: #ffffff`
- `--surface-muted: #f5f5f3`
- `--text-strong: #1a1a1a`
- `--text-muted: #737373`
- `--rail-border / --border-subtle: #e8e8e5`
- `--accent-primary: #4285f4`
- `--accent-primary-hover: #2f74e7`

暗色主题核心变量：

- `--page-bg: #171715`
- `--main-bg: #1d1d1a`
- `--side-bg: #20201d`
- `--surface-bg: #22221f`
- `--surface-muted: #262622`
- `--text-strong: #f3f2ee`
- `--text-muted: #b4b0a8`
- `--rail-border / --border-subtle: #34342f`
- `--accent-primary: #5d96f6`
- `--accent-primary-hover: #77a8fb`

结论：

- 主色是蓝，不是紫，也不是品牌专属色板
- 背景偏暖灰，不是冷白科技风
- 暗色主题也偏棕灰和中性灰，不是纯黑

### 状态色

状态色是当前设计里最稳定的一组语义色：

- `running`：蓝色边框和文字
- `success`：绿色背景 + 绿色文字
- `partial`：黄色背景 + 棕黄色文字
- `error`：红色背景 + 深红文字
- `idle`：中性 badge

状态徽章都带一个小圆点，属于当前系统里最明确的状态识别模式。

### 站内弹层颜色

站内 `tag popover` 采用单独色系：

- 边框偏青色：`rgba(148, 226, 232, 0.42)`
- 面板是浅青白渐变
- hover / selected 也围绕青蓝色展开
- 背景遮罩带青色 radial glow

这套颜色没有复用主工作台变量，属于独立实现。

## 5. 排版系统

### 当前实际使用的字体

当前字体并不统一，至少有三层：

- 全局正文继承：`Roboto`, `Noto Sans SC`, `SF Pro Text`, `-apple-system`, `sans-serif`
- 大标题和部分 Tailwind `font-sans`：`Geist`, `Avenir Next`, `Segoe UI`, `sans-serif`
- 等宽数字/统计：`Geist Mono`, `IBM Plex Mono`, `SFMono-Regular`, `monospace`

另外还定义了：

- `--display-font: "Playfair Display", ...`
- Tailwind `font-display: "Iowan Old Style", ...`

但当前 extension 主界面里基本没有实际用到这套 serif display 字体。它更像遗留 token，而不是现行规范。

### 字号层级

当前排版偏务实，常用层级大致如下：

- 超大标题：`36px` 左右，用于 `options` 页标题
- Popup 主标题：约 `2.08rem`
- 大区块标题：`24px`
- 普通卡片标题：`14px`
- 正文：`12px` 到 `14px`
- 说明文案：`12px`
- Overline / Section Kicker：`10px` 到 `11px`，大写、加大字距
- 指标数字：`36px` 或更大，并使用等宽字体

### 排版特征

- 标题大量使用负字距，提升紧凑度
- overline 是系统里重复率很高的视觉模式
- 文本密度整体偏克制，解释文案通常很短
- 统计值和时间戳的角色区分很明确

## 6. 空间、边框与阴影

### 圆角

当前圆角覆盖面很广，但基本落在一组稳定尺度里：

- `6px`：按钮、输入框、小控件
- `8px`：小卡、列表项、空态
- `10px`：toolbar 控件
- `12px`：导航行、结果卡
- `16px` / `18px`：中等卡片和 stats 块
- `20px` / `22px` / `24px`：主面板、popup 卡片、inspector
- `28px`：站内 popover

结论：当前系统偏好多层级圆角，但多数仍然服务于“柔和工具界面”，不是强拟物。

### 边框

当前边框使用很重，且比阴影更重要：

- 面板边界靠 `1px` 浅灰边框定义
- 激活状态常用 `inset box-shadow` 或蓝色描边
- 结果卡、侧边栏、输入框、详情面板都依赖边框组织结构

### 阴影

阴影整体很轻：

- 大多数工作台面板没有明显厚重阴影
- hover 阴影只在结果卡、局部按钮上略微抬升
- 站内 popover 和悬浮按钮的阴影明显更强

这再次说明工作台与站内弹层是两套不同视觉力度。

## 7. 组件语言

### 面板

当前面板基类主要是：

- `SurfaceCard`
- `.panel-surface`
- `.panel-elevated`
- `.workspace-surface`

特征：

- 白底或浅底
- 轻边框
- 中大圆角
- 结构上先有标题/描述，再有正文区

### 按钮

当前主要按钮类型：

- `glass-button`：浅灰次按钮，多用于 popup 的次级入口
- `primary-button`：蓝色主按钮，当前主要用于同步 CTA
- `workspace-sync-primary`：看起来是主操作按钮，但视觉上更接近浅底高优先按钮
- `chip-button`：胶囊筛选/标签按钮
- `options-toolbar-action`：工具栏按钮
- `options-footer-chip` / `options-footer-icon-button`：页脚微交互按钮

统一特征：

- 高度常见 `40px` 或 `44px`
- hover 时轻微上浮 `translateY(-1px)`
- active 时轻微回弹和缩放
- 大多没有重阴影和高饱和填充

### 输入与筛选

输入控件以 `field-shell` 为底：

- 细边框
- 亮色背景
- focus 时蓝色 ring
- 视觉存在感较弱，让筛选行为融入工作流

筛选方式以：

- 搜索框
- filter popover
- sort 循环切换
- grid/list 视图切换
- active filter chips

为主，属于典型资料库工具组合。

### 结果卡

书签结果卡是 `options` 的核心表达单元：

- 顶部可选媒体预览
- 作者缩写头像
- 作者名 / handle / 保存时间
- 书签正文摘要
- 标签 pills
- 底部一排社交动作图标和外链动作

特征：

- 样式克制，信息密度适中
- hover 只做很轻的位移和阴影提升
- 选中态使用蓝色描边，不靠大面积底色

### 详情检视器

右侧 inspector 是典型信息检视区：

- 元数据
- 摘要
- 媒体预览
- 打开原文
- 标签查看和挂载

检视器强调“结构清晰”和“滚动独立”，不是高视觉冲击。

### 站内弹层

`tag popover` 是高度自定义组件：

- 大圆角浮层
- hero 区 + tweet 摘要卡 + 标签选择区 + 新建标签区
- 动画更明显
- 背景模糊和 radial glow 更强

它更像一个“悬浮操作 modal”。

## 8. 动效与交互反馈

工作台动效统一比较克制：

- 过渡时长多在 `160ms` 到 `180ms`
- 常用 easing：`cubic-bezier(0.16, 1, 0.3, 1)`
- hover 位移一般是 `-1px`
- active 通常是 `scale(0.985)` 左右
- theme 切换时通过 `data-theme-switching` 暂时禁用 transition，避免闪烁

站内弹层动效更明显：

- backdrop fade-in
- pop-in 入场
- lightbox 自带淡入和缩放

## 9. 图标与品牌

图标统一来自 `@phosphor-icons/react`，并且使用 regular 风格。这个选择让界面保持轻量、轮廓清晰、不显得过度系统化。

品牌本体目前很轻：

- 主要依赖 logo 图片资源
- 没有建立完整品牌图形系统
- 更像工具标识，而不是强品牌视觉主角

## 10. 当前设计上的不一致点

这部分很重要，因为后续新增 UI 应该知道现状里哪些是统一的，哪些还没统一。

### 1. 字体系统不统一

- 全局正文是 `Roboto/Noto Sans SC`
- 一些标题走 Tailwind 的 `Geist`
- 站内 popover 也直接写了 `Geist`
- 定义了 serif display token，但基本没用

### 2. 工作台和站内弹层不是同一视觉体系

- 工作台：白底、浅灰边框、蓝色 accent
- 站内弹层：青蓝玻璃感、渐变、发光、高模糊

这不是小差异，而是明确的双风格并存。

### 3. popup 的两张卡片调性不完全一致

- 上卡偏工作台风格
- 下方 `SyncPanel` 是深色强调卡

它本身可用，但风格上不是完全统一。

### 4. Tailwind token 与实际 UI 不完全一致

Tailwind 里定义了：

- `surface / ink / mist / cobalt / sand`
- `font-display`
- `glass-shimmer / soft-pulse / float-card`
- `glass / soft` 阴影

但这些 token 在主界面里并没有形成稳定、完整的系统使用。当前真正的设计源头仍然是 `extension.css` 的 CSS 变量和手写组件类。

## 11. 后续设计修改建议

如果继续扩展 `extension`，建议遵守下面的现实约束：

- 新增 `popup/options` UI 时，优先沿用 `extension.css` 变量，不要直接引入一套新色板
- 优先延续“工作台”语言，而不是再混入第三种品牌风格
- 状态表达继续复用 `StatusBadge` 的语义模型
- 尺寸优先沿用现有 `40px/44px` 控件高度和 `6/8/12/16/24` 圆角层级
- 数据型数字继续使用 `font-mono`
- 如果要统一全局风格，优先处理字体系统和 content popover 的视觉分叉

## 12. 一句话结论

`apps/extension` 当前最准确的设计定义不是“某个品牌官网风格”，而是：

> 一套以浅色本地工作台为主、以蓝色状态和工具性布局为核心，同时夹带一套独立站内玻璃弹层风格的浏览器扩展 UI。
