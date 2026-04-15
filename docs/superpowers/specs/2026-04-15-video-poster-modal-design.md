# Video Poster Modal Design

## Goal

调整书签详情抽屉中的视频媒体交互，使其与图片媒体保持一致：

- 抽屉中只展示视频封面预览
- 点击封面后进入居中的媒体 modal
- 真正的视频播放只发生在 modal 中

要求：

- 不再在右侧 drawer 内直接播放视频
- 视频和图片共享“媒体单独一层”的交互原则
- 保留当前图片 modal 预览能力
- 保留关闭后回到原抽屉上下文的行为

## Current Problem

当前视频媒体在详情抽屉中直接用 `<video controls>` 播放。

这会带来两个问题：

- 用户的视线中心被拉到右侧，不利于沉浸式观看
- 图片和视频的媒体交互模型不一致

同时，当前媒体数据模型只保留了一个 `url` 字段。

在视频场景下，这实际上混合了两种不同语义：

- 视频封面图 URL
- 视频可播放源 URL

这会让 UI 层很难稳定地区分“预览图”和“播放源”。

## Design Summary

将视频媒体改成与图片一致的双层模式：

1. 抽屉内只展示静态封面预览
2. 点击封面进入媒体 modal
3. modal 内渲染真正的视频播放器

为支持这个交互，媒体数据模型需要显式区分：

- `url`: 实际播放源
- `posterUrl`: 静态封面图

## Data Model

当前：

- `media?: Array<{ type: string; url: string; altText?: string }>`

建议改为：

- `media?: Array<{ type: string; url: string; posterUrl?: string; altText?: string }>`

字段含义：

- `type`
  - `photo`
  - `video`
  - `animated_gif`
- `url`
  - 图片时为图片地址
  - 视频时为实际可播放的 mp4 地址
- `posterUrl`
  - 视频/动图时的静态封面图地址
  - 图片可为空

## Parsing Strategy

### Photo

图片媒体保持现有逻辑：

- `url = media_url_https`

### Video

视频媒体解析规则：

- `posterUrl = media_url_https`
- `url = video_info.variants` 中最佳的 `video/mp4`

“最佳”定义为：

- 过滤出 `content_type === "video/mp4"` 且 `url` 存在的 variant
- 按 `bitrate` 降序选择最高码率
- 若无 mp4 variant，则回退到现有 poster URL，避免数据为空

### Animated GIF

建议和视频同样处理：

- `posterUrl = media_url_https`
- `url = video_info.variants` 中最佳 `video/mp4`

原因：

- X 的 gif 实际上通常也是视频流
- 交互上更接近“可播放媒体”而不是静态图片

## UI Behavior

### Drawer Preview

#### Image

保持现状：

- 在抽屉中展示图片预览
- 点击进入 modal

#### Video

改为：

- 抽屉中不再渲染 `<video controls>`
- 展示 `posterUrl` 作为静态封面
- 封面上可以保留一个轻量播放图标，提示这是视频
- 点击后进入 modal 播放

### Modal

#### Image

保持现状：

- 继续渲染图片预览 modal

#### Video

改为：

- modal 中渲染 `<video controls>`
- 视觉中心居中
- 用户在 modal 中完成播放、暂停、拖动、全屏

### Close Behavior

关闭媒体 modal 后：

- 回到原来的详情抽屉
- 保留当前选中书签
- 不丢失列表滚动位置

## List Card Preview

列表卡片中的视频预览也建议统一为封面图，而不是直接嵌入 `<video>`。

原因：

- 列表卡片的主要任务是浏览，不是播放
- 自动展示 `<video>` 会增加噪音和资源消耗
- 与抽屉内“封面预览，modal 播放”的模型保持一致更稳

因此建议：

- 视频卡片优先用 `posterUrl`
- 若缺少 `posterUrl`，再回退到当前 `url`

## Why This Approach

### Better Visual Focus

视频播放属于沉浸式媒体行为。

让它发生在 drawer 内，会把注意力压缩在页面右侧狭窄区域，不适合观看。

### Consistent Mental Model

媒体交互统一成：

- 预览在内容面板
- 播放/大图在 modal

用户更容易理解，也更容易形成稳定预期。

### Cleaner Data Semantics

把 `posterUrl` 和 `url` 分开后：

- UI 不必猜哪个字段是图，哪个字段是视频
- 后续扩展媒体展示会更稳定

## Non-Goals

本次不做：

- 自动播放视频
- 自定义复杂播放器 UI
- 在 drawer 中内联播放视频
- 新增独立视频详情页
- 为图片额外增加数据字段

## Risks

### Missing Poster

部分视频媒体可能缺少可靠 poster。

缓解方式：

- 优先使用 `media_url_https`
- 若缺失，再回退到 `url`

### Variant Availability

部分媒体可能没有标准 mp4 variant。

缓解方式：

- 没有 mp4 时回退到原地址
- 保持解析结果不为空

### Animated GIF Semantics

如果后续用户认为 gif 不应走视频 modal，这需要单独再收敛。

当前设计默认 gif 和视频同类处理，以减少分支复杂度。

## Testing Strategy

至少覆盖：

- 视频媒体解析时同时拿到 `url` 和 `posterUrl`
- `url` 选择最高码率 mp4 variant
- 抽屉内视频展示封面，不直接渲染播放器
- 点击视频封面后打开 modal
- modal 中渲染 `<video controls>`
- 关闭 modal 后仍回到原抽屉
- 列表卡片中的视频使用封面图而非播放器

## Implementation Order

1. 扩展媒体数据模型，增加 `posterUrl`
2. 更新 X 书签解析逻辑，区分视频播放源和封面图
3. 调整列表卡片媒体预览逻辑
4. 调整 drawer 中的视频展示为封面预览
5. 调整 modal 中的视频播放逻辑
6. 补解析层和 UI 测试
