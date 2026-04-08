# X Bookmark Manager Options UI Redesign Design

## Summary

本次重构只覆盖 `options` 页面，不扩展到 `popup`。目标是把当前偏玻璃感、圆润面板堆叠的三栏工作区，重构为一套更克制、更统一的工具型界面：以浅色规范作为主参考，建立白底、细边框、紧凑排版、固定轨道式三栏布局，并为 `dark` / `system` 提供同构映射。

## Goals

- 统一 `options` 三栏的容器、排版、边框、按钮、表单和 badge 语言。
- 保留现有三栏信息架构，但把左右两栏改造成固定轨道式 inspector / sidebar。
- 以浅色规范为主建立新 token，同时让 `dark` 主题只做同构映射，不分裂成另一套审美。
- 降低玻璃感、阴影感和大圆角，改用留白、分隔线、轻边框和选中态建立层级。
- 保持现有交互逻辑、数据流、筛选能力、列表和标签操作不变。

## Non-Goals

- 不修改 `popup` 页面。
- 不新增同步、筛选、批量操作、标签或列表功能。
- 不改动后台消息协议、IndexedDB 结构或运行时通信。
- 不引入新的第三方依赖或动画库。
- 不做与本次 UI 重构无关的大规模文件拆分。

## Visual Thesis

`options` 页面应表现为一个冷静、精确、近乎编辑器式的三轨工作台，而不是带玻璃卡片的展示页。浅色模式是主形态：纯白工作面、冷灰分隔线、克制蓝色强调和高可扫描排版；深色模式仅做颜色同构映射，保持完全一致的结构和信息节奏。

## Content Plan

- 左栏：范围与入口
  - 页面标题
  - 同步状态与主操作
  - 列表导航
  - 偏好设置摘要与展开面板
- 中栏：搜索、筛选、批量操作与结果列表
  - 搜索与基础筛选
  - 高级筛选
  - 当前筛选条件
  - 结果列表与选择态
- 右栏：当前项检查与操作
  - 书签详情
  - 标签管理
  - 列表归档
  - 创建标签

每一栏只承担一种职责，避免跨栏重复说明。

## Interaction Thesis

- hover 只使用轻微底色变化和 `translateY(-1px)`，不依赖重阴影。
- active 保持 `translateY(1px) scale(0.985)` 的轻压反馈。
- 左右栏在桌面保持 sticky，强化“轨道”感。
- 选中态统一为浅蓝底 + 蓝描边，不再使用多套高亮方式。

## Layout Strategy

### Desktop

- 继续保留三栏结构，使用固定轨道式布局：
  - 左栏：约 `240px`
  - 中栏：`minmax(0, 1fr)`
  - 右栏：约 `320px`
- 左栏与右栏采用统一的侧栏语言：
  - 纯白背景
  - 24px 内边距
  - 模块之间 32px 垂直间距
  - 明确的分隔线
- 中栏作为主工作面，不再依赖厚重 panel 包裹整个区域；层级主要通过区块标题、轻边框、间距和结果项选中态建立。

### Tablet

- 中等屏宽降为两栏：
  - 左栏保留
  - 中栏与右栏纵向堆叠
- 右栏详情区下沉到结果区之后，保持同样组件语言。

### Mobile

- 单栏堆叠：
  - 左栏摘要与偏好
  - 搜索和筛选
  - 结果列表
  - 当前选中项详情
- 不新增移动端专属交互，只调整顺序与间距。

## Typography

- 全部使用 `Inter, sans-serif`。
- 模块小标题统一：
  - `font-size: 10px`
  - `font-weight: 700`
  - `color: #94A3B8`
  - `letter-spacing: 0.1em`
  - `text-transform: uppercase`
- 大标题统一：
  - `font-size: 24px`
  - `font-weight: 700`
  - `color: #0F172A`
- 描述性灰字统一：
  - `font-size: 12px`
  - `line-height: 1.625`
  - `color: #64748B`
- 中栏结果正文和表单文案优先可扫描性，不使用展示型大标题。

## Component Direction

### Containers

- 左栏和右栏主容器去掉当前玻璃面板和大圆角，改成更直、更平的轨道面板。
- 中栏内部保留必要的结果项卡片，但降低圆角、阴影和装饰感。
- 模块之间统一 32px 纵向节奏。

### Badges

- 统一为：
  - 高度 `28px`
  - 背景 `#F1F5F9`
  - 文字 `#334155`
  - 左右内边距 `10px`
  - 圆角 `9999px`
- 当前标签、筛选条件、偏好摘要、状态 pill 都优先复用同一尺寸体系。

### Inputs / Selects / Readonly

- 统一为：
  - 高度 `40px`
  - 背景 `rgba(248,250,252,0.5)`
  - `1px solid #E2E8F0`
  - 圆角 `8px`
- `ReadonlyField` 与输入控件共享相同外观语言。
- focus 使用轻蓝色 ring，不做发光或玻璃高亮。

### Buttons

- 主按钮统一：
  - 高度 `40px`
  - 背景 `#2563EB`
  - hover `#1D4ED8`
  - 文字 `#FFFFFF`
  - `font-size: 14px`
  - `font-weight: 500`
  - 圆角 `8px`
- 次按钮改为浅底细边框按钮，去掉当前圆胶囊玻璃按钮风格。

### Navigation Rows

- 左栏列表项改为更扁平的行式导航。
- 默认状态以透明或浅底呈现。
- 选中态统一为浅蓝底 + 蓝描边 + 主文字加深。

### Result Cards

- 中栏结果项继续保留卡片式信息块，但降低卡片感：
  - 减少圆角
  - 去掉厚阴影
  - 使用细边框和选中描边
- 结果项仍可显示媒体、列表、标签等信息，但视觉优先级收敛到“内容摘要 + 元数据 + 选择态”。

## Theme Mapping

### Light

- 以以下规范为主参考：
  - 页面 / 面板背景：`#FFFFFF`
  - 分隔边框：`#E2E8F0`
  - 主文字：`#0F172A`
  - 次级文字：`#64748B`
  - badge：`#F1F5F9` / `#334155`
  - 主按钮：`#2563EB` / `#1D4ED8`

### Dark

- `dark` 主题仅做同构映射：
  - 背景改为深灰，而非纯黑
  - 边框映射为低对比深灰蓝
  - 文本映射为高对比浅灰
  - badge、输入框、列表项保持同样高度、圆角、密度和结构
  - 主按钮继续沿用同一蓝色语义

### System

- `system` 继续只决定运行时选择 `light` 或 `dark` token。
- 组件结构、间距、交互和信息层级不出现分叉。

## States

- `loading`
  - 骨架屏贴近真实三栏布局
  - 不使用泛白玻璃块
- `empty`
  - 统一为轻边框、纯色背景和简短说明
- `selected`
  - 左栏列表项、中栏结果项统一使用浅蓝底 + 蓝描边
- `disabled`
  - 仅降低透明度与交互性，不改变布局
- `error`
  - 保留内联错误条，但视觉语言与新系统一致

## Files In Scope

- `apps/extension/src/options/OptionsApp.tsx`
- `apps/extension/src/styles/extension.css`
- `apps/extension/src/ui/components.tsx`
- `apps/extension/src/ui/theme.ts`
- `apps/extension/tests/options/OptionsApp.test.tsx`

## Risks

- `OptionsApp.tsx` 体量较大，结构调整可能引入 DOM 回归。
- 当前样式类在 `popup` 与 `options` 间有共享，重构 token 时需要避免误伤 `popup`。
- 测试可能对文案、类名或区块结构存在绑定，需要同步更新。
- 深色模式若只换色不调整层级对比，可能出现边界不清的问题，需要验证可读性。

## Success Criteria

- `options` 三栏在 `light` / `dark` / `system` 下保持同一套结构和节奏。
- 左右栏明确表现为固定轨道式侧栏，中栏成为清晰的主工作面。
- 输入框、下拉、只读框、badge、主按钮统一到同一规格。
- 页面视觉不再依赖玻璃感、大圆角和厚阴影。
- 现有业务交互链路不回归。
- `test`、`lint`、`typecheck`、`build` 全部通过。
