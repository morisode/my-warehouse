# 考研数学题库

一个基于纯前端的考研数学选择题练习工具，支持拍照/上传添加题目、图片题目显示、LaTeX 公式渲染、离线使用。

## 功能特性

- **答题练习**：选择题作答，即时反馈正确/错误
- **拍照添加**：拍照或从相册选择图片作为题目，高清显示原图
- **图片题目**：无需手动输入，确认已看即可，不影响正确率统计
- **导航操作**：上一题 / 下一题，支持键盘快捷键（左右箭头）
- **分类筛选**：按高等数学、线性代数、概率统计分类
- **答案解析**：每题配有详细解析说明
- **统计面板**：实时显示正确数、错误数、正确率
- **做题记忆**：记录每道题的历史做题次数和正确率
- **题目持久化**：自定义题目保存在 IndexedDB，关闭浏览器不丢失
- **自定义题目**：支持上传 JSON 格式题目文件追加或替换题库
- **PWA 支持**：可添加到主屏幕，支持离线使用
- **自定义背景**：拍照或上传图片作为网站背景

## 快速开始

### 在线使用（推荐）

1. 打开 GitHub Pages 链接
2. 在手机浏览器中点击「添加到主屏幕」
3. 像原生 App 一样使用，支持离线

### 本地使用

1. 克隆仓库
2. 直接打开 `index.html` 即可使用

> **注意**：拍照功能需要在 HTTPS 或 localhost 环境下才能使用摄像头权限。

## 自定义题目格式

上传的 JSON 文件需遵循以下格式：

```json
{
  "title": "题库名称",
  "questions": [
    {
      "id": 1,
      "category": "高等数学",
      "subCategory": "极限与连续",
      "difficulty": "基础",
      "question": "题目内容（支持 LaTeX）",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": 0,
      "explanation": "答案解析说明"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 题目唯一编号 |
| `category` | string | 学科分类（高等数学/线性代数/概率论与数理统计） |
| `subCategory` | string | 子分类 |
| `difficulty` | string | 难度等级（基础/中等/较难） |
| `question` | string | 题目内容，支持 LaTeX 语法 |
| `options` | string[] | 选项数组，固定4个选项 |
| `answer` | number | 正确答案索引（0-3） |
| `explanation` | string | 答案解析 |

## 部署到 GitHub Pages

1. 将所有文件推送到仓库的 `main` 分支
2. 进入仓库 Settings → Pages
3. Source 选择 `main` 分支，目录选 `/` (root)
4. 保存后等待部署完成，访问 `https://<username>.github.io/<repo-name>/`

## 技术栈

- HTML5 + CSS3 + Vanilla JavaScript
- [KaTeX](https://katex.org/) - LaTeX 公式渲染
- IndexedDB - 自定义题目持久化存储
- Service Worker - 离线缓存
- Web App Manifest - PWA 支持

## 文件结构

```
├── index.html          # 主页面
├── style.css           # 样式文件
├── script.js           # 交互逻辑
├── questions.json      # 题目数据（可替换）
├── manifest.json       # PWA 配置
├── sw.js               # Service Worker（离线缓存）
├── icon-192x192.png    # PWA 图标
├── icon-512x512.png    # PWA 图标
└── README.md           # 项目说明
```

## 键盘快捷键

| 按键 | 功能 |
|------|------|
| ← | 上一题 |
| → | 下一题 |
| 1/A | 选择选项 A |
| 2/B | 选择选项 B |
| 3/C | 选择选项 C |
| 4/D | 选择选项 D |
| Esc | 关闭弹窗 |

## 管理面板

长按页面标题「考研数学题库」3 秒可打开管理面板，包含：
- 访问统计和答题统计
- 自定义背景设置
- 重置统计数据
- 清空做题历史
- 清除自定义题目
