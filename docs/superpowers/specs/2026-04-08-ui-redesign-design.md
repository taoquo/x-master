# X Bookmark Manager UI Redesign Design

## Summary

本次重构统一 `popup` 与 `options` 两个入口的视觉系统，基于 [DESIGN.md](/Users/shuke/WorkSpace/01Code/03AI/x-master/DESIGN.md) 建立一套 `dark-first` 的主题化工作台。目标不是简单换色，而是把当前偏浅色玻璃感的界面，重构为更接近 Linear 气质的精密工具 UI，同时完整适配 `dark`、`light`、`system` 三种主题模式。

## Goals

- 统一 `popup` 与 `options` 的主题 token、排版体系、边框与状态语言。
- 让 `dark` 主题成为主参考，实现真正的深色原生工作台。
- 让 `light` 主题作为同一设计系统的映射，而不是廉价反色版本。
- 调整部分区块层级、导航分组和文案密度，让工作区更接近“操作台”而不是“展示页”。
- 保持现有核心交互与数据流不变，避免把视觉重构变成业务重写。

## Non-Goals

- 不新增同步、搜索、标签、列表等新功能。
- 不改动后台消息协议、IndexedDB 结构或同步逻辑。
- 不引入新的第三方前端依赖。
- 不拆分现有大型页面文件的业务边界，除非对这次 UI 重构有直接收益。

## Visual Thesis

`X Bookmark Manager` 应该像一个夜间工作的书签操作台，而不是轻快的消费应用。整体氛围强调低饱和、近黑背景、超细边框、稀疏强调色、稳定排版与清晰层级。深色模式是主形态，浅色模式是同构映射。

## Theme System

### Dark

- 背景层级：
  - page: `#08090a`
  - panel: `#0f1011`
  - elevated: `#191a1b`
  - hover: `#28282c`
- 文字层级：
  - primary: `#f7f8f8`
  - secondary: `#d0d6e0`
  - tertiary: `#8a8f98`
  - quaternary: `#62666d`
- 强调色：
  - accent bg: `#5e6ad2`
  - accent text/link: `#7170ff`
  - accent hover: `#828fff`
- 边框：
  - subtle: `rgba(255,255,255,0.05)`
  - standard: `rgba(255,255,255,0.08)`

### Light

- 背景层级：
  - page: `#f7f8f8`
  - panel: `#f3f4f5`
  - elevated: `#ffffff`
  - hover: `#eceef1`
- 文字层级：
  - primary: `#111318`
  - secondary: `#3d4450`
  - tertiary: `#68707d`
  - quaternary: `#8a919d`
- 强调色与 dark 保持一致：
  - accent bg: `#5e6ad2`
  - accent text/link: `#7170ff`
  - accent hover: `#828fff`
- 边框采用冷灰中性映射，保持相同语义层次。

### System

- `system` 只决定运行时所使用的 token 源。
- 组件结构、信息层级、交互反馈在三种模式下完全一致。

## Typography

- 使用 `font-sans` 作为主文字体系，去掉当前偏 editorial 的 display 风格。
- 页面级标题强调紧凑字距和较高字重，但避免过度海报化。
- 数字、时间、同步统计优先使用 `font-mono` 辅助扫描。
- 标题、标签、元信息统一控制大小与字重，减少现有样式散落状态。

## Layout Strategy

### Popup

`popup` 重新定义为“状态入口”，而不是轻量管理器。

- 顶部：品牌、工作区角色说明、同步状态 badge。
- 中部：库存概览，包括总书签、未分类、最近同步。
- 下部：同步摘要四项与主动作。
- CTA 顺序：
  - 主动作：立即同步
  - 次动作：打开管理器

视觉上使用更紧凑的深色面板体系，在浅色主题下保留相同分区。

### Options

继续保留三栏结构，但重排视觉层级。

- 左栏：
  - 工作区总览
  - 同步状态与入口
  - 列表导航
  - 偏好设置
- 中栏：
  - 搜索与筛选
  - 批量操作
  - 结果列表
- 右栏：
  - 当前书签详情
  - 标签管理
  - 列表归档

布局不再依赖大面积玻璃卡片堆叠，而是通过分区、细边框、留白和局部抬升建立层级。

## Component Direction

### Shared Surfaces

- `SurfaceCard` 改为更克制的 panel 组件，默认使用 token 化背景、边框与阴影。
- `MetricCard` 改为工具化统计区，降低装饰感。
- `StatusBadge` 改为更薄的 pill，统一 success / running / partial / error / idle 语义。
- 输入框、下拉框、chip、按钮统一尺寸、圆角、边框与 focus ring。

### States

- `loading`：骨架屏贴近真实布局，不使用泛白玻璃块。
- `empty`：使用统一的空态区块，文案简短，强调下一步操作。
- `error`：使用内联错误条，保持在整体主题语言内。
- `selected`：通过 accent 边框与弱填充高亮焦点。

## Content Changes

- 缩短说明文案，优先状态、范围、动作。
- `popup` 不再描述自己是“搜索、归档和手动同步”的入口，因为实际并不承担这些能力。
- `options` 各区块标题更像工作台语言，而不是展示页语言。

## Motion

- 使用已有 CSS transition 实现轻量级层级过渡。
- hover 以 `transform` 与 `opacity` 为主，不使用重阴影或发光。
- active 使用轻微下压反馈：`translateY(1px) scale(0.985)`。
- 不引入额外动画库。

## Files In Scope

- `apps/extension/src/styles/extension.css`
- `apps/extension/src/ui/components.tsx`
- `apps/extension/src/ui/theme.ts`
- `apps/extension/src/popup/App.tsx`
- `apps/extension/src/popup/components/SyncPanel.tsx`
- `apps/extension/src/options/OptionsApp.tsx`
- `apps/extension/tests/popup/*.test.tsx`
- `apps/extension/tests/options/OptionsApp.test.tsx`

## Risks

- `OptionsApp.tsx` 文件较大，UI 调整时容易引入结构回归。
- 现有测试对文案和 DOM 结构有一定绑定，需要同步更新。
- 主题 token 若抽象不稳，可能导致 popup 与 options 在不同主题下风格再次分裂。

## Success Criteria

- `popup` 与 `options` 在 dark / light / system 下都呈现同一套设计系统。
- 深色模式明显更贴近 [DESIGN.md](/Users/shuke/WorkSpace/01Code/03AI/x-master/DESIGN.md) 的层级、颜色与边框语言。
- 浅色模式保持同构，不出现另一套审美。
- 现有交互链路不回归。
- `test`、`lint`、`typecheck`、`build` 全部通过。
