# Options Demo Alignment Design

## Summary

本次改造以 `demo/` 为 `options` 页面的唯一视觉和交互基准，目标是把当前扩展的 `options` 页面收敛成与 demo 一致的三栏工作台：左侧标签导航、中间书签列表、右侧详情栏。现有真实数据、运行时通信、主题持久化、语言持久化、筛选与标签操作逻辑继续复用；当 demo 与当前实现冲突时，统一以 demo 为准。

## Goals

- 严格对齐 demo 的三栏布局、视觉节奏和交互路径。
- 保留现有扩展的数据来源、命令处理、设置存储和测试体系。
- 让浅色主题与 demo 高度一致，同时补齐深色主题映射。
- 清理页面中所有 demo 未出现的冗余文本、按钮和次级面板。
- 让“偏好设置”回到 demo 的底部控制组形态，而不是当前展开式配置区。

## Non-Goals

- 不改 `popup` 页面。
- 不改后台同步、存储 schema、runtime message、hook 接口。
- 不新增新业务字段；demo 中缺少真实数据支持的项只做静态或禁用映射。
- 不把 demo 的 mock 数据结构直接搬进 extension。

## Source Of Truth

- 视觉与交互：`demo/src/App.tsx` 及其子组件
- 运行时逻辑与真实数据：`apps/extension/src/options/OptionsApp.tsx` 及现有 hooks
- 主题与语言持久化：`apps/extension/src/ui/provider.tsx`、settings store

## Layout

### Left Sidebar

- 顶部显示 `工作区 WORKSPACE`、成功状态、`书签` 标题、上次同步时间、`立即同步` 按钮。
- 中段只保留标签导航：
  - 默认项 `全部书签`
  - 用户标签列表
  - 标签计数
  - 顶部 `+` 图标作为新增标签入口
- 底部固定为 demo 风格的偏好设置控制组：
  - 设置图标
  - 语言切换按钮 `中 / EN`
  - 主题切换按钮
  - 信息按钮

### Main Workspace

- 头部显示 `资料库 ARCHIVE`、当前范围标题、右上结果数。
- 工具条只保留 demo 的四组控件：
  - 搜索输入框
  - `筛选` 按钮与弹层
  - `最近保存` 排序按钮
  - 网格 / 列表视图切换
- 第二行显示：
  - `全选可见项`
  - 活跃筛选 chips
  - 结果统计
- 结果区支持两种排版：
  - `grid`: 双列卡片
  - `list`: 单列卡片

### Right Inspector

- 未选中书签时显示 demo 空态。
- 选中书签后显示：
  - `元数据 METADATA`
  - `详情`
  - 作者、handle、时间
  - 内容摘要
  - `在 X 中打开`
  - 标签 pills
  - `添加标签` 入口
- 当前实现中的额外分段，如 `归档`、`创建标签`、`标签库`，从主界面移除。

## Interaction Design

### Tag Filtering

- `全部书签` 为默认激活项。
- 点击具体标签时：
  - 若当前是 `全部书签`，则切换为只激活该标签。
  - 否则执行多选切换。
- 具体标签全部取消后，自动回退到 `全部书签`。
- 主标题和结果集合都跟随当前标签组合变化。

### Toolbar Behavior

- 搜索实时过滤当前结果。
- 排序只保留 demo 当前呈现的主入口，默认使用现有 `最近保存` 排序。
- `筛选` 弹层只暴露 demo 中的四项：
  - `包含媒体`
  - `长文`
  - `未读`
  - `已归档`
- 其中：
  - `包含媒体`、`长文` 绑定现有真实逻辑。
  - `未读`、`已归档` 因无真实字段支持，渲染为禁用项，不参与过滤。
- 活跃筛选 chips 只展示真实生效的筛选项。

### Bookmark Selection

- 点击卡片后在右侧显示详情。
- 当前选中卡片在列表中有明确选中态。
- 视图切换不丢失当前选中书签。

### Preferences

- 语言切换改为底部按钮，仍写入现有 `locale` 设置。
- 主题切换改为底部按钮，仍写入现有 `themePreference` 设置。
- 设置按钮保留为视觉入口，但不再展开旧的偏好面板。
- 信息按钮保留，与 demo 一致。

## Content Rules

- 统一删除 demo 中未出现的说明文字、统计块、批量操作条、高级筛选区、额外面板按钮。
- 页面文案以 demo 为准，现有中英文文案同步收敛。
- 若 demo 与当前中文或英文文案不一致，以 demo 表达优先。

## Theme Mapping

### Light

- 尽量对齐 demo 的白底、浅灰边框、蓝色强调、柔和阴影体系。
- 输入框、按钮、卡片、弹层、详情侧栏维持一致的浅色层级。

### Dark

- 不改变布局和交互，只做颜色映射。
- 采用低饱和深灰背景和浅色文字。
- 保持按钮、chip、弹层和卡片的边界可读性。
- 网格 / 列表切换、筛选浮层、详情栏在 dark 下仍与 light 保持同样密度。

## Files In Scope

- `apps/extension/src/options/OptionsApp.tsx`
- `apps/extension/src/styles/extension.css`
- `apps/extension/tests/options/OptionsApp.test.tsx`

## Risks

- `OptionsApp.tsx` 当前承载过多视图逻辑，改造时需要优先控制删除与隐藏范围，避免误伤真实命令处理。
- 现有测试更多覆盖旧结构，需要同步更新为 demo 语义结构与关键交互。
- 深色主题没有现成 demo，需要保证颜色映射后仍保留同样的信息层级与点击反馈。
