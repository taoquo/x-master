# X Bookmark Manager Options Figma UI Redesign Design

## Summary

本次重构只覆盖 `options` 页面，并以 Figma 节点 `IZjM1Al8siDFFtzVazQfg4 / 2:892` 作为浅色方案的唯一视觉基准。目标不是继续微调现有“工作台风格”页面，而是把当前实现直接重构为与 Figma 同构的三栏信息布局：左栏 `320px`、右栏 `340px`、中栏主体 `1260px`，整体采用暖灰背景、细描边、编辑式留白、衬线标题和紧凑表单。

深色主题不单独重新设计，只做颜色和对比度的同构映射，保持完全相同的布局、模块顺序、密度和交互节奏。

## Goals

- 以 Figma `2:892` 为准重建 `options` 页三栏视觉结构，而不是基于旧样式继续修补。
- 保留当前业务行为、数据流、测试入口和大部分语义结构。
- 让页面在 reload 后有清晰可见的整体变化，包括字体、背景、边框、卡片、侧栏和工具栏。
- 在 `light` 下尽量贴近 Figma，在 `dark` 下保持结构映射和可读性。

## Non-Goals

- 不修改 `popup` 页面。
- 不新增筛选能力、标签能力、同步能力或列表能力。
- 不改后台存储、消息协议或 hook 数据接口。
- 不为深色模式单独发明另一套布局。
- 不引入新的第三方 UI 依赖。

## Figma Basis

### Source

- Figma file: `https://www.figma.com/design/IZjM1Al8siDFFtzVazQfg4/image?node-id=2-892&t=G8yoX3l6vwSmlkFE-0`
- Primary node: `2:892`
- Metadata confirms:
  - left sidebar: `320px`
  - main region: `1260px`
  - right inspector: `340px`
  - page height sample: `1200px`

### Visual Characteristics

- 页面底色不是纯白，而是暖灰 `#f5f5f3` / `#fafafa` 系。
- 大部分边框采用暖灰 `#e8e8e5`，而不是当前的 slate 边框体系。
- 左栏和右栏是整栏面，不是浮动卡片。
- 主区 header 为 sticky，带轻微毛玻璃和底部边框。
- 主标题、右栏标题使用 `Playfair Display` 风格衬线展示感；正文、表单、标签和辅助文案使用 `Roboto` / Noto Sans 体系。
- 输入和下拉采用 9999px 胶囊或轻圆角线框，阴影极轻。
- 结果卡是低阴影、浅描边、白底编辑卡，不是当前厚重 panel。

## Chosen Approach

### A. High-Fidelity Rebuild

采用高保真方案，直接对现有 `OptionsApp` 的 DOM 结构进行定向重排与样式重写，使页面整体视觉语言对齐 Figma，同时尽量不动状态逻辑和数据接口。

### Alternatives Considered

- `B` 半保真迁移：保留旧结构，仅替换 token。优点是改动小，缺点是无法产生明显的重设计效果。
- `C` 样式覆盖：只改 CSS。优点是最快，缺点是与 Figma 差距过大，无法满足“按设计文件完成重构”的要求。

选择 `A` 的原因很直接：用户已经明确反馈当前版本“基本没有变化”，说明此前的问题不是 token 不准，而是页面骨架和视觉重心都没有真正切过去。

## Layout Design

### Desktop

- 整体采用三列固定布局：
  - 左栏 `320px`
  - 中栏 `minmax(0, 1260px)`，居中承载 header 和 results
  - 右栏 `340px`
- 页面底色使用暖灰背景，左右栏固定高度，主区结果滚动。
- 左栏和右栏直接贴边，不再包在独立圆角 panel 中。

### Left Sidebar

左栏按 Figma 分成四个垂直区域：

- 顶部工作区摘要
  - `工作区 Workspace`
  - 成功状态 badge
  - 页面大标题 `书签`
  - 一段 2 行左右说明文案
  - 上次同步信息
  - 主操作按钮 `立即同步`
- 指标区
  - `总书签数`
  - `未分类`
  - 两个数字摘要并排
- 列表导航区
  - `列表 Lists`
  - 默认列表与用户列表
  - 新建列表入口
- 底部配置区
  - `偏好设置 Config`
  - `语言` / `主题` 两个紧凑选择控件

### Main Region

中栏由两部分组成：

- sticky header
  - `资料库 Archive` 小标题
  - 当前范围标题，例如 `全部书签`
  - 右上角结果数量
  - 一段简短描述
  - 一行搜索和两个筛选下拉
  - 一行筛选 chips
  - 一条结果统计与视图控制分隔栏
- results body
  - 结果卡双列流式排布
  - 底部保留分页或占位点

### Right Inspector

右栏保持整栏 aside，依次包含五个 section：

- `元数据 Metadata`
- `标签 Tags`
- `归档 Archival`
- `创建标签 Create`
- `标签库 Library`

每段之间使用明确的垂直节奏和标题下边线，而不是卡片式二次包裹。

## Typography

### Heading System

- 左栏主标题 `书签`：
  - `Playfair Display`, serif fallback
  - 约 `48px`
  - 常规字重
  - 紧凑行高
- 中栏标题 `全部书签`：
  - `Playfair Display`
  - `36px`
  - 常规字重
- 右栏标题 `详情`：
  - `Playfair Display`
  - `30px`
  - 常规字重

### Editorial Labels

- overline / section kicker:
  - `Roboto` / `Noto Sans SC`
  - `10px` 到 `11px`
  - `700`
  - `uppercase`
  - `letter-spacing: 0.16em` 到 `0.2em`
  - 颜色 `#a3a3a3`

### Body Copy

- 主体说明文案、列表项、标签、输入文本：
  - `Roboto` / `Noto Sans SC`
  - `12px` 到 `13px`
  - 常规字重
  - 颜色 `#737373` / `#1a1a1a`

## Component Design

### Buttons

- 左栏同步按钮
  - 深色填充、白字
  - 高度约 `44px`
  - 圆角 `4px`
- 右栏创建按钮
  - 蓝色填充 `#4285f4` 邻近值
  - 高度约 `44px`
  - 圆角 `6px`
- 其余轻操作按钮使用线框或浅灰背景，不保留现有强玻璃按钮风格。

### Inputs And Selects

- 中栏搜索框：
  - 白底
  - `1px` 暖灰边框
  - `9999px` 胶囊圆角
  - 高度 `42px`
  - 极轻投影
- 中栏筛选下拉：
  - 与搜索框同一外观语言
  - 宽度约 `192px`
- 右栏输入 / 下拉：
  - 以底边线或浅边框为主
  - 不使用厚背景块

### Tags And Badges

- 右栏已附加标签改为暖灰小 pill，`32px` 高，轻描边。
- 左栏状态 badge 保持极紧凑圆角胶囊。
- 中栏 chips 使用小尺寸边框 pills，不再使用当前偏蓝的大胶囊。

### Result Cards

- 卡片宽度按双列布局适配。
- 白底，轻边框，极浅阴影。
- 顶部媒体区或文本预览区使用浅灰底。
- 元数据层级更扁平：
  - 作者
  - 时间
  - 摘要
  - 列表 / 标签
- 选中态使用轻蓝描边与背景，不使用厚重高光。

## Data And Behavior

本次重构不改变以下逻辑：

- `useWorkspaceData` 返回的数据结构与调用方式
- 筛选、搜索、排序、选择、批量操作逻辑
- 列表创建、标签附加、主列表归档、创建标签逻辑
- 主题切换和语言切换逻辑

允许的实现层改动：

- 重新组织 JSX 容器与 className
- 调整区块顺序和包裹层级
- 新增 Figma 对齐的语义类名
- 更新与 DOM 结构绑定的测试

## Error Handling

- `loading` 仍保留，但骨架形态要映射三栏新布局。
- `empty` 状态改成更轻的文本空态，不再依赖旧 panel。
- `error` 内联提示条继续保留，颜色系统映射到新暖灰界面，不做玻璃处理。
- 没有选中书签时，右栏显示空态说明，但保持整栏结构不坍塌。

## Theme Mapping

### Light

- page background: `#f5f5f3`
- main surface: `#fafafa`
- sidebar / inspector: `#ffffff`
- border: `#e8e8e5`
- primary text: `#1a1a1a`
- secondary text: `#737373`
- tertiary label: `#a3a3a3`
- accent blue: `#4285f4`

### Dark

dark 只做结构映射，不改信息组织：

- page background 映射为低饱和深灰棕，不用纯黑。
- main surface 映射为略亮一级的深色面。
- border 映射为低对比深灰线。
- serif heading 保留，但文字提亮到可读范围。
- 搜索框、下拉、结果卡、右栏分段仍保持与浅色一致的密度、圆角和区块顺序。
- 蓝色 CTA 保持同一语义，只略微提亮 hover 对比度。

### System

- `system` 继续只是运行时选择 light 或 dark token。
- 不出现额外布局分支。

## Files In Scope

- `apps/extension/src/options/OptionsApp.tsx`
- `apps/extension/src/styles/extension.css`
- `apps/extension/src/ui/components.tsx`
- `apps/extension/tests/options/OptionsApp.test.tsx`

如有必要，可小范围调整：

- `apps/extension/src/ui/theme.ts`

## Testing Strategy

- 先跑聚焦测试：
  - `npm --workspace @xbm/extension exec -- tsx --test tests/options/OptionsApp.test.tsx`
- 再跑全量验证：
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

验证重点不是只看通过，而是确认：

- `options` 页 DOM 结构仍被测试正确命中
- 主题切换仍可工作
- 右栏操作链路不回归
- 新样式类不会影响 popup

## Risks

- 现有 `OptionsApp.tsx` 文件较大，重排容器时容易引入 class 失配。
- `extension.css` 里有共享类，必须避免把 popup 一起拉进新审美。
- 如果只改色不改 DOM，无法达到目标；如果重排太猛，测试会集中失败。
- serif 标题在中文环境下需要合理 fallback，避免字形突兀。

## Success Criteria

- reload 后，用户能一眼看出页面已经切到 Figma 所示的暖灰编辑式三栏。
- 左栏、主区、右栏的宽度、层级和节奏与 Figma 明显一致。
- 中栏 header、搜索区、chips、结果卡、右栏五段式 inspector 都已按设计重建。
- `light` 为高保真基准，`dark` 为可读的同构映射。
- 所有既有功能和验证命令保持通过。
