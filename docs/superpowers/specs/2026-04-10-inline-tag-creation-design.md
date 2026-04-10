# Inline Tag Creation Design

## Summary

将当前侧边栏“添加标签”从浏览器原生 `window.prompt` 弹框，改为标签目录内联创建。用户点击 `+` 后，标签列表中直接插入一条新目录，新目录名称处于可编辑状态并自动聚焦；用户在该行内完成输入、提交或取消，不再打断当前页面上下文。

## Goals

- 移除原生弹框交互，保持侧边栏体验连续。
- 新建标签入口仍保留在标签区标题右侧 `+` 按钮。
- 点击 `+` 后立即在标签列表中出现一条可编辑的新标签行。
- 支持键盘提交和取消，减少鼠标往返。
- 尽量复用现有数据存储和刷新逻辑，不改 IndexedDB schema。

## Non-Goals

- 不调整标签筛选逻辑。
- 不改右侧详情栏里的“添加标签到书签”交互。
- 不在本次改造中引入标签排序、拖拽、分组或批量编辑。
- 不额外设计通用表单组件或状态管理抽象。

## Current Behavior

- 侧边栏 `+` 按钮位于 `WorkspaceSidebar`。
- 点击后调用 `handleCreateTagClick()`。
- `handleCreateTagClick()` 通过 `window.prompt(copy.createTagPrompt, "")` 获取名称。
- 输入后调用 `workspace.handleCreateTag(name)`。
- `handleCreateTag` 最终复用 `tagsStore.createTag({ name })` 持久化数据并刷新页面。
- 数据层已存在 `renameTag(...)`，但当前侧边栏 UI 未提供标签内联编辑能力。

## Approaches

### A. 侧边栏插入临时新建行

- 点击 `+` 后，在现有标签列表中插入一条本地临时行。
- 该行使用 input 替代普通文本，自动聚焦。
- 用户确认后再真正调用 `handleCreateTag` 创建标签。

优点：

- 交互最贴近目标。
- 对现有存储层侵入最小。
- 失败时容易保留输入并展示错误。

缺点：

- 侧边栏组件需要增加少量本地 UI 状态。

### B. 先创建占位标签，再切到重命名态

- 点击 `+` 后直接创建一个默认名标签，例如“新标签”。
- 创建成功后将该标签切换到编辑态，用户再修改名称。

优点：

- 标签行只处理“编辑已有标签”一种模式。

缺点：

- 会产生临时脏数据。
- 用户取消时需要额外删除回滚。
- 默认名冲突和误保存处理更复杂。

### C. 侧边栏内嵌小表单，不插入到列表项里

- 点击 `+` 后，在标签区头部或列表顶部展开一个输入表单。

优点：

- 实现简单。

缺点：

- 视觉上仍像独立输入区，不符合“新增一条目录”的目标。

## Recommendation

采用方案 A。它最符合目标交互，同时不需要改数据结构，也不会制造占位标签。实现重点集中在 `WorkspaceSidebar` 的本地编辑态控制，风险最低。

## Interaction Design

### Entry

- 用户点击标签区头部 `+` 按钮。
- 若当前已存在未完成的新建输入行，则不再重复插入；只重新聚焦该输入框。

### Editing State

- 新建行显示在标签列表中，位置在“全部书签”之后、已有标签之前。
- 图标仍沿用标签项风格，名称区域替换为输入框。
- 输入框默认空值，自动聚焦并选中内容。
- 该行不显示计数，也不显示删除按钮。

### Commit Rules

- `Enter`：若输入非空，调用创建命令。
- `Blur`：若输入非空，按与 `Enter` 一致的规则提交；若为空则取消。
- 创建成功后退出编辑态，列表显示真实标签项。

### Cancel Rules

- `Escape`：取消新建并移除临时行。
- 输入为空时失焦：取消新建并移除临时行。

### Error Handling

- 创建失败时保留输入内容和编辑态。
- 错误信息继续复用现有 `workspace.commandError` 展示区域。
- 用户可继续修改后再次提交，或按 `Escape` 取消。

## State Design

侧边栏新增最小本地状态：

- `isCreatingTag: boolean`
- `newTagName: string`
- `inputRef`：用于自动聚焦，以及重复点击 `+` 时重新聚焦当前输入框。

不新增全局 store，不把新建中的名称提升到 `OptionsScreen` 顶层。

## Data Flow

1. `+` 按钮把侧边栏切到新建态。
2. 输入框更新 `newTagName`。
3. 提交时调用现有 `onCreateTag(newTagName)`。
4. `useWorkspaceCommands.handleCreateTag` 继续调用现有 `createTag` 并 `refreshData()`。
5. 刷新完成后侧边栏退出新建态。

## Testing

新增或更新 `apps/extension/tests/options/OptionsApp.test.tsx`，覆盖以下行为：

- 点击 `+` 后，侧边栏出现输入框而不是调用 `window.prompt`。
- 输入名称并回车后，标签出现在侧边栏列表中。
- 输入为空时按回车或失焦，不创建标签。
- 按 `Escape` 后取消新建，列表恢复原状。
- 重复点击 `+` 不会创建多个输入行。

## Files In Scope

- `apps/extension/src/options/OptionsApp.tsx`
- `apps/extension/tests/options/OptionsApp.test.tsx`

## Risks

- `OptionsApp.tsx` 当前已较大，改动时需要把新增状态收敛在侧边栏内部，避免继续向顶层扩散。
- 当前仓库已有未提交修改，实施时必须避免覆盖现有进行中的 UI 调整。
