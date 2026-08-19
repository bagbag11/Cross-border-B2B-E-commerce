# UI 设计指南

> **设计类型**: App 设计（应用架构设计）
> **确认检查**: 本指南适用于可交互的应用/网站/工具。

> ℹ️ Section 1 为设计意图与决策上下文。Code agent 实现时以 Section 2 及之后的具体参数为准。

## 1. Design Archetype (设计原型)

### 1.1 内容理解

- **目标用户**: B2B 跨境电商物流运营与专员，高频处理多源报价表（邮政/专线/FBA），需快速询价比对与批量维护复杂规则
- **核心目的**: 将异构Excel数据转化为结构化决策依据，秒级匹配最优路线并精准管理计费明细
- **情绪基调**: 精密、笃定 / 避免数据歧义、视觉噪点

### 1.2 设计方向

- **Design Style**: Grid 网格 — 适配高密度物流数据与多维计费规则，sharp 圆角 + 紧凑间距强化专业工具的秩序感
- **Application Type**: SaaS/Admin — 询价工作台（左右分栏）+ 线路管理后台（列表+抽屉）双模式
- **Aesthetic Direction**: 理性蓝灰基底，等宽数字对齐，金色仅作为推荐决策的视觉锚点

## 2. Color System (色彩系统)

**色彩关系**: 品牌蓝 #1A73E8 主色 + 冷灰白底 + 深墨文字 + 金色 #F9AB00 仅限推荐徽章
**配色设计理由**: B2B 物流工具需传递专业可靠感，蓝色系建立信任，冷灰底减少长时间数据阅读的视觉疲劳
**主色推导**: Primary 蓝对应「立即询价」核心行动与高亮报价数据，直接关联用户决策路径
**使用比例**: 60% 中性灰白底色 / 30% 蓝灰辅助层 / 10% Primary 蓝 + <1% 金色徽章点缀

### 2.1 主题颜色

| Token                | HSL 值                  | 说明                                     |
| -------------------- | ----------------------- | ---------------------------------------- |
| `background`         | hsl(210, 20%, 98%)      | 页面底色，冷灰白减少长时间使用疲劳       |
| `card`               | hsl(0, 0%, 100%)        | 卡片/容器背景                            |
| `foreground`         | hsl(215, 25%, 15%)      | 主文字，深墨蓝确保可读性                 |
| `muted-foreground`   | hsl(215, 15%, 50%)      | 次要文字与表单标签                       |
| `primary`            | hsl(213, 78%, 51%)      | 主交互色，对应 #1A73E8                   |
| `primary-foreground` | hsl(0, 0%, 100%)        | 主交互文字/图标                          |
| `accent`             | hsl(213, 30%, 95%)      | 次级交互反馈（hover/focus/骨架屏背景）   |
| `accent-foreground`  | hsl(215, 25%, 25%)      | accent 上的文字/图标                     |
| `border`             | hsl(215, 20%, 88%)      | 边框与分隔线                             |

### 2.2 导航区配色

- **基调关系**: 复用主配色系统，顶部导航栏使用 `bg-card` + 底部细线分隔
- **关键状态**: 激活态使用 `text-primary` + `border-b-2 border-primary`；Hover 使用 `bg-accent`
- **边界与背景**: 非透明白色背景，底部 `border-border` 分隔内容区

### 2.3 语义颜色

| 用途     | HSL 值             | 衍生说明                             |
| -------- | ------------------ | ------------------------------------ |
| 成功/启用 | hsl(145, 63%, 42%) | 绿色系，启用状态圆点与成功 Toast     |
| 警告/校验 | hsl(38, 92%, 50%)  | 橙黄系，表单校验提示大字号使用       |
| 错误/禁用 | hsl(0, 72%, 51%)   | 红色系，必填缺失与删除确认           |
| 推荐徽章 | hsl(40, 96%, 53%)  | 金色 #F9AB00，仅用于🏆综合推荐徽章  |

## 3. Typography (字体排版)

- **Heading**: Inter, "PingFang SC", "Microsoft YaHei", sans-serif
- **Body**: Inter, "PingFang SC", "Microsoft YaHei", sans-serif
- **数字/代码**: Roboto Mono, "SF Mono", Consolas, monospace（报价、重量段、尺寸、时效等数值字段）
- **字体策略**: 西文 Inter 保证屏幕渲染清晰度，中文回退苹方/微软雅黑；数值强制等宽字体确保表格列对齐与扫描效率

## 4. Layout Strategy (布局策略)

- **导航意图**: 轻量 Topbar 导航，仅两个页面切换；非透明背景 + 底部分隔线；移动端折叠为汉堡菜单
- **页面架构**: 工作台左右分栏（40%/60%），管理页全宽表格；统一 `max-w-[1400px]` 居中容器
- **响应式**: 移动端工作台改为上下堆叠，表单在上结果在下；管理页表格横向滚动保持数据完整性

## 5. Visual Language (视觉语言)

- **形态参数**: 圆角 `rounded-sm (2px)` · 阴影 `shadow-sm` · 间距基调 `compact`
- **识别签名**: 报价数字 `text-2xl font-bold tabular-nums`；推荐卡片左侧 3px primary 色条；启用状态绿/灰圆点直径 8px
- **装饰策略**: 仅在推荐徽章使用金色描边；其余区域零装饰，依靠排版密度与留白建立层次
- **动效原则**: 结果卡片 staggered fade-in 200ms；开关切换 color transition 200ms；禁用行斜纹遮罩即时生效
- **可及性**: 对比度 ≥ 4.5:1；Focus 环 `ring-2 ring-primary/40`；表单错误态同时使用颜色+文字双重反馈

## 6. Component Principles (组件原则)

- **状态完整性**: Button/Input/Switch/Card 覆盖 Default/Hover/Active/Focus/Disabled；Switch 带 200ms 过渡动画
- **层级清晰**: Primary 按钮填充蓝底白字，Secondary 按钮 `border-primary text-primary bg-transparent`；表单标签 `text-sm font-medium text-muted-foreground`
- **一致性**: 表格行高统一 `h-12`；卡片内边距 `p-5`；数值字段右对齐并使用等宽字体；抽屉 Tab 切换无页面刷新

## 7. Image Direction (图片与视觉资产)

- **Image Role**: 空状态插画（询价无匹配线路时的引导视觉）
- **Image Art Direction**: 扁平线条风格，物流集装箱/地球路径抽象图形，蓝灰色调为主点缀少量金色，无阴影无渐变，传达"暂时未找到但可调整"的温和感
- **Image Prompt Keywords**: flat line art, logistics container, globe route, blue grey palette, minimal, no shadow, clean vector style, muted gold accent, white background, friendly tone
- **Image Avoidance**: 通用商务人物握手图、3D 渲染科技球、复杂渐变背景、含文字标签的插图

## 8. 应避免 (Anti-patterns)

- ❌ 大面积金色或渐变用于非推荐场景，破坏 B2B 专业克制感
- ❌ 表格/表单使用大圆角（≥8px）或重阴影，削弱数据工具的精密感
- ❌ 管理页添加统计卡片/Recent Activity 等模板噪音，偏离概要设计的纯列表+抽屉结构