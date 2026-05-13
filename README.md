# 考研数学题库

一个基于纯前端的考研数学选择题练习工具，支持上一题/下一题导航、分类筛选、答案解析、计分统计，以及自定义题目上传。

## 功能特性

- **答题练习**：选择题作答，即时反馈正确/错误
- **导航操作**：上一题 / 下一题，支持键盘快捷键（左右箭头）
- **分类筛选**：按高等数学、线性代数、概率统计分类
- **答案解析**：每题配有详细解析说明
- **统计面板**：实时显示正确数、错误数、正确率
- **结果总结**：完成所有题目后展示综合评分
- **自定义题目**：支持上传 JSON 格式题目文件替换题库
- **数学公式**：支持 LaTeX 数学公式渲染（MathJax）

## 快速开始

1. 克隆仓库或下载文件
2. 直接打开 `index.html` 即可使用（无需服务器）

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

## 技术栈

- HTML5 + CSS3 + Vanilla JavaScript
- [MathJax 3](https://www.mathjax.org/) - LaTeX 公式渲染
- 无任何框架依赖，纯静态页面

## 文件结构

```
├── index.html        # 主页面
├── style.css         # 样式文件
├── script.js         # 交互逻辑
├── questions.json    # 题目数据（可替换）
└── README.md         # 项目说明
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
